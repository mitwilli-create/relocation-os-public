---
mission: fixture
step: 8
owner: Orchestrator
date: 2026-07-08
expect_fail: no-em-dash
---

# Step 8: 48-hour priority action (broken fixture: contains an em dash)

This file is the documented exception to the repo style rule: it exists to prove the no-em-dash invariant bites — and this sentence is the violation.

## Action

1. WHERE: your terminal, in the repo root.
2. WHAT: run the fictional booking-precheck script end to end.
3. WHY: confirms the gate outputs are in place before any downstream work.
4. VERIFY: the script prints PASS and exits 0.
5. RECOVER: if it fails, read the first error line and re-run with the verbose flag.

This action rests on the gate outputs outputs/00-constraint-math.md and outputs/01-city-recommendation.md.

## Standing flags

- Cat-sitting logistics UNRESOLVED (registry L3): nothing is bookable yet.
- Facts sourced before 2026-04-09 (90 days) re-verify before use.
