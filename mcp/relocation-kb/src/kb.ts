// Relocation KB access layer. No MCP here on purpose, so the security-relevant
// logic (path gate, ripgrep invocation, listing) is unit-testable without a
// transport. index.ts wires these functions to MCP tools.
//
// Security posture (see ADR-0005 and the adjudicated council report):
//  - Scope is fixed at startup from the module's own location, never process.cwd().
//  - Served set is an allowlist (knowledge/, memory/), never the whole repo.
//  - Within the served dirs, only git-tracked files are served (ADR-0005 amendment
//    2026-07-09), so a gitignored-but-non-private note never surfaces. Falls back to
//    a directory scan when the root is not a git work tree (e.g. a test fixture).
//  - memory/private/ is denied in every code path, canonicalized to defeat symlinks.
//  - ripgrep runs via execFile against an absolute bundled binary, never a shell.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, realpath, readdir, stat } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { rgPath } from "@vscode/ripgrep";

const execFileAsync = promisify(execFile);

// --- Scope configuration (explicitly configured, never process.cwd()) ---
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
// src/ -> relocation-kb -> mcp -> repo root
const CONFIGURED_ROOT = process.env.RELOCATION_KB_ROOT
  ? path.resolve(process.env.RELOCATION_KB_ROOT)
  : path.resolve(MODULE_DIR, "..", "..", "..");

// Directories served as the KB. Least privilege: only these.
const SERVED_SUBDIRS = ["knowledge", "memory"];
// Denied even though it nests under a served dir.
const PRIVATE_SUBPATH = path.join("memory", "private");

// --- Bounds ---
const MAX_QUERY_LEN = 512;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MiB: generous, guards pathological reads
const RG_TIMEOUT_MS = 5000;
const RG_MAX_BUFFER = 8 * 1024 * 1024;
const MAX_COLUMNS = 300;

export interface SearchResult {
  claim_id: string;
  line: number;
  snippet: string;
}
export interface Topic {
  claim_id: string;
  title: string;
  bytes: number;
}

interface Scope {
  root: string;
  served: string[];
  privateReal: string | null;
  // Repo-relative paths git tracks under the served subdirs. null means the root is
  // not a git work tree, in which case scope falls back to the directory scan.
  tracked: Set<string> | null;
}

let scopePromise: Promise<Scope> | null = null;

// The set of git-tracked files under the served subdirs, as repo-relative posix
// paths. Snapshotted once at scope init (ADR-0005 amendment): a file committed
// mid-session appears only after a restart.
//
// Fail closed, not open: only a POSITIVELY confirmed non-worktree (a mkdtemp test
// fixture, git exit 128 "not a git repository") returns null to fall back to the
// directory scan. Any operational failure in a real repo (git missing, timeout,
// buffer overflow) throws, so a transient error never silently drops the tracked-
// only boundary and serves ignored files.
async function computeTracked(root: string): Promise<Set<string> | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", root, "rev-parse", "--is-inside-work-tree"],
      { timeout: RG_TIMEOUT_MS, windowsHide: true },
    );
    if (stdout.trim() !== "true") return null; // inside a .git dir but not a work tree
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string | Buffer };
    // Exit 128 is a generic git fatal. Only "not a git repository" means a genuine
    // non-worktree (the test-fixture case). Other 128s (repo corruption, permission
    // failure) and spawn errors (git missing, timeout) are operational and fail
    // closed, so a broken real repo never silently reopens the permissive scan.
    if (e && e.code === 128 && /not a git repository/i.test(String(e.stderr ?? ""))) {
      return null;
    }
    throw new Error(`cannot determine git scope for ${root}: ${e?.message ?? "git error"}`);
  }
  // Confirmed work tree: a failure enumerating tracked files is operational, so let
  // it propagate (fail closed) rather than fall back to the permissive scan.
  const { stdout } = await execFileAsync(
    "git",
    ["-C", root, "ls-files", "-z", "--", ...SERVED_SUBDIRS],
    { timeout: RG_TIMEOUT_MS, maxBuffer: RG_MAX_BUFFER, windowsHide: true },
  );
  const set = new Set<string>();
  for (const entry of stdout.split("\0")) {
    if (entry) set.add(entry);
  }
  return set;
}

