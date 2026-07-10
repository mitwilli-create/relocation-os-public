# ADR-0005: Relocation KB as a scoped, read-only MCP server

Date: 2026-07-09
Status: Accepted

## Context

Module 3 of the build plan exposes the knowledge base as scoped, read-only MCP servers so sessions retrieve claims through tool calls instead of loading whole files into context. This ADR covers the first of three servers only: the relocation KB. The second-brain and career-ops servers clone this pattern in a later session, each with its own scope.

The adjudicated research supports the shape directly: MCP is the standard for this (Row 12, verified), typed search and read tools beat corpus dumping (Row 13, verified), grep-before-embed and lexical-first is the correct default (Row 14, verified), and least privilege with a read-only default, write separation, and scoped directories that never reach $HOME is the security posture (Row 17, verified). `readOnlyHint` and `destructiveHint` annotations and dual-runtime wiring via `.mcp.json` and `~/.codex/config.toml` are corroborated (Rows 18, 22).

The security design was routed through the council-of-models then dealbreaker chain per SDLC. Raw report: `knowledge/research/2026-07-09-mcp-server-security-hardening-council-report.md`. Adjudicated: `knowledge/research/2026-07-09-mcp-server-security-hardening-ADJUDICATED.md`. Seven of seven models converged; 45 of 55 claims were near-unanimous; the one external fact requiring verification (the CVE identifier) resolved cleanly against the primary source.

A prior constraint bears on this decision: ADR-0003 established that the repo is dependency-free and "the runner must stay dependency-free until an ADR says otherwise." An MCP server needs the SDK and a `package.json`. This ADR is that exception, scoped narrowly.

## Decision

1. **One server this session: the relocation KB.** Scope is the tracked KB only: the `knowledge/` directory plus tracked `memory/` files. `memory/private/` is excluded from every code path by construction, not by convention. Second-brain and career-ops servers are deferred to a later session.

2. **TypeScript on the official SDK (`@modelcontextprotocol/sdk`, v1.29.0), run directly on Node's native type stripping.** The launch command is `node mcp/relocation-kb/src/index.ts`. No build step, no bundler, no committed `dist/`. Node 24.14 (in use) runs `.ts` without a flag; this was verified empirically before adoption. TypeScript is chosen over plain `.mjs` for typed tool-schema design (the module's stated learning goal) and because a TypeScript MCP server is the portfolio artifact Module 5 showcases (Row 47, verified: the single strongest hiring differentiator).

3. **Dependencies are confined to `mcp/relocation-kb/`.** That subtree gets its own `package.json` and lockfile; `node_modules/` stays gitignored. The repo root, `scripts/`, and the eval runner remain dependency-free, so ADR-0003's guarantee holds everywhere except this one scoped subtree. Direct dependencies are `@modelcontextprotocol/sdk`, `zod`, and `@vscode/ripgrep`. The last ships a pinned ripgrep binary so search does not depend on a system install or on this environment's shell-aliased `rg`; the server execs that binary by its absolute path.

4. **stdio transport.** The server is a local, single-user tool spawned by a trusted client (Claude Code or Codex). CVE-2026-30623 (OX Security, April 2026; verified against the LiteLLM advisory) is a client/proxy flaw: a client that executes untrusted `StdioServerParameters` command strings. A server we author ourselves, spawned by a trusted local client, is not exposed to it. HTTP/SSE would add surface for no benefit here.

5. **Three tools, all read-only, no path arguments beyond a claim id.**
   - `search_claims(query, limit?)`: ripgrep-backed lexical search over the scoped KB. Returns file, line, and snippet per hit. Takes no directory argument; the searched roots are fixed at startup so the model can influence only the query text.
   - `read_claim(claim_id)`: returns one whole markdown file byte-exact. Claim granularity is file-level (owner decision): a claim id is a repo-relative path to a KB file, a topic is a file.
   - `list_topics()`: enumerates the KB files available as claims.
   - All three carry `readOnlyHint: true` and `destructiveHint: false`. There are no write or exec tools.

