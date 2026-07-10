// Regression test for the ADR-0005 amendment (2026-07-09): the served set is the
// git-tracked files under knowledge/ and memory/, not everything on disk. Builds an
// isolated temp git repo, stages some files, leaves others untracked (including a
// knowledge/research/raw/ scratch file), and asserts list/search/read serve only the
// tracked ones. Points RELOCATION_KB_ROOT at the fixture so it never touches the repo.
//
// Run: node test/tracked-test.ts   (from mcp/relocation-kb/)

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    process.stdout.write(`PASS ${name}\n`);
  } else {
    failures++;
    process.stdout.write(`FAIL ${name}${detail ? " :: " + detail : ""}\n`);
  }
}

async function git(root: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", ["-C", root, ...args], { windowsHide: true });
}

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), "relkb-tracked-"));
  try {
    await mkdir(path.join(root, "knowledge", "research", "raw"), { recursive: true });
    await mkdir(path.join(root, "memory"), { recursive: true });

    // Tracked (staged) files. A shared unique term proves search filters by track state.
    await writeFile(path.join(root, "knowledge", "tracked.md"), "# Tracked Claim\nzebrafish here\n");
    await writeFile(path.join(root, "memory", "tracked.md"), "# Memory Claim\nhello\n");
    // Untracked files: never staged. The raw/ one is the concrete leak carrier.
    await writeFile(path.join(root, "knowledge", "untracked.md"), "# Untracked\nzebrafish leak\n");
    await writeFile(path.join(root, "knowledge", "research", "raw", "scratch.md"), "# Raw scratch\nunadjudicated\n");

    await git(root, "init", "-q");
    // ls-files reads the index, so staging is enough; no commit (and no user config) needed.
    await git(root, "add", "knowledge/tracked.md", "memory/tracked.md");

    process.env.RELOCATION_KB_ROOT = root;
    const kb = await import("../src/kb.ts");

    const topics = await kb.listTopics();
    const ids = topics.map((t) => t.claim_id);
    check("lists tracked knowledge file", ids.includes("knowledge/tracked.md"), ids.join(", "));
    check("lists tracked memory file", ids.includes("memory/tracked.md"), ids.join(", "));
    check("excludes untracked file", !ids.includes("knowledge/untracked.md"), ids.join(", "));
    check(
      "excludes untracked raw scratch",
      !ids.some((id) => id.includes("research/raw")),
      ids.join(", "),
    );

    const read = await kb.readClaim("knowledge/tracked.md");
    check("reads a tracked claim", read.content.includes("zebrafish"));

    try {
      await kb.readClaim("knowledge/untracked.md");
      check("read_claim denies untracked", false, "expected denial");
    } catch (err) {
      check("read_claim denies untracked", /untracked/.test((err as Error).message), (err as Error).message);
    }

    const hits = await kb.searchClaims("zebrafish");
    check("search finds the term at all", hits.count > 0, `count=${hits.count}`);
    check(
      "search returns only tracked hits",
      hits.results.every((r) => r.claim_id === "knowledge/tracked.md"),
      hits.results.map((r) => r.claim_id).join(", "),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  if (failures > 0) {
    process.stdout.write(`\ntracked-test: FAIL (${failures} failing check(s))\n`);
    process.exit(1);
  }
  process.stdout.write("\ntracked-test: PASS\n");
}

main().catch((err) => {
  process.stdout.write(`tracked-test: ERROR ${err?.stack ?? err}\n`);
  process.exit(1);
});
