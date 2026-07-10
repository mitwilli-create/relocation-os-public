# Skills

Reusable skills for Relocation OS sessions, portable across Claude Code and Codex
(ADR-0006). Each skill is one canonical `skills/<name>/SKILL.md` with `name` +
`description` frontmatter only; its deterministic logic lives in a backing
`scripts/<name>.mjs` (the model routes to the skill, the script enforces the rule).

## Discovery (both runtimes, one source)

Canonical files live here under `skills/<name>/`. Neither runtime scans this directory,
so discovery is provided by committed relative symlinks to the same canonical dir:

- Claude Code reads `.claude/skills/<name>` -> `../../skills/<name>`.
- Codex reads `.agents/skills/<name>` -> `../../skills/<name>` (project scope).

Both runtimes follow symlinks natively (verified against official docs; see ADR-0006), so
they execute byte-identical files with zero drift. For global out-of-repo Codex use, a
user-scope `~/.agents/skills/<name>` symlink is optional and uncommitted.

## Built (Module 4)

- `mission-runner`: execute a mission's `pipeline.md` deterministically, one output file
  per step, gates enforced. Backing script `scripts/mission-runner.mjs`. Refuses to cross
  a booking-adjacent step while registry gates L3 (cat-sitting) or L7 (offer) are
  unresolved.
- `constraint-gate`: validate any proposed plan against the locked-decision registry
  (`memory/constraints.md`, L1-L8). Backing script `scripts/constraint-gate.mjs`. Surfaces
  conflicts; never resolves them. L1 reads a gitignored private list and self-skips when
  absent.
- `award-watch`: monitor observed United/Star Alliance award options against the registry.
  Backing script `scripts/award-watch.mjs`. Computes cents-per-mile, flags L4 (carrier /
  miles budget) and L5 (Frankfurt/Munich hubs), and refuses any book request (it has no
  booking path; L3/L7 gate any real redemption). Monitors only; never books.
- `city-dossier`: assemble a per-city evaluation dossier from KB claims. Backing script
  `scripts/city-dossier.mjs`. Reads only the `relocation-kb` served scope (`knowledge/`,
  tracked `memory/`, never `memory/private/`), attributes every claim to a `file:line`
  source, and flags any source older than 90 days.

Each ships a Module 2 eval (`scripts/skills-selftest.mjs`, gated in CI).

## Deferred

- `sanitize-for-portfolio`: produce the public case-study cut with privacy-check
  enforcement (Module 5's enforcement tool).
