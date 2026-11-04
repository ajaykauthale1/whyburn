import { describe, expect, it } from "vitest";
import type { LineReader } from "../../src/core/reader.js";
import { ClaudeCodeReader } from "../../src/ingest/claudeCodeReader.js";

function mockReader(lines: string[]): LineReader {
  return {
    async *readLines(_path: string) {
      for (const l of lines) yield l;
    },
  };
}

const reader = new ClaudeCodeReader();

// ── Shared fixtures ────────────────────────────────────────────────────────

const USER_LINE = JSON.stringify({
  type: "user",
  uuid: "user-001",
  timestamp: "2026-11-01T10:00:00.000Z",
  message: { role: "user", content: "hello" },
  cwd: "D:\\workspaces\\myproject",
  sessionId: "sess-abc123",
  version: "2.1.0",
});

const ASST_TEXT = JSON.stringify({
  type: "assistant",
  uuid: "asst-001",
  timestamp: "2026-11-01T10:00:05.000Z",
  message: {
    id: "msg-001",
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text: "Sure." }],
    usage: {
      input_tokens: 500,
      output_tokens: 120,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 50,
    },
  },
  sessionId: "sess-abc123",
});

const SYS_DURATION = JSON.stringify({
  type: "system",
  subtype: "turn_duration",
  durationMs: 4800,
  uuid: "sys-001",
  timestamp: "2026-11-01T10:00:05.500Z",
  sessionId: "sess-abc123",
});

const ASST_TOOLS = JSON.stringify({
  type: "assistant",
  uuid: "asst-002",
  timestamp: "2026-11-01T10:00:12.000Z",
  message: {
    id: "msg-002",
    model: "claude-sonnet-5-5",
    content: [
      { type: "thinking", thinking: "...", signature: "sig" },
      { type: "tool_use", id: "tc-001", name: "mcp__github__search_code", input: {} },
      { type: "tool_use", id: "tc-002", name: "Bash", input: {} },
    ],
    usage: {
      input_tokens: 300,
      output_tokens: 80,
      cache_read_input_tokens: 900,
      cache_creation_input_tokens: 0,
    },
  },
  sessionId: "sess-abc123",
});

