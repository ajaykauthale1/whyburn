/**
 * ConfigReader — discovers and parses MCP server config files.
 *
 * Two sources are supported:
 *   1. User-level  — claude_desktop_config.json  (OS-specific path)
 *   2. Project-level — <projectPath>/.mcp.json
 *
 * Both are injected via a FileReader abstraction so tests can mock file I/O.
 */

import type { McpServerConfig } from "../core/types.js";

// ── Abstraction over file I/O ──────────────────────────────────────────────

/** Minimal file-system abstraction; inject a mock in tests. */
export interface FileReader {
  /** Read a file's contents. Throws if the file does not exist or is unreadable. */
  readFile(path: string): Promise<string>;
  /** Return true if the path exists (file or directory). */
  exists(path: string): Promise<boolean>;
}

// ── ConfigReader interface ─────────────────────────────────────────────────

/** Reads MCP server configs from both user-level and project-level sources. */
export interface ConfigReader {
  /**
   * Returns every MCP server entry found across all config sources.
   * Files that do not exist are silently skipped.
   * Files that cannot be parsed are recorded in `errors` and skipped.
   */
  read(options: ConfigReadOptions): Promise<ConfigReadResult>;
}

export interface ConfigReadOptions {
  /**
   * Absolute path to the user-level claude_desktop_config.json.
   * Pass the OS-resolved path; computing it is the caller's concern.
   */
  userConfigPath: string;
  /** Project directory to search for .mcp.json (may be null = skip). */
  projectPath: string | null;
}

export interface ConfigReadResult {
  servers: McpServerConfig[];
  /** Parse/read errors (non-fatal — partial results are still returned). */
  errors: string[];
}

// ── Stub — implementation comes in Step 2 ─────────────────────────────────

export class DefaultConfigReader implements ConfigReader {
  // fileReader will be used in Step 2 implementation
  constructor(readonly _fileReader: FileReader) {}

  read(_options: ConfigReadOptions): Promise<ConfigReadResult> {
    throw new Error("DefaultConfigReader.read: not implemented");
  }
}
