// Security + behavior self-test for the relocation KB access layer.
// Runs the kb.ts functions directly (no transport) and asserts the invariants
// ADR-0005 promises. Exits non-zero on any failure so CI can gate on it.
//
// Run: node test/selftest.ts   (from mcp/relocation-kb/)

import { searchClaims, readClaim, listTopics, resolveClaimPath } from "../src/kb.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

// Independently enumerate the git-tracked files under the served subdirs, so the
// list_topics invariant below is checked against git directly rather than against
// kb.ts's own tracked-set logic (a regression there must not hide the leak it
// would cause). Returns null when the root is not a git work tree, so the check
// degrades gracefully (skips) instead of failing, matching the server's fallback
// scope model. Mirrors kb.ts's root resolution: RELOCATION_KB_ROOT, else repo root.
async function gitTrackedUnderServed(): Promise<Set<string> | null> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url)); // .../mcp/relocation-kb/test
  const configured = process.env.RELOCATION_KB_ROOT
    ? path.resolve(process.env.RELOCATION_KB_ROOT)
    : path.resolve(moduleDir, "..", "..", ".."); // test -> relocation-kb -> mcp -> repo root
  let root: string;
  try {
    root = await realpath(configured);
  } catch {
    return null;
  }
  try {
    const inside = (
      await execFileAsync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"])
    ).stdout.trim();
    if (inside !== "true") return null;
    const { stdout } = await execFileAsync("git", [
      "-C",
      root,
      "ls-files",
      "-z",
      "--",
      "knowledge",
      "memory",
    ]);
    return new Set(stdout.split("\0").filter(Boolean));
  } catch {
    return null; // git missing or not a work tree: skip the invariant
  }
}

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    process.stdout.write(`PASS ${name}\n`);
  } else {
    failures++;
    process.stdout.write(`FAIL ${name}${detail ? " :: " + detail : ""}\n`);
  }
}
// A passing denial must throw AND the message must match the expected reason, so an
// unrelated bug that happens to throw cannot masquerade as a security control working.
async function denies(name: string, claimId: string, expected: RegExp) {
  try {
    await readClaim(claimId);
    check(name, false, `expected denial, got a successful read of ${claimId}`);
  } catch (err) {
    const msg = (err as Error).message;
    check(name, expected.test(msg), `threw but message did not match ${expected}: ${msg}`);
  }
}

async function main() {
  // --- behavior ---
  const topics = await listTopics();
  check("list_topics returns files", topics.length > 0, `got ${topics.length}`);
  check(
    "list_topics includes memory/constraints.md",
    topics.some((t) => t.claim_id === "memory/constraints.md"),
  );
  check(
    "list_topics excludes memory/private",
    !topics.some((t) => t.claim_id.startsWith("memory/private")),
  );

  // Static invariant (ADR-0005 amendment): every listed topic is a git-tracked
  // file. Cross-checks list_topics against an independent `git ls-files`, so a
  // regression that reopens the directory scan and surfaces a gitignored note is
  // caught on the real tree, not only in the tracked-test.ts fixture.
  const tracked = await gitTrackedUnderServed();
  if (tracked === null) {
    process.stdout.write("SKIP list_topics tracked-only invariant (not a git work tree)\n");
  } else {
    const leaked = topics.map((t) => t.claim_id).filter((id) => !tracked.has(id));
    check("list_topics contains only git-tracked files", leaked.length === 0, `untracked leaked: ${leaked.join(", ")}`);
    // Teeth: confirm the tracked set is a real allowlist, not a match-all, so the
    // check above cannot pass vacuously.
    check(
      "tracked set rejects a known-untracked probe path",
      !tracked.has("knowledge/__untracked_leak_probe__.md"),
    );
  }

  const read = await readClaim("memory/constraints.md");
  check(
    "read_claim returns byte-exact content",
    read.content.includes("Locked-Decision Registry"),
    "expected registry heading in constraints.md",
  );
  check("read_claim reports provenance", read.source === "memory/constraints.md");

  const hits = await searchClaims("Beckham");
  check("search_claims finds a known term", hits.count > 0, `got ${hits.count} for 'Beckham'`);
  check(
    "search_claims never returns private paths",
    !hits.results.some((r) => r.claim_id.startsWith("memory/private")),
  );

  const none = await searchClaims("zzz_no_such_token_qwertyxyz");
  check("search_claims handles no matches", none.count === 0);

  // Flag-injection: a query starting with '-' must be treated as data, not a flag.
  // A resolved, bounded, error-free result proves ripgrep saw it as a literal pattern.
  const flagish = await searchClaims("--pre", 5);
  check(
    "search_claims treats leading-dash query as data",
    Array.isArray(flagish.results) &&
      flagish.count === flagish.results.length &&
      flagish.count <= 5,
    `count=${flagish.count}`,
  );

  // --- security denials (assert the reason, not just that something threw) ---
  await denies("deny: parent traversal", "../../../etc/passwd", /outside served scope|not found/);
  await denies("deny: absolute path", "/etc/passwd", /absolute/);
  await denies(
    "deny: memory/private file",
    "memory/private/personal-context.md",
    /private scope|not found/,
  );
  await denies(
    "deny: dotdot into private",
    "memory/../memory/private/personal-context.md",
    /private scope|not found/,
  );
  await denies("deny: repo file outside served scope", "CLAUDE.md", /outside served scope/);
  await denies("deny: empty claim_id", "", /non-empty/);

  // resolveClaimPath should accept a real in-scope file.
  try {
    await resolveClaimPath("memory/candidates.md");
    check("resolve: in-scope file accepted", true);
  } catch (err) {
    check("resolve: in-scope file accepted", false, (err as Error).message);
  }

  if (failures > 0) {
    process.stdout.write(`\nselftest: FAIL (${failures} failing check(s))\n`);
    process.exit(1);
  }
  process.stdout.write("\nselftest: PASS\n");
}

main().catch((err) => {
  process.stdout.write(`selftest: ERROR ${err?.stack ?? err}\n`);
  process.exit(1);
});
