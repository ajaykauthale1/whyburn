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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  check(_session: Session, _configs: McpServerConfig[]): Finding[] {
    throw new Error("UnusedMcpServerRule.check: not implemented");
  }
}
