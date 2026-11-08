/**
 * Tests for validateRule — schema enforcement at the engine boundary.
 */

import { describe, expect, it } from "vitest";
import { RULE_HELP_URL, validateRule } from "../../src/rules/ruleSchema.js";

function validRule() {
  return {
    id: "my-rule",
    version: "1.0.0",
    check: () => [],
  };
}

describe("validateRule", () => {
  it("accepts a correctly-formed rule", () => {
    const rule = validRule();
    expect(() => validateRule(rule)).not.toThrow();
  });

  it("returns the rule object on success", () => {
    const rule = validRule();
    expect(validateRule(rule)).toBe(rule);
  });

  describe("id validation", () => {
    it("throws when id is missing", () => {
      const { id: _id, ...rule } = validRule();
      expect(() => validateRule(rule)).toThrow(/id/i);
    });

    it("throws when id is an empty string", () => {
      expect(() => validateRule({ ...validRule(), id: "" })).toThrow(/id/i);
    });

    it("throws when id is not kebab-case", () => {
      expect(() => validateRule({ ...validRule(), id: "MyRule" })).toThrow(/id/i);
      expect(() => validateRule({ ...validRule(), id: "my_rule" })).toThrow(/id/i);
      expect(() => validateRule({ ...validRule(), id: "123rule" })).toThrow(/id/i);
    });

    it("accepts valid kebab-case ids", () => {
      expect(() => validateRule({ ...validRule(), id: "unused-mcp-server" })).not.toThrow();
      expect(() => validateRule({ ...validRule(), id: "a" })).not.toThrow();
      expect(() => validateRule({ ...validRule(), id: "rule-v2" })).not.toThrow();
    });
  });

  describe("version validation", () => {
    it("throws when version is missing", () => {
      const { version: _v, ...rule } = validRule();
      expect(() => validateRule(rule)).toThrow(/version/i);
    });

    it("throws when version is not semver", () => {
      expect(() => validateRule({ ...validRule(), version: "1" })).toThrow(/version/i);
      expect(() => validateRule({ ...validRule(), version: "v1.0.0" })).toThrow(/version/i);
      expect(() => validateRule({ ...validRule(), version: "1.0" })).toThrow(/version/i);
    });

    it("accepts valid semver versions", () => {
      expect(() => validateRule({ ...validRule(), version: "1.0.0" })).not.toThrow();
      expect(() => validateRule({ ...validRule(), version: "2.3.14" })).not.toThrow();
    });
  });

  describe("check validation", () => {
    it("throws when check is missing", () => {
      const { check: _c, ...rule } = validRule();
      expect(() => validateRule(rule)).toThrow(/check/i);
    });

    it("throws when check is not a function", () => {
      expect(() => validateRule({ ...validRule(), check: "not-a-fn" })).toThrow(/check/i);
      expect(() => validateRule({ ...validRule(), check: null })).toThrow(/check/i);
    });
  });

  it("error message includes the help URL", () => {
    const { id: _id, ...rule } = validRule();
    let message = "";
    try {
      validateRule(rule);
    } catch (e) {
      message = String(e);
    }
    expect(message).toContain(RULE_HELP_URL);
  });
});
