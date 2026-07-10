# ADR-0006: Portable skill authoring across Claude Code and Codex

Date: 2026-07-09
Status: Accepted

## Context

Module 4 of the build plan turns the reusable-workflow stubs in `skills/README.md` into
real skills, "built portable across both runtimes." This ADR locks the authoring pattern
that all four skills inherit (this session builds two: `mission-runner` and
`constraint-gate`; `award-watch` and `sanitize-for-portfolio` are deferred).

The design was routed through the council-of-models then dealbreaker chain per SDLC. Raw
report: `knowledge/research/2026-07-09-portable-agent-skills-council-report.md`. Adjudicated:
`knowledge/research/2026-07-09-portable-agent-skills-dealbreaker-final.md`. The council
split along web-access lines; the dealbreaker ran primary-source verification against the
official Claude Code and Codex docs and overturned two orchestrator-level recommendations,
so the decisions below rest on the adjudicated report, not the raw council synthesis.

Two council-level claims were reversed in adjudication and both bear on this ADR:

1. The orchestrator recommended `.agents/skills/` as a single canonical cross-runtime
   path. Verified false: Claude Code discovers skills only under `.claude/skills/`
   (project) and `~/.claude/skills/` (user); it does not scan `.agents/skills/`. Codex
   discovers under `.agents/skills/` (project) and `~/.agents/skills/` (user). A repo-root
   `skills/` directory is scanned natively by neither. There is no single directory both
   runtimes read.
2. The council preferred committed copies over symlinks, flagging cross-runtime symlink
   behavior as unverified. Verified and reversed: both runtimes officially follow
   symlinked skill directories (Claude Code follows the link and dedupes; Codex supports
   symlinked skill folders). The Windows / git `core.symlinks` caveat does not bite on
   macOS, the only environment in use here.

Priors A, B, and C from the research prompt all confirmed against primary sources: SKILL.md
is a cross-agent open standard keyed on `name` + `description` frontmatter (A); the two
discovery paths above (B); and Codex's optional per-skill sidecar at `<skill>/agents/openai.yaml`
declaring interface / policy / dependencies including `mcp_tools` (C).

This composes with ADR-0005 (the `relocation-kb` MCP server) and ADR-0004 (privacy-check
quarantine). The freshness-independent architecture, determinism, and security guidance in
the adjudicated report (its rows 26 to 58) maps directly onto the ADR-0005 posture.

## Decision

1. **Format is the open SKILL.md standard, frontmatter limited to `name` + `description`.**
   No runtime-specific frontmatter (`context: fork`, `allowed-tools`, `model`, `effort`)
   in the shared body, so every SKILL.md-compatible runtime loads it unmodified. `name`
   matches the parent folder. `description` is the routing trigger.

