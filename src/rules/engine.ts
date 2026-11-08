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

export class RuleEngine {
  private readonly rules: Rule[];

  constructor(rules: Rule[]) {
    this.rules = rules.map((r) => validateRule(r) as Rule);
  }

  run(session: Session, configs: McpServerConfig[]): RuleEngineResult {
    const findings: Finding[] = [];
    const errors: string[] = [];

    for (const rule of this.rules) {
      try {
        const result = rule.check(session, configs);
        findings.push(...result);
      } catch (e) {
        errors.push(`Rule '${rule.id}' threw an error: ${String(e)}`);
      }
    }

    return { findings, errors };
  }
}
