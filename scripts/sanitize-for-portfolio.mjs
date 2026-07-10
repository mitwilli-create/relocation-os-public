#!/usr/bin/env node
// Build the public portfolio cut and prove it clean (skill:
// skills/sanitize-for-portfolio, ADR-0007). Zero dependencies. Idempotent.
// Standalone. No Date.now/Math.random: given a fixed source tree and marker
// files, the output and exit code are fully reproducible.
//
// What it does (ADR-0007 decisions 2, 4, 6):
//   1. Enumerate TRACKED files only (`git ls-files -z` in the source repo), so
//      memory/private/ is excluded by construction (it is gitignored, never
//      tracked). Symlinks are reproduced as symlinks, not dereferenced, so the
//      ADR-0006 discovery links survive into the cut.
//   2. Copy them into a fresh output dir (default dist/public-cut/), then
//      `git init` + `git add -A` it so the cut is a real git repo with clean
//      history: exactly the artifact that gets pushed public.
//   3. Assemble the FULL marker list (the privacy patterns UNION the eliminated
//      -location names, the latter as escaped literals) into a temp file OUTSIDE
//      the repo and the cut, and run the CUT'S OWN copy of scripts/privacy-check.sh
//      against itself with PRIVACY_PATTERNS_FILE pointed at that temp file.
//   4. A marker hit is a hard FAIL: the cut is not publishable. A missing marker
//      source is also a hard stop, never a silent unverified pass: here the scan
//      is the entire point of the run.
//
// The combined marker file is sensitive (it contains the real markers). It lives
// only in the OS temp dir, only for the scan, and is unlinked in a finally block.
// The privacy-check output it drives reports hits by pattern NUMBER and file
// PATH, never marker content, so this script's output is safe to paste into a PR.
//
// This script never widens scope beyond the privacy gate (ADR-0006 decision 4):
// it copies tracked files, it does not read private memory except the two marker
// lists (through the same fail-loud pattern the gate uses), and it writes only
// under the output dir plus one temp marker file.
//
// Usage:
//   node scripts/sanitize-for-portfolio.mjs            build dist/public-cut/ and verify
//   node scripts/sanitize-for-portfolio.mjs --json     machine-readable result
//   node scripts/sanitize-for-portfolio.mjs --out=DIR  write the cut to DIR
// Env (defaults are correct for a normal run; overrides exist for tests):
//   SANITIZE_SRC=<dir>            source repo to cut (default: this repo root)
//   SANITIZE_OUT=<dir>           output dir (default: <src>/dist/public-cut)
//   SANITIZE_PATTERNS_FILE=<f>   privacy patterns (default: <src>/memory/private/privacy-patterns.txt)
//   SANITIZE_ELIMINATORS_FILE=<f> eliminated names (default: <src>/memory/private/eliminators.txt)
//
// Exit codes:
//   0  cut built and verified clean against the full marker list
//   1  cut built but the marker scan found a leak; DO NOT publish
//   2  usage / IO / git error, or a missing marker source (cannot verify: refuse)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function die(msg) { console.error(`sanitize-for-portfolio: ${msg}`); process.exit(2); }

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const outFlag = (args.find(a => a.startsWith('--out=')) || '').split('=').slice(1).join('=');

const SRC = path.resolve(process.env.SANITIZE_SRC || REPO_ROOT);
const OUT = path.resolve(outFlag || process.env.SANITIZE_OUT || path.join(SRC, 'dist', 'public-cut'));
const PATTERNS_FILE = path.resolve(process.env.SANITIZE_PATTERNS_FILE || path.join(SRC, 'memory', 'private', 'privacy-patterns.txt'));
const ELIMINATORS_FILE = path.resolve(process.env.SANITIZE_ELIMINATORS_FILE || path.join(SRC, 'memory', 'private', 'eliminators.txt'));

// Refuse to write the cut inside the source tree's own path in a way that would
// recurse (OUT under SRC is fine as long as it is gitignored; OUT === SRC is not).
if (OUT === SRC) die(`output dir must differ from the source repo (${SRC})`);

