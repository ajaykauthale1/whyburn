/**
 * TranscriptReader implementation for Claude Code `.jsonl` transcripts.
 */

import type { Session, Turn, ToolCall, Usage } from "../core/types.js";
import { parseMcpToolName, zeroUsage } from "../core/types.js";
import type { LineReader, ReadResult, TranscriptReader } from "../core/reader.js";

// ── Raw JSONL line shapes (Claude Code format) ─────────────────────────────

interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface RawMessage {
  id?: string;
  role?: string;
  model?: string;
  usage?: RawUsage;
  content?: Array<{ type?: string; id?: string; name?: string }>;
}

interface RawLine {
  type?: string;
  sessionId?: string;
  uuid?: string;
  timestamp?: string;
  message?: RawMessage;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mapUsage(raw: RawUsage | undefined): Usage {
  if (!raw) return zeroUsage();
  return {
    inputTokens: raw.input_tokens ?? 0,
    outputTokens: raw.output_tokens ?? 0,
    cacheReadTokens: raw.cache_read_input_tokens ?? 0,
    cacheWriteTokens: raw.cache_creation_input_tokens ?? 0,
  };
}

function mapToolCalls(
  turnId: string,
  content: RawMessage["content"],
): ToolCall[] {
  if (!content) return [];
  const calls: ToolCall[] = [];
  for (const block of content) {
    if (block.type !== "tool_use" || !block.id || !block.name) continue;
    const parsed = parseMcpToolName(block.name);
    calls.push({
      id: block.id,
      turnId,
      toolName: block.name,
      mcpServer: parsed?.mcpServer ?? null,
      toolLocalName: parsed?.toolLocalName ?? block.name,
      success: true,
    });
  }
  return calls;
}

function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

// ── Implementation ─────────────────────────────────────────────────────────

export class ClaudeCodeReader implements TranscriptReader {
  readonly agent = "claude-code";

  async read(filePath: string, lineReader: LineReader): Promise<ReadResult> {
    let sessionId = "";
    let startedAt: Date | null = null;
    let endedAt: Date | null = null;
    const modelsSet = new Set<string>();
    let totalUsage: Usage = zeroUsage();
    const turns: Turn[] = [];
    let skippedLines = 0;
    const errors: string[] = [];
    let turnIndex = 0;

    for await (const raw of lineReader.readLines(filePath)) {
      const line = raw.trim();
      if (!line) continue;

      let parsed: RawLine;
      try {
        parsed = JSON.parse(line) as RawLine;
      } catch (e) {
        skippedLines++;
        errors.push(`JSON parse error: ${String(e)}`);
        continue;
      }

      if (!parsed.type) {
        skippedLines++;
        continue;
      }

      const ts = parsed.timestamp ? new Date(parsed.timestamp) : null;

      if (parsed.type === "summary") {
        if (parsed.sessionId) sessionId = parsed.sessionId;
        if (ts && !startedAt) startedAt = ts;
        continue;
      }

      if (parsed.type === "assistant" && parsed.message) {
        const msg = parsed.message;
        if (!msg.id) { skippedLines++; continue; }

        const model = msg.model ?? "unknown";
        modelsSet.add(model);

        const usage = mapUsage(msg.usage);
        totalUsage = addUsage(totalUsage, usage);

        const turnId = parsed.uuid ?? msg.id;
        turns.push({
          id: turnId,
          sessionId,
          index: turnIndex++,
          model,
          usage,
          durationMs: null,
          toolCalls: mapToolCalls(turnId, msg.content),
        });

        if (ts) endedAt = ts;
        continue;
      }

      skippedLines++;
    }

    const session: Session = {
      id: sessionId,
      agent: this.agent,
      projectPath: null,
      startedAt: startedAt ?? new Date(0),
      endedAt,
      models: [...modelsSet],
      usage: totalUsage,
      costUsd: null,
      turns,
    };

    return { session, skippedLines, errors };
  }
}
