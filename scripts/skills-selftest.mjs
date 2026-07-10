#!/usr/bin/env node
// Module 2 eval for the Module 4 skills (mission-runner, constraint-gate; ADR-0006
// decision 6). Builds synthetic fixtures in a temp dir, drives each backing script,
// and asserts behavior plus exit codes. Zero dependencies. Idempotent. Standalone.
// Gated in CI via .github/workflows/checks.yml.
//
// Usage: node scripts/skills-selftest.mjs
// Exit codes: 0 all assertions pass, 1 any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(os.tmpdir(), 'reloc-skills-selftest');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const SLUGS = Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'evals/schemas/steps.json'), 'utf8')).steps)
  .filter(([k]) => /^\d+$/.test(k)).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, s]) => s.slug);

const failures = [];
const check = (name, cond, detail) => {
  if (cond) console.log(`PASS ${name}`);
  else { console.log(`FAIL ${name}: ${detail}`); failures.push(name); }
};

function runNode(scriptRel, args = [], { input, env } = {}) {
  const r = spawnSync(process.execPath, [path.join(ROOT, scriptRel), ...args],
    { input, encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// A crashing or non-JSON backing script must surface as a FAIL, not abort the
// suite before the summary and TMP cleanup run.
function parseJson(r, label) {
  try { return JSON.parse(r.stdout); }
  catch {
    console.log(`FAIL ${label}: non-JSON output (status=${r.status}): ${r.stdout.slice(0, 200)}${r.stderr ? ` stderr: ${r.stderr.slice(0, 200)}` : ''}`);
    failures.push(label);
    return {};
  }
}

// ---- mission-runner fixtures ----
function makeMission(name, { outputs = [], gatesResolved = false } = {}) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(path.join(dir, 'outputs'), { recursive: true });
  for (const slug of outputs) fs.writeFileSync(path.join(dir, 'outputs', `${slug}.md`), 'stub\n');
  if (gatesResolved) fs.writeFileSync(path.join(dir, 'gates-resolved.md'), 'L3: RESOLVED\nL7: RESOLVED\n');
  return dir;
}
const mr = dir => { const r = runNode('scripts/mission-runner.mjs', ['--json', dir]); return { ...r, json: parseJson(r, `mission-runner ${path.basename(dir)}`) }; };

// 1. No outputs: next step is 0, booking freeze active, exit 1.
{
  const r = mr(makeMission('m-empty'));
  check('mission-runner/empty exit 1', r.status === 1, `got ${r.status}`);
  check('mission-runner/empty next=0', r.json.nextStep && r.json.nextStep.num === 0, JSON.stringify(r.json.nextStep));
  check('mission-runner/empty freeze', r.json.bookingFreeze === true, `freeze=${r.json.bookingFreeze}`);
  check('mission-runner/empty blocks step 2', r.json.blockedSteps?.some(s => s.num === 2), JSON.stringify(r.json.blockedSteps));
}
// 2. Gate 0 present but gates unresolved: refuses to cross the booking barrier, exit 1.
{
  const r = mr(makeMission('m-gate0', { outputs: ['00-constraint-math'] }));
  check('mission-runner/gate0 refuses (exit 1)', r.status === 1, `got ${r.status}`);
  check('mission-runner/gate0 next=1 (non-booking)', r.json.nextStep && r.json.nextStep.num === 1, JSON.stringify(r.json.nextStep));
}
// 3. All outputs present and gates resolved: pipeline complete, exit 0.
{
  const r = mr(makeMission('m-done', { outputs: SLUGS, gatesResolved: true }));
  check('mission-runner/complete exit 0', r.status === 0, `got ${r.status}`);
  check('mission-runner/complete allDone', r.json.allDone === true, `allDone=${r.json.allDone}`);
}
// 4. A later step present while gate 0 is missing: ordering violation, exit 2.
{
  const r = mr(makeMission('m-order', { outputs: ['02-miles-vs-cash'], gatesResolved: true }));
  check('mission-runner/ordering exit 2', r.status === 2, `got ${r.status}`);
  check('mission-runner/ordering flagged', r.json.orderingViolations?.length > 0, JSON.stringify(r.json.orderingViolations));
}

// ---- constraint-gate fixtures ----
const NOELIM = path.join(TMP, 'no-such-eliminators.txt'); // guaranteed absent
const cg = (plan, env = {}) => {
  const r = runNode('scripts/constraint-gate.mjs', ['--json', '-'],
    { input: plan, env: { ELIMINATORS_FILE: NOELIM, ...env } });
  return { ...r, json: parseJson(r, 'constraint-gate') };
};

// 5. Over the ceiling on a booking plan: L2 CONFLICT, exit 2.
{
  const r = cg('Book flights. Denver 3 nights, Spain 7 days, 1 travel day. Total: 11 days.');
  check('constraint-gate/L2 exit 2', r.status === 2, `got ${r.status}`);
  check('constraint-gate/L2 conflict', r.json.summary?.CONFLICT?.includes('L2'), JSON.stringify(r.json.summary));
}
// 6. Eliminated city named (via a controlled test list): L1 CONFLICT, exit 2.
{
  const list = path.join(TMP, 'test-eliminators.txt');
  fs.writeFileSync(list, '# test list\nAtlantis\n');
  const r = cg('Visit Atlantis for 5 days of research.', { ELIMINATORS_FILE: list });
  check('constraint-gate/L1 exit 2', r.status === 2, `got ${r.status}`);
  check('constraint-gate/L1 conflict', r.json.summary?.CONFLICT?.includes('L1'), JSON.stringify(r.json.summary));
  check('constraint-gate/L1 name withheld', !JSON.stringify(r.json).includes('Atlantis'), 'private name leaked into output');
}
// 6b. Eliminated location in a transit context only: L1 FLAGs, not CONFLICT (registry L1
// permits airport transit). Non-booking plan, so no L3/L7 block; exit 0.
{
  const list = path.join(TMP, 'test-eliminators.txt');
  fs.writeFileSync(list, '# test list\nAtlantis\n');
  const r = cg('Research trip: fly to Gijon, connecting through Atlantis airport. 6 days of desk research only.', { ELIMINATORS_FILE: list });
  check('constraint-gate/L1 transit exit 0', r.status === 0, `got ${r.status}`);
  const l1 = r.json.findings?.find(f => f.id === 'L1');
  check('constraint-gate/L1 transit FLAG', l1 && l1.status === 'FLAG', JSON.stringify(l1));
  check('constraint-gate/L1 transit name withheld', !JSON.stringify(r.json).includes('Atlantis'), 'private name leaked into output');
}
// 6c. Destination named alongside a transit clause for a DIFFERENT place: still CONFLICT.
{
  const list = path.join(TMP, 'test-eliminators.txt');
  fs.writeFileSync(list, '# test list\nAtlantis\n');
  const r = cg('Destination: Atlantis. Return flight connecting through Paris. 6 days of desk research only.', { ELIMINATORS_FILE: list });
  check('constraint-gate/L1 dest-not-transit exit 2', r.status === 2, `got ${r.status}`);
  check('constraint-gate/L1 dest-not-transit is L1', r.json.summary?.CONFLICT?.includes('L1'), JSON.stringify(r.json.summary));
  check('constraint-gate/L1 dest-not-transit withheld', !JSON.stringify(r.json).includes('Atlantis'), 'private name leaked into output');
}
// 7. Missing eliminator list: L1 self-skips to NOTE, never a silent CONFLICT.
{
  const r = cg('Compare Valencia and Gijon on cost of living. 6 days of desk research only.');
  check('constraint-gate/self-skip exit 0', r.status === 0, `got ${r.status}`);
  const l1 = r.json.findings?.find(f => f.id === 'L1');
  check('constraint-gate/self-skip NOTE', l1 && l1.status === 'NOTE', JSON.stringify(l1));
}
// 8. Booking plan that satisfies hard gates but routes via a discouraged hub: L5 FLAG, exit 0.
{
  const r = cg('Book Spain via Frankfurt using United miles. Cat-sitting RESOLVED. Signed offer with work-from-abroad in writing. 8 days total.');
  check('constraint-gate/soft-flag exit 0', r.status === 0, `got ${r.status}`);
  check('constraint-gate/soft-flag L5', r.json.summary?.FLAG?.includes('L5'), JSON.stringify(r.json.summary));
}
// 9. Clean non-booking plan: no conflicts, no blocks, exit 0.
{
  const r = cg('Draft a comparison of cost of living across candidate cities. 4 days of desk research only.');
  check('constraint-gate/clean exit 0', r.status === 0, `got ${r.status}`);
  check('constraint-gate/clean no conflict/block',
    r.json.summary?.CONFLICT?.length === 0 && r.json.summary?.BLOCKED?.length === 0, JSON.stringify(r.json.summary));
}

// ---- award-watch fixtures ----
const aw = watch => {
  const r = runNode('scripts/award-watch.mjs', ['--json', '-'], { input: JSON.stringify(watch) });
  return { ...r, json: parseJson(r, 'award-watch') };
};
const OPT = (over = {}) => ({
  id: 'o', route: 'SEA-EWR-LIS', carrier: 'United/TAP', depart: '2026-07-30',
  miles: 88000, taxes_fees_usd: 5.6, cash_price_usd: 3200, action: 'watch', ...over,
});
const WIN = { start: '2026-07-25', end: '2026-08-05' };

// 10. Clean monitoring, watch action: exit 0, no freeze, cpm computed, banner.
{
  const r = aw({ trip_window: WIN, options: [OPT()] });
  check('award-watch/clean exit 0', r.status === 0, `got ${r.status}`);
  check('award-watch/clean no freeze', r.json.bookingFreeze === false, `freeze=${r.json.bookingFreeze}`);
  check('award-watch/clean booking-adjacent', r.json.bookingAdjacent === true, JSON.stringify(r.json.bookingAdjacent));
  check('award-watch/clean cpm ~3.63', r.json.options?.[0]?.cpm === 3.63, `cpm=${r.json.options?.[0]?.cpm}`);
}
// 11. Frankfurt hub routing: L5 flag on the option, still exit 0 (soft).
{
  const r = aw({ trip_window: WIN, options: [OPT({ route: 'SEA-FRA-VLC', carrier: 'Lufthansa' })] });
  check('award-watch/L5 exit 0', r.status === 0, `got ${r.status}`);
  check('award-watch/L5 flag', r.json.options?.[0]?.flags?.some(f => f.id === 'L5'), JSON.stringify(r.json.options?.[0]?.flags));
}
// 12. Non-Star carrier: L4 flag, exit 0 (soft, advisory).
{
  const r = aw({ trip_window: WIN, options: [OPT({ carrier: 'Iberia' })] });
  check('award-watch/L4 flag', r.json.options?.[0]?.flags?.some(f => f.id === 'L4'), JSON.stringify(r.json.options?.[0]?.flags));
}
// 13. Any book request is refused: BOOKING FREEZE, exit 1. There is no gate field
// that can permit it (fail closed; award-watch has no booking path).
{
  const r = aw({ options: [OPT({ action: 'book' })] });
  check('award-watch/freeze exit 1', r.status === 1, `got ${r.status}`);
  check('award-watch/freeze flagged', r.json.bookingFreeze === true, `freeze=${r.json.bookingFreeze}`);
}
// 14. A stray gates_resolved:true in the watch-file cannot permit a booking (the field
// is ignored by design): a book request still freezes, exit 1.
{
  const r = aw({ gates_resolved: true, options: [OPT({ action: 'book' })] });
  check('award-watch/no-override exit 1', r.status === 1, `got ${r.status}`);
}
// 15. Non-positive miles_available falls back to the 300000 default, not a nonsensical 0.
{
  const r = aw({ miles_available: 0, options: [OPT({ miles: 88000 })] });
  check('award-watch/miles fallback', r.json.milesAvailable === 300000, `milesAvailable=${r.json.milesAvailable}`);
  check('award-watch/miles no false over-budget', !r.json.options?.[0]?.flags?.some(f => f.detail?.includes('exceeds')), JSON.stringify(r.json.options?.[0]?.flags));
}
// 16. Impossible calendar depart (2026-02-31): schema error, exit 2 (regex alone would pass).
{
  const r = runNode('scripts/award-watch.mjs', ['-'], { input: JSON.stringify({ options: [OPT({ depart: '2026-02-31' })] }) });
  check('award-watch/bad-date exit 2', r.status === 2, `got ${r.status}`);
}
// 17. Reversed trip window (start > end) is treated as unset: no crash, in-window null, exit 0.
{
  const r = aw({ trip_window: { start: '2026-08-05', end: '2026-07-25' }, options: [OPT()] });
  check('award-watch/reversed-window exit 0', r.status === 0, `got ${r.status}`);
  check('award-watch/reversed-window unset', r.json.tripWindow === null, JSON.stringify(r.json.tripWindow));
}
// 18. A null option entry: schema error, exit 2, not a TypeError crash.
{
  const r = runNode('scripts/award-watch.mjs', ['-'], { input: JSON.stringify({ options: [null] }) });
  check('award-watch/null-option exit 2', r.status === 2, `got ${r.status}`);
}
// 19. Empty options: schema error, exit 2 (not a silent pass).
{
  const r = runNode('scripts/award-watch.mjs', ['-'], { input: JSON.stringify({ options: [] }) });
  check('award-watch/empty exit 2', r.status === 2, `got ${r.status}`);
}

// ---- city-dossier fixtures ----
const DKB = path.join(TMP, 'dossier-kb');
fs.mkdirSync(path.join(DKB, 'knowledge'), { recursive: true });
fs.mkdirSync(path.join(DKB, 'memory', 'private'), { recursive: true });
fs.writeFileSync(path.join(DKB, 'knowledge', 'stale.md'), '# Staleburg\nLast confirmed: 2020-01-01\n\n## Staleburg\n- an old fact about Staleburg.\n- a second line.\n');
// Frontmatter date is the recognized freshness metadata (a bare body "date:" is not).
fs.writeFileSync(path.join(DKB, 'memory', 'fresh.md'), '---\ndate: 2026-07-01\n---\n\n## Freshton\n- Freshton is fresh.\n');
fs.writeFileSync(path.join(DKB, 'memory', 'accent.md'), '## Gijón\n- accented profile line.\n- second accented line.\n');
// A body "date:" line must NOT override the real freshness marker: this source is STALE by
// its "Last confirmed" date, and the 2099 prose date must be ignored (finding: metadata-specific).
fs.writeFileSync(path.join(DKB, 'memory', 'bodydate.md'), '# Metroville\nLast confirmed: 2020-01-01\n\n## Metroville\n- event date: 2099-12-31 is only mentioned in prose.\n- a fact.\n');
fs.writeFileSync(path.join(DKB, 'memory', 'private', 'secret.md'), 'Secretville eliminator reasoning is classified and private.\n');
const cd = (city, today = '2026-07-09') => {
  const r = runNode('scripts/city-dossier.mjs', ['--json', city], { env: { DOSSIER_KB_ROOT: DKB, DOSSIER_TODAY: today } });
  return { ...r, json: parseJson(r, `city-dossier ${city}`) };
};

// 20. Stale dated source: exit 1, source flagged stale, section captured with a body.
{
  const r = cd('Staleburg');
  check('city-dossier/stale exit 1', r.status === 1, `got ${r.status}`);
  check('city-dossier/stale flagged', r.json.staleSources?.includes('knowledge/stale.md'), JSON.stringify(r.json.staleSources));
  const sec = r.json.sources?.[0]?.hits?.find(h => h.kind === 'section');
  check('city-dossier/section body', sec && sec.body?.length > 0, JSON.stringify(r.json.sources?.[0]?.hits));
}
// 21. Fresh frontmatter date: exit 0.
{
  const r = cd('Freshton');
  check('city-dossier/fresh exit 0', r.status === 0, `got ${r.status}`);
  check('city-dossier/fresh date parsed', r.json.sources?.[0]?.date === '2026-07-01', JSON.stringify(r.json.sources?.[0]?.date));
}
// 22. A body "date:" line is not freshness metadata: source stays STALE by Last-confirmed.
{
  const r = cd('Metroville');
  check('city-dossier/bodydate exit 1', r.status === 1, `got ${r.status}`);
  const src = r.json.sources?.find(s => s.claim_id === 'memory/bodydate.md');
  check('city-dossier/bodydate uses Last-confirmed', src?.date === '2020-01-01', JSON.stringify(src?.date));
  check('city-dossier/bodydate stale', src?.freshness === 'STALE', JSON.stringify(src?.freshness));
}
// 23. Accent-insensitive match: query "Gijon" matches "Gijón" heading; UNKNOWN date, exit 0.
{
  const r = cd('Gijon');
  check('city-dossier/accent exit 0', r.status === 0, `got ${r.status}`);
  check('city-dossier/accent matched', r.json.claimCount > 0, `claims=${r.json.claimCount}`);
}
// 24. Absent city: exit 3, no claims.
{
  const r = cd('Nowhere City');
  check('city-dossier/absent exit 3', r.status === 3, `got ${r.status}`);
}
// 25. Scope guard: a private-only name is not found (private excluded) and never leaks.
{
  const r = cd('Secretville');
  check('city-dossier/private not found (exit 3)', r.status === 3, `got ${r.status}`);
  check('city-dossier/private not leaked', !r.stdout.includes('classified'), 'private content surfaced in output');
}
// 26. Impossible reference date is rejected up front: exit 2.
{
  const r = runNode('scripts/city-dossier.mjs', ['--json', 'Freshton'], { env: { DOSSIER_KB_ROOT: DKB, DOSSIER_TODAY: '2026-02-31' } });
  check('city-dossier/bad-today exit 2', r.status === 2, `got ${r.status}`);
}
// 27. --today pins the freshness reference date and wins over DOSSIER_TODAY (determinism
// control): Freshton (dated 2026-07-01) is fresh at the env date but stale at the flag date.
{
  const r = runNode('scripts/city-dossier.mjs', ['--json', '--today=2027-01-01', 'Freshton'],
    { env: { DOSSIER_KB_ROOT: DKB, DOSSIER_TODAY: '2026-07-09' } });
  const j = parseJson(r, 'city-dossier --today');
  check('city-dossier/--today overrides env (stale exit 1)', r.status === 1, `got ${r.status}`);
  check('city-dossier/--today reference used', j.today === '2027-01-01', JSON.stringify(j.today));
}

// ---- sanitize-for-portfolio fixtures ----
// Build a tiny source repo (its own git repo, with gitignored marker files) and drive the
// real build+verify end to end. The cut self-scans with a copy of the real privacy-check.sh.
// Fixture markers are FICTIONAL tokens (never the real private markers), so this test file
// itself stays clean under the privacy gate. Same precedent as the constraint-gate 'Atlantis'
// fixture: never put a real marker in a tracked file, not even as test data.
function makeSanitizeSrc(name, { tracked = {}, patterns = ['Zephyrite', 'Brindlewax'], eliminators = ['Atlantis'], symlink = null, noChecker = false } = {}) {
  const src = path.join(TMP, name);
  fs.mkdirSync(path.join(src, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(src, 'memory', 'private'), { recursive: true });
  if (!noChecker) fs.copyFileSync(path.join(ROOT, 'scripts', 'privacy-check.sh'), path.join(src, 'scripts', 'privacy-check.sh'));
  fs.writeFileSync(path.join(src, '.gitignore'), 'memory/private/\n');
  fs.writeFileSync(path.join(src, 'memory', 'private', 'privacy-patterns.txt'), patterns.join('\n') + '\n');
  fs.writeFileSync(path.join(src, 'memory', 'private', 'eliminators.txt'), eliminators.join('\n') + '\n');
  for (const [rel, content] of Object.entries(tracked)) {
    const abs = path.join(src, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  if (symlink) {
    const abs = path.join(src, symlink.at);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.symlinkSync(symlink.to, abs);
  }
  for (const argv of [['init', '-q'], ['config', 'user.email', 't@t.t'], ['config', 'user.name', 't'], ['add', '-A']])
    spawnSync('git', argv, { cwd: src, encoding: 'utf8' });
  return src;
}
const sanitize = (src) => {
  const out = path.join(TMP, `${path.basename(src)}-out`);
  const r = runNode('scripts/sanitize-for-portfolio.mjs', ['--json'], { env: { SANITIZE_SRC: src, SANITIZE_OUT: out } });
  return { ...r, out, json: parseJson(r, `sanitize ${path.basename(src)}`) };
};

// 28. Tracked file leaks a marker: verification FAILs, exit 1, hit reported without marker content.
{
  const src = makeSanitizeSrc('san-leak', { tracked: { 'notes.md': '# n\nThis file mentions Zephyrite.\n', 'README.md': 'hello\n' } });
  const r = sanitize(src);
  check('sanitize/leak exit 1', r.status === 1, `got ${r.status}`);
  check('sanitize/leak FAIL', r.json.verification?.status === 'FAIL', JSON.stringify(r.json.verification));
  check('sanitize/leak reports path not content', /notes\.md/.test(r.json.checkOutput || '') && !/Zephyrite/.test(r.json.checkOutput || ''), 'marker content leaked into output');
}
// 29. Clean tracked files: verification PASSes, exit 0, private absent from cut, tracked file copied.
{
  const src = makeSanitizeSrc('san-clean', { tracked: { 'notes.md': '# n\nnothing private here.\n', 'README.md': 'hi\n' } });
  const r = sanitize(src);
  check('sanitize/clean exit 0', r.status === 0, `got ${r.status}`);
  check('sanitize/clean PASS', r.json.verification?.status === 'PASS', JSON.stringify(r.json.verification));
  check('sanitize/clean markerCount 3', r.json.markerCount === 3, `markerCount=${r.json.markerCount}`); // 2 patterns + 1 eliminator
  check('sanitize/clean copied file exists', fs.existsSync(path.join(r.out, 'notes.md')), 'tracked file not copied into cut');
  check('sanitize/clean private excluded', !fs.existsSync(path.join(r.out, 'memory', 'private')), 'memory/private present in cut');
}
// 30. Eliminated NAME appears in a tracked file: caught by the union marker list, exit 1, name not echoed.
{
  const src = makeSanitizeSrc('san-elim', { tracked: { 'plan.md': 'Visit Atlantis next week.\n' }, patterns: ['Zephyrite'], eliminators: ['Atlantis'] });
  const r = sanitize(src);
  check('sanitize/eliminated-name exit 1', r.status === 1, `got ${r.status}`);
  check('sanitize/eliminated-name no name leak', !/Atlantis/.test(JSON.stringify(r.json)), 'eliminated name leaked into output');
}
// 31. Missing marker source: hard refuse (exit 2), never a silent unverified cut.
{
  const src = makeSanitizeSrc('san-nomarker', { tracked: { 'a.md': 'clean\n' } });
  fs.rmSync(path.join(src, 'memory', 'private', 'privacy-patterns.txt'));
  const r = runNode('scripts/sanitize-for-portfolio.mjs', ['--json'], { env: { SANITIZE_SRC: src, SANITIZE_OUT: path.join(TMP, 'san-nomarker-out') } });
  check('sanitize/missing-marker exit 2', r.status === 2, `got ${r.status}`);
}
// 32. Symlinks are reproduced as symlinks in the cut (ADR-0006 discovery links survive).
{
  const src = makeSanitizeSrc('san-symlink', {
    tracked: { 'skills/foo/SKILL.md': '---\nname: foo\ndescription: d\n---\n', 'a.md': 'clean\n' },
    symlink: { at: '.claude/skills/foo', to: '../../skills/foo' },
  });
  const r = sanitize(src);
  check('sanitize/symlink exit 0', r.status === 0, `got ${r.status}`);
  const link = path.join(r.out, '.claude', 'skills', 'foo');
  check('sanitize/symlink preserved', fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink(), 'skill symlink not preserved in the cut');
}
// 33. Cut with no privacy-check.sh: tool error (exit 2), and NO temp marker dir is left behind
// (the checker-existence check runs before the temp file is created; CodeRabbit PR #13).
{
  const src = makeSanitizeSrc('san-nochecker', { tracked: { 'a.md': 'clean\n' }, noChecker: true });
  const before = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('sanitize-markers-')).length;
  // die() writes to stderr and exits 2 (no JSON), so call runNode directly rather than the
  // sanitize() helper (which would try to JSON-parse the empty stdout and log a false failure).
  const r = runNode('scripts/sanitize-for-portfolio.mjs', ['--json'], { env: { SANITIZE_SRC: src, SANITIZE_OUT: path.join(TMP, 'san-nochecker-out') } });
  const after = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('sanitize-markers-')).length;
  check('sanitize/no-checker exit 2', r.status === 2, `got ${r.status}`);
  check('sanitize/no-checker no temp leak', after <= before, `stray temp marker dir(s): before=${before} after=${after}`);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log('');
if (failures.length) { console.log(`skills-selftest: ${failures.length} failure(s): ${failures.join(', ')}`); process.exit(1); }
console.log('skills-selftest: PASS (all skill behaviors and exit codes asserted)');
