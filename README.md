# whyburn

**Find out *why* your AI coding agents burn tokens — and what to change.**

> 🚧 **Coming soon.** whyburn is in early development. Star or watch this repo to follow along.

---

Dashboards tell you how much you spent. **whyburn** will tell you *why*, using evidence from your own sessions — and give you concrete, dollar-ranked fixes.

## What it will help you answer

- **Which MCP servers am I paying for but not using?** Tool definitions are sent on every turn, even when the tools are never called.
- **Which sessions didn't need the top model?** Spot work that a cheaper model could have handled.
- **Did that change to my rules or instructions help or hurt?** See the measured effect of edits to files like `CLAUDE.md` and `AGENTS.md`.
- **Where can I save the most?** Every finding comes with evidence, a suggested fix and an estimated saving.

## Principles

- **Measure, don't guess.** Findings are backed by what actually happened in your sessions, not just by reading config files.
- **Local-first and private.** Runs on your machine. Your prompts and code never leave it.
- **Cross-agent.** Starting with Claude Code, with more coding agents to follow.
- **Open source.**

## Coming soon

```bash
npx whyburn
```

Ideas, questions or wishes? Open an issue — early feedback is very welcome.

## Acknowledgements

Usage ingest will build on [ccusage](https://github.com/ccusage/ccusage).
