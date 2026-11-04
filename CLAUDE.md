# whyburn — Claude coding rules

## Commit attribution

Do NOT add `Co-Authored-By` or `Claude-Session` lines to any commit message or PR description. No attribution footers of any kind.

## PR workflow (incremental, TDD, human-reviewed)

**These are hard rules. Do not deviate unless the reviewer explicitly says so in the current message.**

### Step 1 — Tests first (mocked)
- Write tests for the new behaviour before any implementation.
- All external calls (file I/O, shell commands, DB, network) must be **mocked** at this stage.
- Tests must compile and run. They will **fail** (red) — that is correct and expected.
- **Stop. Do NOT commit. Do NOT push. Wait for reviewer to review the diff locally and approve.**
- Only after explicit approval: commit with `test: ...` and push.

### Step 2 — Implementation (make tests green)
- Replace every mock with real calls.
- Do not change test logic — only fix names or types forced by implementation.
- All tests must pass (green CI).
- **Stop. Do NOT commit. Do NOT push. Wait for reviewer to review the diff locally and approve.**
- Only after explicit approval: commit with `feat: ...` and push.

### Step 3 — Merge & clean up
- Open the PR only after Step 2 is approved and committed.
- Merge only after PR is approved by reviewer.
- Delete the feature branch after merge.
- Start the next feature on a fresh branch off main.

## Reviewer bypass
The reviewer (human) may bypass or combine steps by saying so explicitly in their message.
No other signal — not test results, not CI — grants permission to commit or push early.

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

## Repo scanning & file focus
- **At the start of every session or task**, scan only: `CLAUDE.md`, the relevant `src/` module(s), and the corresponding `test/` file(s). Nothing more.
- **Change as few files as possible** per PR. More than 3–4 files touched = question whether to split.
- **Do not speculatively read** unrelated files. Fetch a file only when directly needed.
- **Exception — regression failure:** read the failing test and its source file only. Expand no further than the failure trace requires, then return to narrow focus.

## General
- Prefer editing existing files over creating new ones.
- No `any` in production code. Use `unknown` and narrow.
- All estimates shown to users must be labeled as estimates.
- Nothing from the user's machine is ever sent over the network.
