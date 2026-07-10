---
mission: fixture
step: 0
owner: Orchestrator
date: 2026-07-08
expect_fail: golden-diff
---

# Step 0: Constraint math (broken fixture: Option A total disagrees with golden)

## Verdict

Structurally complete, but Option A claims 8 days while the golden record says 9. The structured diff must catch the drifted number even though every section and invariant is satisfied.

## Option A: Single city, direct routing

Day-by-day: 2 travel out, 5 on the ground, 1 travel back.
Total days: 8 (PASS vs 10-day ceiling)

## Option B: Single city plus a domestic stop

Day-by-day: 2 travel out, 6 on the ground, 1 domestic stop, 1 travel back.
Total days: 10 (PASS vs 10-day ceiling)

## Option C: Two cities, open jaw

Day-by-day: 2 travel out, 8 on the ground split across cities, 2 travel back.
Total days: 12 (FAIL vs 10-day ceiling)

## Option D: Two cities plus a domestic stop

Day-by-day: 2 travel out, 7 on the ground, 1 domestic stop, 1 travel back.
Total days: 11 (FAIL vs 10-day ceiling)

## Sources

- Pipeline arithmetic on fictional leg lengths, dated 2026-07-08. No external sources.

## Standing flags

- Cat-sitting logistics UNRESOLVED (registry L3): nothing is bookable yet.
- Facts sourced before 2026-04-09 (90 days) re-verify before use.
