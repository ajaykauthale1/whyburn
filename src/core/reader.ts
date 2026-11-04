/**
 * Shared interface that every agent-specific transcript reader implements.
 * All readers map their native format into the same core types.
 */

import type { Session } from "./types.js";

/** Result returned by any TranscriptReader. */
export interface ReadResult {
  session: Session;
  /** Lines skipped because they were malformed or of an unrecognised type. */
  skippedLines: number;
  /** One entry per malformed line (parse error message). */
  errors: string[];
}

/**
 * Abstraction over line-by-line file I/O.
 * Inject a mock in tests; use NodeLineReader in production.
 */
export interface LineReader {
  readLines(path: string): AsyncIterable<string>;
}

/**
 * A reader for one agent's transcript format.
 * Each supported agent (Claude Code, Codex, Gemini, …) ships its own
 * implementation of this interface.
 */
export interface TranscriptReader {
  /** Identifier for the agent this reader handles, e.g. "claude-code". */
  readonly agent: string;
  /** Parse a single transcript file and return normalised core types. */
  read(filePath: string, lineReader: LineReader): Promise<ReadResult>;
}
