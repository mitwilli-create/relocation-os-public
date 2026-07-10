---
name: mission-runner
description: Execute a Relocation OS mission's pipeline deterministically, one output file per step, gates enforced. Use when running or advancing a mission under missions/, producing the next pipeline step, or checking whether a mission may proceed. Refuses to cross a booking-adjacent step while registry gates L3 (cat-sitting) or L7 (offer) are unresolved.
---

# mission-runner

Run a mission's `pipeline.md` in order, produce exactly one output file per step, and
never cross a gate that is not satisfied. The gate logic is deterministic and lives in
`scripts/mission-runner.mjs`; this skill routes to it and interprets the verdict. You
author step content; the script decides what may be produced. It never authors output and
never resolves a gate.

## Procedure

1. **Ask the engine what is next.** From the repo root:

   ```sh
   node scripts/mission-runner.mjs [missionDir]     # default: missions/2026-07-scouting-trip
   ```

   Read its verdict and exit code. Do not reorder steps by judgment; the engine owns order.

2. **Act on the verdict:**
   - `NEXT STEP: N (slug.md)` (exit 0): produce ONLY that one output file at
     `missions/<name>/outputs/<slug>.md`. Follow the section contract in the mission's
     `pipeline.md` "Done when" column and the coordination rules in `council/roles.md`.
     Open every file with the frontmatter block `evals/schemas/output-frontmatter.json`
     requires. Attach the standing flags every output carries (cat-sitting UNRESOLVED L3;
     90-day freshness). Then go to step 3.
   - `BOOKING FREEZE ...` (exit 1): STOP. A booking-adjacent step (flights, hotels,
     Denver lodging) cannot be produced while L3 or L7 are unresolved. Report the freeze
     and the named constraints to the human. Do not book, do not author the frozen step,
     do not resolve the gate. You may still produce any non-booking step the verdict names
     as producible.
   - `ORDERING VIOLATION ...` (exit 2): a blocking gate below an existing output is
     missing. Produce the missing gate first.

3. **Validate what you produced.** Run `node scripts/run-evals.mjs`. It owns output-content
   validity (schema, required sections, invariants, golden diff for step 0). Fix any
   failure before re-running the engine. A produced output that fails evals is not done.

4. **Re-run the engine** to advance. Repeat until it reports `PIPELINE COMPLETE` or a
   freeze you cannot lift. One step per loop; never batch-produce past a gate.

## Rules

- Gates are hard. The engine's non-zero exit is a refusal, not a warning. Do not work
  around it; surface it.
- Registry resolution is signalled only by `missions/<name>/gates-resolved.md` asserting
  `L3: RESOLVED` and `L7: RESOLVED`. You do not create that file to unblock yourself; the
  owner resolves the real-world prerequisite first.
- Known simplification: step 7 (Denver) is conditional on the step 0 outcome; the engine
  treats it as booking-adjacent regardless. If step 0 drops Denver, skip step 7 by
  judgment and note it.
- No interactive prompts in any automated run. The engine is bounded: it evaluates the
  pipeline once per invocation and exits.
