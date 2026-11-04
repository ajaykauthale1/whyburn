/**
 * TranscriptReader implementation for Claude Code `.jsonl` transcripts.
 *
 * Line types handled:
 *   assistant       — assistant turn; maps into Turn + ToolCall[]
 *                     IMPORTANT: one API call can produce multiple assistant lines
 *                     with the same message.id — dedupe by message.id to avoid
 *                     double-counting tokens and duplicate turns.
 *   system          — subtype "turn_duration" carries durationMs for the preceding turn
 *   cost-state      — session-level cost and per-model token totals
 *   user            — provides sessionId, cwd (projectPath); content is Tier C (ignored)
 *   (all others)    — counted as skipped, never crash
 *
 * Lines with isSidechain=true belong to subagents and are skipped;
 * subagent transcripts live in separate files.
 */

import type { Session, Turn, ToolCall, Usage } from "../core/types.js";
import { parseMcpToolName, zeroUsage } from "../core/types.js";
import type { LineReader, ReadResult, TranscriptReader } from "../core/reader.js";

// ── Raw JSONL line shapes ──────────────────────────────────────────────────

interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface RawContentBlock {
  type?: string;
  id?: string;
  name?: string;
}

interface RawMessage {
  id?: string;
  model?: string;
  usage?: RawUsage;
  content?: RawContentBlock[];
}

interface RawModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

interface RawLine {
  type?: string;
  sessionId?: string;
  uuid?: string;
  timestamp?: string;
  /** true for subagent turns — skip entirely; they live in separate files */
  isSidechain?: boolean;
  // assistant
  message?: RawMessage;
  // system
  subtype?: string;
  durationMs?: number;
  // user
  cwd?: string;
  // cost-state
  totalCostUSD?: number;
  modelUsage?: Record<string, RawModelUsage>;
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

function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

function mapToolCalls(turnId: string, content: RawContentBlock[] | undefined): ToolCall[] {
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

// ── Implementation ─────────────────────────────────────────────────────────

export class ClaudeCodeReader implements TranscriptReader {
  readonly agent = "claude-code";

  async read(filePath: string, lineReader: LineReader): Promise<ReadResult> {
    let sessionId = "";
    let projectPath: string | null = null;
    let startedAt: Date | null = null;
    let endedAt: Date | null = null;
    const modelsSet = new Set<string>();
    let totalUsage: Usage = zeroUsage();
    let costUsd: number | null = null;
    const turns: Turn[] = [];
    /** Deduplicates assistant lines by message.id — one API call can emit several. */
    const seenMessageIds = new Set<string>();
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

      // Skip subagent lines — they belong to separate files
      if (parsed.isSidechain) { skippedLines++; continue; }

      // sessionId is on nearly every line — grab it opportunistically
      if (parsed.sessionId && !sessionId) sessionId = parsed.sessionId;

      const ts = parsed.timestamp ? new Date(parsed.timestamp) : null;
      if (ts && !startedAt) startedAt = ts;

      switch (parsed.type) {
        case "user": {
          if (parsed.cwd && !projectPath) projectPath = parsed.cwd;
          break;
        }

        case "assistant": {
          const msg = parsed.message;
          if (!msg?.id) { skippedLines++; break; }

          // Dedupe: skip if we already processed this message.id
          if (seenMessageIds.has(msg.id)) { skippedLines++; break; }
          seenMessageIds.add(msg.id);

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
          break;
        }

        case "system": {
          if (parsed.subtype === "turn_duration" && typeof parsed.durationMs === "number") {
            const last = turns[turns.length - 1];
            if (last) last.durationMs = parsed.durationMs;
          }
          break;
        }

        case "cost-state": {
          if (typeof parsed.totalCostUSD === "number") costUsd = parsed.totalCostUSD;
          break;
        }

        default:
          skippedLines++;
      }
    }

    const session: Session = {
      id: sessionId,
      agent: this.agent,
      projectPath,
      startedAt: startedAt ?? new Date(0),
      endedAt,
      models: [...modelsSet],
      usage: totalUsage,
      costUsd,
      turns,
    };

    return { session, skippedLines, errors };
  }
}
