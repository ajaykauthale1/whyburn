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

// ── Raw config shapes ──────────────────────────────────────────────────────

interface RawMcpConfig {
  mcpServers?: Record<string, unknown>;
}

// ── Implementation ─────────────────────────────────────────────────────────

export class DefaultConfigReader implements ConfigReader {
  constructor(private readonly fileReader: FileReader) {}

  async read(options: ConfigReadOptions): Promise<ConfigReadResult> {
    const servers: McpServerConfig[] = [];
    const errors: string[] = [];

    await this.#parseConfig(options.userConfigPath, null, servers, errors);

    if (options.projectPath !== null) {
      const dotMcp = `${options.projectPath}/.mcp.json`;
      await this.#parseConfig(dotMcp, options.projectPath, servers, errors);
    }

    return { servers, errors };
  }

  async #parseConfig(
    configPath: string,
    projectPath: string | null,
    out: McpServerConfig[],
    errors: string[],
  ): Promise<void> {
    if (!(await this.fileReader.exists(configPath))) return;

    let raw: RawMcpConfig;
    try {
      const text = await this.fileReader.readFile(configPath);
      raw = JSON.parse(text) as RawMcpConfig;
    } catch (e) {
      errors.push(`Failed to parse ${configPath}: ${String(e)}`);
      return;
    }

    for (const name of Object.keys(raw.mcpServers ?? {})) {
      out.push({ name, configPath, projectPath });
    }
  }
}
