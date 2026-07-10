---
name: constraint-gate
description: Validate a proposed plan or itinerary against the locked-decision registry (memory/constraints.md, L1-L8) before acting on it. Use whenever a plan proposes a destination, itinerary, routing, or booking, to surface conflicts with eliminated cities, the 10-day ceiling, cat-sitting, the offer gate, and routing preferences. Surfaces conflicts; never resolves them.
---

# constraint-gate

Check any proposed plan against the eight locked decisions before it drives an action.
The check is deterministic and lives in `scripts/constraint-gate.mjs`; this skill routes
to it and relays the verdict verbatim. The gate surfaces conflicts. It never resolves
them, never edits the registry, and never silently overrides a soft flag.

## Procedure

1. **Put the plan in a file** (or pipe it). From the repo root:

   ```sh
   node scripts/constraint-gate.mjs <plan-file>
   node scripts/constraint-gate.mjs -            # read plan from stdin
   ```

2. **Relay the verdict as-is.** The row-by-row table (L1-L8, each OK / FLAG / CONFLICT /
   BLOCKED / NOTE) is the output the human needs. Do not summarize away a CONFLICT or a
   BLOCKED row.

3. **Act on the exit code:**
   - `2` CONFLICT (L1 eliminated city, or L2 over the 10-day ceiling): a hard eliminator.
     Stop and surface it to the owner. Do not propose a fix that assumes the constraint
     bends; it does not.
   - `1` BLOCKED (L3 cat-sitting or L7 offer, on a booking-adjacent plan): a hard gate.
     No booking until the real-world prerequisite is resolved by the owner.
   - `0` PASS, possibly with soft FLAG(s) (L4 miles, L5 hub routing): note the flags for
     review. A flag is a preference, not a veto, but never override it silently.

## Rules

- Booking-adjacency is detected conservatively: a plan that mentions booking, purchasing,
  or award redemption is treated as booking-adjacent, so L3 and L7 apply. Over-flagging is
  the intended, safe direction. If a genuinely non-booking plan trips it, say so; do not
  weaken the gate.
- L1 reads a gitignored private eliminator list. When that list is absent (CI, or an
  un-restored machine) the L1 row reports NOTE and self-skips, never a silent pass.
  `.gitignore` is not a security boundary; the private list stays out of every tracked file.
- L6 (multi-trip architecture) and L8 (framework rule) are structural and are reported as
  NOTE, not machine-checked per plan.
- The gate presents; the human decides. If the owner amends a locked decision, that happens
  in `memory/constraints.md` with a dated reason, not by ignoring a CONFLICT here.
