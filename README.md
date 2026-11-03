<div align="center">

# 🔥 whyburn

### Find out **why** your AI coding agents burn tokens — and what to change.

Evidence-based, dollar-ranked guidance from your own sessions.<br>
Local-first. Private by default. Open source.

[![Status: coming soon](https://img.shields.io/badge/status-coming%20soon-orange)](#-coming-soon)
[![Local-first](https://img.shields.io/badge/runs-100%25%20locally-2ea44f)](#-privacy-first)
[![Built on ccusage](https://img.shields.io/badge/built%20on-ccusage-blue)](https://github.com/ccusage/ccusage)
[![GitHub stars](https://img.shields.io/github/stars/ajaykauthale1/whyburn?style=social)](https://github.com/ajaykauthale1/whyburn)

**[The problem](#-the-problem) · [What you'll get](#-what-youll-get) · [Preview](#-a-sneak-peek) · [Privacy](#-privacy-first) · [FAQ](#-faq)**

</div>

---

> [!NOTE]
> **whyburn is coming soon.** It's in early development and not installable yet.
> ⭐ **Star** or 👀 **Watch** this repo to get notified when the first release lands.

---

## 🤔 The problem

You open your usage report and the number is bigger than you expected. But *why*?

- Was it that one long session that never got compacted?
- The six MCP servers whose tool definitions ride along on **every single turn** — even the ones you never call?
- Running the top model for work a cheaper one could have done?
- That rules file you made "more thorough" last week?

Today's tools tell you **how much** you spent. None of them tell you **why**, or **what to change**.

## ✨ What you'll get

whyburn reads the data your coding agent already stores on your machine, connects the dots across all your sessions, and turns it into findings you can act on.

| | Question | What whyburn shows you |
|---|---|---|
| 🔌 | **Which MCP servers am I paying for but not using?** | Servers loaded in every session vs. actually called, with their estimated monthly cost |
| 🧠 | **Did I need the top model for that?** | Sessions that look like a cheaper model could have handled them, and what you'd have saved |
| 📝 | **Did my rules change help or hurt?** | The measured before/after effect of edits to `CLAUDE.md`, `AGENTS.md` and rules files |
| 💸 | **Where can I save the most?** | Every finding ranked by estimated dollars, with evidence and a concrete fix |

## 👀 A sneak peek

> _Illustrative preview of the planned output — numbers are made up._

```text
$ npx whyburn

  whyburn · last 30 days · 184 sessions · $212.40 estimated

  TOP FINDINGS                                              EST. SAVINGS
  ──────────────────────────────────────────────────────────────────────
  1  2 MCP servers loaded on every turn, called 0–2 times       ~$36/mo
     jira, browser → remove from .mcp.json

  2  23 sessions on the top model look like simple edits        ~$29/mo
     mostly reads + small diffs → try a smaller model

  3  Rules file grew +1.4k tokens on Oct 12                     ~$11/mo
     cost/session +18%, retries unchanged → trim or scope it

  Run `whyburn mcp`, `whyburn models` or `whyburn config` for details.
```

## 🧭 How it will work

```
 your agent's local logs ─┐
 usage & cost (ccusage) ──┼──▶  whyburn  ──▶  findings + $ estimates  ──▶  CLI · local dashboard
 your config files ───────┘     (on your machine)
```

1. **Reads** what's already on your disk — no proxy, no API keys, no setup.
2. **Connects** config, usage, cost and model choice across many sessions.
3. **Explains** each finding with the evidence behind it.
4. **Ranks** everything by how much fixing it would save.

## 🔒 Privacy first

- 💻 **Runs 100% on your machine.** No account, no cloud, no telemetry.
- 🙈 **Your prompts and code never leave your computer.** They're only read locally to compute findings.
- 🔍 **Open source**, so you can see exactly what it reads and does.

## 🤖 Supported agents

| Agent | Status |
|---|---|
| Claude Code | 🛠️ first up |
| Codex CLI | 🗓️ planned |
| Gemini CLI | 🗓️ planned |
| More coding agents | 💬 [tell us which](../../issues) |

## 🚀 Coming soon

When it's ready, getting started will be one command — no install, no config:

```bash
npx whyburn
```

**Want to help shape it?**

- ⭐ **Star** the repo to show interest
- 👀 **Watch → Releases** to be notified when it ships
- 💡 **[Open an issue](../../issues)** with the question you most want answered about your token usage

## ❓ FAQ

<details>
<summary><b>How is this different from ccusage?</b></summary>
<br>
ccusage is great at counting — tokens and cost by day, session and model. whyburn builds on it to answer the next question: <i>why</i> you spent it and <i>what to change</i>, by combining usage with your config and session behavior.
</details>

<details>
<summary><b>Is it different from config linters?</b></summary>
<br>
Linters read your config files and flag problems in isolation. whyburn looks at what actually happened across your sessions, so it can tell you things a linter can't — like an MCP server you load every day but never use.
</details>

<details>
<summary><b>Will it send my data anywhere?</b></summary>
<br>
No. Everything runs locally. Your prompts, code and transcripts stay on your machine.
</details>

<details>
<summary><b>Are the dollar amounts exact?</b></summary>
<br>
They're estimates based on public model pricing, meant to show where your spend goes and what's worth fixing. Your provider's bill is always the source of truth.
</details>

<details>
<summary><b>I'm on a subscription plan, not the API. Is it still useful?</b></summary>
<br>
Yes. Even if you don't pay per token, wasted tokens mean hitting usage limits sooner and slower, less focused sessions.
</details>

## 🙏 Acknowledgements

Usage ingest builds on the excellent [ccusage](https://github.com/ccusage/ccusage).

---

<div align="center">

**Stop guessing where your tokens go.** ⭐ Star the repo to follow along.

</div>
