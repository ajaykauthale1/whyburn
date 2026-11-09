/**
 * Aggregates MCP server usage across a list of sessions.
 *
 * Produces one row per distinct MCP server, sorted by total call count
 * descending (most-used first).
 */

import type { Session } from "../core/types.js";

/** Per-server usage summary across all sessions. */
export interface McpServerUsage {
  /** MCP server name, e.g. "github". */
  server: string;
  /** Total number of tool calls made to this server across all sessions. */
  totalCalls: number;
  /** Number of distinct sessions in which this server was called. */
  sessionCount: number;
  /** Distinct tool local names called on this server, sorted alphabetically. */
  tools: string[];
}

/**
 * Aggregates MCP tool calls from `sessions` into per-server usage rows.
 *
 * - Non-MCP tool calls (mcpServer === null) are ignored.
 * - A session is counted once per server regardless of how many turns or
 *   calls it contains.
 * - Results are sorted by totalCalls descending; ties keep insertion order.
 */
export function aggregateMcpUsage(sessions: Session[]): McpServerUsage[] {
  /** server → { totalCalls, sessionIds, tools } */
  const map = new Map<
    string,
    { totalCalls: number; sessionIds: Set<string>; tools: Set<string> }
  >();

  for (const session of sessions) {
    for (const turn of session.turns) {
      for (const call of turn.toolCalls) {
        if (call.mcpServer === null) continue;

        let entry = map.get(call.mcpServer);
        if (!entry) {
          entry = { totalCalls: 0, sessionIds: new Set(), tools: new Set() };
          map.set(call.mcpServer, entry);
        }

        entry.totalCalls++;
        entry.sessionIds.add(session.id);
        entry.tools.add(call.toolLocalName);
      }
    }
  }

  const rows: McpServerUsage[] = [];
  for (const [server, { totalCalls, sessionIds, tools }] of map) {
    rows.push({
      server,
      totalCalls,
      sessionCount: sessionIds.size,
      tools: [...tools].sort(),
    });
  }

  rows.sort((a, b) => b.totalCalls - a.totalCalls);
  return rows;
}
