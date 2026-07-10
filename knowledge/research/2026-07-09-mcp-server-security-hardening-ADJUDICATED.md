---
agent: dealbreaker
mode: claim-adjudication
input_report: /Users/mitchellwilliams/Documents/relocation-os/knowledge/research/2026-07-09-mcp-server-security-hardening-council-report.md
input_kind: council
timestamp: 2026-07-09 PT
adjudication_summary:
  total_claims_reviewed: 55
  verified: 37
  corroborated: 8
  unique_distinctive_kept: 4
  cut_unsupported: 0
  cut_contradicted: 6
  cut_stale: 0
  websearch_calls_used: 1
  routing_audit: skipped
  confidence_in_final_synthesis: high
divergence_verdicts:
  a_process_isolation_sandboxing: "NOT load-bearing — optional defense-in-depth, contingent on being maintained (middle position wins over both extremes)"
  b_search_claims_path_argument: "search_claims accepts NO path argument (consensus wins over Gemini's targetDir sample)"
  c_content_neutralization: "Do NOT neutralize returned content — provenance-label only (majority wins over Grok-x-search)"
cve_verification:
  identifier: CVE-2026-30623
  status: VERIFIED against LiteLLM advisory
  stray_citations_rejected:
    - CVE-2026-42271 (SDR citation 4 — not this bug)
    - CVE-2026-30617 (SRP citation 32 — not this bug)
  sibling_not_this_bug: CVE-2026-40933 (Flowise 1-click RCE, same class)
---

# Final Research Report — Security-hardening a local read-only stdio MCP server for a git markdown KB

**Adjudicated by:** dealbreaker agent (claim-adjudication mode)
**Source report:** `/Users/mitchellwilliams/Documents/relocation-os/knowledge/research/2026-07-09-mcp-server-security-hardening-council-report.md`
**Timestamp:** 2026-07-09 PT

## Headline

Build the server on three load-bearing controls — a canonicalize-then-verify path gate using `fs.realpath` plus a `path.relative` containment check, argv-based ripgrep via `execFile` with `-e`/`--`/`--fixed-strings` and server-side output+time caps, and stdio transport kept for its absence of a network surface — and treat process sandboxing, a `search_claims` path argument, and content neutralization as the three things NOT to build, because all three divergences break toward the smaller-surface design.

## Executive synthesis

The council reached unusually strong convergence — 45 of 55 ledger claims are 7-of-7 or near-unanimous — and independent adjudication did not disturb the load-bearing structure. The three-part core stands as settled design: (1) a canonicalize-then-verify path gate that resolves the repo root and `memory/private` once at startup with `realpathSync`, rejects absolute inputs, `path.resolve`-anchors each request against the canonical root, `realpath`s the target to follow symlinks, then checks containment with `path.relative` (non-empty, no leading `..`, not absolute); (2) argv-based ripgrep invoked through `execFile`/`spawn` (never `exec`, never `shell: true`), with the query typed as a pattern via `-e`, guarded by the `--` end-of-options sentinel and `--fixed-strings`, and bounded by both ripgrep flags and a server-side total-output byte cap plus a wall-clock timeout; and (3) the finding that the April 2026 stdio RCE class is a client/proxy configuration flaw, not a self-authored-server flaw, so this system is not exposed to it. Each is VERIFIED.

I verified the one load-bearing external fact — the CVE identifier — because two models emitted stray numbers. **CVE-2026-30623 is confirmed** as the LiteLLM authenticated command-injection via Anthropic's MCP SDK stdio transport (`StdioServerParameters` executing an attacker-supplied `command`), remediated by the `MCP_STDIO_ALLOWED_COMMANDS` allowlist (`npx`, `uvx`, `python`, `python3`, `node`, `docker`, `deno`), patched from LiteLLM v1.83.6-nightly. The two stray citations are rejected: CVE-2026-42271 (sonar-deep-research citation 4) and CVE-2026-30617 (sonar-reasoning-pro citation 32) are not this vulnerability. The Flowise sibling in the same design class is CVE-2026-40933, not this one. The council's unanimous characterization of the vulnerability shape is correct and the identifier is now primary-source-verified.

The three genuine divergences all break in the same direction — toward the more conservative, lower-attack-surface design — which is the correct default for a single-user, local, read-only threat model:

