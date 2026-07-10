# Mission: 2026 Scouting Trip (SEA → DEN → Spain)

Target window: end of July / beginning of August 2026. Full verbatim brief (contains personal context) lives at `memory/private/mission-brief-2026-07-scouting.md`. This file carries only the operational skeleton.

## Objective
Recommend which candidate city to visit on THIS trip (not assume it), then plan the trip end to end within locked constraints.

## Confirmed legs
SEA → DEN (2 to 3 nights) → Spain (7 days) → SEA. Hard ceiling: 10 days total including travel (registry L2).

## Gate 0 (blocking): the 10-day math
Current architecture totals 11 to 13 days. Options A to D in `memory/trip-architecture.md` must be presented with transparent math before any city, flight, or hotel work.

## Gate 1 (blocking): cat-sitting logistics
Unresolved (registry L3). No booking until resolved.

## Pipeline (deterministic section order)
1. 10-day constraint solutions (Options A to D with math)
2. City recommendation with seasonal-validity reasoning (one pick + runner-up)
3. Miles vs cash joint recommendation with breakeven math (Roles 1+2, one conclusion)
4. Weather brief: Denver + recommended city (Role 3)
5. Accommodation recommendations (Role 4)
6. Relocation intelligence brief for recommended city (Role 5)
7. Local guide for recommended city, plus runner-up if the council splits (Role 6)
8. Denver brief (only if Denver survives Gate 0)
9. Single priority action for the next 48 hours

## Outputs
One dated file per section in `outputs/`. Conclusions first. Structured headers per `council/roles.md` coordination rules.
