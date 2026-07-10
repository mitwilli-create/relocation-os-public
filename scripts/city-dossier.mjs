#!/usr/bin/env node
// Assemble a per-city evaluation dossier from knowledge-base claims (skill:
// skills/city-dossier, ADR-0006 determinism boundary). Zero dependencies.
// Idempotent given a fixed reference date. Standalone.
//
// Retrieval is SCOPE-SAFE: this script reads exactly the set the relocation-kb
// MCP server serves (tracked knowledge/ and memory/, EXCLUDING memory/private/).
// It is not a backdoor around that scope (ADR-0006 decision 4); memory/private/
// is skipped by construction, and the script never writes outside the repo.
// Interactive retrieval should still prefer the MCP tools (search_claims /
// read_claim); this script produces the deterministic, source-attributed,
// freshness-flagged artifact that a dossier needs.
//
// When a city name lands on a markdown heading, the whole block beneath that
// heading is captured as one claim (so a city's profile section comes through
// intact, not just its title line). Other matches are captured line by line.
// Every claim carries a file:line source. Every source is checked for a date
// (a "Last confirmed:" / "Last verified:" line, a frontmatter "date:" line, or a
// leading YYYY-MM-DD in the filename) and flagged STALE when older than 90 days,
// UNKNOWN when no date is present. Freshness is measured against DOSSIER_TODAY
// (default: system date), so the check is deterministic under test.
//
// Determinism: given a fixed reference date and a fixed KB, the output and exit
// code are fully reproducible. The reference date is taken from --today, then
// DOSSIER_TODAY, then the system clock. Pin --today (or DOSSIER_TODAY) for eval
// and CI runs; the wall-clock default is the one intentional time-dependent input,
// because freshness is inherently relative to "now" and has no fixed answer without
// a reference date.
//
// Usage:
//   node scripts/city-dossier.mjs <city>
//   node scripts/city-dossier.mjs --json <city>
//   node scripts/city-dossier.mjs --today=2026-07-09 <city>   pin the freshness reference date
// Env:
//   DOSSIER_TODAY=YYYY-MM-DD    reference date for the freshness check (--today wins over it)
//   DOSSIER_KB_ROOT=<dir>       KB root to scan (default: repo root; for tests)
//
// Exit codes:
//   0  dossier assembled, all dated sources fresh
//   1  dossier assembled, but >=1 source is STALE (>90 days); freshness review needed
//   2  usage / IO error
//   3  no claims found for the city in the served scope

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB_ROOT = process.env.DOSSIER_KB_ROOT ? path.resolve(process.env.DOSSIER_KB_ROOT) : REPO_ROOT;
const FRESH_DAYS = 90;          // registry/eval freshness window
const MAX_SECTION_LINES = 40;   // cap a captured section so a match cannot pull a whole file
const SCAN_DIRS = ['knowledge', 'memory']; // the relocation-kb served scope

function die(msg) { console.error(`city-dossier: ${msg}`); process.exit(2); }

// Serve only git-tracked files under the scanned dirs, so a gitignored-but-non-
// private note (e.g. a knowledge/research/raw/ scratch file) never enters a
// dossier. This mirrors the relocation-kb server one-for-one (ADR-0005 amendment
// 2026-07-09); the two surfaces must not diverge. Snapshotted once per run.
//
// Fail closed, not open: only a POSITIVELY confirmed non-worktree (git exit 128
// "not a git repository", e.g. a DOSSIER_KB_ROOT test fixture) returns null to fall
// back to the directory scan. Any operational failure in a real repo (git missing,
// timeout) throws, so a transient error never silently serves ignored files. git is
// a system binary invoked via execFile with no shell, so no npm dependency is added.
function trackedSet(root) {
  try {
    const inside = execFileSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (inside !== 'true') return null; // inside a .git dir but not a work tree
  } catch (e) {
    // Exit 128 is a generic git fatal; only "not a git repository" means a genuine
    // non-worktree. Other 128s (corruption, permission) and spawn errors (git
    // missing, timeout) are operational and fail closed rather than reopen the scan.
    if (e && e.status === 128 && /not a git repository/i.test(String(e.stderr ?? ''))) return null;
    throw e; // fail closed (caught below and reported via die)
  }
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z', '--', ...SCAN_DIRS], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const set = new Set();
  for (const p of out.split('\0')) if (p) set.add(p);
  return set;
}
let TRACKED; // paths relative to KB_ROOT, POSIX separators (see toPosix in walk)
try { TRACKED = trackedSet(KB_ROOT); }
catch (e) { die(`cannot determine git scope (${e.status ?? e.code ?? 'error'}): ${e.message}`); }

