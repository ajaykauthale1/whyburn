/**
 * Tests for DefaultConfigReader.
 * All file I/O is mocked via a fake FileReader — no real disk access.
 */

import { describe, expect, it } from "vitest";
import { DefaultConfigReader, type FileReader } from "../../src/config/configReader.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_CONFIG = "/home/user/.config/Claude/claude_desktop_config.json";
const PROJECT_PATH = "/home/user/projects/my-app";
const DOT_MCP = `${PROJECT_PATH}/.mcp.json`;

function makeFileReader(files: Record<string, string>): FileReader {
  return {
    async readFile(path: string): Promise<string> {
      if (path in files) return files[path]!;
      throw new Error(`ENOENT: ${path}`);
    },
    async exists(path: string): Promise<boolean> {
      return path in files;
    },
  };
}

function desktopConfig(servers: Record<string, object>): string {
  return JSON.stringify({ mcpServers: servers });
}

function dotMcpConfig(servers: Record<string, object>): string {
  return JSON.stringify({ mcpServers: servers });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("DefaultConfigReader", () => {
  describe("user-level config", () => {
    it("returns empty when user config does not exist", async () => {
      const reader = new DefaultConfigReader(makeFileReader({}));
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: null });
      expect(result.servers).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("returns servers from a valid user config", async () => {
      const reader = new DefaultConfigReader(
        makeFileReader({
          [USER_CONFIG]: desktopConfig({
            github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
            filesystem: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-filesystem"],
            },
          }),
        }),
      );
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: null });
      expect(result.errors).toEqual([]);
      expect(result.servers).toHaveLength(2);
      expect(result.servers.map((s) => s.name)).toEqual(["github", "filesystem"]);
      expect(result.servers.every((s) => s.configPath === USER_CONFIG)).toBe(true);
      expect(result.servers.every((s) => s.projectPath === null)).toBe(true);
    });

    it("records an error and returns empty when user config is not valid JSON", async () => {
      const reader = new DefaultConfigReader(makeFileReader({ [USER_CONFIG]: "{ bad json" }));
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: null });
      expect(result.servers).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(USER_CONFIG);
    });

    it("returns empty when mcpServers key is missing", async () => {
      const reader = new DefaultConfigReader(
        makeFileReader({ [USER_CONFIG]: JSON.stringify({ otherKey: {} }) }),
      );
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: null });
      expect(result.servers).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("returns empty when mcpServers is an empty object", async () => {
      const reader = new DefaultConfigReader(makeFileReader({ [USER_CONFIG]: desktopConfig({}) }));
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: null });
      expect(result.servers).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });

  describe("project-level .mcp.json", () => {
    it("skips project-level scan when projectPath is null", async () => {
      const reader = new DefaultConfigReader(
        makeFileReader({ [DOT_MCP]: dotMcpConfig({ myServer: {} }) }),
      );
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: null });
      expect(result.servers).toEqual([]);
    });

    it("returns servers from a valid .mcp.json", async () => {
      const reader = new DefaultConfigReader(
        makeFileReader({
          [DOT_MCP]: dotMcpConfig({ myServer: { command: "node", args: ["server.js"] } }),
        }),
      );
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: PROJECT_PATH });
      expect(result.errors).toEqual([]);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0]!.name).toBe("myServer");
      expect(result.servers[0]!.configPath).toBe(DOT_MCP);
      expect(result.servers[0]!.projectPath).toBe(PROJECT_PATH);
    });

    it("returns empty when .mcp.json does not exist", async () => {
      const reader = new DefaultConfigReader(makeFileReader({}));
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: PROJECT_PATH });
      expect(result.servers).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("records an error and returns partial results when .mcp.json is invalid JSON", async () => {
      const reader = new DefaultConfigReader(makeFileReader({ [DOT_MCP]: "not json" }));
      const result = await reader.read({ userConfigPath: USER_CONFIG, projectPath: PROJECT_PATH });
      expect(result.servers).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(DOT_MCP);
    });
  });

  describe("both sources combined", () => {
    it("merges servers from user config and .mcp.json", async () => {
      const reader = new DefaultConfigReader(
        makeFileReader({
          [USER_CONFIG]: desktopConfig({ github: {}, filesystem: {} }),
          [DOT_MCP]: dotMcpConfig({ localDb: {} }),
        }),
      );
      const result = await reader.read({
        userConfigPath: USER_CONFIG,
        projectPath: PROJECT_PATH,
      });
      expect(result.errors).toEqual([]);
      expect(result.servers).toHaveLength(3);
      const names = result.servers.map((s) => s.name);
      expect(names).toContain("github");
      expect(names).toContain("filesystem");
      expect(names).toContain("localDb");
    });

    it("partial results returned when one source errors", async () => {
      const reader = new DefaultConfigReader(
        makeFileReader({
          [USER_CONFIG]: "BAD JSON",
          [DOT_MCP]: dotMcpConfig({ localDb: {} }),
        }),
      );
      const result = await reader.read({
        userConfigPath: USER_CONFIG,
        projectPath: PROJECT_PATH,
      });
      expect(result.errors).toHaveLength(1);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0]!.name).toBe("localDb");
    });

    it("user config servers have projectPath=null; .mcp.json servers have projectPath set", async () => {
      const reader = new DefaultConfigReader(
        makeFileReader({
          [USER_CONFIG]: desktopConfig({ globalServer: {} }),
          [DOT_MCP]: dotMcpConfig({ projectServer: {} }),
        }),
      );
      const result = await reader.read({
        userConfigPath: USER_CONFIG,
        projectPath: PROJECT_PATH,
      });
      const global = result.servers.find((s) => s.name === "globalServer")!;
      const project = result.servers.find((s) => s.name === "projectServer")!;
      expect(global.projectPath).toBeNull();
      expect(project.projectPath).toBe(PROJECT_PATH);
    });
  });
});
