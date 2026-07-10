#!/usr/bin/env node
// Structured United / Star Alliance award-availability monitoring (skill:
// skills/award-watch, ADR-0006 determinism boundary). Zero dependencies.
// Idempotent. Standalone.
//
// It MONITORS a watch-file of observed award options and NEVER books. For each
// option it computes cents-per-mile value and checks the soft routing
// preferences (registry L4 United/Star Alliance, L5 avoid Frankfurt/Munich).
// Award redemption is booking-adjacent, so any output carries the L3/L7 gate
// banner, and an option flagged action:"book" is REFUSED unconditionally: this
// skill has no booking path, so a book request is always a freeze (exit 1). The
// L3 (cat-sitting) and L7 (offer) gates resolve outside this file, never by a
// field in the watch-file. The gate is surfaced, never resolved.
//
// The watch-file is observed data the owner records by hand; this script never
// contacts an airline. Format (JSON):
//   {
//     "trip_window":   { "start": "2026-07-25", "end": "2026-08-05" },  // optional
//     "miles_available": 300000,          // optional, default 300000 (standing fact)
//     "options": [
//       { "id": "opt-1", "route": "SEA-DEN-EWR-LIS", "carrier": "United/TAP",
//         "cabin": "business", "depart": "2026-07-30", "miles": 88000,
//         "taxes_fees_usd": 5.6, "cash_price_usd": 3200, "action": "watch" }
//     ]
//   }
//
// Usage:
//   node scripts/award-watch.mjs <watch-file>
//   node scripts/award-watch.mjs -            read the watch-file from stdin
//   node scripts/award-watch.mjs --json <watch-file>
//
// Exit codes:
//   0  watch processed; monitoring table emitted (may carry soft FLAGs)
//   1  BOOKING FREEZE: an option requests booking (action:"book"); this skill never books
//   2  usage / IO / schema error

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MILES = 300000; // MEMORY.md standing fact: ~300k United miles available
const LOW_VALUE_CPM = 1.2;    // advisory floor for a "good" redemption, cents per mile

// Non-exhaustive Star Alliance token list, biased to carriers that actually fly
// SEA -> Spain. L4 is a soft preference, so an unrecognized carrier only FLAGs.
// (SAS left Star Alliance in 2024; deliberately excluded.)
const STAR_ALLIANCE = [
  'united', 'tap', 'swiss', 'lufthansa', 'austrian', 'brussels', 'lot',
  'turkish', 'aegean', 'air canada', 'ana', 'singapore', 'star alliance',
  'mileageplus',
];
const AVOID_HUBS = ['fra', 'frankfurt', 'muc', 'munich'];

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = args.find(a => !a.startsWith('--'));

function die(msg) { console.error(`award-watch: ${msg}`); process.exit(2); }

// Strict calendar-date parse: rejects syntactically valid but impossible dates
// (e.g. 2026-02-31) via a UTC round-trip. Returns 'YYYY-MM-DD' or null.
function parseISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) ? s : null;
}

if (!target) die('usage: award-watch.mjs <watch-file>|-  [--json]');

let raw;
try {
  raw = target === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(ROOT, target), 'utf8');
} catch (e) { die(`cannot read watch-file: ${e.message}`); }

let watch;
try { watch = JSON.parse(raw); }
catch (e) { die(`watch-file is not valid JSON: ${e.message}`); }

if (!watch || typeof watch !== 'object' || Array.isArray(watch) || !Array.isArray(watch.options))
  die('watch-file needs an "options" array');
if (watch.options.length === 0)
  die('watch-file "options" array is empty; nothing to monitor');

// miles_available must be a positive finite number; 0 or negative is malformed
// input, so fall back to the standing default rather than flag every option.
const milesAvailable = (Number.isFinite(watch.miles_available) && watch.miles_available > 0)
  ? watch.miles_available : DEFAULT_MILES;

// Trip window is valid only when both ends are real calendar dates AND start <= end.
const win = watch.trip_window && typeof watch.trip_window === 'object' ? watch.trip_window : null;
const windowValid = !!(win && parseISO(win.start) && parseISO(win.end) && win.start <= win.end);