6. **Load-bearing control: canonicalize-then-verify path gate.** Served roots are an explicitly configured allowlist (`knowledge/`, `memory/`) resolved against a repo root captured at startup, never `process.cwd()`. Every `read_claim` id is rejected if absolute, resolved with `path.resolve`, canonicalized with `fs.realpath` (which follows symlinks), then verified with a `path.relative` containment check against an allowed root. Anything resolving under `memory/private/` is denied. `path.resolve` alone is insufficient because it never follows symlinks; the `realpath` step is what closes symlink escape.

7. **Load-bearing control: argv-based ripgrep with no shell.** ripgrep is invoked via `execFile` against the absolute path of the bundled binary (`@vscode/ripgrep`'s `rgPath`), never `exec` or a shell, and never a PATH-resolved name. The query is passed as `-e <query>` with a `--` terminator before the path operands so a query beginning with `-` cannot inject a flag (notably `--pre`, which names a preprocessor binary and is an execution vector). `--fixed-strings` disables regex. `--no-follow` refuses to follow symlinks out of scope. `--glob '!memory/private/**'` is a second layer excluding private files from search. `--max-count`, `--max-filesize`, and `--max-columns` bound per-file matches, file size scanned, and line width. Results are further capped server-side with a wall-clock timeout.

8. **Returned content is byte-exact with provenance labeling, never neutralized.** Divergence resolved by dealbreaker: stripping or mangling markers from returned content is rejected. The server labels each result with its source path and returns the content verbatim. Trust decisions belong to the reader, not to silent server-side edits.

9. **No embeddings.** Lexical ripgrep only, until grep demonstrably stops being good enough. Revisited only with evidence, per Rows 12 to 14 and 17.

10. **Dual-runtime registration.** The same server is registered in `.mcp.json` (Claude Code) and `~/.codex/config.toml` (Codex) so both runtimes list the identical tools.

## Alternatives considered

- **Whole-repo scope for the served set.** Rejected as over-broad. Least privilege serves only the KB directories; the repo root is the containment ceiling, not the served set.
- **Section-level or line-range claim granularity.** Considered. Owner chose file-level: a topic is a file, which matches the tiered-memory model and keeps ids stable across edits. Line ranges are brittle across edits; section slugs add parsing surface for little gain given small topic files.
- **Plain `.mjs` server.** Simpler and matches the repo's existing script convention, but loses static types (the learning goal) and the TypeScript portfolio signal. Rejected.
- **Compiled `dist/` or a bundler.** Conventional, but adds a build step and forces either committing build artifacts or building on install. Rejected in favor of native type stripping.
- **HTTP/SSE transport.** Unnecessary for a local single-user server and adds network surface. Rejected.
- **`readOnlyHint` as an access-control mechanism.** Rejected as enforcement. The MCP spec says clients must not trust annotations. The hint is set honestly for UX; real enforcement is that no write tool exists and the in-process path gate denies out-of-scope reads.
- **Process sandboxing (seatbelt, landlock, container) as a required control.** Divergence resolved: not load-bearing for this single-user, local, read-only threat model. The confidentiality boundary is enforced in-process by the path gate. Sandboxing is optional defense-in-depth and is maintenance-contingent; an unmaintained profile gives false assurance. Not implemented this session.
- **A path or directory argument on `search_claims`.** Rejected. Fixing the roots at startup and letting the model influence only the query removes an attack surface for no capability loss.
- **Server-side content neutralization or marker stripping.** Rejected in favor of byte-exact plus provenance labeling.

## Consequences

- The repo gains one scoped Node dependency subtree at `mcp/relocation-kb/`. Root and `scripts/` stay dependency-free. `node_modules/` is gitignored; the lockfile is committed for reproducibility.
- Running the server requires Node with native type stripping (23.6 or newer). 24.14 is in use. This is documented in the server's README.
- Sessions can retrieve relocation claims through tool calls. Reading memory files directly becomes the fallback, not the default. The verification target is a fresh session answering a relocation question via tools without a direct file read.
- Adding a new KB directory requires updating the served-roots allowlist in the server, by design.
- The indirect prompt-injection risk (hostile text living in KB content and flowing back to the model) is the dominant residual risk and is a client-side problem. The server bounds the blast radius to one non-private repo file. This is documented here for the Module 5 threat-model writeup, which pairs it with the CVE-2026-30623 scoping defense.
- Second-brain and career-ops servers clone this pattern later, each with its own scope and its own allowlist.
- A Module 2 style invariant should assert the security-relevant properties that can be checked statically (no write tools declared, `memory/private/` absent from served roots). Wiring that into the eval gate is tracked with the implementation.

## Amendment 2026-07-09: served set is git-tracked, not directory-scanned

Status: Accepted

CodeRabbit (PR #10) observed that the served set is enumerated by directory walk over `knowledge/` and `memory/` with a `memory/private/` exclusion, so a gitignored-but-non-private file under a served root would surface in `search_claims` and `list_topics`. This is a real divergence from Decision #1, which already states the scope is "the tracked KB only." The implementation under-delivered the word "tracked": it served whatever was on disk minus `memory/private/`, not what git tracks.

The divergence has a concrete carrier. `.gitignore` ignores `knowledge/research/raw/` (the raw, un-adjudicated council-output scratch directory) and `*.local.*`, both of which nest inside the served `knowledge/` root. The KB premise is that only adjudicated claims graduate into served files; raw model output dropped in `knowledge/research/raw/` would otherwise be returned as if it were a vetted claim. The directory is latent today, so the leak is potential, not active, but the design hole contradicts the premise.

Decision: make the served set exactly the git-tracked files under the served subdirs, enforced in code, so Decision #1's word "tracked" holds by construction.

1. **Tracked allowlist at scope init.** `getScope` runs `git -C <root> ls-files -z -- knowledge memory` once and caches the result as a set of repo-relative paths. `resolveClaimPath`, `list_topics`, and `search_claims` each drop any path not in that set (layered on top of, not replacing, the existing realpath containment and `memory/private/` checks). Because `memory/private/` is gitignored, it is absent from the tracked set as well, so private exclusion is now enforced twice: by construction (untracked) and by the explicit path gate.

2. **Fail closed, fall back only on a confirmed non-worktree.** Scope first probes `git rev-parse --is-inside-work-tree`. Only a positively confirmed non-worktree (git exit 128 "not a git repository", or a `false` result) returns `null` and falls back to the prior directory-scan-minus-private behavior. This preserves the temp-fixture tests (`symlink-test.ts` points `RELOCATION_KB_ROOT` at a bare `mkdtemp` dir that is not a git repo). Any operational failure in a real repo (git missing, timeout, buffer overflow) throws instead of falling back, so a transient error can never silently drop the tracked-only boundary and serve ignored files. The real repo and any git checkout get the stricter tracked-only path; `selftest.ts` exercises it.

3. **No new package dependency.** `git` is invoked as a system binary via `execFile` (never a shell), consistent with the argv-based ripgrep control. This does not add an npm dependency, so ADR-0003's dependency-free guarantee for `scripts/` and the runner is untouched. `git` is already ambient in this repo's SDLC (branch + PR, `privacy-check.sh`).

Consequences of the amendment:

- The tracked set is snapshotted at scope init. For the long-running MCP server that means startup time; a claim committed mid-session appears only after a restart. For the `city-dossier` CLI, snapshot is per-invocation, so no staleness. Acceptable and matches "reviewed content only."
- `git ls-files` reports the index, so a staged-but-uncommitted claim is served; a never-added file is not. This is the intended line: content entering the KB does so through version control.
- Residual: a tracked file can still carry hostile or half-baked content. Tracked-only narrows the surface to committed, reviewable content; it does not replace adjudication or the indirect-prompt-injection caveat above.
- `city-dossier.mjs` mirrors this exact scope and receives the same change on its branch (PR #10), so the two surfaces never diverge. A unilateral change to either would itself be the bug.
- This strengthens the Module 5 CVE-2026-30623 scoping-defense writeup: the served set is now a positive allowlist of version-controlled content, not a denylist that leaks new gitignored files by default. The static invariant noted above can be extended to assert no gitignored file appears in `list_topics`.
