/**
 * Core domain types for whyburn.
 * No agent-specific details here — adapters map into these.
 */

/** Token breakdown for a single turn or session. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** A single assistant turn within a session. */
export interface Turn {
  id: string;
  sessionId: string;
  /** 0-based index within the session. */
  index: number;
  model: string;
  usage: Usage;
  /** Wall-clock duration in milliseconds, if known. */
  durationMs: number | null;
  toolCalls: ToolCall[];
}

/** A single tool call made within a turn. */
export interface ToolCall {
  id: string;
  turnId: string;
  /** Raw tool name as recorded in the transcript, e.g. "mcp__github__search_code". */
  toolName: string;
  /**
   * MCP server name parsed from toolName, or null if this is not an MCP call.
   * Derived from the "mcp__<server>__<tool>" naming convention.
   */
  mcpServer: string | null;
  /** Tool name within the MCP server, or the full toolName for non-MCP calls. */
  toolLocalName: string;
  success: boolean;
}

/** A single Claude Code (or other agent) session. */
export interface Session {
  id: string;
  agent: string;
  /** Filesystem path of the project, if known. */
  projectPath: string | null;
  startedAt: Date;
  endedAt: Date | null;
  /** All models used across turns (deduplicated, insertion order). */
  models: string[];
  usage: Usage;
  /** Estimated cost in USD. Labeled as an estimate wherever shown to users. */
  costUsd: number | null;
  turns: Turn[];
}

/** An MCP server entry from a config file. */
export interface McpServerConfig {
  name: string;
  /** Source config file path. */
  configPath: string;
  /** Project path this config applies to, or null for user-level config. */
  projectPath: string | null;
}

/** Confidence level for a finding. */
export type Confidence = "high" | "medium" | "low";

/** A single actionable finding produced by a rule. */
export interface Finding {
  ruleId: string;
  ruleVersion: string;
  title: string;
  evidence: string;
  fix: string;
  /** Estimated monthly savings in USD. Always an estimate. */
  estSavingsUsd: number | null;
  confidence: Confidence;
  /** Scope: which session/project/server this finding is about. */
  scope: Record<string, string>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns a Usage with all fields set to zero. */
export function zeroUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

/** Returns the total tokens across all fields. */
export function totalTokens(u: Usage): number {
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
}

/**
 * Parses an MCP tool name of the form "mcp__<server>__<tool>".
 * Returns { mcpServer, toolLocalName } or null if the name does not match.
 */
export function parseMcpToolName(
  toolName: string,
): { mcpServer: string; toolLocalName: string } | null {
  if (!toolName.startsWith("mcp__")) return null;
  const rest = toolName.slice("mcp__".length);
  const sep = rest.indexOf("__");
  if (sep === -1) return null;
  const mcpServer = rest.slice(0, sep);
  const toolLocalName = rest.slice(sep + 2);
  if (!mcpServer || !toolLocalName) return null;
  return { mcpServer, toolLocalName };
}
