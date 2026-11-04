import { describe, expect, it } from "vitest";
import { ClaudeCodeReader } from "../../src/ingest/claudeCodeReader.js";
import type { LineReader } from "../../src/core/reader.js";

// ── Mock LineReader ────────────────────────────────────────────────────────

function mockReader(lines: string[]): LineReader {
  return {
    async *readLines(_path: string) {
      for (const line of lines) yield line;
    },
  };
}

const reader = new ClaudeCodeReader();

// ── Fixtures (anonymized) ──────────────────────────────────────────────────

const SUMMARY_LINE = JSON.stringify({
  type: "summary",
  sessionId: "sess-abc123",
  timestamp: "2026-11-01T10:00:00.000Z",
});

const ASSISTANT_LINE = JSON.stringify({
  type: "assistant",
  uuid: "turn-001",
  timestamp: "2026-11-01T10:00:05.000Z",
  message: {
    id: "msg-001",
    role: "assistant",
    model: "claude-sonnet-4-6",
    usage: {
      input_tokens: 500,
      output_tokens: 120,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 50,
    },
    content: [],
  },
});

const ASSISTANT_WITH_MCP = JSON.stringify({
  type: "assistant",
  uuid: "turn-002",
  timestamp: "2026-11-01T10:00:10.000Z",
  message: {
    id: "msg-002",
    role: "assistant",
    model: "claude-sonnet-4-6",
    usage: { input_tokens: 300, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    content: [
      { type: "tool_use", id: "tc-001", name: "mcp__github__search_code" },
      { type: "tool_use", id: "tc-002", name: "bash" },
    ],
  },
});

const ASSISTANT_WITH_HYPHEN_SERVER = JSON.stringify({
  type: "assistant",
  uuid: "turn-003",
  timestamp: "2026-11-01T10:00:15.000Z",
  message: {
    id: "msg-003",
    role: "assistant",
    model: "claude-sonnet-4-6",
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    content: [
      { type: "tool_use", id: "tc-003", name: "mcp__my-server__do_thing" },
    ],
  },
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ClaudeCodeReader", () => {
  it("identifies itself as claude-code", () => {
    expect(reader.agent).toBe("claude-code");
  });

  it("returns an empty session for an empty file", async () => {
    const result = await reader.read("any.jsonl", mockReader([]));
    expect(result.session.turns).toHaveLength(0);
    expect(result.skippedLines).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("picks up sessionId from a summary line", async () => {
    const result = await reader.read("any.jsonl", mockReader([SUMMARY_LINE]));
    expect(result.session.id).toBe("sess-abc123");
  });

  it("sets startedAt from the summary line timestamp", async () => {
    const result = await reader.read("any.jsonl", mockReader([SUMMARY_LINE]));
    expect(result.session.startedAt.toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });

  it("parses a single assistant turn", async () => {
    const result = await reader.read("any.jsonl", mockReader([SUMMARY_LINE, ASSISTANT_LINE]));
    expect(result.session.turns).toHaveLength(1);
    const turn = result.session.turns[0];
    expect(turn.id).toBe("turn-001");
    expect(turn.model).toBe("claude-sonnet-4-6");
    expect(turn.index).toBe(0);
  });

  it("maps token usage correctly", async () => {
    const result = await reader.read("any.jsonl", mockReader([ASSISTANT_LINE]));
    const turn = result.session.turns[0];
    expect(turn.usage.inputTokens).toBe(500);
    expect(turn.usage.outputTokens).toBe(120);
    expect(turn.usage.cacheReadTokens).toBe(200);
    expect(turn.usage.cacheWriteTokens).toBe(50);
  });

  it("accumulates usage across multiple turns", async () => {
    const result = await reader.read("any.jsonl", mockReader([ASSISTANT_LINE, ASSISTANT_WITH_MCP]));
    expect(result.session.usage.inputTokens).toBe(800);
    expect(result.session.usage.outputTokens).toBe(200);
  });

  it("sets turn index incrementally", async () => {
    const result = await reader.read("any.jsonl", mockReader([ASSISTANT_LINE, ASSISTANT_WITH_MCP]));
    expect(result.session.turns[0].index).toBe(0);
    expect(result.session.turns[1].index).toBe(1);
  });

  it("deduplates models across turns", async () => {
    const result = await reader.read("any.jsonl", mockReader([ASSISTANT_LINE, ASSISTANT_WITH_MCP]));
    expect(result.session.models).toEqual(["claude-sonnet-4-6"]);
  });

  it("sets endedAt to the last assistant turn timestamp", async () => {
    const result = await reader.read("any.jsonl", mockReader([SUMMARY_LINE, ASSISTANT_LINE, ASSISTANT_WITH_MCP]));
    expect(result.session.endedAt?.toISOString()).toBe("2026-11-01T10:00:10.000Z");
  });

  it("parses MCP tool calls and sets mcpServer", async () => {
    const result = await reader.read("any.jsonl", mockReader([ASSISTANT_WITH_MCP]));
    const toolCalls = result.session.turns[0].toolCalls;
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].mcpServer).toBe("github");
    expect(toolCalls[0].toolLocalName).toBe("search_code");
    expect(toolCalls[0].toolName).toBe("mcp__github__search_code");
  });

  it("sets mcpServer to null for non-MCP tools", async () => {
    const result = await reader.read("any.jsonl", mockReader([ASSISTANT_WITH_MCP]));
    const bash = result.session.turns[0].toolCalls[1];
    expect(bash.mcpServer).toBeNull();
    expect(bash.toolLocalName).toBe("bash");
  });

  it("handles MCP server names with hyphens", async () => {
    const result = await reader.read("any.jsonl", mockReader([ASSISTANT_WITH_HYPHEN_SERVER]));
    const tc = result.session.turns[0].toolCalls[0];
    expect(tc.mcpServer).toBe("my-server");
    expect(tc.toolLocalName).toBe("do_thing");
  });

  it("skips and counts malformed JSON lines", async () => {
    const result = await reader.read("any.jsonl", mockReader([
      SUMMARY_LINE,
      "not valid json {{",
      ASSISTANT_LINE,
    ]));
    expect(result.skippedLines).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.session.turns).toHaveLength(1);
  });

  it("skips lines with no type field", async () => {
    const noType = JSON.stringify({ sessionId: "x", timestamp: "2026-01-01T00:00:00Z" });
    const result = await reader.read("any.jsonl", mockReader([noType, ASSISTANT_LINE]));
    expect(result.skippedLines).toBe(1);
    expect(result.session.turns).toHaveLength(1);
  });

  it("skips unknown line types without crashing", async () => {
    const unknown = JSON.stringify({ type: "user", content: "hello" });
    const result = await reader.read("any.jsonl", mockReader([unknown, ASSISTANT_LINE]));
    expect(result.skippedLines).toBe(1);
    expect(result.session.turns).toHaveLength(1);
  });

  it("skips blank lines silently (not counted as skipped)", async () => {
    const result = await reader.read("any.jsonl", mockReader(["", "   ", ASSISTANT_LINE]));
    expect(result.skippedLines).toBe(0);
    expect(result.session.turns).toHaveLength(1);
  });

  it("skips assistant lines missing a message id", async () => {
    const noId = JSON.stringify({
      type: "assistant",
      uuid: "turn-x",
      message: { role: "assistant", model: "claude-sonnet-4-6", usage: {} },
    });
    const result = await reader.read("any.jsonl", mockReader([noId]));
    expect(result.skippedLines).toBe(1);
    expect(result.session.turns).toHaveLength(0);
  });

  it("sets agent to claude-code on the session", async () => {
    const result = await reader.read("any.jsonl", mockReader([]));
    expect(result.session.agent).toBe("claude-code");
  });
});
