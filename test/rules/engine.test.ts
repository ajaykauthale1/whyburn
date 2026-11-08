/**
 * Tests for RuleEngine.
 * Rules are injected as fakes — no real rule logic runs here.
 */

import { describe, expect, it, vi } from "vitest";
import type { Finding, McpServerConfig, Session } from "../../src/core/types.js";
import { zeroUsage } from "../../src/core/types.js";
import { type Rule, RuleEngine } from "../../src/rules/engine.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    agent: "claude-code",
    projectPath: "/home/user/project",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    endedAt: new Date("2026-01-01T01:00:00Z"),
    models: ["claude-sonnet-4-5"],
    usage: zeroUsage(),
    costUsd: null,
    turns: [],
    ...overrides,
  };
}

function makeConfig(name: string, projectPath: string | null = null): McpServerConfig {
  return { name, configPath: "/config.json", projectPath };
}

function makeFinding(ruleId: string): Finding {
  return {
    ruleId,
    ruleVersion: "1.0.0",
    title: `Finding from ${ruleId}`,
    evidence: "test evidence",
    fix: "test fix",
    estSavingsUsd: null,
    confidence: "high",
    scope: {},
  };
}

function makeRule(id: string, findings: Finding[] = []): Rule {
  return {
    id,
    version: "1.0.0",
    check: vi.fn().mockReturnValue(findings),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("RuleEngine", () => {
  const session = makeSession();
  const configs = [makeConfig("github"), makeConfig("filesystem")];

  it("returns empty findings when no rules are registered", () => {
    const engine = new RuleEngine([]);
    const result = engine.run(session, configs);
    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("returns findings from a single rule", () => {
    const finding = makeFinding("rule-a");
    const engine = new RuleEngine([makeRule("rule-a", [finding])]);
    const result = engine.run(session, configs);
    expect(result.findings).toEqual([finding]);
    expect(result.errors).toEqual([]);
  });

  it("aggregates findings from multiple rules", () => {
    const f1 = makeFinding("rule-a");
    const f2 = makeFinding("rule-b");
    const engine = new RuleEngine([makeRule("rule-a", [f1]), makeRule("rule-b", [f2])]);
    const result = engine.run(session, configs);
    expect(result.findings).toHaveLength(2);
    expect(result.findings).toContain(f1);
    expect(result.findings).toContain(f2);
  });

  it("passes session and configs to each rule", () => {
    const rule = makeRule("rule-a");
    const engine = new RuleEngine([rule]);
    engine.run(session, configs);
    expect(rule.check).toHaveBeenCalledWith(session, configs);
  });

  it("catches a throwing rule and records it in errors without losing other findings", () => {
    const badRule: Rule = {
      id: "bad-rule",
      version: "1.0.0",
      check: vi.fn().mockImplementation(() => {
        throw new Error("boom");
      }),
    };
    const goodFinding = makeFinding("good-rule");
    const goodRule = makeRule("good-rule", [goodFinding]);
    const engine = new RuleEngine([badRule, goodRule]);
    const result = engine.run(session, configs);
    expect(result.findings).toEqual([goodFinding]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("bad-rule");
  });

  it("returns empty findings when a rule returns []", () => {
    const engine = new RuleEngine([makeRule("rule-a", [])]);
    const result = engine.run(session, configs);
    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});

describe("RuleEngine — rule validation at construction", () => {
  it("throws when a rule has no id", () => {
    const bad = { version: "1.0.0", check: vi.fn() };
    expect(() => new RuleEngine([bad as unknown as Rule])).toThrow(/id/i);
  });

  it("throws when a rule has no version", () => {
    const bad = { id: "my-rule", check: vi.fn() };
    expect(() => new RuleEngine([bad as unknown as Rule])).toThrow(/version/i);
  });

  it("throws when check is not a function", () => {
    const bad = { id: "my-rule", version: "1.0.0", check: "oops" };
    expect(() => new RuleEngine([bad as unknown as Rule])).toThrow(/check/i);
  });

  it("error message includes the help URL", () => {
    const bad = { version: "1.0.0", check: vi.fn() };
    let message = "";
    try {
      new RuleEngine([bad as unknown as Rule]);
    } catch (e) {
      message = String(e);
    }
    expect(message).toContain("whyburn#writing-rules");
  });
});