2. **One canonical source directory, two committed discovery symlinks.** Canonical skill
   files live at `skills/<name>/SKILL.md` (the repo's existing documented library). Because
   neither runtime scans repo-root `skills/`, discovery is provided by two relative,
   git-tracked symlinks per skill:
   - `.claude/skills/<name>` to `../../skills/<name>` (Claude Code, project scope).
   - `.agents/skills/<name>` to `../../skills/<name>` (Codex, project scope).
   One real directory, two symlinks, both runtimes resolve to the identical file, zero
   drift. A user-scope `~/.agents/skills/<name>` symlink is available for global
   out-of-repo Codex use; it is documented, not committed, exactly as ADR-0005 left the
   Codex `~/.codex/config.toml` MCP registration uncommitted.

3. **Determinism lives in scripts, not skill prose.** Each skill's mechanical logic is a
   zero-dependency, idempotent `scripts/<name>.mjs` that emits structured output and a
   meaningful exit code. The SKILL.md body is a thin instruction wrapper: it routes to the
   script and interprets the verdict. The division is "the model chooses the skill; the
   script enforces the rule." This matches the determinism rules in CLAUDE.md and the
   adjudicated architecture guidance.

4. **Scripts never widen scope beyond what MCP or the privacy gate already allow.** The
   `relocation-kb` MCP server owns scoped read-only capability; skill scripts own
   deterministic repo-local transforms; SKILL.md owns routing only. A skill script must not
   become a backdoor around the MCP read-only scope or the privacy quarantine. Concretely:
   skill scripts do not read the quarantined private list except through the same
   self-skipping, fail-loud pattern the privacy gate uses, and they never write outside
   the repo.

5. **The quarantine is enforced in code, not by `.gitignore`.** The adjudicated
   load-bearing security claim is that `.gitignore` is not a security boundary. Any skill
   that touches private data (here, `constraint-gate`'s L1 eliminated-cities check) reads a
   gitignored file (`memory/private/eliminators.txt`) and, when that file is absent (CI, or
   an un-restored machine), self-skips that check with an explicit NOTE, never a silent
   pass. This is the ADR-0004 privacy-check pattern applied to a skill.

6. **Each skill ships with a Module 2 eval that gates merge.** A zero-dependency
   `scripts/skills-selftest.mjs` drives each backing script against synthetic fixtures and
   asserts behavior plus exit codes, wired into `.github/workflows/checks.yml` as a
   fail-fast step (mirroring the ADR-0005 MCP `npm run selftest` CI gate). Skill-produced
   mission outputs are additionally validated by the existing `run-evals.mjs`.

## Alternatives considered

- **Canonical at `.agents/skills/` with only a `.claude/skills/` symlink.** The
  orchestrator's recommendation. Rejected: it presumes `.agents/skills/` is a shared path,
  but Claude Code never reads it, so the layout is no simpler than the chosen one and
  abandons the repo's existing `skills/` convention for no gain. The chosen layout keeps
  the canonical where the repo already documents it and treats both runtime dirs equally.
- **Committed copies instead of symlinks.** The council's preference. Rejected for the two
  in-scope runtimes on macOS, where symlink discovery is documented and supported. Copies
  reintroduce drift and would themselves need a CI diff-against-canonical guard. If a
  future Windows contributor or a symlink-hostile CI appears, revisit with that guard.
- **Runtime-specific frontmatter in the shared body.** Rejected: it breaks portability.
  Runtime-specific metadata, if ever needed, goes in Codex's `agents/openai.yaml` sidecar,
  not the SKILL.md frontmatter. Neither skill this session needs a sidecar.
- **Skill logic as model prose only (no backing script).** Rejected: non-deterministic,
  unevaluable, and contrary to the determinism rules. The gate and registry logic must be
  machine-checkable, which means a script.
- **Reusing the MCP server as the skill transport.** Rejected as a category error: MCP
  exposes read-only retrieval, not the deterministic orchestration and gate-enforcement a
  skill needs. They compose (decision 4); one does not replace the other.

## Consequences

- The repo gains `skills/<name>/SKILL.md` canonical files plus `.claude/skills/` and
  `.agents/skills/` symlink trees, all committed. Adding a skill means one directory and
  two symlinks.
- Both runtimes execute the byte-identical SKILL.md. The Module 4 verification target
  (both runtimes run the same skill files) is met by construction, not by copy discipline.
- Skill behavior is testable: the backing scripts are ordinary Node scripts with exit
  codes, gated in CI alongside the existing eval suite.
- The privacy boundary for skills is the script layer, consistent with ADR-0004. Reviewers
  check skill scripts for scope widening, not just the SKILL.md text.
- Codex's `agents/openai.yaml` sidecar remains available if a later skill needs to declare
  MCP tool dependencies or Codex-specific UI metadata; it stays out of the portable body.
- Cursor and Gemini CLI portability is plausible but unverified (out of this ADR's scope,
  which is Claude Code + Codex). The adjudicated report flags that `geminicli.com` and
  `agentskills.io` are non-official domains; do not graduate those claims without checking
  the official Google and Cursor docs first.
