---
name: award-watch
description: Monitor United and Star Alliance award availability against the locked registry before any redemption. Use when tracking award windows for the scouting trip, comparing options on cents-per-mile value, or checking a proposed redemption against L4 (United/Star Alliance) and L5 (avoid Frankfurt/Munich). Monitors only; it has no booking path, so any book request is refused (cat-sitting L3 and the offer L7 gate any real redemption, which happens elsewhere).
---

# award-watch

Track observed United / Star Alliance award options and rank them on value, without
ever booking. The scoring and gate logic are deterministic and live in
`scripts/award-watch.mjs`; this skill routes to it and relays the verdict. Award
redemption is booking-adjacent, so every run carries the L3/L7 booking gate. The skill
surfaces options and flags; it never books and never resolves a gate.

## Procedure

1. **Record what you observed in a watch-file.** This skill never contacts an airline;
   you hand-enter the award options you saw (United.com, a Star Alliance partner, an award
   tool) as JSON. Minimum per option: `id`, `route`, `carrier`, `depart` (YYYY-MM-DD),
   `miles`. Add `taxes_fees_usd` and `cash_price_usd` to get a cents-per-mile figure, and
   `cabin`. Top level takes an optional `trip_window` and `miles_available` (default 300000;
   a zero or negative value is treated as unset and falls back to that default, not
   enforced). There is deliberately no field that permits booking. See the header of
   `scripts/award-watch.mjs` for the full shape.

2. **Run the engine.** From the repo root:

   ```sh
   node scripts/award-watch.mjs <watch-file>
   node scripts/award-watch.mjs -            # read the watch-file from stdin
   ```

3. **Relay the verdict as-is.** The per-option table (route, carrier, in-window, miles,
   cents-per-mile, flags) plus the best in-window value is what the owner needs. Do not
   summarize away a flag.

4. **Act on the exit code:**
   - `1` BOOKING FREEZE: an option set `action: "book"`. This skill has no booking path, so
     any book request is refused. STOP. Report the freeze; booking happens through a
     deliberate gated flow after L3 (cat-sitting) and L7 (offer) resolve, never here.
   - `0` watch processed. Soft FLAGs may be present: `L4` (carrier not Star Alliance, or
     miles over the ~300k available), `L5` (routes via Frankfurt/Munich), `window`
     (departs outside the trip window), `value` (low cents-per-mile). Note them for review;
     a flag is a preference, not a veto, but never override it silently.

## Rules

- Monitoring is always allowed; booking never is from this skill. The best-value line is a
  recommendation to watch, not a green light to redeem.
- L3 and L7 are hard gates owned by the real world (cat-sitting logistics; a signed
  relocation-compatible offer with work-from-abroad in writing). They resolve outside this
  skill entirely; the watch-file has no field that can permit a booking, by design.
- L4 and L5 are soft preferences. The Star Alliance carrier list in the script is not
  exhaustive, so an unrecognized carrier flags for verification rather than failing.
- No live API, no interactive prompts. The engine evaluates the watch-file once and exits.
