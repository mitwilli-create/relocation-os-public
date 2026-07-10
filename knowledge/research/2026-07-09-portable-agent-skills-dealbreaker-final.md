---
agent: dealbreaker
mode: claim-adjudication
input_report: knowledge/research/2026-07-09-portable-agent-skills-council-report.md
input_kind: council
timestamp: 2026-07-09 14:05:00 PT
backs: ADR-0006 (Module 4 / Skills) in the Relocation OS build
adjudication_summary:
  total_claims_reviewed: 61
  verified: 22
  corroborated: 28
  unique_distinctive_kept: 2
  cut_unsupported: 1
  cut_contradicted_or_corrected: 4
  out_of_adr_scope_not_graduated: 4
  websearch_calls_used: 4   # 1 WebSearch + 3 WebFetch, all against official docs
  routing_audit: skipped   # council mode; no researcher routing to audit
  confidence_in_final_synthesis: high
primary_sources_opened:
  - https://code.claude.com/docs/en/skills            # Claude Code skills (official)
  - https://developers.openai.com/codex/skills         # redirects to learn.chatgpt.com/docs/build-skills (official Codex)
  - https://learn.chatgpt.com/docs/build-skills        # Codex skill discovery + openai.yaml (official)
  - https://github.com/anthropics/claude-code/issues/66352  # open request: add .agents/skills support
  - https://github.com/anthropics/claude-code/issues/31005  # open request: AGENTS.md + .agents/skills
overrides_of_council_synthesis:
  - "Council said put canonical skills in .agents/skills/ for broadest native discovery. WRONG for Claude Code: Claude Code does not scan .agents/skills/. Verified."
  - "Council said treat symlinks as unreliable, prefer copies. OVERTURNED: both Claude Code and Codex officially follow symlinks. Symlinks are the recommended single-source-of-truth mechanism on macOS/Linux."
  - "Council downgraded prior B Codex user path from ~/.agents/skills/ toward ~/.codex/skills/. REVERSED: official Codex docs list ~/.agents/skills/ as the user scope; ~/.codex/skills/ is not in current official docs."
---

# Final Research Report: Portable agent skills across Claude Code + Codex CLI

**Adjudicated by:** dealbreaker agent (claim-adjudication mode)
**Source report:** [`2026-07-09-portable-agent-skills-council-report.md`](./2026-07-09-portable-agent-skills-council-report.md)
**Timestamp:** 2026-07-09 14:05 PT
**Backs:** ADR-0006 (Module 4 / Skills)

## Headline

There is no single directory both runtimes scan natively (Claude Code reads only `.claude/skills/`, Codex reads `.agents/skills/`), but both officially follow symlinks, so the correct cross-runtime pattern is one committed canonical skill directory with a symlink from each runtime's discovery path, not committed copies.

## Executive synthesis

