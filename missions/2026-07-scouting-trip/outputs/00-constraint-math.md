---
mission: 2026-07-scouting-trip
step: 0
owner: Orchestrator
date: 2026-07-09
---

# Step 0: 10-day constraint math

Day counting model, applied identically to every option: total days are calendar days
from the SEA departure through the SEA return, inclusive, travel days included (registry
L2). The transatlantic outbound is an overnight (depart evening of day X, arrive Spain
morning of day X+1). The westbound return is same-day (depart Spain, arrive SEA the same
calendar day). SEA to DEN is a same-day domestic hop.

## Verdict

Three of four options clear the 10-day ceiling; the do-nothing baseline (Option D) does
not. Option B has the most slack (9 days) and the most Spain time, at the cost of Denver.
Options A and C both land exactly on the ceiling with zero slack: A keeps a single Denver
night and a full 7 Spain days; C keeps 2 Denver nights by trimming Spain to 6. Option D
(2 Denver nights plus a full 7 Spain days) is 11 days and is off the table. The city and
routing choice is deferred to Step 1; this step only fixes which shapes are feasible.

## Option A: Denver 1 night, Spain 7 days

- Day 1: SEA to DEN, Denver overnight (night 1).
- Day 2: Denver by day, DEN to Spain overnight (travel).
- Days 3 to 9: arrive Spain morning of day 3; 7 days on the ground.
- Day 10: Spain to SEA (travel).
Total days: 10 (PASS vs 10-day ceiling), zero slack.

## Option B: Drop Denver, Spain 7 days

- Day 1: SEA to Spain overnight (travel); Denver becomes a separate domestic trip.
- Days 2 to 8: arrive Spain morning of day 2; 7 days on the ground.
- Day 9: Spain to SEA (travel).
Total days: 9 (PASS vs 10-day ceiling), one day of slack.

## Option C: Denver 2 nights, Spain 6 days

- Day 1: SEA to DEN, Denver overnight (night 1).
- Day 2: Denver overnight (night 2).
- Day 3: DEN to Spain overnight (travel).
- Days 4 to 9: arrive Spain morning of day 4; 6 days on the ground.
- Day 10: Spain to SEA (travel).
Total days: 10 (PASS vs 10-day ceiling), zero slack.

## Option D: Denver 2 nights, Spain 7 days (no compression)

- Day 1: SEA to DEN, Denver overnight (night 1).
- Day 2: Denver overnight (night 2).
- Day 3: DEN to Spain overnight (travel).
- Days 4 to 10: arrive Spain morning of day 4; 7 days on the ground.
- Day 11: Spain to SEA (travel).
Total days: 11 (FAIL vs 10-day ceiling), 1 day over.

## Sources

- Pipeline arithmetic on the confirmed legs in memory/trip-architecture.md, dated 2026-07-09. No external sources.

## Standing flags

- Cat-sitting logistics UNRESOLVED (registry L3): nothing is bookable yet.
- Facts sourced before 2026-04-10 (90 days) re-verify before use.
