/**
 * Rules engine — runs registered Rule implementations against a Session
 * and aggregates the resulting Findings.
 *
 * Rules are validated against RuleSchema at construction time. A rule that
 * does not conform throws immediately with a message pointing to the help URL.
 */

import type { Finding, McpServerConfig, Session } from "../core/types.js";
import { validateRule } from "./ruleSchema.js";

// ── Rule interface ─────────────────────────────────────────────────────────

export interface Rule {
  readonly id: string;
  readonly version: string;
  check(session: Session, configs: McpServerConfig[]): Finding[];
}

// ── Engine ─────────────────────────────────────────────────────────────────

export interface RuleEngineResult {
  findings: Finding[];
  errors: string[];
}

/** Stub — implementation comes in Step 2. */
export class RuleEngine {
  constructor(rules: Rule[]) {
    // Validate every rule at construction — throws if any rule is malformed
    this.rules = rules.map((r) => validateRule(r) as Rule);
  }

  run(_session: Session, _configs: McpServerConfig[]): RuleEngineResult {
    throw new Error("RuleEngine.run: not implemented");
  }
}
