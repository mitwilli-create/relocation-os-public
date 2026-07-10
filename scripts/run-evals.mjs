#!/usr/bin/env node
// Eval runner for relocation-os (ADR-0003). Zero dependencies by design.
//
// Validates mission outputs (missions/*/outputs/*.md) and eval fixtures against
// evals/schemas/. Fixture self-test: everything in evals/fixtures/valid/ must
// pass; everything in evals/fixtures/broken/ must fail the check named in its
// 'expect_fail' frontmatter key. A broken fixture that passes is itself a failure.
//
// Usage:
//   node scripts/run-evals.mjs                full run
//   node scripts/run-evals.mjs --schemas-only frontmatter + required sections only
//
// Exit codes: 0 all gates pass, 1 any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMAS_ONLY = process.argv.includes('--schemas-only');

function readJSON(rel) {
  let raw;
  try { raw = fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch (e) { throw new Error(`cannot read ${rel}: ${e.message}`); }
  try { return JSON.parse(raw); }
  catch (e) { throw new Error(`${rel} is not valid JSON: ${e.message}`); }
}

let fmSchema, stepSchema;
try {
  fmSchema = readJSON('evals/schemas/output-frontmatter.json');
  stepSchema = readJSON('evals/schemas/steps.json');
} catch (e) {
  console.error(`eval: cannot load schemas: ${e.message}`);
  process.exit(2);
}

function listMd(rel) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()
    .map(f => path.join(rel, f));
}

function missionOutputFiles() {
  const missionsDir = path.join(ROOT, 'missions');
  if (!fs.existsSync(missionsDir)) return [];
  return fs.readdirSync(missionsDir)
    .filter(m => fs.statSync(path.join(missionsDir, m)).isDirectory())
    .flatMap(m => listMd(path.join('missions', m, 'outputs')));
}

// Frontmatter is flat 'key: value' lines between two '---' fences (see
// evals/schemas/output-frontmatter.json for why it stays flat).
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { fm: null, error: 'file does not start with a --- frontmatter fence' };
  const fm = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return { fm, body: lines.slice(i + 1).join('\n') };
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/);
    if (!m) return { fm: null, error: `frontmatter line ${i + 1} is not flat 'key: value': "${lines[i]}"` };
    fm[m[1]] = m[2].trim();
  }
  return { fm: null, error: 'frontmatter fence never closes' };
}

function h2Headings(body) {
  return body.split('\n').filter(l => l.startsWith('## ')).map(l => l.slice(3).trim());
}

function daysBetween(a, b) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}