**(a) Process isolation / sandboxing — NOT load-bearing.** Grok-4-x-search called it load-bearing; Grok-4 and Gemini called it security theater; four models (sonar-deep-research, sonar-reasoning-pro, GPT-5, Opus) landed in the middle. The middle position wins on both vote weight and reasoning. Grok-4-x-search's "load-bearing" label conflates sandboxing with the CVE class, but the CVE lives client-side and no amount of server sandboxing addresses it. The confidentiality boundary that actually matters here — `memory/private` exclusion — is enforced in-process by the path gate, not by a sandbox. Opus's point is decisive: an unmaintained seccomp/AppArmor profile is write-once-rot-forever and provides false assurance. Verdict: sandboxing is optional defense-in-depth whose value is entirely contingent on the solo developer actually maintaining it; it is neither load-bearing nor pure theater. Do not treat its absence as a gap.

**(b) Should `search_claims` accept a path/directory argument — NO.** Gemini's sample accepts a `targetDir` and canonicalizes it; four models (sonar-deep-research, sonar-reasoning-pro, GPT-5, Opus) say `search_claims` should take no path at all. Follow the consensus. Even a canonicalized `targetDir` expands the attack surface for zero benefit: the search root is always the repo root, so the model should influence only the query, never where ripgrep looks. Fix `cwd` to the canonical repo root, pass `.` as the sole positional, and hard-exclude `memory/private` via `--glob`. Gemini's own path gate would catch an escaping `targetDir`, but the safer design removes the argument entirely rather than defending it.

**(c) Should returned KB content be neutralized/stripped — NO, leave it byte-exact.** Grok-4-x-search is open to "optionally stripping known injection markers"; GPT-5, Gemini, and Opus explicitly warn against any content mangling. Follow the majority — and note Grok-4-x-search's own phrasing is hedged ("optionally"). Neutralization corrupts the KB's utility, is trivially bypassed by any injection author, and provides no real protection. The correct server-side move is provenance labeling: wrap every returned snippet in a structured envelope (XML tags or `=== FILE: path ===` delimiters with line ranges) so the model and client can distinguish tool output from instruction. The path scoping from control (1) is what makes a successful injection bounded — the worst a KB-resident injection can achieve through this server is reading another non-private file in the same repo. Real indirect-prompt-injection mitigation lives client-side.

One implementation nit worth carrying to the builder: Gemini derives `REPO_ROOT` from `fs.realpathSync(process.cwd())`, which is fragile if the server is ever spawned from a different working directory. The other six models take an explicitly-configured root (env var or constant). Use the explicit-config form; do not trust `process.cwd()`.

## Verified findings (high confidence)

