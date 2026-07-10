# Relocation OS Build Plan (v0.2 → v1.0)

Status: awaiting Mitchell's review. Executed as a TUTORED BUILD: Mitchell and Claude build together in a fresh Claude Code instance that reads [HANDOFF-TUTOR.md](HANDOFF-TUTOR.md) first. One module at a time, each its own CodeRabbit-reviewed PR, each ending in a working committed state.

Every module cites the adjudicated research findings it builds on ([adjudicated report](../knowledge/research/2026-07-08-agentic-os-best-practices-ADJUDICATED.md), cited as rows). **Explicitly not built on:** Row 5 (the "500-line root manifest" budget, cut as contradicting consensus) and Row 10 (specific context-window size specs, cut as single-source). Where those topics arise we use the corroborated 150 to 200 line band as a band, never a rule, and we never cite window sizes.

## Module 1 (warm-up): Standing council roles 7 to 9

**Goal:** Add the Language Specialist, Visa Specialist, and Tax Accountant as standing relocation-lifecycle roles, distinct from the six trip-mission roles.
**Builds on:** Row 40 (verified: CodeRabbit reviews CLAUDE.md/AGENTS.md and harness files as first-class targets, which is the SDLC loop this module teaches). The role content itself is the documented exception to the citation rule: it is owner-specified (Mitchell's requirements), not research-derived.
**What Mitchell learns:** the full SDLC loop hands-on with a low-risk change: branch, edit, ADR, privacy gate, PR, reading and answering a CodeRabbit review, merge.
**Steps:**
1. Branch `feat/standing-council-roles`. Restructure `council/roles.md` into "Mission roles (1 to 6)" and "Standing roles (7 to 9)".
2. Role 7 Language Specialist: pre-departure CEFR-milestone plan with dated checkpoints and ADHD-sized habit loops; survival-Spanish priorities for scouting trips; in-country immersion design, regional accent notes for candidate cities, DELE/SIELE certification path. Deliverables are dated plans with measurable checkpoints.
3. Role 8 Visa Specialist: DNV process end to end (consulate vs in-country filing, documents, apostilles, timelines, renewal to permanent residency), employer work-from-abroad letter spec (feeds the career-ops offer gate), totalization certificate, private health insurance, cat relocation (EU animal health certificate, rabies titer timing, airline rules). Delineation: Role 5 owns on-the-ground city intel; Role 8 owns the immigration process.
4. Role 9 Tax Accountant: Beckham mechanics and 6-year clock, US worldwide-tax interplay and foreign tax credit ordering, retirement vehicle treatment across the border (401k/IRA/Roth recognition, restructure-before-move analysis), wealth-tax and asset-reporting exposure, totalization, year-6 exit plan. Standing rule: every numeric claim is dated and dealbreaker-verified before entering `memory/visa-tax.md`.
5. ADR-0002 (standing vs mission roles); update role counts in README.md and CLAUDE.md/AGENTS.md.
**Verification:** privacy gate passes; no stale "six" counts (`grep -ri six README.md CLAUDE.md AGENTS.md council/`); Role 5 vs Role 8 have zero overlapping deliverables; CodeRabbit review addressed.

## Module 2: Eval harness

**Goal:** Numeric, CI-enforced quality gates for the system's own agents and pipelines.
**Builds on:** Rows 27, 29, 31 (verified: eval gates decide accept/reject; golden transcripts with structured-output diffs; promptfoo / inspect_ai / Langfuse as the field-standard tooling) and Row 30 (corroborated GPT-5 caveat: golden transcripts are brittle, prefer invariant assertions such as "citations present, prohibited files untouched, schema valid").
**What Mitchell learns:** what an eval actually is, writing invariant assertions vs golden-output comparisons, wiring a merge-blocking CI gate in GitHub Actions.
**Steps:** pick the eval runner (default: promptfoo, swap if the tutored session finds friction); define schemas for council-role outputs; 3 to 5 invariant assertions per pipeline step (structure present, no private markers, constraint registry consulted, sources attributed); golden transcripts only for the deterministic steps; GitHub Actions workflow running privacy gate + schema validation + evals on every PR.
**Verification:** a deliberately broken output fails CI; the privacy gate runs in CI as well as pre-commit.

## Module 3: Scoped MCP servers

**Goal:** Second brain, career-ops state, and relocation KB exposed as separately scoped, read-only-by-default MCP servers so sessions retrieve claims instead of loading files.
**Builds on:** Rows 12, 13, 14, 17 (verified: MCP as the standard; typed search/read tools over corpus dumping; grep-before-embed, lexical first; least privilege, read-only default, write separation, scoped directories, never $HOME) and Rows 18, 22 (corroborated: `readOnlyHint`/`destructiveHint` annotations; `.mcp.json` and `~/.codex/config.toml` wiring for dual-runtime).
**What Mitchell learns:** building and shipping an MCP server (the single strongest hiring differentiator per Row 47), tool schema design, transport and security scoping, registering the same server under both runtimes.
**Steps:** one server first (relocation KB: `knowledge/` + tracked `memory/`), TypeScript SDK, tools `search_claims` (ripgrep-backed), `read_claim`, `list_topics`, all annotated read-only; scoped to the repo directory; then clone the pattern for second-brain and career-ops corpora as separate servers with their own scopes; register in `.mcp.json` and Codex config; no embeddings until grep demonstrably stops being good enough.
**Verification:** a fresh session answers a relocation question via tool calls without reading any memory file directly; write attempts fail; both runtimes list the tools.

## Module 4: Skills

**Goal:** The skills stubbed in `skills/README.md`, built portable across both runtimes.
**Builds on:** Rows 2, 3 (verified: thin index + just-in-time progressive disclosure), Row 9 (verified: AGENTS.md as the cross-runtime convention, now an AAIF project), Rows 24 to 26 (verified: deterministic orchestration, schema-enforced boundaries, bounded loops).
**What Mitchell learns:** skill authoring, frontmatter-based lazy loading, writing instructions that survive contact with a fresh model instance.
**Steps:** `mission-runner` (execute a pipeline.md deterministically, one output file per step, gates enforced), `constraint-gate` (validate any plan against the locked-decision registry), `award-watch` (structured United/Star Alliance monitoring), `sanitize-for-portfolio` (Module 5's enforcement tool). Each skill gets an eval from Module 2 before merge.
**Verification:** running `mission-runner` against the scouting-trip mission produces Gate 0 output and refuses to proceed past unresolved gates; both runtimes execute the same skill files.

## Module 5: Synthetic twin + portfolio case study

**Goal:** The public showcase artifact: architecture public, data private.
**Builds on:** Row 53 (verified pattern: synthetic-data twin, diagrams over transcripts, public evals with gitignored corpus, one redacted sample transcript) and Row 20 (verified: the OX Security MCP stdio RCE, CVE-2026-30623, as the real, current exhibit for the "how it fails" threat-model section, paired with how Module 3's scoping defends against it). Also Row 11 (verified token-inflation bug) as an honest operational-cost note.
**What Mitchell learns:** sanitization as an engineering discipline, threat modeling an agentic system, telling the story for a hiring audience.
**Steps:** generate a synthetic relocation scenario (fictional person, fictional constraints, same schema); public repo cut with twin data; architecture diagrams; "how it fails" writeup covering prompt injection surface, the stdio RCE class and our scoping defenses, context bloat, and the interactive-hang failure we hit live on 2026-07-08; portfolio page on storytellermitch.com linking the public repo.
**Verification:** privacy gate run against the public cut with the full private marker list; a stranger reading the public repo learns the architecture and nothing about Mitchell's life.

## Sequencing and effort

Order is 1 → 2 → 3 → 4 → 5; Module 2 before 3 so the MCP servers are born with evals. Rough tutored-session estimates with ADHD-realistic buffers (+40%): M1 one session (~1.5h), M2 two sessions, M3 two to three sessions, M4 two sessions, M5 two sessions. Nothing here blocks trip planning; the scouting-trip mission can run on the current v0.1 system at any time.

## Standing cautions carried into every module

- The verified token-inflation bug (Row 11) means long sessions cost more than they appear to; prefer short tutored sessions and `/compact` early.
- Multi-agent runs cost ~10 to 15x single-agent tokens (Row 36, corroborated); councils stay reserved for high-stakes calls (Row 34, verified).
- Background subagents never get interactive prompts (2026-07-08 lesson, twice confirmed); every background prompt bans pauses and includes bounded-effort fallbacks.
