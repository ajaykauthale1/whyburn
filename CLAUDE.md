# whyburn — Claude coding rules

## PR workflow (incremental, TDD, human-reviewed)

Every feature follows this exact sequence by default. The reviewer (you) may explicitly skip or combine steps at any time — just say so.

### Step 1 — Tests first (mocked)
- Write tests for the new behaviour before any implementation.
- All external calls (file I/O, shell commands, DB, network) must be **mocked** at this stage.
- Tests should compile and run. They will **fail** (red) — that is correct.
- Push the branch and wait for reviewer approval before continuing.
- **Reviewer may say:** "skip to impl" or "combine steps" to bypass this gate.

### Step 2 — Implementation (make tests green)
- Replace every mock with real calls.
- Do not change tests themselves except for name/type fixes forced by implementation.
- All tests must pass (green CI) before asking for review.
- Push and wait for reviewer approval before merging.
- **Reviewer may say:** "ship it" to merge without a separate review round.

### Step 3 — Merge & clean up
- Merge only after the current open step is approved (or reviewer bypasses it).
- Delete the feature branch after merge.
- Start the next feature on a fresh branch off main.

## Branch naming
`feat/<short-name>` — new feature  
`fix/<short-name>` — bug fix  
`chore/<short-name>` — tooling, deps, docs

## Commit style
Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`  
One logical change per commit. Keep commits small and readable.

## PR size
- **Small and focused.** One concern per PR.
- A PR that cannot be reviewed in one sitting is too large — split it.
- Each PR description must state: what it does, what is mocked/stubbed, and what the next PR will do.

## Testing
- Tests live in `test/` and mirror the `src/` structure.
- Fixtures go in `test/fixtures/` — anonymize any real transcript data.
- Every new module needs at least one unit test before its PR is merged.
- Mocks are removed in the implementation PR, never left in production code.

## General
- Prefer editing existing files over creating new ones.
- No `any` in production code. Use `unknown` and narrow.
- All estimates shown to users must be labeled as estimates.
- Nothing from the user's machine is ever sent over the network.

## Repo scanning & file focus

- **At the start of every session or task**, do a lightweight scan: read `CLAUDE.md`, the relevant `src/` module(s), and the corresponding `test/` file(s) for the current task. Nothing more.
- **Change as few files as possible** per PR. If a task touches more than 3–4 files, question whether it should be split.
- **Do not speculatively read** unrelated files. Work from what is in context; fetch a file only when it is directly needed.
- **Exception — regression failure:** if CI or the test runner reports a failure outside the current module, read the failing test and its source file. Expand scope only as far as the failure trace requires, then stop.
- After a regression is fixed, return to the original narrow focus.
