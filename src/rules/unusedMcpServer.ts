/**
 * Rule: unused-mcp-server
 *
 * Flags every MCP server that appears in a config file but was never
 * called during the session. Each unused server loaded into the context
 * burns tokens on every turn via the system prompt — removing it saves
 * those tokens immediately.
 */

import type { Finding, McpServerConfig, Session } from "../core/types.js";
import type { Rule } from "./engine.js";

export class UnusedMcpServerRule implements Rule {
  readonly id = "unused-mcp-server";
  readonly version = "1.0.0";

  check(session: Session, configs: McpServerConfig[]): Finding[] {
    if (configs.length === 0) return [];

    // Collect every MCP server name that was actually called in this session
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
          title: `MCP server '${config.name}' is configured but never used`,
          evidence: `Server '${config.name}' appears in ${config.configPath} but no tool calls to it were recorded in this session.`,
          fix: `Remove '${config.name}' from ${config.configPath} or scope it to projects that actually use it.`,
          estSavingsUsd: null,
          confidence: "high",
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
