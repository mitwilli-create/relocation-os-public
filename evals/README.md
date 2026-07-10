# Evals

An eval is a machine-checkable assertion about an artifact this system produced. The runner (`scripts/run-evals.mjs`, zero dependencies, ADR-0003) validates every mission output and every fixture against the schemas here, and CI blocks any PR where one fails.

## Run it

```bash
node scripts/run-evals.mjs                # full run
node scripts/run-evals.mjs --schemas-only # frontmatter + required sections only
```

Exit 0 means every gate passed. Exit 1 prints each failure with the file, the check name, and the schema line that demanded it.

## Layout

- `schemas/output-frontmatter.json`: the flat frontmatter block every output must open with.
- `schemas/steps.json`: per-pipeline-step required sections and named invariants. This is the machine twin of `pipeline.md`'s "Done when" column; the prose stays the source of truth, and both change in the same PR.
- `golden/`: structured expected values for deterministic steps (step 0 only; see ADR-0003 on why golden stays narrow).
- `fixtures/valid/`: synthetic outputs that must always pass. All numbers fictional.
- `fixtures/broken/`: synthetic outputs that must each fail exactly the check named in their `expect_fail` frontmatter key. A broken fixture that passes fails CI: the suite proves the gate bites on every run, not just the day it was written. These files intentionally violate style rules; that is their job (documented exception, ADR-0003).

## Add an assertion

1. Decide which prose contract it enforces (a "Done when" cell, a standing flag, a style rule, a registry entry) and name it in the invariant's `why`.
2. Add the invariant to `schemas/steps.json` (types: `present`, `absent`, `count` with `count` or `min`, `first_h2`).
3. Add a broken fixture to `fixtures/broken/` with `expect_fail: <your-invariant-name>` so the self-test proves it bites.
4. Run `node scripts/run-evals.mjs` and confirm PASS.

Privacy is deliberately NOT re-implemented here: `scripts/privacy-check.sh` stays the single source of the private-marker list and runs as its own gate, pre-commit and in CI.

## Skill evals

The Module 4 skills (`mission-runner`, `constraint-gate`) are gated by
`scripts/skills-selftest.mjs`, not by this markdown runner: their contract is script
behavior plus exit codes, not output-file shape. The self-test builds synthetic fixtures
in a temp dir and asserts each branch (booking freeze, ordering violation, pipeline
complete; each L1-L8 verdict and the L1 self-skip). It runs as its own fail-fast step in
CI (ADR-0006). A skill that also produces a mission output (mission-runner's Gate 0) is
additionally validated by this runner through the normal schema, golden, and gate-ordering
checks.
