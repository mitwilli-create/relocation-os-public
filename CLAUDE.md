# Relocation OS: Harness Contract (Claude Code)

This file is the operating contract for any Claude Code instance working in this repo. Codex instances read AGENTS.md, which mirrors this contract. If the two ever diverge, this file wins and the divergence is a bug: fix AGENTS.md in the same commit.

## Load order (context economy)

1. Read `memory/MEMORY.md` (Tier 1 index). Always. It is small by design.
2. Load Tier 2 memory files ONLY when the task touches their topic. Never bulk-load `memory/`.
3. `memory/private/` holds personal context. Read it when personalizing recommendations; NEVER quote it into committed files, commit messages, PR text, or any tracked artifact.
4. When the `relocation-kb` MCP server is connected, prefer its read-only tools (`search_claims`, `read_claim`, `list_topics`) to retrieve KB claims instead of opening `knowledge/` or `memory/` files directly. The tools are scoped and never expose `memory/private/`. Direct file reads are the fallback. See ADR-0005.

## Locked decisions (never re-litigate)

The registry lives in `memory/constraints.md`. Highlights that govern everything:

- Three cities are permanently eliminated on values-based criteria (list and reasoning in `memory/private/personal-context.md`). Do not re-argue them, do not route trips through them as destinations.
- 10-day total ceiling on international trips, including travel days. Non-negotiable (cat care).
- Star Alliance / United miles preferred for international legs. Avoid Frankfurt/Munich hubs. TAP via Lisbon and SWISS via Zürich preferred.
- Cat-sitting logistics are UNRESOLVED and are a prerequisite to any booking. Flag on every booking-adjacent output.
- Nothing moves on relocation until a signed, relocation-compatible offer with work-from-abroad in writing.

If a proposed action conflicts with the registry, stop and surface the conflict instead of proceeding.

## Mission pattern

Each trip or evaluation is a folder under `missions/` containing:

- `BRIEF.md`: pointer to the full brief (full text lives in `memory/private/` if sensitive)
- `pipeline.md`: the ordered, deterministic step list with owner (agent/script) per step
- `outputs/`: dated artifacts, one file per council section

Missions run council roles in the order the brief specifies. Constraint math (for example the 10-day ceiling) is solved and presented BEFORE any downstream recommendation work begins.

## Council usage

The six mission roles and three standing roles are defined in `council/roles.md`. Research questions route through the council-of-models → dealbreaker chain (agents available in the parent Claude Code environment). Raw council output goes to `knowledge/research/`; only adjudicated claims graduate into `memory/` or `knowledge/kb/`.

## Skills (portable across both runtimes)

Reusable skills live at `skills/<name>/SKILL.md` (canonical, `name` + `description`
frontmatter only). Both runtimes discover them through committed symlinks: `.claude/skills/`
for Claude Code, `.agents/skills/` for Codex. Each skill's deterministic logic is a backing
`scripts/<name>.mjs`; the SKILL.md routes to it, the script enforces the rule (ADR-0006).

- `mission-runner`: run a mission's `pipeline.md` in order, one output per step, gates
  enforced; refuses to cross a booking-adjacent step while L3/L7 are unresolved.
- `constraint-gate`: validate a proposed plan against the L1-L8 registry; surfaces
  conflicts, never resolves them.
- `award-watch`: monitor observed United/Star Alliance award options; computes
  cents-per-mile, flags L4/L5, refuses any book request (no booking path; L3/L7 gate any real
  redemption, which happens elsewhere). Never books.
- `city-dossier`: assemble a per-city evaluation dossier from KB claims in the served scope
  (never `memory/private/`); attributes every claim to a source and flags sources over 90 days old.
- `sanitize-for-portfolio`: build the public cut (tracked files only, into gitignored
  `dist/public-cut/`, `memory/synthetic/` standing in for the private corpus) and scan it with
  the full marker list (privacy patterns plus eliminated names) via the cut's own
  privacy-check. Fails on any marker hit; refuses on a missing marker source; never pushes
  (ADR-0007).

## Determinism rules

- Orchestration order lives in `pipeline.md` files and scripts, not in improvised agent judgment.
- Agents return structured output (defined schemas or fixed section headers), never free-form essays.
- Every research claim carries attribution: source model, source URL, verification tier.
- Scripts in `scripts/` must be idempotent and runnable standalone.

## SDLC gates (see docs/SDLC.md)

- Non-trivial changes get an ADR in `docs/decisions/` before implementation.
- All work lands via branch + PR. CodeRabbit reviews every PR; address its findings before merge.
- Evals gate merge: CI (`.github/workflows/checks.yml`) runs the privacy gate, schema validation, and `node scripts/run-evals.mjs` on every PR. Mission outputs must conform to `evals/schemas/` (ADR-0003).
- Verify before claiming done: run relevant scripts, check links, confirm no `memory/private/` content leaked into tracked files (`scripts/privacy-check.sh`).

## Privacy quarantine (hard rule)

`memory/private/` is gitignored. Before any commit, confirm nothing personal (eliminator reasoning, salary figures, health/identity details, personality profile) appears in tracked files. The public story is "values-based constraints exist and are enforced by the harness"; the specifics stay private.

## Style

Conclusions first. Short sentences. Plain language. No corporate speak. No em dashes in any tracked file. Quantify uncertainty with numbers, not hedges.

One exception to the em-dash rule: files under `knowledge/research/` are verbatim archived council output and immutable once written (see `knowledge/README.md`). Their original punctuation stays as delivered. Do not scrub them.