The council was strongly right on architecture and partly wrong on the exact plumbing that ADR-0006 turns on. I verified the plumbing against primary sources (official Claude Code and Codex skills docs, plus Anthropic's own open issue tracker) and I am overriding the council synthesis on two load-bearing points and reversing its verdict on one documentation prior.

**Point 1, canonical location (user question 1).** `.agents/skills/<name>/SKILL.md` is NOT a genuine single cross-runtime canonical path. It is canonical for Codex (repo scope, scanned from CWD up to the repository root) and it is the directory named by the Agent Skills open standard, but Claude Code does not scan it. Claude Code's official docs list exactly two skill discovery locations, `.claude/skills/<name>/SKILL.md` (project) and `~/.claude/skills/<name>/SKILL.md` (personal), plus nested and parent `.claude/skills/` directories. There is no `.agents/skills/` support, and there are two open Anthropic feature requests (issues #66352 and #31005) asking for exactly that, which is direct confirmation it is absent today. The council's own `perplexity:sonar-deep-research` flagged this correctly ("Any claim that Claude Code natively scans `.agents/skills` for repository-local skills is [UNVERIFIED]"), but the orchestrator's synthesis overrode that flag and recommended `.agents/skills/` "for the broadest native discovery." That recommendation would make Claude Code silently fail to find the skill. A repo-root `skills/` directory (which this repo already has) is scanned natively by neither runtime, so it is a fine home for canonical copies but is not a discovery path on its own. Conclusion: the skill content must be reachable from BOTH `.claude/skills/<name>/` and `.agents/skills/<name>/`. The only real design question is how, which is user question 2.

**Point 2, discovery mechanism (user question 2).** Symlinks win, which reverses the council. The council flagged cross-runtime symlink behavior as UNVERIFIED and leaned toward committed copies. Primary sources say the opposite for both ADR-relevant runtimes. Claude Code's docs: "A `<skill-name>` entry in the enterprise, personal, or project locations can be a symlink to a directory elsewhere on disk. Claude Code follows the symlink and reads `SKILL.md` from the target directory, and if the same target is reachable from more than one location, Claude Code loads the skill once." Codex's docs: "Codex supports symlinked skill folders and follows the symlink target when scanning these locations." So the clean pattern is: commit ONE canonical skill directory, and make each runtime's discovery directory a symlink into it. Claude Code even deduplicates when the same target is reachable twice, so there is no double-load risk. This eliminates the drift problem that copies introduce, because there is only one real directory. The council's residual worry is still partly valid and belongs in the ADR as a caveat: Windows does not handle symlinks reliably, and git needs `core.symlinks=true` (default on macOS and Linux, sometimes disabled on Windows). Mitchell's environment is macOS (darwin), so symlinks are the right call here. If a future contributor is on Windows or a CI runner strips symlinks, the fallback is committed copies guarded by a CI check that diffs each copy against the canonical file and fails the build on drift.

**Point 3, the recommended repo layout.** Because Codex needs the real directory at `.agents/skills/<name>/` anyway and that is the open-standard location, the lowest-friction layout is: make `.agents/skills/<name>/` the committed canonical directory (SKILL.md plus `scripts/`), and create `.claude/skills/<name>` as a symlink pointing to `../../.agents/skills/<name>`. One real directory, one symlink, both runtimes find it, zero drift. If Mitchell prefers to keep the already-documented top-level `skills/` directory as the canonical home for consistency with existing repo conventions, that also works: canonical `skills/<name>/`, with `.claude/skills/<name>` and `.agents/skills/<name>` both symlinked to it. Either is defensible; the first is one fewer symlink. This is a genuine choice for the ADR, not a forced move.

**Point 4, the architecture and security guidance is solid and can graduate as-is.** Everything the council said about the determinism boundary ("thick scripts, thin instructions," SKILL.md as dispatcher not implementation, JSON-on-stdout plus exit codes, model treats script output as data not instructions), about security (`.gitignore` is not a security boundary, canonicalize paths with allowlists, sandbox the scripts, never put quarantined bytes or secrets in SKILL.md or tracked paths), and about MCP composition (MCP owns scoped read-only capability exposure, scripts own deterministic repo-local transforms, SKILL.md owns only routing) is internally consistent, freshness-independent, and maps directly onto this repo's ADR-0005 `relocation-kb` posture. Opus 4.7 and GPT-5.5 are the sharpest voices here and their being cutoff-bound does not matter for reasoning claims. These graduate.

**Prior verdicts.** Prior A (SKILL.md is a cross-agent open standard with `name` + `description` frontmatter): CONFIRM. Both official docs require `name` + `description` and the Claude Code page explicitly says its skills "follow the Agent Skills open standard, which works across multiple AI tools." Prior B (Claude Code at `.claude/skills/`; Codex at `~/.agents/skills/`): CONFIRM, and I am reversing the orchestrator's downgrade to PARTIAL. The official Codex docs list the user scope as `$HOME/.agents/skills`, so the original prior was correct on both halves; `~/.codex/skills/` (which the orchestrator promoted as the "better-documented" path) does not appear in the current official Codex docs and came from a non-official community repo. Prior C (Codex added an `openai.yaml` for Codex-specific metadata): CONFIRM. The file is real, optional, and lives at `<skill>/agents/openai.yaml`, carrying `interface`, `policy`, and `dependencies` (including `mcp_tools`). Grok's `codex.yaml` is wrong; Opus's `config.toml` skepticism is a cutoff artifact.

## Verified findings (high confidence, primary-source or unanimous-architecture)

1. A skill is a directory containing a `SKILL.md` file plus optional `scripts/`, `references/`, `assets/` subdirectories. [ledger #1; verified against both official docs]
2. The only two cross-portable, required frontmatter fields are `name` and `description`, as YAML at the top of SKILL.md. [#2; both official docs require exactly these]
3. Claude Code discovers skills at `.claude/skills/<name>/SKILL.md` (project) and `~/.claude/skills/<name>/SKILL.md` (personal), auto-discovered with no registration step, also loading from nested and parent `.claude/skills/` directories up to the repo root. [#14; official Claude Code docs, web-verified by dealbreaker]
4. Claude Code does NOT scan `.agents/skills/`. This is a verified negative: the official discovery table lists only `.claude/skills/` locations, and Anthropic issues #66352 and #31005 are open requests to add `.agents/skills/` support. [corrects #15; web-verified by dealbreaker]
5. Codex CLI discovers repo skills at `.agents/skills/`, scanned in every directory from the current working directory up to the repository root. [#16; official Codex docs, web-verified]
6. Codex CLI user-scope skills live at `~/.agents/skills/`; admin skills at `/etc/codex/skills/`. [#18, upgraded from single-source; official Codex docs, web-verified]
7. Both Claude Code and Codex officially follow symlinks when discovering skills. Claude Code deduplicates when the same target is reachable from multiple locations. [overturns #24; both official docs, web-verified]
8. Codex supports an optional `agents/openai.yaml` sidecar inside the skill directory carrying `interface`, `policy`, and `dependencies` (including `mcp_tools`) metadata. [#13, #61 / Prior C; official Codex docs, web-verified]
9. Claude Code supports dynamic context injection via `` !`command` `` syntax that inlines live command output once before the model sees it (not re-scanned for further placeholders). This is Claude-specific and NOT portable. [#31, upgraded from single-source; official Claude Code docs, web-verified]
10. Progressive disclosure: the agent sees only `name` + `description` first and loads the body and assets only when the description matches a task. [#6; both official docs]
11. Determinism boundary: real logic lives in version-controlled executable scripts under `scripts/`; SKILL.md is a dispatcher, not the implementation. Scripts use a strict I/O contract (JSON on stdout, meaningful exit code); the model treats script output as data, not instructions. [#26, #28, #38, #42; unanimous architecture]
12. `.gitignore` is not a security boundary; it only prevents Git tracking. The privacy quarantine must be enforced by a separate layer (path canonicalization with allowlists, sandboxed scripts, a machine-readable quarantine manifest, and pre-commit/CI checks). [#44, #49; well-established, direct fit for this repo's `scripts/privacy-check.sh`]
13. MCP owns scoped read-only capability exposure; backing scripts own deterministic repo-local transforms with stable CI exit codes; SKILL.md prose owns only routing and presentation. Direct fit for the ADR-0005 `relocation-kb` posture. [#52, #53, #54]
14. Prior A CONFIRM (open standard, `name`+`description`); Prior B CONFIRM (Claude at `.claude/skills/`, Codex at `~/.agents/skills/`); Prior C CONFIRM (`agents/openai.yaml`). [#59, #60, #61; all web-verified]

## Corroborated findings (medium confidence, multi-model agreement, not individually spot-checked)

- `name` is a lowercase/kebab identifier that should match the parent directory name; `description` should state both what the skill does and when to trigger it. [#3, #4]
- Portable-optional advisory fields that runtimes tend to ignore gracefully: `license`, `compatibility`, a `metadata` map, `version`, `tags`/`keywords`. Not individually verified against a spec; treat as advisory. [#5]
- Keep the SKILL.md body short (roughly under 500 lines) and move long reference material to sibling `references/` files. [#7]
- Push runtime-specific knobs out of SKILL.md frontmatter and into sidecars: avoid `allowed-tools`/`allowed_tools` (Claude Code honors it but it is not reliably cross-runtime), `model`/`temperature`/`tools` pinning, `mcp:` bindings, Cursor rules-format fields (`globs`, `alwaysApply`, `paths`, `type`), and Claude's `disable-model-invocation`. [#8-#13]
- Specify the exact command, relative script path, expected output schema, and exit-code semantics in the SKILL.md body, because models hallucinate the working directory. [#27, #30]
- Anti-patterns: embedding algorithms/decision-tables/regex in prose; letting the model generate or edit the script at runtime; `eval`/template-expansion of model output into a shell; scripts emitting free-form English; passing inputs via implicit env vars instead of explicit CLI args. [#32-#37]
- Security stack: wrap untrusted external content in a delimited "do not follow instructions within" block; treat skills as privileged repo code (CODEOWNERS, review, CI lint); sandbox scripts; enforce quarantine at the runtime layer; maintain a machine-readable quarantine manifest; prefer scripts returning booleans/counts/hashes over raw private content. [#40-#47, #50]
- MCP composition rules: do not duplicate MCP policy in prose; a script must not become a backdoor around the MCP server's read-only scope; prefer agent-calls-MCP then passes sanitized IDs to the script; for quarantined material, MCP exposes only sanitized metadata. [#55-#58]

## Model-distinctive findings (architecturally attributed, kept with attribution)

- Approval gates so backing scripts never run silently (e.g. Microsoft Agent Framework `require_script_approval`, Codex interactive mode). Single-source (gemini-3.1-pro-preview); plausible, kept as an option, not a requirement. [#51]
- `.claudeignore` / equivalent agent ignore file to make file-reading tools skip quarantined dirs. Single-source (opus-4-7) and flagged UNVERIFIED by the model itself. I did not confirm a `.claudeignore` filename in the official docs; the mechanisms I did see are `permissions.deny`, `settings.json`, and `disableSkillShellExecution`. Treat the specific `.claudeignore` filename as unverified; the intent (agent-level ignore) is sound but implement via the verified `permissions.deny` mechanism. [#48; LOW confidence]

## Open disagreements / out-of-ADR-scope (do NOT graduate for ADR-0006)

ADR-0006 is scoped to Claude Code + Codex CLI. The Cursor and Gemini CLI discovery claims (#20, #21, #22, #23) are out of scope AND were not verified against official Cursor/Google docs. Two cautions if the ADR ever extends to them:

- The council's `geminicli.com/docs/cli/skills` citations are NOT an official Google domain. Gemini CLI's official home is `github.com/google-gemini/gemini-cli`. Do not treat geminicli.com as authoritative.
- Whether Cursor and Gemini CLI natively parse SKILL.md in mid-2026 is genuinely unresolved here. The grounded models say yes; the cutoff models (GPT-5.5, Opus 4.7) say bridge-files-only. The orchestrator's OV tiebreaker ("Cursor with manual placement") itself came from a non-official WebSearch and I did not re-verify it. Suggested next step if needed: open `cursor.com/docs` and the `google-gemini/gemini-cli` repo docs directly before relying on native SKILL.md support for either.

## Appendix: adjudication audit trail

Model key: SDR = perplexity:sonar-deep-research, SRP = perplexity:sonar-reasoning-pro, G4 = xai:grok-4 (grok-4.3), G4X = xai:grok-4-x-search, GPT5 = openai:gpt-5 (gpt-5.5), GEM = google:gemini-2.5-pro (gemini-3.1-pro-preview), OPUS = anthropic:claude-opus-4-7.

### Overrides and corrections (the load-bearing changes)

| # | Item | Council verdict | Dealbreaker verdict | Rationale (primary source) |
|---|---|---|---|---|
| #15 | `.agents/skills/` is the interoperable alias for repo skills "across runtimes" | M / OV (kept, and synthesis recommended it for "broadest native discovery") | CORRECTED. True for Codex + the open standard; FALSE for Claude Code | Official Claude Code docs list only `.claude/skills/`; Anthropic issues #66352 and #31005 are open requests to add `.agents/skills/`. SDR's original [UNVERIFIED] flag was right. |
| #24 | Symlinks not reliably supported; prefer copies/stubs | F (kept as recommendation) | OVERTURNED for Claude Code + Codex | Claude docs: "Claude Code follows the symlink and reads SKILL.md from the target directory." Codex docs: "Codex supports symlinked skill folders and follows the symlink target." Windows/`core.symlinks` caveat survives. |
| #25 | Layout: canonical under `.agents/skills/` OR `.claude/skills/` with per-runtime stub | M | CORRECTED. One canonical dir + symlink from the other runtime's path. Neither single dir is scanned by both runtimes. | Same two official docs. |
| #17 | Codex user path `~/.codex/skills/` | M / OV (promoted as "co-equal, better-documented") | DOWNGRADED. Official user path is `~/.agents/skills/`; `~/.codex/skills/` not in current official docs | Official Codex build-skills doc lists USER scope = `$HOME/.agents/skills`. #17 sourced from non-official composiohq repo. |
| #19 | DISPUTED: Codex repo path `.codex/skills` (G4) vs `.agents/skills` | D / OV | BROKEN, side with `.agents/skills` | Official Codex docs: repo scope = `.agents/skills`. G4's `.codex/skills` is at best a compat alias, not in official docs. |
| #60 | Prior B (Codex at `~/.agents/skills/`) | PARTIAL (orchestrator downgrade) | REVERSED to CONFIRM | Official Codex docs list `~/.agents/skills` as the user scope. Original prior was correct. |

### Upgrades (single-source or few -> verified)

| # | Item | Council tier | Dealbreaker | Source |
|---|---|---|---|---|
| #18 | Codex `~/.agents/skills/` (user) + `/etc/codex/skills/` (admin) | S / OV | VERIFIED | Official Codex docs |
| #31 | Claude `` !`command` `` dynamic injection | S | VERIFIED (and marked Claude-specific, not portable) | Official Claude Code docs |
| #61 | Prior C `agents/openai.yaml` | CONFIRM / OV | VERIFIED (interface/policy/dependencies) | Official Codex docs |

### Out-of-scope, not graduated

| # | Item | Reason |
|---|---|---|
| #20 | Cursor native `.cursor/skills/` discovery | Out of ADR-0006 scope; not verified against official Cursor docs |
| #21 | DISPUTED: Cursor does NOT parse SKILL.md natively | Out of scope; OV tiebreaker was itself non-official; undecidable here |
| #22 | Gemini CLI native `.gemini/skills/` / `.agents/skills/` discovery | Out of scope; geminicli.com is not an official Google domain |
| #23 | DISPUTED: Gemini CLI does NOT parse SKILL.md natively | Out of scope; undecidable here |

### Low-confidence, kept with caveat

| # | Item | Reason |
|---|---|---|
| #48 | `.claudeignore` agent ignore file | Model self-flagged UNVERIFIED; specific filename not confirmed in official docs. Implement via verified `permissions.deny` instead. |
| #5 | Portable-optional fields (`license`, `compatibility`, `metadata`, `version`, `tags`) | Multi-model but not spec-verified; advisory only. |

### URL spot-check results (orchestrator flagged these as asserted-but-unopened)

| URL | Status | Note |
|---|---|---|
| code.claude.com/docs/en/skills | REAL, opened, authoritative | Claude Code skills reference |
| developers.openai.com/codex/skills | REAL, opened (308-redirects to learn.chatgpt.com/docs/build-skills), authoritative | Official Codex skills |
| `<skill>/agents/openai.yaml` | CONFIRMED real | interface/policy/dependencies |
| agentskills.io | Corroborated (linked as the open standard from official Claude Code docs); not independently opened | Safe to cite as the standard's home |
| geminicli.com/docs/cli/skills | UNVERIFIED, NOT an official Google domain | Do not graduate; use github.com/google-gemini/gemini-cli |
| cursor.com/docs/skills | Not opened; out of ADR scope | Verify directly if ADR extends to Cursor |

## Recommended ADR-0006 decision (dealbreaker's actual pick)

Canonical skill directory committed once at `.agents/skills/<name>/` (real SKILL.md + `scripts/`), with `.claude/skills/<name>` as a symlink to `../../.agents/skills/<name>`. Both runtimes follow the symlink; Claude Code deduplicates; zero drift. Keep frontmatter to `name` + `description`. Add a Codex `agents/openai.yaml` sidecar only if you want Codex UI metadata or `mcp_tools` wiring to `relocation-kb`. Add a one-line CI check that fails if `.claude/skills/<name>` is ever a real directory instead of a symlink (Windows-contributor guard) or, if you must support Windows, replace the symlink with a committed copy plus a CI diff-against-canonical drift check. Alternative equally-defensible layout: canonical at the existing repo-root `skills/<name>/`, with both `.claude/skills/<name>` and `.agents/skills/<name>` symlinked to it (one extra symlink, keeps the existing `skills/` convention).
