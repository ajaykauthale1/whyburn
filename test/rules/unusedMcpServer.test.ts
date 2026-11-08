/**
 * Tests for UnusedMcpServerRule.
 * Sessions are built inline — no file I/O.
 */

import { describe, expect, it } from "vitest";
import type { McpServerConfig, Session, ToolCall, Turn } from "../../src/core/types.js";
import { zeroUsage } from "../../src/core/types.js";
import { UnusedMcpServerRule } from "../../src/rules/unusedMcpServer.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSession(turns: Turn[] = []): Session {
  return {
    id: "sess-1",
    agent: "claude-code",
    projectPath: "/home/user/project",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    endedAt: new Date("2026-01-01T01:00:00Z"),
    models: ["claude-sonnet-4-5"],
    usage: zeroUsage(),
    costUsd: null,
    turns,
  };
}

function makeTurn(id: string, toolCalls: ToolCall[] = []): Turn {
  return {
    id,
    sessionId: "sess-1",
    index: 0,
    model: "claude-sonnet-4-5",
    usage: zeroUsage(),
    durationMs: null,
    toolCalls,
  };
}

function makeToolCall(toolName: string, mcpServer: string | null): ToolCall {
  return {
    id: `tc-${toolName}`,
    turnId: "turn-1",
    toolName,
    mcpServer,
    toolLocalName: toolName,
    success: true,
  };
}

function makeConfig(name: string, projectPath: string | null = null): McpServerConfig {
  return { name, configPath: "/config.json", projectPath };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("UnusedMcpServerRule", () => {
  const rule = new UnusedMcpServerRule();

  it("returns no findings when no configs are provided", () => {
    const result = rule.check(makeSession(), []);
    expect(result).toEqual([]);
  });

  it("returns no findings when session has no turns", () => {
    const result = rule.check(makeSession(), [makeConfig("github")]);
    expect(result).toHaveLength(1);
    expect(result[0]!.ruleId).toBe("unused-mcp-server");
    expect(result[0]!.scope.server).toBe("github");
  });

  it("returns no findings when all configured servers are used", () => {
    const turn = makeTurn("t1", [
      makeToolCall("mcp__github__search_code", "github"),
      makeToolCall("mcp__filesystem__read_file", "filesystem"),
    ]);
    const result = rule.check(makeSession([turn]), [
      makeConfig("github"),
      makeConfig("filesystem"),
    ]);
    expect(result).toEqual([]);
  });

  it("flags a server that is configured but never called", () => {
    const turn = makeTurn("t1", [makeToolCall("mcp__github__search_code", "github")]);
    const result = rule.check(makeSession([turn]), [
      makeConfig("github"),
      makeConfig("filesystem"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.scope.server).toBe("filesystem");
  });

  it("flags multiple unused servers", () => {
    const result = rule.check(makeSession(), [
      makeConfig("github"),
      makeConfig("filesystem"),
      makeConfig("postgres"),
    ]);
    expect(result).toHaveLength(3);
    const names = result.map((f) => f.scope.server);
    expect(names).toContain("github");
    expect(names).toContain("filesystem");
    expect(names).toContain("postgres");
  });

  it("each finding has correct ruleId, ruleVersion, and non-empty title/fix", () => {
    const result = rule.check(makeSession(), [makeConfig("github")]);
    expect(result[0]!.ruleId).toBe("unused-mcp-server");
    expect(result[0]!.ruleVersion).toBe("1.0.0");
    expect(result[0]!.title.length).toBeGreaterThan(0);
    expect(result[0]!.fix.length).toBeGreaterThan(0);
  });

  it("ignores tool calls that are not MCP calls (mcpServer === null)", () => {
    const turn = makeTurn("t1", [makeToolCall("Bash", null), makeToolCall("Read", null)]);
    const result = rule.check(makeSession([turn]), [makeConfig("github")]);
    expect(result).toHaveLength(1);
    expect(result[0]!.scope.server).toBe("github");
  });

  it("counts a server as used if called in any turn across the session", () => {
    const turns = [
      makeTurn("t1", [makeToolCall("mcp__github__search_code", "github")]),
      makeTurn("t2", []),
      makeTurn("t3", [makeToolCall("mcp__github__list_prs", "github")]),
    ];
    const result = rule.check(makeSession(turns), [makeConfig("github")]);
    expect(result).toEqual([]);
  });
});