// Date.parse silently normalizes impossible dates (2026-02-30 becomes March 2),
// which would skew the freshness math instead of failing loudly.
function isRealDate(s) {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Every check pushes {name, msg, where} onto fails.
function checkFile(rel, kind) {
  const fails = [];
  const push = (name, msg, where) => fails.push({ name, msg, where });
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');

  const { fm, body, error } = parseFrontmatter(text);
  if (error) { push('frontmatter', error, 'output-frontmatter.json'); return { fails, fm: null }; }

  for (const [key, spec] of Object.entries(fmSchema.required)) {
    if (!(key in fm)) push('frontmatter', `missing required key '${key}'`, 'output-frontmatter.json required');
    else if (!new RegExp(spec.pattern).test(fm[key]))
      push('frontmatter', `key '${key}' value "${fm[key]}" fails pattern ${spec.pattern}`, 'output-frontmatter.json required');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(fm.date || '') && !isRealDate(fm.date))
    push('frontmatter', `date "${fm.date}" is not a real calendar date`, 'output-frontmatter.json required');
  if (fails.length) return { fails, fm };

  const step = stepSchema.steps[fm.step];
  if (!step) { push('frontmatter', `no steps.json entry for step ${fm.step}`, 'steps.json steps'); return { fails, fm }; }

  for (const section of step.required_sections || []) {
    if (!h2Headings(body).some(h => h.startsWith(section)))
      push(`section:${section}`, `missing required H2 section '## ${section}'`, `steps.json steps.${fm.step}.required_sections`);
  }
  // Real outputs must live at the filename the pipeline assigns to their step.
  if (kind === 'mission' && path.basename(rel, '.md') !== step.slug)
    push('slug', `file name should be ${step.slug}.md for step ${fm.step}`, `steps.json steps.${fm.step}.slug`);

  if (SCHEMAS_ONLY) return { fails, fm };

  if (fm.owner !== step.owner)
    push('owner-matches', `owner "${fm.owner}" does not match pipeline owner "${step.owner}"`, `steps.json steps.${fm.step}.owner`);

  const invariants = [...(stepSchema.common.invariants || []), ...(step.invariants || [])];
  for (const inv of invariants) {
    const flags = inv.flags || '';
    const where = `steps.json invariant '${inv.name}' (${inv.why})`;
    if (inv.type === 'present') {
      if (!new RegExp(inv.pattern, flags).test(body)) push(inv.name, `pattern /${inv.pattern}/ not found`, where);
    } else if (inv.type === 'absent') {
      if (new RegExp(inv.pattern, flags).test(body)) push(inv.name, `forbidden pattern /${inv.pattern}/ found`, where);
    } else if (inv.type === 'count') {
      const n = (body.match(new RegExp(inv.pattern, flags.includes('g') ? flags : flags + 'g')) || []).length;
      if ('count' in inv && n !== inv.count) push(inv.name, `pattern /${inv.pattern}/ matched ${n} times, expected exactly ${inv.count}`, where);
      if ('min' in inv && n < inv.min) push(inv.name, `pattern /${inv.pattern}/ matched ${n} times, expected at least ${inv.min}`, where);
    } else if (inv.type === 'first_h2') {
      const first = h2Headings(body)[0] || '';
      if (!new RegExp(inv.pattern, flags).test(first)) push(inv.name, `first H2 is '${first}', expected match for /${inv.pattern}/`, where);
    } else {
      push(inv.name, `unknown invariant type '${inv.type}'`, where);
    }
  }

  if ((step.required_sections || []).includes('Sources')) checkSourcesFresh(body, fm, push);
  if (step.golden) checkGolden(step.golden, body, fm, push);

  return { fails, fm };
}

// Standing flag 2 made numeric: every line in ## Sources carries a date no more
// than 90 days older than the output's own frontmatter date.
function checkSourcesFresh(body, fm, push) {
  const m = body.match(/^## Sources\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
  const items = m ? m[1].split('\n').filter(l => l.trim().startsWith('- ')) : [];
  if (!items.length) { push('sources-fresh', 'no source lines found under ## Sources', 'steps.json required_sections + standing flag 2'); return; }
  for (const line of items) {
    const d = line.match(/\d{4}-\d{2}-\d{2}/);
    if (!d) push('sources-fresh', `source line has no YYYY-MM-DD date: "${line.trim()}"`, 'determinism rule: every claim carries attribution');
    else if (daysBetween(fm.date, d[0]) > 90)
      push('sources-fresh', `source dated ${d[0]} is over 90 days older than output date ${fm.date}`, 'pipeline.md standing flag 2');
  }
}

// Step 0 golden: extract {option: {total_days, verdict}} and deep-compare against
// the entry for this mission. Prose is free; the numbers are not (Rows 29, 30).
function checkGolden(goldenRel, body, fm, push) {
  let golden;
  try { golden = readJSON(goldenRel); }
  catch (e) { push('golden-diff', e.message, goldenRel); return; }
  const expected = golden[fm.mission];
  if (!expected) { push('golden-diff', `no golden entry for mission "${fm.mission}" in ${goldenRel}`, goldenRel); return; }
  // Split into H2 sections first so a block missing its 'Total days' line reports
  // as missing instead of matching into the next option's numbers.
  const actual = {};
  for (const sec of body.split(/^(?=## )/m)) {
    const head = sec.match(/^## Option ([A-Z])\b/);
    if (!head) continue;
    const m = sec.match(/Total days: (\d+) \((PASS|FAIL)/);
    if (m) actual[head[1]] = { total_days: Number(m[1]), verdict: m[2] };
  }
  for (const [opt, exp] of Object.entries(expected)) {
    const act = actual[opt];
    if (!act) push('golden-diff', `option ${opt}: no 'Total days: N (PASS|FAIL ...)' line extracted`, goldenRel);
    else if (act.total_days !== exp.total_days || act.verdict !== exp.verdict)
      push('golden-diff', `option ${opt}: got ${act.total_days}/${act.verdict}, golden says ${exp.total_days}/${exp.verdict}`, goldenRel);
  }
  for (const opt of Object.keys(actual))
    if (!expected[opt]) push('golden-diff', `option ${opt} present in output but not in golden`, goldenRel);
}

// Gate ordering, real outputs only: no step file may exist unless every BLOCKING
// gate below its number has its output file (pipeline.md preamble).
function checkGateOrdering(files, report) {
  // Gates are derived from steps.json class metadata, not hardcoded, so adding
  // a gate step to the schema automatically extends this check.
  const gates = Object.entries(stepSchema.steps)
    .filter(([, s]) => s.class === 'gate')
    .map(([num, s]) => ({ num: Number(num), file: `${s.slug}.md` }));
  const byDir = {};
  for (const f of files) (byDir[path.dirname(f)] ||= []).push(path.basename(f));
  for (const [dir, names] of Object.entries(byDir)) {
    const steps = names.map(n => Number(n.slice(0, 2))).filter(n => !Number.isNaN(n));
    for (const g of gates) {
      if (steps.some(s => s > g.num) && !names.includes(g.file))
        report(dir, { name: 'gate-ordering', msg: `outputs exist past BLOCKING gate ${g.num} but ${g.file} is missing`, where: 'pipeline.md preamble + steps.json class' });
    }
  }
}

// ---- run ----
const failures = [];   // [{file, name, msg, where}]
let checked = 0;
const report = (file, f) => failures.push({ file, ...f });

const validFixtures = listMd('evals/fixtures/valid');
const brokenFixtures = SCHEMAS_ONLY ? [] : listMd('evals/fixtures/broken');
const missionOutputs = missionOutputFiles();

for (const f of [...validFixtures, ...missionOutputs]) {
  checked++;
  const { fails } = checkFile(f, f.startsWith('missions/') ? 'mission' : 'fixture');
  if (fails.length) fails.forEach(x => report(f, x));
  else console.log(`PASS ${f}`);
}

for (const f of brokenFixtures) {
  checked++;
  const { fails, fm } = checkFile(f, 'fixture');
  const expected = fm && fm.expect_fail;
  if (!expected)
    report(f, { name: 'self-test', msg: "broken fixture has no 'expect_fail' frontmatter key", where: 'output-frontmatter.json optional' });
  else if (!fails.length)
    report(f, { name: 'self-test', msg: `broken fixture PASSED all checks; it must fail '${expected}'. The gate no longer bites.`, where: 'ADR-0003 decision 4' });
  else if (!fails.some(x => x.name === expected))
    report(f, { name: 'self-test', msg: `broken fixture failed [${fails.map(x => x.name).join(', ')}] but not the named check '${expected}'`, where: 'ADR-0003 decision 4' });
  else
    console.log(`PASS ${f} (failed as expected on '${expected}')`);
}

if (!SCHEMAS_ONLY) checkGateOrdering(missionOutputs, report);

console.log('');
if (failures.length) {
  for (const f of failures)
    console.log(`FAIL ${f.file}\n  check: ${f.name}\n  ${f.msg}\n  demanded by: ${f.where}`);
  console.log(`\neval: ${failures.length} failure(s) across ${checked} file(s) [mode: ${SCHEMAS_ONLY ? 'schemas-only' : 'full'}]`);
  process.exit(1);
}
console.log(`eval: PASS. ${checked} file(s) checked (${validFixtures.length} valid fixtures, ${brokenFixtures.length} broken fixtures, ${missionOutputs.length} mission outputs) [mode: ${SCHEMAS_ONLY ? 'schemas-only' : 'full'}]`);