// git ls-files emits POSIX separators; path.relative emits platform-native ones.
// Normalize before comparing against the tracked set so the check holds on Windows.
function toPosix(p: string): string {
  return path.sep === "/" ? p : p.split(path.sep).join("/");
}

// True if `scope` restricts to tracked files and `rel` is not among them.
function isUntracked(scope: Scope, rel: string): boolean {
  return scope.tracked !== null && !scope.tracked.has(rel);
}

// Canonicalize the root and served dirs once. realpath follows symlinks, which is
// what the "resolve then verify" pattern needs to prevent symlink escape.
async function getScope(): Promise<Scope> {
  if (!scopePromise) {
    scopePromise = (async () => {
      const root = await realpath(CONFIGURED_ROOT);
      const served: string[] = [];
      for (const sub of SERVED_SUBDIRS) {
        try {
          served.push(await realpath(path.join(root, sub)));
        } catch {
          // A served dir that does not exist is simply not served.
        }
      }
      let privateReal: string | null = null;
      try {
        privateReal = await realpath(path.join(root, PRIVATE_SUBPATH));
      } catch {
        privateReal = null; // absent is fine
      }
      // Uses the canonicalized root so ls-files paths share the base that every
      // path.relative(root, real) below is measured against.
      const tracked = await computeTracked(root);
      return { root, served, privateReal, tracked };
    })();
  }
  return scopePromise;
}

