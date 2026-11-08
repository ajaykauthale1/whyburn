/**
 * Zod schema for the Rule interface.
 *
 * The engine validates every rule against this schema at construction time.
 * A rule that fails validation throws immediately with a human-readable message
 * that names the bad field and points to the authoring guide.
 */

import { z } from "zod";

export const RULE_HELP_URL = "https://github.com/ajaykauthale1/whyburn#writing-rules";

export const RuleSchema = z.object({
  id: z
    .string({ required_error: "Rule must have an 'id' string." })
    .min(1, "Rule 'id' must not be empty.")
    .regex(/^[a-z][a-z0-9-]*$/, "Rule 'id' must be kebab-case (e.g. 'unused-mcp-server')."),
  version: z
    .string({ required_error: "Rule must have a 'version' string." })
    .min(1, "Rule 'version' must not be empty.")
    .regex(/^\d+\.\d+\.\d+$/, "Rule 'version' must be semver (e.g. '1.0.0')."),
  check: z.function(),
});

export type ValidatedRule = z.infer<typeof RuleSchema>;

/**
 * Validates a rule object. Returns the rule if valid.
 * Throws a TypeError with a descriptive message + help URL if invalid.
 * Stub — full error formatting implemented in Step 2.
 */
export function validateRule(_rule: unknown): ValidatedRule {
  throw new Error("validateRule: not implemented");
}
