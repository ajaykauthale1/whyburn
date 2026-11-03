import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { createProgram } from "../src/program.js";

describe("createProgram", () => {
  it("is named whyburn", () => {
    expect(createProgram().name()).toBe("whyburn");
  });

  it("reports the package version", () => {
    expect(createProgram().version()).toBe(pkg.version);
  });
});
