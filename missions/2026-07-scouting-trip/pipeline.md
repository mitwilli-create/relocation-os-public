# Pipeline: 2026 Scouting Trip

Deterministic execution order. A step does not start until every gate above it has an output file in `outputs/`. Owner column names the council role (see `council/roles.md`) or script responsible. The "Done when" column is machine-enforced by `evals/schemas/steps.json` (see `evals/README.md`); the prose here stays the source of truth, and both change in the same PR.

| Step | Gate? | Owner | Output file | Done when |
|---|---|---|---|---|
| 0. Solve 10-day math (Options A to D) | BLOCKING | Orchestrator | outputs/00-constraint-math.md | Each option shows day-by-day count vs the 10-day ceiling |
| 1. City recommendation + runner-up | BLOCKING | Roles 3+5 joint, orchestrator synthesis | outputs/01-city-recommendation.md | One pick, one runner-up, seasonal-validity score for each candidate |
| 2. Miles vs cash joint call | | Roles 1+2 | outputs/02-miles-vs-cash.md | Single conclusion with cents-per-mile breakeven shown |
| 3. Weather brief (Denver + pick) | | Role 3 | outputs/03-weather.md | Temps, rain, validity rating |
| 4. Accommodation | | Role 4 | outputs/04-hotels.md | Named properties with rates and urgency flags |
| 5. Relocation intelligence brief | | Role 5 | outputs/05-relocation-intel.md | Includes current-year DNV/Beckham update sweep |
| 6. Local guide (pick + runner-up) | | Role 6 | outputs/06-local-guide.md | Includes the definitive is-this-home test |
| 7. Denver brief | conditional on Step 0 outcome | Role 4 + orchestrator | outputs/07-denver.md | Only if Denver survives the math |
| 8. 48-hour priority action | | Orchestrator | outputs/08-next-action.md | Exactly one action, 5-W formatted |

## Standing flags (attach to every output)

- Cat-sitting logistics UNRESOLVED (registry L3): nothing is bookable yet.
- Facts sourced before 2026-04-09 (90 days) re-verify before use.
