import { describe, expect, it } from "vitest";
import type { Session, ToolCall, Turn, Usage } from "../../src/core/types.js";
import { aggregateMcpUsage } from "../../src/ingest/mcpAggregator.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

function makeTurn(id: string, sessionId: string, toolCalls: ToolCall[]): Turn {
  return {
    id,
    sessionId,
    index: 0,
    model: "claude-sonnet-5-5",
    usage: makeUsage(),
    durationMs: null,
    toolCalls,
  };
}

function makeToolCall(turnId: string, toolName: string): ToolCall {
  const isMcp = toolName.startsWith("mcp__");
  let mcpServer: string | null = null;
  let toolLocalName = toolName;
  if (isMcp) {
    const rest = toolName.slice("mcp__".length);
    const sep = rest.indexOf("__");
    mcpServer = rest.slice(0, sep);
    toolLocalName = rest.slice(sep + 2);
  }
  return { id: `tc-${toolName}`, turnId, toolName, mcpServer, toolLocalName, success: true };
}

function makeSession(id: string, turns: Turn[]): Session {
  return {
    id,
    agent: "claude-code",
    projectPath: "/home/user/proj",
    startedAt: new Date("2026-11-01T10:00:00Z"),
    endedAt: new Date("2026-11-01T10:05:00Z"),
    models: ["claude-sonnet-5-5"],
    usage: makeUsage(),
    costUsd: null,
    turns,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("aggregateMcpUsage", () => {
  it("returns an empty array when there are no sessions", () => {
    expect(aggregateMcpUsage([])).toEqual([]);
  });

  it("returns an empty array when no MCP tools were called", () => {
    const turn = makeTurn("t1", "s1", [makeToolCall("t1", "Bash")]);
    const session = makeSession("s1", [turn]);
    expect(aggregateMcpUsage([session])).toEqual([]);
  });

  it("counts a single MCP server call", () => {
    const turn = makeTurn("t1", "s1", [makeToolCall("t1", "mcp__github__search_code")]);
    const session = makeSession("s1", [turn]);
    const result = aggregateMcpUsage([session]);
    expect(result).toHaveLength(1);
    expect(result[0].server).toBe("github");
    expect(result[0].totalCalls).toBe(1);
    expect(result[0].sessionCount).toBe(1);
  });

  it("aggregates multiple calls to the same server in one session", () => {
    const turn = makeTurn("t1", "s1", [
      makeToolCall("t1", "mcp__github__search_code"),
      makeToolCall("t1", "mcp__github__get_file"),
      makeToolCall("t1", "mcp__github__search_code"),
    ]);
    const session = makeSession("s1", [turn]);
    const [row] = aggregateMcpUsage([session]);
    expect(row.totalCalls).toBe(3);
    expect(row.sessionCount).toBe(1);
  });

  it("counts distinct sessions for a server across multiple sessions", () => {
    const s1 = makeSession("s1", [
      makeTurn("t1", "s1", [makeToolCall("t1", "mcp__github__search_code")]),
    ]);
    const s2 = makeSession("s2", [
      makeTurn("t2", "s2", [makeToolCall("t2", "mcp__github__get_file")]),
    ]);
    const [row] = aggregateMcpUsage([s1, s2]);
    expect(row.server).toBe("github");
    expect(row.sessionCount).toBe(2);
    expect(row.totalCalls).toBe(2);
  });

  it("tracks distinct tools called per server", () => {
    const turn = makeTurn("t1", "s1", [
      makeToolCall("t1", "mcp__github__search_code"),
      makeToolCall("t1", "mcp__github__get_file"),
      makeToolCall("t1", "mcp__github__search_code"),
    ]);
    const session = makeSession("s1", [turn]);
    const [row] = aggregateMcpUsage([session]);
    expect(row.tools).toContain("search_code");
    expect(row.tools).toContain("get_file");
    expect(row.tools).toHaveLength(2);
  });

  it("handles multiple distinct MCP servers", () => {
    const turn = makeTurn("t1", "s1", [
      makeToolCall("t1", "mcp__github__search_code"),
      makeToolCall("t1", "mcp__linear__create_issue"),
    ]);
    const session = makeSession("s1", [turn]);
    const result = aggregateMcpUsage([session]);
    expect(result).toHaveLength(2);
    const servers = result.map((r) => r.server).sort();
    expect(servers).toEqual(["github", "linear"]);
  });

  it("sorts results by totalCalls descending", () => {
    const turn = makeTurn("t1", "s1", [
      makeToolCall("t1", "mcp__github__search_code"),
      makeToolCall("t1", "mcp__github__get_file"),
      makeToolCall("t1", "mcp__linear__create_issue"),
    ]);
    const session = makeSession("s1", [turn]);
    const result = aggregateMcpUsage([session]);
    expect(result[0].server).toBe("github");
    expect(result[0].totalCalls).toBe(2);
    expect(result[1].server).toBe("linear");
    expect(result[1].totalCalls).toBe(1);
  });

  it("handles server names containing underscores and hyphens", () => {
    const turn = makeTurn("t1", "s1", [
      makeToolCall("t1", "mcp__my_server__do_thing"),
      makeToolCall("t1", "mcp__my-server__do-thing"),
    ]);
    const session = makeSession("s1", [turn]);
    const result = aggregateMcpUsage([session]);
    const servers = result.map((r) => r.server).sort();
    expect(servers).toEqual(["my-server", "my_server"]);
  });

  it("does not double-count a session even if the same server is called in multiple turns", () => {
    const s1 = makeSession("s1", [
      makeTurn("t1", "s1", [makeToolCall("t1", "mcp__github__search_code")]),
      makeTurn("t2", "s1", [makeToolCall("t2", "mcp__github__get_file")]),
    ]);
    const [row] = aggregateMcpUsage([s1]);
    expect(row.sessionCount).toBe(1);
    expect(row.totalCalls).toBe(2);
  });
});