const COST_STATE = JSON.stringify({
  type: "cost-state",
  sessionId: "sess-abc123",
  totalCostUSD: 0.04812,
  modelUsage: { "claude-sonnet-5-5": { inputTokens: 800, outputTokens: 200 } },
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ClaudeCodeReader", () => {
  it("identifies itself as claude-code", () => {
    expect(reader.agent).toBe("claude-code");
  });

  it("returns an empty session for an empty file", async () => {
    const r = await reader.read("any.jsonl", mockReader([]));
    expect(r.session.turns).toHaveLength(0);
    expect(r.skippedLines).toBe(0);
  });

  it("picks up sessionId from the first line that has it", async () => {
    const r = await reader.read("any.jsonl", mockReader([USER_LINE]));
    expect(r.session.id).toBe("sess-abc123");
  });

  it("sets startedAt from the first timestamped line", async () => {
    const r = await reader.read("any.jsonl", mockReader([USER_LINE]));
    expect(r.session.startedAt.toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });

  it("sets projectPath from the first user line's cwd", async () => {
    const r = await reader.read("any.jsonl", mockReader([USER_LINE]));
    expect(r.session.projectPath).toBe("D:\\workspaces\\myproject");
  });

  it("parses a single assistant turn", async () => {
    const r = await reader.read("any.jsonl", mockReader([USER_LINE, ASST_TEXT]));
    expect(r.session.turns).toHaveLength(1);
    const t = r.session.turns[0];
    expect(t.id).toBe("asst-001");
    expect(t.model).toBe("claude-sonnet-5-5");
    expect(t.index).toBe(0);
  });

  it("maps token usage correctly", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TEXT]));
    const t = r.session.turns[0];
    expect(t.usage.inputTokens).toBe(500);
    expect(t.usage.outputTokens).toBe(120);
    expect(t.usage.cacheReadTokens).toBe(200);
    expect(t.usage.cacheWriteTokens).toBe(50);
  });

  it("attaches durationMs from the following system/turn_duration line", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TEXT, SYS_DURATION]));
    expect(r.session.turns[0].durationMs).toBe(4800);
  });

  it("leaves durationMs null when no system/turn_duration follows", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TEXT]));
    expect(r.session.turns[0].durationMs).toBeNull();
  });

  it("accumulates usage across multiple turns", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TEXT, ASST_TOOLS]));
    expect(r.session.usage.inputTokens).toBe(800);
    expect(r.session.usage.outputTokens).toBe(200);
  });

  it("sets turn index incrementally", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TEXT, ASST_TOOLS]));
    expect(r.session.turns[0].index).toBe(0);
    expect(r.session.turns[1].index).toBe(1);
  });

  it("deduplates models across turns", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TEXT, ASST_TOOLS]));
    expect(r.session.models).toEqual(["claude-sonnet-5-5"]);
  });

  it("sets endedAt to the last assistant turn timestamp", async () => {
    const r = await reader.read("any.jsonl", mockReader([USER_LINE, ASST_TEXT, ASST_TOOLS]));
    expect(r.session.endedAt?.toISOString()).toBe("2026-11-01T10:00:12.000Z");
  });

  it("parses MCP tool calls and sets mcpServer", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TOOLS]));
    const tcs = r.session.turns[0].toolCalls;
    expect(tcs).toHaveLength(2);
    expect(tcs[0].mcpServer).toBe("github");
    expect(tcs[0].toolLocalName).toBe("search_code");
  });

  it("sets mcpServer to null for non-MCP tools", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TOOLS]));
    const bash = r.session.turns[0].toolCalls[1];
    expect(bash.mcpServer).toBeNull();
    expect(bash.toolLocalName).toBe("Bash");
  });

  it("ignores thinking content blocks (not tool calls)", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TOOLS]));
    // thinking block must not appear as a tool call
    expect(r.session.turns[0].toolCalls.every((tc) => tc.toolName !== "thinking")).toBe(true);
  });

  it("reads costUsd from cost-state line", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TEXT, COST_STATE]));
    expect(r.session.costUsd).toBeCloseTo(0.04812);
  });

  it("leaves costUsd null when no cost-state line present", async () => {
    const r = await reader.read("any.jsonl", mockReader([ASST_TEXT]));
    expect(r.session.costUsd).toBeNull();
  });

  it("skips and counts malformed JSON lines", async () => {
    const r = await reader.read("any.jsonl", mockReader([USER_LINE, "not json {{", ASST_TEXT]));
    expect(r.skippedLines).toBe(1);
    expect(r.errors).toHaveLength(1);
    expect(r.session.turns).toHaveLength(1);
  });

  it("skips lines with no type field", async () => {
    const r = await reader.read(
      "any.jsonl",
      mockReader([JSON.stringify({ sessionId: "x" }), ASST_TEXT]),
    );
    expect(r.skippedLines).toBe(1);
  });

  it("skips unknown line types (mode, attachment, ai-title, etc.) without crashing", async () => {
    const lines = [
      JSON.stringify({ type: "mode", mode: "auto", sessionId: "sess-abc123" }),
      JSON.stringify({ type: "attachment", uuid: "att-1", sessionId: "sess-abc123" }),
      JSON.stringify({ type: "ai-title", aiTitle: "My session", sessionId: "sess-abc123" }),
      JSON.stringify({ type: "tools-used", tools: ["Bash"], sessionId: "sess-abc123" }),
      ASST_TEXT,
    ];
    const r = await reader.read("any.jsonl", mockReader(lines));
    expect(r.skippedLines).toBe(4);
    expect(r.session.turns).toHaveLength(1);
  });

  it("skips blank lines silently (not counted)", async () => {
    const r = await reader.read("any.jsonl", mockReader(["", "   ", ASST_TEXT]));
    expect(r.skippedLines).toBe(0);
    expect(r.session.turns).toHaveLength(1);
  });

  it("skips assistant lines missing a message id", async () => {
    const noId = JSON.stringify({
      type: "assistant",
      uuid: "x",
      message: { model: "claude-sonnet-5-5" },
      sessionId: "sess-abc123",
    });
    const r = await reader.read("any.jsonl", mockReader([noId]));
    expect(r.skippedLines).toBe(1);
    expect(r.session.turns).toHaveLength(0);
  });
});

describe("ClaudeCodeReader — dedup and sidechain", () => {
  const reader = new ClaudeCodeReader();

  it("deduplicates assistant lines with the same message.id — tokens counted once", async () => {
    // Two assistant lines share the same message.id (msg-dup). Only the first
    // should produce a turn; the second must be skipped so usage isn't doubled.
    const shared = {
      type: "assistant",
      uuid: "turn-dup",
      sessionId: "sess-dup",
      timestamp: "2025-07-01T10:00:00Z",
      message: {
        id: "msg-dup",
        model: "claude-sonnet-5-5",
        usage: { input_tokens: 100, output_tokens: 50 },
        content: [],
      },
    };
    const lines = [
      JSON.stringify(shared),
      JSON.stringify({ ...shared, uuid: "turn-dup-2" }), // same message.id, different uuid
    ];
    const r = await reader.read("any.jsonl", mockReader(lines));
    expect(r.session.turns).toHaveLength(1);
    expect(r.session.usage.inputTokens).toBe(100); // not 200
    expect(r.session.usage.outputTokens).toBe(50); // not 100
    expect(r.skippedLines).toBe(1);
  });

  it("skips lines with isSidechain: true", async () => {
    const sidechain = JSON.stringify({
      type: "assistant",
      uuid: "sub-turn",
      sessionId: "sess-main",
      isSidechain: true,
      message: {
        id: "msg-sub",
        model: "claude-sonnet-5-5",
        usage: { input_tokens: 200, output_tokens: 100 },
        content: [],
      },
    });
    const main = JSON.stringify({
      type: "assistant",
      uuid: "main-turn",
      sessionId: "sess-main",
      message: {
        id: "msg-main",
        model: "claude-sonnet-5-5",
        usage: { input_tokens: 50, output_tokens: 25 },
        content: [],
      },
    });
    const r = await reader.read("any.jsonl", mockReader([sidechain, main]));
    expect(r.session.turns).toHaveLength(1);
    expect(r.session.turns[0].id).toBe("main-turn");
    expect(r.session.usage.inputTokens).toBe(50); // sidechain tokens not counted
    expect(r.skippedLines).toBe(1);
  });
});
