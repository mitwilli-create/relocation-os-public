#!/usr/bin/env node
// Deterministic pipeline gate engine for a mission (skill: skills/mission-runner,
// ADR-0006 determinism boundary). Zero dependencies. Idempotent. Standalone.
//
// It reports which step is producible next and REFUSES to certify a mission whose
// booking-adjacent steps are blocked by unresolved registry prerequisites (L3
// cat-sitting, L7 offer; see memory/constraints.md). It never resolves a gate and
// never authors an output; producing a step's content is the skill's job, gated by
// this engine. Output-content validity stays owned by scripts/run-evals.mjs.
//
// Step metadata (slug, class, booking_adjacent) is read from evals/schemas/steps.json,
// the machine twin of the mission's pipeline.md. Registry prerequisites are resolved
// per mission by a missions/<name>/gates-resolved.md artifact.
//
// Usage:
//   node scripts/mission-runner.mjs [missionDir]     default: missions/2026-07-scouting-trip
//   node scripts/mission-runner.mjs --json [dir]     machine-readable status
//
// Exit codes:
//   0  pipeline complete, or the next step is producible and no booking freeze is in effect
//   1  booking freeze: an unresolved registry gate (L3/L7) blocks a booking-adjacent step
//   2  pipeline ordering violation, or a usage / IO error

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Registry blocking prerequisites for any booking-adjacent step. memory/constraints.md
// is the source of truth; these ids and reasons mirror rows L3 and L7 there.
const BOOKING_PREREQS = [
  { id: 'L3', reason: 'cat-sitting logistics UNRESOLVED (blocking prerequisite)' },
  { id: 'L7', reason: 'no signed relocation-compatible offer with work-from-abroad in writing' },
];

function die(msg) { console.error(`mission-runner: ${msg}`); process.exit(2); }

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const missionArg = args.find(a => !a.startsWith('--'));
const missionDir = missionArg
  ? path.resolve(ROOT, missionArg)
  : path.join(ROOT, 'missions', '2026-07-scouting-trip');

if (!fs.existsSync(missionDir) || !fs.statSync(missionDir).isDirectory())
  die(`mission dir not found: ${path.relative(ROOT, missionDir)}`);

let stepSchema;
try { stepSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals/schemas/steps.json'), 'utf8')); }
catch (e) { die(`cannot read evals/schemas/steps.json: ${e.message}`); }
if (!stepSchema || typeof stepSchema.steps !== 'object')
  die('evals/schemas/steps.json is missing a "steps" object');

// Steps, numeric order. Underscore-prefixed keys are schema comments, skip them.
const steps = Object.entries(stepSchema.steps)
  .filter(([k]) => /^\d+$/.test(k))
  .map(([num, s]) => ({
    num: Number(num),
    slug: s.slug,
    isGate: s.class === 'gate',
    bookingAdjacent: s.booking_adjacent === true,
  }))
  .sort((a, b) => a.num - b.num);

const outputsDir = path.join(missionDir, 'outputs');
const present = new Set(
  fs.existsSync(outputsDir)
    ? fs.readdirSync(outputsDir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3))
    : []
);
for (const s of steps) s.present = present.has(s.slug);

// Per-mission gate resolution: gates-resolved.md must assert each prereq RESOLVED
// (a line matching '^<id>: RESOLVED'). Absent file or missing line means unresolved.
const gatesFile = path.join(missionDir, 'gates-resolved.md');
const gatesText = fs.existsSync(gatesFile) ? fs.readFileSync(gatesFile, 'utf8') : '';
const unresolvedPrereqs = BOOKING_PREREQS.filter(
  p => !new RegExp(`^${p.id}:\\s*RESOLVED\\b`, 'im').test(gatesText)
);
const gatesResolved = unresolvedPrereqs.length === 0;

// Ordering violation: a BLOCKING gate is missing while a higher-numbered step exists
// (mirrors run-evals.mjs checkGateOrdering, scoped to this mission).
const orderingViolations = [];
for (const g of steps.filter(s => s.isGate && !s.present))
  if (steps.some(s => s.num > g.num && s.present))
    orderingViolations.push({ gate: g.num, slug: g.slug });

// A booking-adjacent step is blocked while its registry prereqs are unresolved.
const blockedSteps = steps.filter(s => s.bookingAdjacent && !s.present && !gatesResolved);
const bookingFreeze = blockedSteps.length > 0;

// Next producible step: lowest missing step that is not blocked by a registry gate.
const nextStep = steps.find(s => !s.present && !(s.bookingAdjacent && !gatesResolved)) || null;
const allDone = steps.every(s => s.present);

const status = s =>
  s.present ? 'DONE'
  : (s.bookingAdjacent && !gatesResolved) ? `BLOCKED (${unresolvedPrereqs.map(p => p.id).join(', ')})`
  : (nextStep && s.num === nextStep.num) ? 'NEXT'
  : 'pending';

const result = {
  mission: path.relative(ROOT, missionDir),
  gatesResolved,
  unresolvedPrereqs,
  orderingViolations,
  bookingFreeze,
  blockedSteps: blockedSteps.map(s => ({ num: s.num, slug: s.slug })),
  nextStep: nextStep ? { num: nextStep.num, slug: nextStep.slug } : null,
  allDone,
  steps: steps.map(s => ({ num: s.num, slug: s.slug, status: status(s) })),
};

let exitCode;
let verdict;
if (orderingViolations.length) {
  exitCode = 2;
  verdict = `ORDERING VIOLATION: ${orderingViolations
    .map(v => `blocking gate ${v.gate} (${v.slug}.md) missing but later steps exist`)
    .join('; ')}. Produce the missing gate before any later step.`;
} else if (bookingFreeze) {
  exitCode = 1;
  verdict =
    `BOOKING FREEZE: cannot proceed past booking-adjacent step(s) ` +
    `${blockedSteps.map(s => s.num).join(', ')} while ` +
    `${unresolvedPrereqs.map(p => `${p.id} (${p.reason})`).join(' and ')} remain unresolved. ` +
    (nextStep
      ? `Next producible non-booking step: ${nextStep.num} (${nextStep.slug}.md).`
      : `No non-booking step remains to produce.`);
} else if (allDone) {
  exitCode = 0;
  verdict = 'PIPELINE COMPLETE: every step has an output. Run node scripts/run-evals.mjs to validate contents.';
} else {
  exitCode = 0;
  verdict = `NEXT STEP: ${nextStep.num} (${nextStep.slug}.md). Produce it, then validate with node scripts/run-evals.mjs.`;
}
result.verdict = verdict;

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Mission: ${result.mission}`);
  console.log(`Registry gates: ${gatesResolved ? 'resolved' : 'UNRESOLVED (' + unresolvedPrereqs.map(p => p.id).join(', ') + ')'}\n`);
  console.log('Step  Status                  File');
  for (const s of result.steps)
    console.log(`${String(s.num).padEnd(4)}  ${s.status.padEnd(22)}  outputs/${s.slug}.md`);
  console.log(`\n${verdict}`);
}
process.exit(exitCode);
