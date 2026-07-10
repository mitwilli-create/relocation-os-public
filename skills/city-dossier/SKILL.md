---
name: city-dossier
description: Assemble a per-city evaluation dossier from knowledge-base claims, every claim source-attributed and freshness-checked. Use when evaluating or comparing a candidate city (Gijon, Malaga, Valencia, Sevilla, Las Palmas), gathering what the KB already knows about a place, or checking whether the evidence for a city is stale. Reads only the served scope (knowledge/, tracked memory/), never private memory; flags any source older than 90 days.
---

# city-dossier

Pull together everything the knowledge base says about one city, with a source on every
claim and a freshness flag on every source. Retrieval and freshness scoring are
deterministic and live in `scripts/city-dossier.mjs`; this skill routes to it and relays
the dossier. It reads only what the `relocation-kb` MCP server would serve (tracked
`knowledge/` and `memory/`); it never touches `memory/private/`.

## Procedure

1. **Prefer the MCP tools for interactive lookup.** When the `relocation-kb` server is
   connected, `search_claims` and `read_claim` are the scoped read path for exploring what
   exists. Use them to sanity-check spelling and see the raw claims.

2. **Run the engine to build the artifact.** From the repo root:

   ```sh
   node scripts/city-dossier.mjs "Gijon"
   node scripts/city-dossier.mjs --json "Las Palmas"
   ```

   City matching is accent- and case-insensitive, so `Gijon` matches `Gijón`.

3. **Relay the dossier as-is.** It groups claims by source file, each line carried as a
   `claim_id:line` citation, with a `FRESH` / `STALE` / `UNKNOWN date` tag per source. Do
   not drop the citations or the freshness tags; they are the point of the dossier.

4. **Act on the exit code:**
   - `0` assembled, all dated sources within the 90-day window.
   - `1` assembled, but one or more sources are STALE (older than 90 days). Re-verify those
     claims before acting on them; route regulatory or price facts through council research
     and land dated, adjudicated updates back into memory.
   - `3` no claims found for that city. It may not be a tracked candidate, or the spelling
     differs. Check `memory/candidates.md` and try the MCP `search_claims` tool.

## Rules

- Scope is fixed: `knowledge/` and tracked `memory/`, never `memory/private/`. The script
  will not read private memory even if asked; that boundary is enforced in code, not by
  `.gitignore` (ADR-0004, ADR-0006 decision 4). Do not add a private path to widen it.
- A dossier is evaluation input, not a plan. Any booking it informs is gated by L3
  (cat-sitting) and L7 (offer). Run `constraint-gate` on any plan derived from a dossier.
- UNKNOWN-date sources are not asserted stale (no date to judge), but treat undated facts
  with caution; prefer sources that carry a `Last confirmed:` line.
- No interactive prompts. The engine scans the scope once and exits.
