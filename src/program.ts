import { Command } from "commander";
import { VERSION } from "./version.js";

/**
 * Builds the CLI program. Kept separate from `cli.ts` so tests can
 * create and inspect it without running it.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("whyburn")
    .description("Find out why your AI coding agents burn tokens — and what to change.")
    .version(VERSION, "-v, --version", "print the version");

  // Commands are added here as they are built, e.g.:
  // program.addCommand(mcpCommand());

  return program;
}
