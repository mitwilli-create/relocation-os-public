# ADR-0003: Eval harness: custom runner with invariant assertions

Date: 2026-07-08
Status: Accepted

## Context

Module 2 of the build plan requires numeric, CI-enforced quality gates for the system's own agents and pipelines. The adjudicated research supports this directly: eval gates decide accept/reject (Row 27, verified), golden transcripts should diff structured outputs rather than raw text (Row 29, verified), and promptfoo, inspect_ai, and Langfuse are the field-standard tooling (Row 31, verified). Row 30 (corroborated) tempers Row 29: golden transcripts are brittle, and invariant assertions (citations present, prohibited files untouched, schema valid) are preferred.

The artifacts under evaluation are static markdown mission outputs written to `missions/*/outputs/NN-slug.md`. Their contracts exist today as prose: the "Done when" column of `pipeline.md` and the role deliverable checklists in `council/roles.md`. Nothing in this repo makes live LLM calls at CI time. The build plan named promptfoo as the default runner with an explicit swap clause: "swap if the tutored session finds friction."

## Decision

1. **Custom zero-dependency Node runner over promptfoo.** The friction the swap clause anticipated showed up at design time. Promptfoo supports assertion-only runs on pre-existing outputs, but every check this repo needs (section presence, regex invariants, frontmatter validation, standing flags) would be a `javascript:` custom assertion anyway, plus glue code packaging markdown files into promptfoo's JSON input format. That means installing a large npm dependency tree into a repo with no `package.json` to get a wrapper around JavaScript we still write ourselves. Instead, `scripts/run-evals.mjs` uses only `node:fs`, `node:path`, and regex, and is invoked as `node scripts/run-evals.mjs`. The whole engine is readable in one sitting, which serves the tutored-build goal.
2. **JSON section manifests plus flat frontmatter as the schema layer.** `evals/schemas/output-frontmatter.json` defines the common frontmatter contract (mission, step, owner, date) and `evals/schemas/steps.json` encodes each pipeline step's required sections and named regex invariants. Frontmatter is restricted to flat `key: value` lines so the runner parses it without a YAML library. The human source of truth is unchanged: `pipeline.md`'s "Done when" column and `council/roles.md` prose stay authoritative, and `steps.json` is their machine-checkable encoding.
3. **Invariant-first assertion policy; golden restricted to step 0.** Step 0 (constraint math) is the only deterministic step: fixed inputs, one correct numeric outcome per option. The runner extracts a normalized JSON object (per-option day totals and PASS/FAIL verdicts) and deep-compares it against `evals/golden/00-constraint-math.expected.json`. Prose can change freely; the numbers cannot. All other steps get invariant assertions only, per Row 30.
4. **Fixture self-test keeps "broken fails" continuously proven.** `evals/fixtures/valid/` must always pass and every file in `evals/fixtures/broken/` must fail the specific check named in its `expect_fail` frontmatter key. A broken fixture that passes is itself a CI failure. This inverts the module's verification: CI stays green while permanently proving the gate bites.
5. **Privacy patterns stay single-sourced in `scripts/privacy-check.sh`.** The eval runner does not duplicate the private-marker list. CI runs the privacy script as its own step; the runner delegates rather than re-implements.

## Alternatives considered

- **promptfoo standalone-assertion mode**: works technically, but all assertions would be custom JS plus JSON packaging glue, and a large dependency tree lands in a dependency-free repo. Rejected for this module; re-evaluated at Module 4, where skills introduce live agent calls and promptfoo's matrix evals and model-graded assertions earn their weight.
- **Full JSON Schema with ajv**: wrong shape for markdown bodies (JSON Schema validates object trees, not section structure), and forces a `package.json`. Rejected.
- **Golden transcripts for all steps**: rejected on Row 30 brittleness; steps 1 through 8 depend on live research and would produce constant false failures.

## Consequences

- New mission outputs must carry the flat frontmatter block and pass their `steps.json` entry or CI blocks the PR.
- Adding a pipeline step now requires a `steps.json` entry and at least one fixture.
- `evals/fixtures/broken/` files intentionally violate repo style rules (for example the em-dash ban) because violating exactly one rule each is their job. They are the documented exception, mirroring the `knowledge/research/` archive exception.
- The runner must stay dependency-free until an ADR says otherwise.
- promptfoo is revisited at Module 4 for the live-call class of evals; this runner remains the static-artifact gate regardless.
