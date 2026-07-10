// Regression test for the CodeRabbit-caught critical: listTopics must canonicalize
// each entry so a symlink cannot smuggle memory/private (or out-of-scope) content
// into the topic list or its heading. Builds an isolated temp KB and points
// RELOCATION_KB_ROOT at it, so this never touches the real repo tree.
//
// Run: node test/symlink-test.ts   (from mcp/relocation-kb/)

import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    process.stdout.write(`PASS ${name}\n`);
  } else {
    failures++;
    process.stdout.write(`FAIL ${name}${detail ? " :: " + detail : ""}\n`);
  }
}

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), "relkb-symlink-"));
  try {
    await mkdir(path.join(root, "knowledge"), { recursive: true });
    await mkdir(path.join(root, "memory", "private"), { recursive: true });
    await writeFile(path.join(root, "memory", "topic.md"), "# Public Topic\nhello\n");
    await writeFile(
      path.join(root, "memory", "private", "secret.md"),
      "# SECRET HEADING\ntop secret\n",
    );
    // A symlink inside served memory/ pointing at a private target.
    await symlink(
      path.join(root, "memory", "private", "secret.md"),
      path.join(root, "memory", "sneaky.md"),
    );
    // A symlink pointing entirely outside the served root.
    await symlink("/etc/hosts", path.join(root, "memory", "outside.md"));
    // A directory symlink pointing at the private directory.
    await symlink(path.join(root, "memory", "private"), path.join(root, "memory", "linkdir"), "dir");

    // Point the server scope at the temp root, then load kb.ts fresh.
    process.env.RELOCATION_KB_ROOT = root;
    const kb = await import("../src/kb.ts");

    const topics = await kb.listTopics();
    const ids = topics.map((t) => t.claim_id);
    check("lists the genuine public topic", ids.includes("memory/topic.md"));
    check(
      "symlink into private is NOT listed",
      !ids.some((id) => id.includes("sneaky")),
      ids.join(", "),
    );
    check(
      "no private heading leaked into titles",
      !topics.some((t) => t.title.includes("SECRET")),
      topics.map((t) => t.title).join(" | "),
    );
    check(
      "symlink pointing outside root is NOT listed",
      !ids.some((id) => id.includes("outside")),
      ids.join(", "),
    );
    check(
      "directory symlink into private is NOT traversed",
      !ids.some((id) => id.includes("linkdir") || id.includes("secret")),
      ids.join(", "),
    );

    // read_claim through the private symlink must be denied.
    try {
      await kb.readClaim("memory/sneaky.md");
      check("read_claim via private symlink denied", false, "expected denial");
    } catch {
      check("read_claim via private symlink denied", true);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  if (failures > 0) {
    process.stdout.write(`\nsymlink-test: FAIL (${failures} failing check(s))\n`);
    process.exit(1);
  }
  process.stdout.write("\nsymlink-test: PASS\n");
}

main().catch((err) => {
  process.stdout.write(`symlink-test: ERROR ${err?.stack ?? err}\n`);
  process.exit(1);
});
