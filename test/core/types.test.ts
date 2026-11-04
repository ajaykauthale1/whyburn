import { describe, expect, it } from "vitest";
import {
  type Confidence,
  type Finding,
  type McpServerConfig,
  type Session,
  type ToolCall,
  type Turn,
  type Usage,
  parseMcpToolName,
  totalTokens,
  zeroUsage,
} from "../../src/core/types.js";

// ── Usage ──────────────────────────────────────────────────────────────────

describe("zeroUsage", () => {
  it("returns all fields as zero", () => {
    const u = zeroUsage();
    expect(u.inputTokens).toBe(0);
    expect(u.outputTokens).toBe(0);
    expect(u.cacheReadTokens).toBe(0);
    expect(u.cacheWriteTokens).toBe(0);
  });
});

describe("totalTokens", () => {
  it("sums all four token fields", () => {
    const u: Usage = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 200, cacheWriteTokens: 25 };
    expect(totalTokens(u)).toBe(375);
  });

  it("returns 0 for zeroUsage", () => {
    expect(totalTokens(zeroUsage())).toBe(0);
  });
});

// ── parseMcpToolName ───────────────────────────────────────────────────────

describe("parseMcpToolName", () => {
  it("parses a standard MCP tool name", () => {
    expect(parseMcpToolName("mcp__github__search_code")).toEqual({
      mcpServer: "github",
      toolLocalName: "search_code",
    });
  });

  it("handles server names with hyphens", () => {
    expect(parseMcpToolName("mcp__my-server__do_thing")).toEqual({
      mcpServer: "my-server",
      toolLocalName: "do_thing",
    });
  });

  it("handles server names with underscores", () => {
    expect(parseMcpToolName("mcp__my_server__do_thing")).toEqual({
      mcpServer: "my_server",
      toolLocalName: "do_thing",
    });
  });

  it("returns null for a non-MCP tool name", () => {
    expect(parseMcpToolName("bash")).toBeNull();
    expect(parseMcpToolName("read_file")).toBeNull();
  });

  it("returns null when mcp__ prefix exists but no server separator", () => {
    expect(parseMcpToolName("mcp__nogood")).toBeNull();
  });

  it("returns null when server or tool name is empty", () => {
    expect(parseMcpToolName("mcp____tool")).toBeNull();
    expect(parseMcpToolName("mcp__server__")).toBeNull();
  });

  it("handles tool names that themselves contain double underscores", () => {
    // only the FIRST __ after mcp__ is the separator
    expect(parseMcpToolName("mcp__server__tool__extra")).toEqual({
      mcpServer: "server",
      toolLocalName: "tool__extra",
    });
  });
});

// ── Shape tests (structural / compile-time checks via assignments) ─────────

describe("Turn shape", () => {
  it("accepts a valid Turn object", () => {
    const turn: Turn = {
      id: "t1",
      sessionId: "s1",
      index: 0,
      model: "claude-sonnet-4-6",
      usage: zeroUsage(),
      durationMs: 1200,
      toolCalls: [],
    };
    expect(turn.id).toBe("t1");
  });

  it("allows durationMs to be null", () => {
    const turn: Turn = {
      id: "t2",
      sessionId: "s1",
      index: 1,
      model: "claude-sonnet-4-6",
      usage: zeroUsage(),
      durationMs: null,
      toolCalls: [],
    };
    expect(turn.durationMs).toBeNull();
  });
});

describe("ToolCall shape", () => {
  it("accepts an MCP tool call", () => {
    const tc: ToolCall = {
      id: "tc1",
      turnId: "t1",
      toolName: "mcp__github__search_code",
      mcpServer: "github",
      toolLocalName: "search_code",
      success: true,
    };
    expect(tc.mcpServer).toBe("github");
  });

  it("accepts a non-MCP tool call with null mcpServer", () => {
    const tc: ToolCall = {
      id: "tc2",
      turnId: "t1",
      toolName: "bash",
      mcpServer: null,
      toolLocalName: "bash",
      success: false,
    };
    expect(tc.mcpServer).toBeNull();
  });
});

describe("Session shape", () => {
  it("accepts a minimal session", () => {
    const s: Session = {
      id: "sess1",
      agent: "claude-code",
      projectPath: null,
      startedAt: new Date("2026-11-01T10:00:00Z"),
      endedAt: null,
      models: ["claude-sonnet-4-6"],
      usage: zeroUsage(),
      costUsd: null,
      turns: [],
    };
    expect(s.agent).toBe("claude-code");
  });
});

describe("McpServerConfig shape", () => {
  it("accepts a project-level config entry", () => {
    const cfg: McpServerConfig = {
      name: "github",
      configPath: "/project/.mcp.json",
      projectPath: "/project",
    };
    expect(cfg.projectPath).toBe("/project");
  });

  it("accepts a user-level config entry with null projectPath", () => {
    const cfg: McpServerConfig = {
      name: "browser",
      configPath: "/home/user/.claude/mcp.json",
      projectPath: null,
    };
    expect(cfg.projectPath).toBeNull();
  });
});

describe("Finding shape", () => {
  it("accepts a valid finding", () => {
    const f: Finding = {
      ruleId: "mcp-unused-server",
      ruleVersion: "1.0.0",
      title: "MCP server loaded but never called",
      evidence: "jira: configured in 30 sessions, called 0 times",
      fix: "Remove jira from .mcp.json",
      estSavingsUsd: 12.5,
      confidence: "high",
      scope: { mcpServer: "jira" },
    };
    expect(f.ruleId).toBe("mcp-unused-server");
  });

  it("accepts null estSavingsUsd when cost cannot be estimated", () => {
    const f: Finding = {
      ruleId: "mcp-unused-server",
      ruleVersion: "1.0.0",
      title: "MCP server loaded but never called",
      evidence: "some evidence",
      fix: "some fix",
      estSavingsUsd: null,
      confidence: "low",
      scope: {},
    };
    expect(f.estSavingsUsd).toBeNull();
  });

  it("confidence type accepts all valid values", () => {
    const values: Confidence[] = ["high", "medium", "low"];
    expect(values).toHaveLength(3);
  });
});
