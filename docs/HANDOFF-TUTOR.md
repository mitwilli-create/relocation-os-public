# Tutored-Build Handoff

You are a fresh Claude Code instance opening this repo to build [BUILD-PLAN.md](BUILD-PLAN.md) WITH Mitchell, not for him. Read `CLAUDE.md`, then `memory/MEMORY.md`, then the build plan, then this contract. This file governs how the sessions run.

## The contract

1. **Tutor mode.** Before every step: what we are about to do, why the system needs it, and what pattern it demonstrates, in 2 to 4 plain sentences. Then do it or hand it to Mitchell to do. Never execute a step whose purpose was not explained first.
2. **Mitchell drives where learning value is high.** He types: branch creation, PR creation, CodeRabbit replies, MCP server test invocations, merge. Claude types: boilerplate, repetitive edits, config plumbing. When Mitchell drives, give him the exact command with the 5-W structure (where to type it, what to type, why, how he'll know it worked, what to do if it fails).
3. **Small increments.** One module per session maximum; stop earlier at any natural checkpoint. Every session ends with a working, committed state and a one-paragraph recap of what was built and what was learned.
4. **Answer first, one next action, no menus.** Recommend one path with its main tradeoff. Mitchell's EF rules are canonical (his global CLAUDE.md).
5. **Locked decisions stay locked.** Consult `memory/constraints.md` before proposing anything; surface conflicts, never resolve them silently.
6. **Privacy quarantine is absolute.** Nothing from `memory/private/` enters tracked files, commit messages, or PR text. The pre-commit hook enforces it; do not work around a failure, fix the leak.
7. **Background subagents never get interactive prompts.** Any background Agent prompt must ban AskUserQuestion/approval pauses and include bounded-effort fallbacks (see global memory: background-agent-interactive-hang).
8. **Verify before claiming done.** Run the module's verification list from the build plan before calling a module complete. CodeRabbit findings get addressed (fix or reasoned reply), never ignored.

## Session opener (run this every time)

1. State where we are: last completed module, current branch, any open PR.
2. State the goal of this session in one sentence.
3. Confirm the privacy gate passes before starting new work.

## Current state at handoff (2026-07-09, after Module 4)

- v0.1 merged on main: harness, tiered memory, mission pattern, SDLC, privacy gate (pre-commit enforced).
- Module 1 merged (PR #2): standing council roles 7 to 9 (Language, Visa, Tax specialists). Council now has 6 mission roles + 3 standing roles.
- Em-dash scrub merged (PR #5), with the research-archive exception documented in CLAUDE.md.
- Module 2 merged (PR #6): eval harness. Zero-dependency runner `scripts/run-evals.mjs`, schema-encoded invariants in `evals/schemas/`, golden diff for step 0, fixture self-test (`evals/fixtures/`), and merge-blocking CI in `.github/workflows/checks.yml`. Decision recorded in ADR-0003 (custom runner over promptfoo; promptfoo revisited at Module 4).
- ADR-0004 merged (PR #7): privacy-check redesign so the marker list stops self-disclosing. The marker scan now lives in gitignored `memory/private/privacy-patterns.txt` and self-skips where that file is absent (CI); structural checks always run. `scripts/privacy-check.sh` and `docs/SDLC.md` updated.
- Module 3 merged (PR #8, `c34a0c8`): `relocation-kb` MCP server. Scoped, read-only, TypeScript on the official SDK run via Node native type stripping (no build step), at `mcp/relocation-kb/`. Three tools (`search_claims`, `read_claim`, `list_topics`), all `readOnlyHint`, `memory/private/` denied by construction (canonicalize-then-verify path gate). Decision + security rationale in ADR-0005, backed by an adjudicated council report. Connected under both runtimes (`.mcp.json` for Claude Code + `~/.codex/config.toml` for Codex, both pointing at one `src/index.ts`). One CodeRabbit finding (symlink-traversal leak) fixed and regression-tested (`test/symlink-test.ts`).
- Module 4 merged (PR #9, `3060715`): two portable skills, `mission-runner` and `constraint-gate`. Each is a canonical `skills/<name>/SKILL.md` (name + description frontmatter only) with a zero-dependency backing `scripts/<name>.mjs`, discovered by both runtimes through committed relative symlinks (`.claude/skills/<name>` and `.agents/skills/<name>` to `../../skills/<name>`). The authoring pattern is locked in ADR-0006, routed through the council-of-models then dealbreaker chain; adjudication reversed the council on two points (it followed symlinks over committed copies, and kept canonical files at `skills/` rather than the council's proposed `.agents/skills/` path). Verified cross-runtime live in Codex. Each skill is gated in CI by `scripts/skills-selftest.mjs` (synthetic fixtures assert behavior and exit codes). Four CodeRabbit rounds addressed, notably a privacy fix (eliminated-city matches reported by count, never name, so gate output is PR-safe) and an L1 correctness fix (airport transit through an eliminated location FLAGs, only destination use CONFLICTs).
- Module 4 completed (PR #10): the other two skills, `award-watch` (monitor United/Star Alliance award options, cents-per-mile, L4/L5 flags, refuses any book request; it has no booking path) and `city-dossier` (per-city dossier from KB claims in the relocation-kb served scope, never `memory/private/`, file:line sources, 90-day freshness flags), both on the same ADR-0006 pattern with `skills-selftest.mjs` cases gated in CI. Module 4 now has all four skills.
- PRs #3 and #4 closed unmerged: #3 was a stacked-base casualty, #4 an accidental duplicate. Nothing from them is pending; do not resurrect.
- Ruleset caveat: GitHub rulesets need Pro or a public repo, so the `gates` check is NOT yet a hard merge block. Discipline is procedural (never merge on red) until the Module 5 public cut. Recorded in `docs/SDLC.md`.
- Main is clean; privacy gate, `node scripts/run-evals.mjs`, and `node scripts/skills-selftest.mjs` all pass.
- Adjudicated research in `knowledge/research/` (55 claims: 35 verified, 15 corroborated, 3 unique kept, 2 cut). Build only on kept claims; rows 5 and 10 are cut, do not cite them.
- CodeRabbit Pro covers all of Mitchell's repos; never instruct an install step.
- Next up: Module 5 (synthetic twin + portfolio case study), see BUILD-PLAN.md. Module 4 is complete (all four skills: `mission-runner`, `constraint-gate`, `award-watch`, `city-dossier`). Module 5 adds `sanitize-for-portfolio` (its enforcement tool), the synthetic twin, architecture diagrams, and the public case study. Every new skill follows the locked ADR-0006 pattern (canonical SKILL.md, two committed symlinks, backing script, a `skills-selftest.mjs` case in CI) and gets a Module 2 eval before merge.
