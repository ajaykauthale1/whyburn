import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decodeFolderName,
  defaultProjectsDir,
  discoverSessionFiles,
} from "../../src/ingest/sessionDiscovery.js";

// ── decodeFolderName ───────────────────────────────────────────────────────

describe("decodeFolderName", () => {
  it("decodes a Unix absolute path", () => {
    // /home/user/projects/myapp  →  -home-user-projects-myapp
    expect(decodeFolderName("-home-user-projects-myapp")).toBe("/home/user/projects/myapp");
  });

  it("decodes a Windows absolute path", () => {
    // D:\workspaces\whyburn  →  D--workspaces-whyburn
    expect(decodeFolderName("D--workspaces-whyburn")).toBe("D:\\workspaces\\whyburn");
  });

  it("returns null for a folder name that looks like a session id (UUID-like)", () => {
    expect(decodeFolderName("abc123-def456-ghi789")).toBe(null);
  });

  it("returns the raw string when it cannot determine a path (no leading dash or drive letter)", () => {
    expect(decodeFolderName("myproject")).toBe(null);
  });
});

// ── defaultProjectsDir ─────────────────────────────────────────────────────

describe("defaultProjectsDir", () => {
  it("returns a path ending with .claude/projects", () => {
    const dir = defaultProjectsDir();
    expect(dir.replace(/\\/g, "/")).toMatch(/\.claude\/projects$/);
  });

  it("is rooted at the home directory", () => {
    const dir = defaultProjectsDir();
    expect(dir.startsWith(os.homedir())).toBe(true);
  });
});

// ── discoverSessionFiles ───────────────────────────────────────────────────

describe("discoverSessionFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whyburn-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeSession(projectFolder: string, sessionId: string): string {
    const dir = path.join(tmpDir, projectFolder);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${sessionId}.jsonl`);
    fs.writeFileSync(filePath, "");
    return filePath;
  }

  it("discovers .jsonl files and returns their paths", async () => {
    makeSession("-home-user-myproject", "sess-001");
    const results = await discoverSessionFiles(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.filePath).toMatch(/sess-001\.jsonl$/);
  });

  it("sets sessionId from the filename (without extension)", async () => {
    makeSession("-home-user-myproject", "sess-abc123");
    const results = await discoverSessionFiles(tmpDir);
    expect(results[0]!.sessionId).toBe("sess-abc123");
  });

  it("decodes projectPath from the folder name", async () => {
    makeSession("-home-user-myproject", "sess-001");
    const results = await discoverSessionFiles(tmpDir);
    expect(results[0]!.projectPath).toBe("/home/user/myproject");
  });

  it("sets projectPath to null for undecodable folder names", async () => {
    makeSession("unknown-folder-123", "sess-001");
    const results = await discoverSessionFiles(tmpDir);
    expect(results[0]!.projectPath).toBeNull();
  });

  it("discovers files across multiple project folders", async () => {
    makeSession("-home-user-proj-a", "sess-001");
    makeSession("-home-user-proj-b", "sess-002");
    makeSession("-home-user-proj-b", "sess-003");
    const results = await discoverSessionFiles(tmpDir);
    expect(results).toHaveLength(3);
  });

  it("ignores non-.jsonl files", async () => {
    const dir = path.join(tmpDir, "-home-user-proj");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "sess-001.jsonl"), "");
    fs.writeFileSync(path.join(dir, "notes.txt"), "");
    fs.writeFileSync(path.join(dir, "sess-002.json"), "");
    const results = await discoverSessionFiles(tmpDir);
    expect(results).toHaveLength(1);
  });

  it("returns an empty array when the projects directory does not exist", async () => {
    const results = await discoverSessionFiles(path.join(tmpDir, "nonexistent"));
    expect(results).toEqual([]);
  });

  it("sorts results by filePath for deterministic ordering", async () => {
    makeSession("-home-user-proj", "sess-b");
    makeSession("-home-user-proj", "sess-a");
    const results = await discoverSessionFiles(tmpDir);
    expect(results[0]!.sessionId).toBe("sess-a");
    expect(results[1]!.sessionId).toBe("sess-b");
  });
});
