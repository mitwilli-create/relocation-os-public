# ADR-0002: Standing roles vs mission roles

Date: 2026-07-08
Status: Accepted

## Context

v0.1 defined six council roles, all scoped to trip missions and invoked through a mission's `pipeline.md`. The relocation itself has domains that outlive any single trip: language acquisition, the immigration process, and cross-border tax strategy. Wedging these into trip pipelines would either bloat every mission or leave the domains unowned between trips. Role 5 (Spain Relocation Expert) had also accumulated visa and tax scope that belongs to dedicated specialists.

## Decision

1. **Two role classes.** Mission roles (1 to 6) run inside a mission's `pipeline.md` in pipeline order. Standing roles (7 to 9) own relocation-lifecycle domains and are invoked whenever their domain comes up, inside or outside a mission.
2. **Three standing roles.** Role 7 Language Specialist (Spanish acquisition, CEFR milestones, certification path). Role 8 Visa Specialist (DNV process end to end, work-from-abroad letter spec, cat relocation). Role 9 Tax Accountant (Beckham regime, US interplay, retirement vehicles, exit plan).
3. **Rescoped Role 5.** Role 5 owns on-the-ground city intelligence only. Immigration process moved to Role 8, tax to Role 9. The classes have zero overlapping deliverables by design.
4. **Verification discipline for Role 9.** Every numeric tax claim is dated and dealbreaker-verified before entering `memory/visa-tax.md`. Tax numbers age fast and carry real money risk.
5. Role content is owner-specified (Mitchell's requirements), the documented exception to the research-citation rule in the build plan.

## Alternatives considered

- Fold visa/tax/language into Role 5 as a mega-role: rejected. A role covering city vibes, immigration law, and tax code produces shallow output in all three and cannot be given a clean output schema.
- Make standing roles separate mission folders: rejected. Missions are dated, bounded units of work; language acquisition and visa processing are continuous programs with their own cadence.
- Defer until a trip mission needs them: rejected. The work-from-abroad letter spec (Role 8) feeds the career-ops offer gate now, before any trip books.

## Consequences

- `pipeline.md` files must state which class a step invokes; a mission may call a standing role, but standing roles never depend on mission state.
- Role counts in README.md, CLAUDE.md, and AGENTS.md change from a bare "six" to "six mission roles and three standing roles"; a bare count is now a bug.
- Standing-role outputs are dated artifacts; stale ones (especially Role 9 numbers) must be re-verified, not reused.