// Evaluate one option into a structured verdict. ISO date strings compare
// correctly as plain strings once validated, so no Date math is needed here.
function evalOption(opt, i) {
  // Reject a null / non-object entry before any field access, so malformed input
  // surfaces as a schema error (exit 2), not a TypeError.
  if (opt == null || typeof opt !== 'object' || Array.isArray(opt))
    return { id: `option-${i + 1}`, errors: ['not-an-object'], flags: [] };

  const flags = [];
  const id = typeof opt.id === 'string' && opt.id ? opt.id : `option-${i + 1}`;
  const errs = [];
  for (const f of ['route', 'carrier', 'depart', 'miles']) if (opt[f] == null) errs.push(f);
  if (!parseISO(opt.depart)) errs.push('depart(valid YYYY-MM-DD)');
  if (!Number.isFinite(opt.miles) || opt.miles <= 0) errs.push('miles(>0)');
  const fees = Number.isFinite(opt.taxes_fees_usd) ? opt.taxes_fees_usd : 0;
  const cash = Number.isFinite(opt.cash_price_usd) ? opt.cash_price_usd : null;

  // cents per mile = (cash value recovered) / miles * 100. Needs a cash comparison.
  const cpm = (cash != null && Number.isFinite(opt.miles) && opt.miles > 0)
    ? Number((((cash - fees) / opt.miles) * 100).toFixed(2))
    : null;

  const route = String(opt.route || '').toLowerCase();
  const carrier = String(opt.carrier || '').toLowerCase();
  const inWindow = (windowValid && parseISO(opt.depart))
    ? (opt.depart >= win.start && opt.depart <= win.end)
    : null;
  const wantsBook = opt.action === 'book';

  if (!STAR_ALLIANCE.some(t => carrier.includes(t)))
    flags.push({ id: 'L4', detail: `carrier "${opt.carrier}" not recognized as United/Star Alliance; L4 prefers Star Alliance (verify, ~${milesAvailable.toLocaleString('en-US')} miles available).` });
  if (AVOID_HUBS.some(h => route.includes(h)))
    flags.push({ id: 'L5', detail: `route transits a discouraged hub (Frankfurt/Munich); L5 prefers TAP via Lisbon or SWISS via Zurich.` });
  if (Number.isFinite(opt.miles) && opt.miles > milesAvailable)
    flags.push({ id: 'L4', detail: `${opt.miles.toLocaleString('en-US')} miles exceeds the ~${milesAvailable.toLocaleString('en-US')} available.` });
  if (cpm != null && cpm < LOW_VALUE_CPM)
    flags.push({ id: 'value', detail: `low redemption value: ${cpm} cents/mile (below ${LOW_VALUE_CPM}).` });
  if (inWindow === false)
    flags.push({ id: 'window', detail: `departs ${opt.depart}, outside the trip window ${win.start}..${win.end}.` });

  return { id, route: opt.route, carrier: opt.carrier, cabin: opt.cabin || null,
    depart: opt.depart, miles: opt.miles, taxes_fees_usd: fees, cash_price_usd: cash,
    cpm, inWindow, wantsBook, errors: errs, flags };
}

const evaluated = watch.options.map(evalOption);
const schemaErrors = evaluated.filter(o => o.errors.length);
if (schemaErrors.length)
  die(`option(s) missing/invalid fields: ${schemaErrors.map(o => `${o.id}[${o.errors.join(',')}]`).join('; ')}`);

// This skill has no booking path. A book request is always refused (fail closed);
// there is no watch-file field that can permit it. L3/L7 resolve elsewhere.
const bookRequests = evaluated.filter(o => o.wantsBook);
const freeze = bookRequests.length > 0;

// Rank in-window options by cents-per-mile (best value first); nulls sort last.
const ranked = [...evaluated]
  .filter(o => o.inWindow !== false)
  .sort((a, b) => (b.cpm ?? -Infinity) - (a.cpm ?? -Infinity));
const best = ranked[0] || null;

const exitCode = freeze ? 1 : 0;
const result = {
  watch: target,
  bookingAdjacent: true,
  milesAvailable,
  tripWindow: windowValid ? win : null,
  bookingFreeze: freeze,
  bookRequests: bookRequests.map(o => o.id),
  best: best ? { id: best.id, cpm: best.cpm, route: best.route } : null,
  options: evaluated,
  exitCode,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(exitCode);
}

const fmt = o => {
  const cpm = o.cpm == null ? 'n/a' : `${o.cpm}`;
  const w = o.inWindow == null ? '?' : o.inWindow ? 'yes' : 'NO';
  const fl = o.flags.length ? o.flags.map(f => f.id).join(',') : '-';
  return `${o.id.padEnd(9)} ${String(o.route).padEnd(20)} ${String(o.carrier).padEnd(14)} ${String(o.depart).padEnd(11)} in-window:${w.padEnd(4)} ${String(o.miles).padStart(7)}mi  cpm:${cpm.padStart(5)}  flags:${fl}`;
};

console.log(`Award watch: ${target}  [booking-adjacent]`);
console.log(`Trip window: ${windowValid ? `${win.start}..${win.end}` : 'not set'}   Miles available: ~${milesAvailable.toLocaleString('en-US')}   Booking: never (monitoring only; L3/L7 gate any redemption)\n`);
for (const o of evaluated) {
  console.log(fmt(o));
  for (const f of o.flags) console.log(`            ${f.id}: ${f.detail}`);
}
console.log('');
if (best) console.log(`Best in-window value: ${best.id} at ${best.cpm == null ? 'n/a' : best.cpm + ' cents/mile'} (${best.route}).`);
console.log('L3 (cat-sitting) and L7 (signed offer) gate any actual booking. This skill monitors only; it does not book.');
if (freeze)
  console.log(`\nBOOKING FREEZE: option(s) ${bookRequests.map(o => o.id).join(', ')} request booking. This skill has no booking path; refused. Booking happens through a deliberate gated flow after L3/L7 resolve, never here.`);
else
  console.log(`\nWATCH OK: ${evaluated.length} option(s) monitored. No booking performed.`);
process.exit(exitCode);