Path scoping (control 1):
1. `path.resolve` alone is insufficient: it does only lexical normalization and never follows symlinks or touches the filesystem (7/7; nodejs.org path docs, nodejsdesignpatterns path-traversal). [Ledger #1]
2. Correct pattern is canonicalize-then-verify: `realpath`/`realpathSync` the target to resolve symlinks, then verify containment (7/7; CVE-2025-55130 symlink bypass writeup). [#2]
3. Resolve and cache the canonical repo root and `memory/private` once at startup with `realpathSync` (7/7). [#3]
4. Reject absolute-path arguments outright rather than coercing them (5 models). [#4]
5. Containment check uses `path.relative` (result non-empty, no leading `..`, not absolute), NOT a raw `startsWith` string prefix (5 models: Opus, GPT-5, Gemini, both Groks). This supersedes the two-Perplexity `startsWith` form. [#5 over #6]
6. For a non-existent final path component, `realpath` the parent directory then join the basename (6 models). [#7]
7. For this read-only server a non-existent file is simply "not found" and never reaches `realpath` on a missing path (4 models). [#8]
8. The realpath-then-open TOCTOU window is unavoidable in Node's high-level API but negligible for a single-user local threat model — the only actor who could swap a symlink mid-call is the same user running the server. Document it in a comment; do not pretend it is atomic (5 models). [#9]
9. `search_claims` accepts NO model-supplied path/search-root; run ripgrep with `cwd` = canonical repo root and `.` as the sole target (4 models; adjudicated winner of divergence b). [#11 over #12]

Ripgrep invocation (control 2):
10. Use `execFile`/`spawn` with an argv array; never `exec` with a shell string; never `shell: true` (7/7; sourcery.ai exec-user-input, OWASP command-injection). [#15]
11. Flag injection: a query beginning with `-` (e.g. `--pre`, `-f`) is parsed by ripgrep as an option, not a pattern (7/7; ripgrep issue 1842). [#16]
12. `--` end-of-options sentinel before positionals (7/7; rg man page). [#18]
13. Pass the pattern via `-e`/`--regexp` to explicitly type the argument as a pattern (6 models). [#19]
14. `--fixed-strings`/`-F` treats the query as literal, fits a lexical KB search, and eliminates ReDoS (7/7; rg man page). [#20]
15. Bound results with `--max-count`, `--max-columns`, `--max-filesize` (7/7; rg man page). [#21]
16. `--max-count`/`-m` is per-file, not a global cap; enforce a global cap yourself by counting parsed events and killing the child (5 models). [#22]
17. Enforce a server-side total-output byte cap (64KB / 256KB / 512KB cited) with a truncation marker, regardless of ripgrep output (7/7). [#23]
18. ripgrep's default Rust `regex` engine is linear-time by construction, so classic catastrophic ReDoS backtracking does not apply (5 models; rg discussion 2602). [#24]
19. A per-call wall-clock timeout on the child process is the real mitigation for pathological-but-slow patterns (6 models). [#26]

CVE-2026-30623 class (control 3):
20. **CVE-2026-30623 is the command-injection flaw where MCP `StdioServerParameters` executes an attacker-influenced `command`+`args` (7/7; web-verified against LiteLLM advisory).** [#27]
21. **LiteLLM's remediation is the `MCP_STDIO_ALLOWED_COMMANDS` allowlist — npx, uvx, python, python3, node, docker, deno (7/7; web-verified: fix landed LiteLLM v1.83.6-nightly, PR #25343).** [#28]
22. The vulnerable party is the CLIENT / PROXY that executes untrusted server configs, NOT a self-authored server (7/7; LiteLLM blog, The Hacker News). [#29]
23. This system (self-authored server + single trusted local client with hard-coded command) is NOT exposed to CVE-2026-30623 (7/7). [#30]
24. **The LiteLLM flaw required authentication (a valid API key, and PROXY_ADMIN after the patch); it was not unauthenticated RCE (sonar-deep-research; web-verified).** [#32 — upgraded from UNIQUE to VERIFIED via web]

Control ranking / theater:
25. Load-bearing control #1: filesystem scoping / path canonicalization / private-dir exclusion (7/7). [#33]
26. Load-bearing control #2: argv-based ripgrep invocation with `-e`/`--` (prevents search-to-exec via `--pre`) (4 models). [#34]
27. stdio transport is load-bearing by omission — no network listener means no remote attacker, no CORS, no DNS-rebinding; keep stdio (Opus, corroborated by GPT-5, Gemini, both Groks, sonar-reasoning-pro calling stdio fine/appropriate). [#35]
28. Process isolation / sandboxing is defense-in-depth of marginal, maintenance-contingent value — NOT load-bearing, NOT pure theater; an unmaintained seccomp/AppArmor profile gives false assurance (4 models; adjudicated winner of divergence a). [#38]
29. `readOnlyHint` and sibling annotations are security theater as an enforcement boundary; the spec says clients MUST NOT trust annotations from untrusted servers for security decisions (7/7; MCP spec tools page). [#40]
30. Annotations are still worth setting honestly on a trusted self-authored server for UX/planner value (auto-approve, skip confirmation prompts) (5 models). [#41]
31. Output size limits are essential even for a read-only tool: an oversized `read_claim` floods model context, incurs token cost/DoS, and amplifies injection (7/7). [#44]
32. Indirect prompt injection via KB content is the dominant residual risk; a read-only server cannot solve it (7/7; simonwillison.net MCP prompt injection). [#45]
33. Server-side mitigation is provenance labeling / structured envelope / clear delimiters, NOT neutralization (7/7; adjudicated winner of divergence c). [#46]
34. Do NOT strip/mangle/neutralize returned content: it corrupts the KB and is trivially bypassed (GPT-5, Gemini, Opus). [#47 over #48]
35. Real IPI mitigation lives client-side (system-prompt hardening, human-in-the-loop confirmation, cross-tool contamination detection) (7/7). [#49]
36. Security theater here: TLS / OAuth / auth tokens on the stdio transport — it is a local pipe, no network (6 models). [#52]
37. Security theater here: switching stdio to HTTP/SSE + mutual TLS adds network/CSRF/auth surface and addresses none of the real risks (4 models). [#54]

## Corroborated findings (medium confidence)

1. Fully closing TOCTOU needs `openat`/`O_NOFOLLOW`, which Node does not expose portably; on Linux, verify via `/proc/self/fd/<fd>` or open with `O_NOFOLLOW` (3 models; flagged UNVERIFIED by sonar-reasoning-pro). [#10]
2. Pass `--no-follow` so ripgrep does not descend through symlinks out of tree (GPT-5, Opus). [#14]
3. PCRE2 (`-P`) is backtracking-based and IS susceptible to ReDoS; do not expose it (sonar-deep-research, GPT-5; rg man page). [#25]
4. The CVE is a reason to vet which `mcp.json` entries the developer adds to the client, not a reason to change server code (GPT-5, Opus). [#31]
5. Run the server as non-root with read-only filesystem scope (least privilege) — noted, but Gemini and Opus caution that on a single-user local box, dropping privileges on a subprocess reading the user's own files can simply break standard file permissions for marginal gain (sonar-reasoning-pro, Grok-4-x-search, GPT-5). [#39]
6. Recommended annotation values: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` (GPT-5, Opus). [#42]
7. The server's read-only property comes from the absence of write/exec tools, not from an annotation (GPT-5, Opus). [#43]
8. Security theater here: rate limiting / per-client auth / RBAC inside the server — one local user, no untrusted clients (4 models). [#53]

## Model-distinctive findings (architecturally attributed)

1. Post-filter every ripgrep-returned path through the same containment gate; the `--glob` exclusion is a performance optimization, the post-filter is authoritative (Opus). Kept — this is the sharpest defense-in-depth in the report and closes the gap where a glob alone could be bypassed by a symlinked directory. [#13]
2. `--pre` specifically is a code-execution vector because it names a preprocessor binary (Opus; GPT-5 and Gemini cite `--pre` as an example). Kept — this is the concrete reason flag injection is not merely cosmetic. [#17]
3. Path scoping bounds the blast radius of a successful injection: worst case is reading another non-private file in the same repo (Opus). Kept — the framing that makes the whole read-only, scope-bounded design coherent. [#50]
4. Security theater here: HMAC-signing tool-call arguments — single trusted local client, no man-in-the-middle (Opus). Kept. [#55]

## Cleaned final controls list (ship this)

Build these. Everything here is VERIFIED or a kept model-distinctive control.

1. **Path gate (load-bearing).** At startup: `REPO_ROOT = realpathSync(explicitlyConfiguredRoot)` and `PRIVATE = realpathSync(join(REPO_ROOT, 'memory/private'))` — never `process.cwd()`. Per request: reject absolute paths and NUL bytes; `path.resolve(REPO_ROOT, userPath)`; `realpath` the target; containment via `path.relative(REPO_ROOT, real)` (non-empty, no leading `..`, not absolute); exclude `memory/private` via the same `path.relative` test against `PRIVATE`. Non-existent file = "not found". Document the residual TOCTOU window in a comment.
2. **Ripgrep gate (load-bearing).** `execFile('rg', args, { cwd: REPO_ROOT, timeout: 5000 })` with argv: `--fixed-strings`, `--no-follow`, `--max-count`/`--max-columns`/`--max-filesize`, `--glob '!memory/private/**'`, `-e <query>`, `--`, `.`. No shell, no `shell: true`, no user-supplied search root. Count parsed events and kill the child at a global match cap; hard-cap returned bytes (e.g. 64KB) with a truncation marker.
3. **stdio transport (load-bearing by omission).** Keep it. No HTTP/SSE, no TLS, no OAuth, no auth tokens, no rate limiting, no HMAC — all theater for a local pipe between two same-UID processes.
4. **Output size limits (load-bearing).** Reject/truncate oversized `read_claim` results (cited ceilings 50KB–512KB) with an explicit truncation marker; same ceiling on aggregated `search_claims` output.
5. **Provenance labeling, NOT neutralization.** Wrap returned content in a structured envelope with file path and line range. Return content byte-exact. No stripping of markers, no HTML-escaping, no markdown mangling.
6. **Annotations for UX only.** Set `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` honestly, but rely on the absence of write/exec tools — not the annotation — for the read-only property.
7. **Optional, not required:** process sandboxing (bwrap/sandbox-exec/dedicated uid) and non-root least privilege. Add ONLY if you will maintain them; otherwise they are false assurance. Their absence is not a gap.

## Open disagreements / undecidable impasses

None. All three flagged divergences were adjudicated with a clear winner (see Executive synthesis). No claim was left CONTRADICTED-and-flagged for manual judgment. The CVE identifier was the only external fact requiring verification and it resolved cleanly.

## Routing audit

Skipped — this is a council-of-models report, not a researcher report. No routing decision to audit.

## Appendix: rejected claims / addressed items (audit trail)

| # | Item | Source (ledger #) | Classification / verdict | Rationale |
|---|---|---|---|---|
| 1 | Containment check via raw `real.startsWith(root + path.sep)` string prefix | SDR, SRP (#6) | CUT — superseded | Weaker idiom; the exact class of check the other 5 models warn can be fooled on edge cases. Use `path.relative` (#5). |
| 2 | `search_claims` sample accepts a `targetDir` path argument and canonicalizes it | GEM (#12) | CUT — contradicted (divergence b) | Consensus (SDR, SRP, GPT-5, Opus) says accept no path at all. A canonicalized `targetDir` expands surface for zero benefit; fix the root, let the model influence only the query. |
| 3 | Process isolation / sandboxing is load-bearing | G4X (#36) | CUT — contradicted (divergence a) | Conflates sandboxing with the client-side CVE class. The `memory/private` boundary is enforced in-process; sandboxing is maintenance-contingent defense-in-depth, not load-bearing. Middle position (#38) wins. |
| 4 | Process isolation / sandboxing is security theater / overkill | G4, GEM (#37) | CUT — overruled by middle | Too strong in the other direction. It has real defense-in-depth value IF maintained. Adjudicated verdict is "optional, contingent on maintenance," not "theater." Middle position (#38) wins. |
| 5 | A read-only server MAY optionally strip known injection markers | G4X (#48) | CUT — contradicted (divergence c) | Majority (GPT-5, Gemini, Opus) warns neutralization corrupts the KB and is trivially bypassed. Grok-4-x-search's own phrasing is hedged. Provenance-label instead (#46). |
| 6 | `REPO_ROOT` derived from `fs.realpathSync(process.cwd())` | GEM (#51) | CUT — flagged fragile | Fragile if the server is spawned from a different cwd. Six models use an explicitly-configured root. Use env var / constant, not `process.cwd()`. |
| 7 | CVE-2026-42271 as the stdio RCE identifier | SDR citation 4 | REJECTED — wrong number | Web-verified: not this vulnerability. Correct identifier is CVE-2026-30623. |
| 8 | CVE-2026-30617 cited alongside the correct CVE | SRP citation 32 | REJECTED — wrong number | Web-verified: not this vulnerability. Correct identifier is CVE-2026-30623. The Flowise sibling in the same class is CVE-2026-40933, also not this bug. |

**Web verification performed (1 call):** [LiteLLM security advisory for CVE-2026-30623](https://docs.litellm.ai/blog/mcp-stdio-command-injection-april-2026) confirmed the identifier, the `StdioServerParameters` command-injection mechanism, the `MCP_STDIO_ALLOWED_COMMANDS` allowlist and its member binaries, the authenticated-only exploit precondition, and the patched version (v1.83.6-nightly, PR #25343). Corroborating coverage: [The Hacker News](https://thehackernews.com/2026/04/anthropic-mcp-design-vulnerability.html), [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-mcp-rce-design-vulnerability-20260423-csa/), [Obsidian Security on the Flowise sibling CVE-2026-40933](https://www.obsidiansecurity.com/blog/when-is-stdio-mcp-actually-a-vulnerability).

**Truncation note (carried from source):** sonar-deep-research and sonar-reasoning-pro were both cut off by the run's `--max-tokens 8000` cap (SDR mid-Area-3, SRP mid-Area-4). Areas 1-2 and the substance of Area 3 are intact for both; the missing tail is Area-4 detail the other five models cover fully. This is a run-parameter artifact, not a model failure, and does not affect any adjudicated verdict.