// True if `child` is `parent` or nested under it. Uses path.relative rather than a
// startsWith string test, which would misjudge sibling prefixes like foo vs foobar.
function isWithin(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Resolve a repo-relative claim id to a canonical absolute path inside the served
// scope, or throw. This is the confidentiality boundary.
export async function resolveClaimPath(claimId: string): Promise<string> {
  if (typeof claimId !== "string" || claimId.length === 0) {
    throw new Error("claim_id must be a non-empty string");
  }
  if (claimId.includes("\0")) {
    throw new Error("claim_id contains a null byte");
  }
  if (path.isAbsolute(claimId)) {
    throw new Error("claim_id must be a repo-relative path, not absolute");
  }
  const scope = await getScope();
  const { root, served, privateReal } = scope;
  const resolved = path.resolve(root, claimId);
  let real: string;
  try {
    real = await realpath(resolved);
  } catch {
    throw new Error(`claim not found: ${claimId}`);
  }
  if (privateReal && isWithin(privateReal, real)) {
    throw new Error("access denied: private scope");
  }
  if (!served.some((dir) => isWithin(dir, real))) {
    throw new Error("access denied: outside served scope");
  }
  if (isUntracked(scope, toPosix(path.relative(root, real)))) {
    throw new Error("access denied: untracked path");
  }
  return real;
}

// Return one whole markdown file, byte-exact. Provenance is the repo-relative path.
export async function readClaim(
  claimId: string,
): Promise<{ claim_id: string; source: string; bytes: number; content: string }> {
  const real = await resolveClaimPath(claimId);
  const info = await stat(real);
  if (!info.isFile()) {
    throw new Error(`claim is not a file: ${claimId}`);
  }
  if (info.size > MAX_FILE_BYTES) {
    throw new Error(`claim exceeds size cap (${info.size} bytes > ${MAX_FILE_BYTES})`);
  }
  const content = await readFile(real, "utf8");
  const { root } = await getScope();
  const source = path.relative(root, real);
  return { claim_id: source, source, bytes: info.size, content };
}

async function firstHeading(abs: string, fallback: string, sizeBytes: number): Promise<string> {
  if (sizeBytes > MAX_FILE_BYTES) return fallback; // never buffer an oversized file
  try {
    const content = await readFile(abs, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < Math.min(lines.length, 60); i++) {
      const m = lines[i].match(/^#\s+(.+?)\s*$/);
      if (m) return m[1];
    }
  } catch {
    // fall through to fallback
  }
  return fallback;
}

// Enumerate the markdown files available as claims, excluding memory/private.
export async function listTopics(): Promise<Topic[]> {
  const scope = await getScope();
  const { root, served, privateReal } = scope;
  const topics: Topic[] = [];
  for (const dir of served) {
    let entries: string[];
    try {
      entries = await readdir(dir, { recursive: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      // Canonicalize before any check or read, mirroring resolveClaimPath, so a
      // symlink cannot smuggle memory/private or out-of-scope content into the list.
      let real: string;
      try {
        real = await realpath(path.join(dir, entry));
      } catch {
        continue;
      }
      if (privateReal && isWithin(privateReal, real)) continue;
      if (!served.some((s) => isWithin(s, real))) continue;
      let info;
      try {
        info = await stat(real);
      } catch {
        continue;
      }
      if (!info.isFile()) continue;
      const rel = toPosix(path.relative(root, real));
      if (isUntracked(scope, rel)) continue; // serve only git-tracked files
      topics.push({ claim_id: rel, title: await firstHeading(real, rel, info.size), bytes: info.size });
    }
  }
  topics.sort((a, b) => a.claim_id.localeCompare(b.claim_id));
  return topics;
}

// Lexical search over the served KB. The query is data, never a flag or shell token.
export async function searchClaims(
  query: string,
  limit: number = DEFAULT_LIMIT,
): Promise<{ query: string; count: number; results: SearchResult[] }> {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new Error("query must be a non-empty string");
  }
  if (query.length > MAX_QUERY_LEN) {
    throw new Error(`query too long (>${MAX_QUERY_LEN} chars)`);
  }
  const cap = Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit) || DEFAULT_LIMIT));
  const scope = await getScope();
  const { root, served } = scope;
  if (served.length === 0) return { query, count: 0, results: [] };

  const args = [
    "--fixed-strings", // query is a literal, not a regex
    "--no-follow", // never follow a symlink out of the served scope
    "--line-number",
    "--no-heading",
    "--color=never",
    "--max-columns",
    String(MAX_COLUMNS), // bound line width
    "--max-count",
    String(cap), // bound matches per file
    "--max-filesize",
    String(MAX_FILE_BYTES), // skip pathologically large files
    "--glob",
    "!memory/private/**", // defense in depth; the parse loop also drops private hits
    "-e",
    query, // passed as the argument to -e, so a leading '-' cannot inject a flag
    "--", // terminate options; path operands follow
    ...served,
  ];

  let stdout = "";
  try {
    const res = await execFileAsync(rgPath, args, {
      cwd: root,
      timeout: RG_TIMEOUT_MS,
      maxBuffer: RG_MAX_BUFFER,
      windowsHide: true,
    });
    stdout = res.stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { code?: number | string };
    if (e && e.code === 1) {
      return { query, count: 0, results: [] }; // rg exit 1 = no matches
    }
    throw new Error(`search failed: ${e?.message ?? "unknown ripgrep error"}`);
  }

  const results: SearchResult[] = [];
  for (const line of stdout.split("\n")) {
    if (!line) continue;
    const m = line.match(/^(.*?):(\d+):(.*)$/);
    if (!m) continue;
    const rel = path.isAbsolute(m[1]) ? path.relative(root, m[1]) : m[1];
    if (rel === PRIVATE_SUBPATH || rel.startsWith(PRIVATE_SUBPATH + path.sep)) continue;
    if (isUntracked(scope, toPosix(rel))) continue; // drop hits in gitignored files
    results.push({ claim_id: rel, line: Number(m[2]), snippet: m[3] });
    if (results.length >= cap) break;
  }
  return { query, count: results.length, results };
}
