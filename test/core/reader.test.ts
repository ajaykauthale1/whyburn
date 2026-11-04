import { describe, expect, it } from "vitest";
import type { LineReader, ReadResult, TranscriptReader } from "../../src/core/reader.js";
import { zeroUsage } from "../../src/core/types.js";

/**
 * Structural tests: verify that a conforming implementation satisfies
 * the TranscriptReader and LineReader contracts.
 */

describe("TranscriptReader interface", () => {
  it("can be satisfied by a minimal implementation", () => {
    const stubResult: ReadResult = {
      session: {
        id: "s1",
        agent: "stub-agent",
        projectPath: null,
        startedAt: new Date(),
        endedAt: null,
        models: [],
        usage: zeroUsage(),
        costUsd: null,
        turns: [],
      },
      skippedLines: 0,
      errors: [],
    };

    const impl: TranscriptReader = {
      agent: "stub-agent",
      read: async (_filePath, _lineReader) => stubResult,
    };

    expect(impl.agent).toBe("stub-agent");
  });
});

describe("LineReader interface", () => {
  it("can be satisfied by an async generator", async () => {
    const impl: LineReader = {
      async *readLines(_path: string) {
        yield "line one";
        yield "line two";
      },
    };

    const lines: string[] = [];
    for await (const line of impl.readLines("any")) {
      lines.push(line);
    }
    expect(lines).toEqual(["line one", "line two"]);
  });
});
