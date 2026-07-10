---
mission: fixture
step: 0
owner: Orchestrator
date: 2026-07-08
expect_fail: section:Option D
---

# Step 0: Constraint math (broken fixture: Option D section deleted)

## Verdict

Two of four options clear the 10-day ceiling, but this file only covers three options, which the gate must catch.

## Option A: Single city, direct routing

Day-by-day: 2 travel out, 6 on the ground, 1 travel back.
Total days: 9 (PASS vs 10-day ceiling)

## Option B: Single city plus a domestic stop

Day-by-day: 2 travel out, 6 on the ground, 1 domestic stop, 1 travel back.
Total days: 10 (PASS vs 10-day ceiling)

## Option C: Two cities, open jaw

Day-by-day: 2 travel out, 8 on the ground split across cities, 2 travel back.
Total days: 12 (FAIL vs 10-day ceiling)

## Sources

- Pipeline arithmetic on fictional leg lengths, dated 2026-07-08. No external sources.

## Standing flags

- Cat-sitting logistics UNRESOLVED (registry L3): nothing is bookable yet.
- Facts sourced before 2026-04-09 (90 days) re-verify before use.
