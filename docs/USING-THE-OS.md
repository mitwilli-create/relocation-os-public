# Using the OS

A short quickstart for the four things you actually do with this system: kick off a mission,
gate a plan, query the knowledge base, and invoke a skill. Each is shown two ways, because the
system runs under two runtimes: Claude Code (which reads `.claude/skills` and `.mcp.json`) and
Codex (which reads `.agents/skills` and `~/.codex/config.toml`). The skill files and backing
scripts are byte-identical across both; only the discovery path differs.

Every skill has a deterministic backing script you can run directly, and a `SKILL.md` the
agent routes to on its own. When you want the agent to decide, describe the task and let the
description trigger the skill. When you want determinism (CI, a script, a reproducible check),
call the backing script.

## Prerequisites

- Node 24 or newer (the scripts are zero-dependency; the MCP server uses native type
  stripping, no build step).
- For the private-data features, restore `memory/private/` on the machine. Without it, the
  constraint gate's eliminated-cities check self-skips with a NOTE (never a silent pass) and
  the sanitize verification refuses to run. To try the system on fictional data instead, copy
  the synthetic twin into place: `cp memory/synthetic/* memory/private/`.

## 1. Kick off a mission

A mission is a folder under `missions/` with an ordered `pipeline.md`. The runner reports the
next step, enforces ordering, and refuses to cross a booking-adjacent step while hard gates are
unresolved.

Direct script (either runtime):

```sh
node scripts/mission-runner.mjs missions/2026-07-scouting-trip
node scripts/mission-runner.mjs --json missions/2026-07-scouting-trip
```

It prints the next step to produce and the current gate state, and exits non-zero while the
pipeline is incomplete or blocked. Produce that step's output file under the mission's
`outputs/`, then run it again. The exit code is the source of truth for whether the mission may
proceed.

Through the agent:
- Claude Code: "Advance the scouting-trip mission." The `mission-runner` description triggers;
  the agent runs the engine and produces the next step.
- Codex: same phrasing. Codex discovers the identical skill through `.agents/skills/`.

## 2. Gate a plan

Before acting on any itinerary or booking, validate it against the locked-decision registry
(L1 through L8). The gate reads the plan on stdin and surfaces conflicts; it never resolves
them.

Direct script (either runtime):

```sh
echo "Fly to Gijon for 6 days of desk research. No booking." | node scripts/constraint-gate.mjs -
echo "Book Spain via Frankfurt, 12 days total." | node scripts/constraint-gate.mjs --json -
```

Exit `0` means no hard conflict (soft preferences may still be FLAGged). Exit `2` means a
CONFLICT or a BLOCKED gate: stop and address it. Eliminated-location matches are reported by
category, never by name, so the output is safe to share.

Through the agent: "Run the constraint gate on this plan: ..." Both runtimes route to the same
skill and relay the verdict.

## 3. Query the knowledge base

Retrieve claims through the `relocation-kb` MCP server instead of opening memory files. The
tools are read-only and scoped, and they never expose `memory/private/`.

- Claude Code: the server is registered in `.mcp.json`. Ask a question ("What does the KB say
  about Valencia's expat density?") and the agent calls `search_claims` / `read_claim`. Or list
  what exists with `list_topics`.
- Codex: the same server is registered in `~/.codex/config.toml`, pointing at the same
  `src/index.ts`. The tool names and behavior are identical.

For a source-attributed, freshness-flagged dossier on one city, use the `city-dossier` skill:

```sh
node scripts/city-dossier.mjs "Gijon"
node scripts/city-dossier.mjs --json "Las Palmas"
```

Every claim carries a `file:line` source and a FRESH / STALE / UNKNOWN tag. Exit `1` means at
least one source is older than 90 days and should be re-verified before you rely on it.

## 4. Invoke a skill

All five skills follow the same pattern, so invocation is uniform.

| Skill | Direct script | What it does |
| --- | --- | --- |
| `mission-runner` | `node scripts/mission-runner.mjs DIR` | Advance a mission, gates enforced |
| `constraint-gate` | `... \| node scripts/constraint-gate.mjs -` | Validate a plan against the registry |
| `award-watch` | `... \| node scripts/award-watch.mjs -` | Monitor award options, never books |
| `city-dossier` | `node scripts/city-dossier.mjs CITY` | Source-attributed city dossier |
| `sanitize-for-portfolio` | `node scripts/sanitize-for-portfolio.mjs` | Build and verify the public cut |

To let the agent choose, just describe the task; the `description` frontmatter is the routing
trigger and is identical in both runtimes. To be deterministic, call the script and read the
exit code. That split (the model chooses the skill, the script enforces the rule) is the core
of the design.

## Producing the public cut

When you want to refresh the public showcase:

```sh
node scripts/sanitize-for-portfolio.mjs
```

On PASS, review `dist/public-cut/` and push it to the separate public repo. The script builds
and proves; publishing is a deliberate human step, by design. See
[ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit and
[HOW-IT-FAILS.md](HOW-IT-FAILS.md) for the threat model.
