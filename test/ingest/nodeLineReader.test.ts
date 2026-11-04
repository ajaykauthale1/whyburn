import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClaudeCodeReader } from "../../src/ingest/claudeCodeReader.js";
import { NodeLineReader } from "../../src/ingest/nodeLineReader.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE = join(__dirname, "../fixtures/claude-code/sample.jsonl");

const lineReader = new NodeLineReader();
const reader = new ClaudeCodeReader();

describe("NodeLineReader + ClaudeCodeReader (integration)", () => {
  it("reads lines from a real file without throwing", async () => {
    const lines: string[] = [];
    for await (const line of lineReader.readLines(FIXTURE)) lines.push(line);
    expect(lines.length).toBeGreaterThan(5);
  });

  it("parses session id from fixture", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    expect(r.session.id).toBe("sess-fixture-001");
  });

  it("produces 3 turns from the fixture", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    expect(r.session.turns).toHaveLength(3);
  });

  it("sets startedAt from the first timestamped line", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    expect(r.session.startedAt.toISOString()).toBe("2026-10-01T09:00:00.000Z");
  });

  it("sets endedAt to the last assistant turn timestamp", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    expect(r.session.endedAt?.toISOString()).toBe("2026-10-01T09:01:15.000Z");
  });

  it("sets projectPath from the user line cwd", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    expect(r.session.projectPath).toBe("D:\\workspaces\\myproject");
  });

  it("accumulates token usage across all 3 turns", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    // turn1: in=120 out=250  turn2: in=200 out=180  turn3: in=310 out=90
    expect(r.session.usage.inputTokens).toBe(630);
    expect(r.session.usage.outputTokens).toBe(520);
  });

  it("attaches durationMs to turns from system/turn_duration lines", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    expect(r.session.turns[0].durationMs).toBe(4823);
    expect(r.session.turns[1].durationMs).toBe(7540);
    expect(r.session.turns[2].durationMs).toBe(3100);
  });

  it("reads costUsd from cost-state line", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    expect(r.session.costUsd).toBeCloseTo(0.04812);
  });

  it("detects MCP tool call in turn 3", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    const turn3 = r.session.turns[2];
    expect(turn3.toolCalls).toHaveLength(1);
    expect(turn3.toolCalls[0].mcpServer).toBe("github");
    expect(turn3.toolCalls[0].toolLocalName).toBe("search_code");
  });

  it("detects non-MCP tool call (Bash) in turn 2", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    const turn2 = r.session.turns[1];
    const bash = turn2.toolCalls.find((tc) => tc.toolName === "Bash");
    expect(bash?.mcpServer).toBeNull();
  });

  it("skips unknown line types and malformed JSON without crashing", async () => {
    const r = await reader.read(FIXTURE, lineReader);
    // mode, permission-mode, tools-used, ai-title, attachment = 5 skipped + 1 malformed JSON
    expect(r.skippedLines).toBeGreaterThanOrEqual(5);
    expect(r.errors).toHaveLength(1);
  });
});
