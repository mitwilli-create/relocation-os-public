#!/usr/bin/env node
// Validate a proposed plan against the locked-decision registry (memory/constraints.md,
// rows L1-L8). Skill: skills/constraint-gate, ADR-0006 determinism boundary. Zero
// dependencies. Idempotent. Standalone.
//
// It SURFACES conflicts and never resolves them (harness contract). L1 (eliminated
// cities) is checked against a gitignored list and self-skips with a NOTE when that
// list is absent (CI, or an un-restored machine), never a silent pass (ADR-0004
// pattern; .gitignore is not a security boundary, ADR-0006 decision 5). L6 (multi-trip
// architecture) and L8 (framework rule) are structural and not per-plan checkable; they
// are reported as informational.
//
// Usage:
//   node scripts/constraint-gate.mjs <plan-file>
//   node scripts/constraint-gate.mjs -            read the plan from stdin
//   node scripts/constraint-gate.mjs --json <plan-file>
//
// Exit codes:
//   0  clean, or only soft FLAGs (L4/L5) or NOTEs
//   1  BLOCKED: a booking-adjacent plan with an unresolved hard gate (L3 or L7)
//   2  CONFLICT: a hard-eliminator violation (L1 eliminated city, or L2 10-day ceiling)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CEILING = 10; // registry L2, travel days included

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = args.find(a => !a.startsWith('--'));

if (!target) { console.error('constraint-gate: usage: constraint-gate.mjs <plan-file>|-'); process.exit(2); }

let text;
try {
  text = target === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(ROOT, target), 'utf8');
} catch (e) { console.error(`constraint-gate: cannot read plan: ${e.message}`); process.exit(2); }

const findings = []; // { id, status: OK|FLAG|CONFLICT|BLOCKED|NOTE, detail }
const add = (id, status, detail) => findings.push({ id, status, detail });

// A plan is booking-adjacent if it proposes spending: booking, reserving, purchasing,
// ticketing, or redeeming an award. This decides whether L3/L7 hard gates apply.
const bookingAdjacent = /\b(book|booking|reserve|reservation|purchase|buy|pay|deposit|ticketed?|redeem|award\s+redemption)\b/i.test(text);

// L1: eliminated cities. Gitignored list, one name per line (# comments ignored).
const elimFile = process.env.ELIMINATORS_FILE
  ? path.resolve(process.env.ELIMINATORS_FILE)
  : path.join(ROOT, 'memory/private/eliminators.txt');
if (fs.existsSync(elimFile)) {
  const cities = fs.readFileSync(elimFile, 'utf8')
    .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  // Report a COUNT only, never the matched name: the eliminator list is private,
  // and this output can be pasted into a PR or CI log (same rule privacy-check.sh
  // follows, reporting by number not content). Transit through an eliminated location
  // is acceptable per registry L1; only destination use is a hard CONFLICT, so a
  // mention in a transit context (via / through / layover / connecting) flags instead.
  // Transit wording must directly GOVERN this location: look only at the clause
  // immediately before the match (up to the previous sentence break), not a raw
  // window that could catch transit wording governing a different city.
  const transitCtx = /\b(via|through|transit\w*|layover|stop\s?over|connect\w*|changing\s+(?:planes|in)|change\s+planes)\b/i;
  let destCount = 0, transitCount = 0;
  for (const c of cities) {
    const re = new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let anyHit = false, allTransit = true, m;
    while ((m = re.exec(text)) !== null) {
      anyHit = true;
      const clauseBefore = text.slice(0, m.index).split(/[.!?;\n]/).pop();
      if (!transitCtx.test(clauseBefore)) allTransit = false;
    }
    if (anyHit) { if (allTransit) transitCount++; else destCount++; }
  }
  if (destCount) add('L1', 'CONFLICT', `plan names ${destCount} permanently eliminated location(s) as a destination (names withheld; cross-check the private registry). Surface to owner; do not resolve.`);
  else if (transitCount) add('L1', 'FLAG', `${transitCount} eliminated location(s) appear only in a transit context (names withheld). Airport transit is acceptable per registry L1; confirm none is a destination.`);
  else add('L1', 'OK', 'no eliminated location named.');
} else {
  add('L1', 'NOTE', `eliminated-city check skipped: no list at ${path.relative(ROOT, elimFile)} (expected in CI; on a local machine this means private memory is not restored).`);
}

