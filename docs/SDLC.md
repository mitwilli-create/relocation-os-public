# Software Development Lifecycle

Every non-trivial change to Relocation OS follows this loop. "Non-trivial" means anything that changes system behavior: harness rules, memory schema, pipelines, scripts, agent definitions. Typo fixes and dated mission outputs are exempt.

## The loop

1. **Research.** Route open questions through the council-of-models → dealbreaker chain. Raw output lands in `knowledge/research/`; only adjudicated claims inform design.
2. **Decide.** Write an ADR in `docs/decisions/ADR-NNNN-title.md`: context, decision, alternatives considered, consequences. One decision per ADR.
3. **Implement.** On a branch, never on main. Match existing file conventions. Keep commits scoped to one concern.
4. **Verify locally.** Run `scripts/privacy-check.sh` (must pass), run `node scripts/run-evals.mjs` (must pass), confirm internal links resolve, run any touched scripts end to end.
5. **Review.** Open a PR. CodeRabbit auto-reviews (the owner's Pro subscription covers all repos on this account; no per-repo installation or setup step exists, so never instruct one). Address every finding: fix it or reply with reasoning. No self-merge with unaddressed findings.
6. **Merge and record.** Squash-merge, update the README status checklist if a milestone moved.

## Branch and PR conventions

- Branches: `feat/`, `fix/`, `docs/`, `research/` prefixes.
- PR body: what changed, why, which ADR (if any), verification evidence.
- This is a solo repo with machine review; the PR discipline exists for CodeRabbit coverage and portfolio-grade history, not ceremony.

## Privacy gate (blocking)

`scripts/privacy-check.sh` runs two layers (ADR-0004). Structural checks always run: no tracked files under `memory/private/`, the `.gitignore` quarantine line intact, no tracked env files. The marker scan runs only where the gitignored pattern list `memory/private/privacy-patterns.txt` exists, meaning Mitchell's machines, never CI. The pattern list is itself quarantined content: extend it in the same change whenever private memory grows, and never quote it into tracked files, commits, or PR text.

CI (`.github/workflows/checks.yml`) runs the same script and therefore enforces the structural layer only. A green CI run is not evidence of marker cleanliness; the local pre-commit run is. Run the gate manually before commit (it should also be wired as a pre-commit hook). A local failure blocks the commit, no exceptions.

## CI gate (blocking)

`.github/workflows/checks.yml` runs on every PR and every push to main, as one job named `gates` with three fail-fast steps: the privacy gate, schema validation (`node scripts/run-evals.mjs --schemas-only`), then the full eval suite (`node scripts/run-evals.mjs`). The commands are identical to the local ones, so green locally means green in CI. A branch ruleset on main should require the `gates` check; rulesets need GitHub Pro or a public repo, so until the Module 5 public cut the red X is advisory and merge discipline is procedural: never merge on red. Mission outputs must conform to `evals/schemas/` (see `evals/README.md` and ADR-0003).

## Research hygiene

- Every claim in `knowledge/` carries: source, date, verification tier (verified / corroborated / unique / contradicted).
- Facts older than 90 days re-verify before they drive an action.
- Council reports are immutable once written; corrections happen in new dated files.
