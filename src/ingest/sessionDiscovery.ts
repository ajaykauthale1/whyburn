/**
 * Session discovery for Claude Code transcripts.
 *
 * Claude Code stores transcripts at:
 *   ~/.claude/projects/<encoded-path>/<session-id>.jsonl
 *
 * The folder name encodes the project path by replacing every path separator
 * (/ on Unix, \ on Windows) with a hyphen. A leading slash becomes a leading
 * hyphen; a Windows drive letter like "D:\" becomes "D--".
 *
 * Examples:
 *   /home/user/myapp   →  -home-user-myapp
 *   D:\workspaces\wb   →  D--workspaces-wb
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** A discovered session transcript file. */
export interface SessionFile {
  /** Absolute path to the .jsonl file. */
  filePath: string;
  /** Decoded project path, or null if the folder name could not be decoded. */
  projectPath: string | null;
  /** Session ID derived from the filename (without extension). */
  sessionId: string;
}

/**
 * Returns the default Claude Code projects directory:
 *   ~/.claude/projects
 */
export function defaultProjectsDir(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

/**
 * Decodes a Claude Code project folder name back to an absolute project path.
 *
 * Rules:
 *   - A name starting with "-" is a Unix path: replace each "-" with "/".
 *   - A name matching /^[A-Za-z]--/ is a Windows path: the first "-" is the
 *     colon after the drive letter, the second starts the first separator.
 *   - Anything else is not a recognisable project path → returns null.
 */
export function decodeFolderName(folder: string): string | null {
  // Windows path: starts with a drive letter followed by "--"
  // e.g. "D--workspaces-whyburn"  →  "D:\workspaces\whyburn"
  const windowsDrive = /^([A-Za-z])--(.*)$/.exec(folder);
  if (windowsDrive) {
    const drive = windowsDrive[1].toUpperCase();
    const rest = windowsDrive[2].replace(/-/g, "\\");
    return `${drive}:\\${rest}`;
  }

  // Unix path: starts with "-" (the leading "/")
  // e.g. "-home-user-myapp"  →  "/home/user/myapp"
  if (folder.startsWith("-")) {
    return folder.replace(/-/g, "/");
  }

  // Unrecognised (UUID-like session ids, plain names, etc.)
  return null;
}

/**
 * Walks `projectsDir` and returns all `.jsonl` transcript files found inside
 * it, one level deep (each immediate subdirectory is treated as a project
 * folder).
 *
 * Returns an empty array if `projectsDir` does not exist.
 * Results are sorted by `filePath` for deterministic ordering.
 */
export async function discoverSessionFiles(projectsDir: string): Promise<SessionFile[]> {
  if (!fs.existsSync(projectsDir)) return [];

  const results: SessionFile[] = [];

  let projectFolders: string[];
  try {
    projectFolders = fs.readdirSync(projectsDir);
  } catch {
    return [];
  }

  for (const folder of projectFolders) {
    const folderPath = path.join(projectsDir, folder);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(folderPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const projectPath = decodeFolderName(folder);

    let files: string[];
    try {
      files = fs.readdirSync(folderPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const sessionId = file.slice(0, -".jsonl".length);
      results.push({
        filePath: path.join(folderPath, file),
        projectPath,
        sessionId,
      });
    }
  }

  results.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return results;
}
