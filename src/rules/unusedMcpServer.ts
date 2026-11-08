/**
 * Rule: unused-mcp-server
 *
 * Flags every MCP server that appears in a config file but was never
 * called during the session. Each unused server loaded into the context
 * burns tokens on every turn via the system prompt — removing it saves
 * those tokens immediately.
 *
 * Confidence is LOW: a server not called in one session may well be used
 * in others. Treat findings as a prompt to review usage patterns across
 * multiple sessions before removing a server.
 */

import type { Finding, McpServerConfig, Session } from "../core/types.js";
import type { Rule } from "./engine.js";

export class UnusedMcpServerRule implements Rule {
  readonly id = "unused-mcp-server";
  readonly version = "1.0.0";

  check(session: Session, configs: McpServerConfig[]): Finding[] {
    if (configs.length === 0) return [];

    const usedServers = new Set<string>();
    for (const turn of session.turns) {
      for (const toolCall of turn.toolCalls) {
        if (toolCall.mcpServer !== null) {
          usedServers.add(toolCall.mcpServer);
        }
      }
    }

    const findings: Finding[] = [];
    for (const config of configs) {
      if (!usedServers.has(config.name)) {
        findings.push({
          ruleId: this.id,
          ruleVersion: this.version,
          title: `MCP server '${config.name}' was not used in this session`,
          evidence: `No tool calls to '${config.name}' were recorded in session '${session.id}'. Note: this is based on a single session — the server may be used in other sessions.`,
          fix: `If '${config.name}' is consistently unused across many sessions, consider removing it from ${config.configPath} or scoping it to projects that need it.`,
          estSavingsUsd: null,
          confidence: "low",
          scope: {
            server: config.name,
            configPath: config.configPath,
            ...(config.projectPath ? { projectPath: config.projectPath } : {}),
          },
        });
      }
    }

    return findings;
  }
}