function git(cwdDir, argv) {
  const r = spawnSync('git', argv, { cwd: cwdDir, encoding: 'utf8' });
  if (r.status !== 0) die(`git ${argv.join(' ')} failed in ${cwdDir}: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

// --- 1. Enumerate tracked files (NUL-delimited: safe for spaces/quotes). ---
let tracked;
{
  const r = spawnSync('git', ['-C', SRC, 'ls-files', '-z'], { encoding: 'utf8' });
  if (r.status !== 0) die(`cannot list tracked files in ${SRC} (is it a git repo?): ${(r.stderr || '').trim()}`);
  tracked = r.stdout.split('\0').filter(Boolean);
}
if (!tracked.length) die(`no tracked files found in ${SRC}`);

// --- 2. Build a fresh cut. Reproduce symlinks as symlinks. ---
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let copied = 0;
for (const rel of tracked) {
  const from = path.join(SRC, rel);
  const to = path.join(OUT, rel);
  let st;
  try { st = fs.lstatSync(from); }
  catch (e) { die(`tracked file missing from working tree: ${rel} (${e.code})`); }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (st.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to);
  else if (st.isFile()) fs.copyFileSync(from, to);
  else die(`tracked path is neither file nor symlink: ${rel}`);
  copied++;
}

// Belt-and-suspenders: the private corpus must not exist in the cut.
const privateInCut = path.join(OUT, 'memory', 'private');
let privateLeakedFiles = [];
if (fs.existsSync(privateInCut)) {
  privateLeakedFiles = fs.readdirSync(privateInCut);
  if (privateLeakedFiles.length) die(`memory/private/ present in the cut with ${privateLeakedFiles.length} file(s); tracked-file copy should never produce this`);
}

// Make the cut a real git repo so its own privacy-check.sh can scan it.
git(OUT, ['init', '-q']);
git(OUT, ['add', '-A']);

// --- 3. Assemble the FULL marker list into a temp file OUTSIDE repo and cut. ---
function readList(file, label) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT')
      die(`missing ${label} at ${file}. The full-marker scan is the point of this run; refusing to produce an unverified cut. Restore private memory or set the override env var.`);
    die(`cannot read ${label} at ${file}: ${e.message}`);
  }
  return text.split(/\r?\n/).filter(l => !/^\s*(#|$)/.test(l));
}
const escapeERE = s => s.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&');
const patternLines = readList(PATTERNS_FILE, 'privacy patterns file');   // already regexes
const eliminatorLines = readList(ELIMINATORS_FILE, 'eliminators file').map(escapeERE); // literals
const combined = [...patternLines, ...eliminatorLines];
if (!combined.length) die('the full marker list is empty; refusing to verify against nothing');

// --- 4. Run the CUT'S OWN privacy-check.sh against itself, full markers. ---
// Validate the checker exists BEFORE creating the temp marker file, so that a
// die() here cannot skip the cleanup (process.exit does not run finally blocks)
// and strand a temp file that contains the real markers.
const checkScript = path.join(OUT, 'scripts', 'privacy-check.sh');
if (!fs.existsSync(checkScript)) die(`the cut has no scripts/privacy-check.sh to run (source repo must track it)`);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanitize-markers-'));
const tmpMarkers = path.join(tmpDir, 'full-markers.txt');
let verifyStatus, verifyOut, verifyError;
try {
  fs.writeFileSync(tmpMarkers, combined.join('\n') + '\n');
  const r = spawnSync('bash', [checkScript], {
    cwd: OUT, encoding: 'utf8',
    env: { ...process.env, PRIVACY_PATTERNS_FILE: tmpMarkers },
  });
  // A spawn failure (bash unspawnable: r.error set, r.status null) means NOTHING
  // was scanned. Capture it here and die AFTER the finally cleans up the temp
  // file; never let it fall through as verifyStatus=null, which would misreport a
  // broken environment as a privacy FAIL (exit 1) instead of a tool error (exit 2).
  if (r.error || r.status === null) verifyError = r.error || new Error('privacy-check.sh did not run to completion');
  else { verifyStatus = r.status; verifyOut = (r.stdout || '') + (r.stderr ? `\n${r.stderr}` : ''); }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
if (verifyError) die(`could not run the cut's privacy-check.sh (tooling/IO error, nothing was scanned): ${verifyError.message}`);

const clean = verifyStatus === 0;
const exitCode = clean ? 0 : 1;
const result = {
  src: SRC,
  out: OUT,
  trackedCount: tracked.length,
  copiedCount: copied,
  privateInCut: privateLeakedFiles.length > 0,
  markerCount: combined.length,
  verification: { status: clean ? 'PASS' : 'FAIL', exitCode: verifyStatus },
  exitCode,
};

if (asJson) {
  console.log(JSON.stringify({ ...result, checkOutput: verifyOut.trim() }, null, 2));
  process.exit(exitCode);
}

console.log(`sanitize-for-portfolio`);
console.log(`Source:   ${path.relative(process.cwd(), SRC) || '.'}`);
console.log(`Cut:      ${path.relative(process.cwd(), OUT) || '.'}  (${copied} tracked file(s) copied; memory/private excluded)`);
console.log(`Markers:  ${combined.length} pattern(s) scanned (privacy patterns + eliminated names)`);
console.log('');
console.log(verifyOut.trim());
console.log('');
if (clean) {
  console.log(`RESULT: PASS. The cut is verified clean against the full marker list and is publishable.`);
  console.log(`Next (outward, Mitchell-driven): review ${path.relative(process.cwd(), OUT)}, then push it to a NEW public repo.`);
} else {
  console.log(`RESULT: FAIL. The cut contains at least one private marker (see the PRIVACY FAIL line(s) above, reported by pattern number and file path). DO NOT publish. Fix the leak in the source repo and rebuild.`);
}
process.exit(exitCode);
