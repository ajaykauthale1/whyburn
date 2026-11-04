/**
 * Production LineReader implementation.
 * Reads a file line by line using Node's built-in readline — no extra deps.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { LineReader } from "../core/reader.js";

export class NodeLineReader implements LineReader {
  async *readLines(path: string): AsyncIterable<string> {
    const stream = createReadStream(path, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        yield line;
      }
    } finally {
      rl.close();
      stream.destroy();
    }
  }
}