// L2: 10-day ceiling. Prefer an explicit total; else sum duration tokens and show the math.
const explicit = text.match(/total[:\s]+(\d+)\s*days?/i) || text.match(/(\d+)\s*days?\s+total/i);
let total, basis;
if (explicit) { total = Number(explicit[1]); basis = `explicit total: ${total}`; }
else {
  const nums = [...text.matchAll(/(\d+)\s*(?:nights?|days?|travel\s+days?)\b/gi)].map(m => Number(m[1]));
  total = nums.reduce((a, b) => a + b, 0);
  basis = nums.length ? `summed ${nums.length} duration token(s) [${nums.join(', ')}]` : 'no duration figures found';
}
// Only an explicit total is unambiguous enough to hard-block; a summed heuristic can be
// inflated by unrelated numbers ("3 days notice"), so it flags advisory instead.
if (total > CEILING) {
  const status = explicit ? 'CONFLICT' : 'FLAG';
  add('L2', status, `itinerary totals ${total} days (${basis}); exceeds the ${CEILING}-day ceiling. Non-negotiable (cat care).${explicit ? '' : ' Heuristic sum, verify manually.'}`);
}
else if (total === 0) add('L2', 'NOTE', `no day counts found to check against the ${CEILING}-day ceiling.`);
else add('L2', 'OK', `${total} days within the ${CEILING}-day ceiling (${basis}).`);

// L3: cat-sitting is a blocking prerequisite for any booking.
if (bookingAdjacent) {
  if (/cat.?sitting[^\n]*RESOLVED/i.test(text)) add('L3', 'OK', 'booking-adjacent plan marks cat-sitting RESOLVED.');
  else add('L3', 'BLOCKED', 'booking-adjacent plan without cat-sitting RESOLVED. Cat-sitting is a blocking prerequisite; no booking until resolved.');
} else add('L3', 'OK', 'not booking-adjacent; L3 does not gate this plan (still flag it on any booking-adjacent output).');

// L4 / L5: soft routing preferences.
if (/\bfrankfurt\b|\bmunich\b|\bFRA\b|\bMUC\b/i.test(text))
  add('L5', 'FLAG', 'plan routes via Frankfurt/Munich; registry L5 prefers avoiding those hubs (TAP via Lisbon, SWISS via Zurich).');
else add('L5', 'OK', 'no Frankfurt/Munich hub routing detected.');

if (bookingAdjacent && /\binternational\b|\btransatlantic\b|\bto\s+spain\b|\bspain\b/i.test(text)
    && !/\bmiles?\b|\baward\b|\bunited\b|\bstar\s*alliance\b|\bmileageplus\b/i.test(text))
  add('L4', 'FLAG', 'international leg with no mention of miles/award/United/Star Alliance; registry L4 prefers United miles (~300k available).');
else add('L4', 'OK', 'miles preference not contradicted.');

// L7: signed relocation-compatible offer is a hard gate for any booking that presumes relocation.
if (bookingAdjacent) {
  if (/signed[^\n]*offer|offer[^\n]*signed|work.from.abroad[^\n]*writing/i.test(text)) add('L7', 'OK', 'booking-adjacent plan cites a signed, relocation-compatible offer.');
  else add('L7', 'BLOCKED', 'booking-adjacent plan without a signed relocation-compatible offer (work-from-abroad in writing). Hard gate; owned by career-ops.');
} else add('L7', 'OK', 'not booking-adjacent; L7 does not gate this plan.');

// L6 / L8: structural, not per-plan checkable.
add('L6', 'NOTE', 'multi-trip evaluation architecture is a locked plan, not a per-plan check.');
add('L8', 'NOTE', 'hard-eliminator vs soft-preference distinction is a framework rule; conflations get pushed back on in review.');

findings.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

const severity = { CONFLICT: 2, BLOCKED: 1, FLAG: 0, NOTE: 0, OK: 0 };
const exitCode = findings.reduce((m, f) => Math.max(m, severity[f.status]), 0);
const summary = {
  CONFLICT: findings.filter(f => f.status === 'CONFLICT').map(f => f.id),
  BLOCKED: findings.filter(f => f.status === 'BLOCKED').map(f => f.id),
  FLAG: findings.filter(f => f.status === 'FLAG').map(f => f.id),
};

if (asJson) {
  console.log(JSON.stringify({ plan: target, bookingAdjacent, exitCode, summary, findings }, null, 2));
} else {
  console.log(`Plan: ${target}${bookingAdjacent ? '  [booking-adjacent]' : ''}\n`);
  console.log('Row  Status    Detail');
  for (const f of findings)
    console.log(`${f.id.padEnd(4)} ${f.status.padEnd(9)} ${f.detail}`);
  const head =
    exitCode === 2 ? `CONFLICT on ${summary.CONFLICT.join(', ')} (hard eliminator). Surface to owner; the gate does not resolve it.`
    : exitCode === 1 ? `BLOCKED on ${summary.BLOCKED.join(', ')} (hard gate). No booking until resolved.`
    : summary.FLAG.length ? `PASS with soft FLAG(s) on ${summary.FLAG.join(', ')}. Review, do not silently override.`
    : `PASS. No locked-decision conflict detected.`;
  console.log(`\n${head}`);
}
process.exit(exitCode);