// git ls-files emits POSIX separators; path.relative emits platform-native ones.
const toPosix = p => (path.sep === '/' ? p : p.split(path.sep).join('/'));

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const todayFlag = (args.find(a => a.startsWith('--today=')) || '').split('=').slice(1).join('=');
const city = args.filter(a => !a.startsWith('--')).join(' ').trim();
if (!city) die('usage: city-dossier.mjs [--json] [--today=YYYY-MM-DD] <city>');

// Strict calendar-date parse: rejects syntactically valid but impossible dates
// (e.g. 2026-02-31) via a UTC round-trip. Returns 'YYYY-MM-DD' or null.
function parseISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) ? s : null;
}
// Reference date precedence: --today, then DOSSIER_TODAY, then the system clock.
const todaySrc = todayFlag ? '--today' : process.env.DOSSIER_TODAY ? 'DOSSIER_TODAY' : 'system clock';
const today = todayFlag || process.env.DOSSIER_TODAY || new Date().toISOString().slice(0, 10);
if (!parseISO(today)) die(`reference date must be a real calendar date (YYYY-MM-DD); got "${today}" from ${todaySrc}`);

// Accent-fold so "Gijon" matches "Gijón" and vice versa, case-insensitively.
const fold = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const cityFolded = fold(city);
const cityRe = new RegExp(`\\b${cityFolded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
const isHeading = l => /^#{1,6}\s/.test(l);

function daysBetween(a, b) { // b - a, in whole days; a,b are YYYY-MM-DD
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// Gather .md files under the served scope, never descending into private memory.
// A missing scan dir (ENOENT) is expected and skipped; any other error (a
// permission/IO failure) surfaces so the caller cannot mistake an incomplete
// scan for a complete dossier.
function walk(dir, acc) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return acc; throw e; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(KB_ROOT, abs);
    // Hard scope guard: never traverse private memory (ADR-0004/ADR-0006).
    if (rel.split(path.sep).includes('private')) continue;
    if (e.name === '.git' || e.name === 'node_modules') continue;
    if (e.isDirectory()) walk(abs, acc);
    // Serve only git-tracked .md files (ADR-0005 amendment); TRACKED === null means
    // KB_ROOT is not a git work tree, so fall back to serving every .md found.
    // toPosix so the tracked-set check holds on Windows, where rel uses '\'.
    else if (e.isFile() && e.name.endsWith('.md') && (TRACKED === null || TRACKED.has(toPosix(rel)))) acc.push(abs);
  }
  return acc;
}

const files = [];
try { for (const d of SCAN_DIRS) walk(path.join(KB_ROOT, d), files); }
catch (e) { die(`cannot scan KB scope (${e.code || 'error'}): ${e.message}`); }
files.sort();

// Leading frontmatter block (between the first two --- fences), or '' if none.
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

// Freshest VALID calendar date for a file. Sources, most to least specific: a
// leading YYYY-MM-DD in the filename; an explicit "Last confirmed:" / "Last
// verified:" line anywhere (the documented freshness convention); a "date:" line
// ONLY inside leading frontmatter. A bare "date:" in prose is not freshness
// metadata and must not mark a stale source fresh. Impossible dates are dropped.
function fileDate(abs, text) {
  const cand = [];
  const nameDate = path.basename(abs).match(/(\d{4}-\d{2}-\d{2})/);
  if (nameDate) cand.push(nameDate[1]);
  for (const m of text.matchAll(/last\s+(?:confirmed|verified)\s*[:=]\s*(\d{4}-\d{2}-\d{2})/gi))
    cand.push(m[1]);
  for (const m of frontmatter(text).matchAll(/^\s*date\s*[:=]\s*(\d{4}-\d{2}-\d{2})\s*$/gim))
    cand.push(m[1]);
  const valid = cand.filter(parseISO);
  return valid.length ? valid.sort().pop() : null; // latest valid date wins
}

const sources = [];
for (const abs of files) {
  let text;
  // The walk already confirmed this file exists; a read failure now is a real
  // error, so surface it rather than silently dropping a source.
  try { text = fs.readFileSync(abs, 'utf8'); }
  catch (e) { die(`cannot read ${path.relative(KB_ROOT, abs)}: ${e.message}`); }
  const rel = path.relative(KB_ROOT, abs);
  const lines = text.split(/\r?\n/);
  const hits = [];
  let coveredUntil = -1; // last line index already emitted as part of a section
  for (let i = 0; i < lines.length; i++) {
    if (i <= coveredUntil) continue;
    if (!cityRe.test(fold(lines[i]))) continue;
    if (isHeading(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !isHeading(lines[j]) && (j - i) <= MAX_SECTION_LINES) j++;
      const body = lines.slice(i + 1, j).map(b => b.replace(/\s+$/, ''));
      while (body.length && body[body.length - 1] === '') body.pop();
      hits.push({ line: i + 1, kind: 'section', heading: lines[i].trim(), body });
      coveredUntil = j - 1;
    } else {
      hits.push({ line: i + 1, kind: 'line', snippet: lines[i].trim().slice(0, 200) });
    }
  }
  if (!hits.length) continue;
  const date = fileDate(abs, text);
  const ageDays = date ? daysBetween(date, today) : null;
  const freshness = date == null ? 'UNKNOWN' : (ageDays > FRESH_DAYS ? 'STALE' : 'FRESH');
  sources.push({ claim_id: rel, date, ageDays, freshness, hits });
}

const claimCount = sources.reduce((n, s) => n + s.hits.length, 0);
const staleSources = sources.filter(s => s.freshness === 'STALE');

if (claimCount === 0) {
  const msg = `no claims naming "${city}" found in the served scope (knowledge/, tracked memory/). It may not be a tracked candidate, or the name/spelling differs.`;
  if (asJson) console.log(JSON.stringify({ city, today, claimCount: 0, sources: [], note: msg, exitCode: 3 }, null, 2));
  else console.log(`City dossier: ${city}\nGenerated: ${today}\n\n${msg}`);
  process.exit(3);
}

const exitCode = staleSources.length ? 1 : 0;
const result = {
  city, today, freshDays: FRESH_DAYS, kbRoot: path.relative(REPO_ROOT, KB_ROOT) || '.',
  claimCount, sourceCount: sources.length,
  staleSources: staleSources.map(s => s.claim_id),
  sources, exitCode,
};

if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(exitCode); }

console.log(`City dossier: ${city}`);
console.log(`Generated: ${today}   Freshness window: ${FRESH_DAYS} days   Scope: knowledge/ + tracked memory/ (memory/private excluded)`);
console.log(`${claimCount} claim(s) across ${sources.length} source(s).\n`);
for (const s of sources) {
  const tag = s.freshness === 'FRESH' ? 'FRESH'
    : s.freshness === 'STALE' ? `STALE (${s.ageDays} days old, dated ${s.date})`
    : 'UNKNOWN date';
  console.log(`## ${s.claim_id}  [${tag}]`);
  for (const h of s.hits) {
    if (h.kind === 'section') {
      console.log(`  ${s.claim_id}:${h.line}  ${h.heading}`);
      for (const b of h.body) console.log(`      ${b}`);
    } else {
      console.log(`  ${s.claim_id}:${h.line}  ${h.snippet}`);
    }
  }
  console.log('');
}
if (staleSources.length)
  console.log(`FRESHNESS REVIEW: ${staleSources.length} source(s) exceed the ${FRESH_DAYS}-day window: ${staleSources.map(s => s.claim_id).join(', ')}. Re-verify before acting on their claims.`);
else
  console.log(`All dated sources are within the ${FRESH_DAYS}-day freshness window.`);
console.log(`This dossier is evaluation input, not a plan. Any booking it informs is gated by L3 (cat-sitting) and L7 (offer); run constraint-gate on any derived plan.`);
process.exit(exitCode);
