---
agent: dealbreaker
mode: claim-adjudication
input_report: /Users/mitchellwilliams/Documents/relocation-os/knowledge/research/2026-07-08-agentic-os-best-practices-council-report.md
input_kind: council
timestamp: 2026-07-08 PT
adjudication_summary:
  total_claims_reviewed: 55
  verified: 35
  corroborated: 15
  unique_distinctive_kept: 3
  cut_unsupported: 2
  cut_contradicted: 0
  cut_stale: 0
  websearch_calls_used: 6
  routing_audit: skipped
  confidence_in_final_synthesis: high
priority_row_verdicts:
  row_11_token_bug: VERIFIED
  row_20_ox_security_rce: VERIFIED
  row_21_mcp_lf_donation: VERIFIED
  row_43_coderabbit_cli: VERIFIED (date hedged)
  row_51_fde_729pct: VERIFIED
  row_52_agentic_postings: CORROBORATED (directional)
---

# Final Research Report — Agentic OS best practices (Claude Code + Codex) and 2026 AI-industry hiring signals

**Adjudicated by:** dealbreaker agent (claim-adjudication mode)
**Source report:** `/Users/mitchellwilliams/Documents/relocation-os/knowledge/research/2026-07-08-agentic-os-best-practices-council-report.md`
**Timestamp:** 2026-07-08 PT

## Headline

Build Relocation OS as a thin-root, index-first memory system exposing your corpora as separately-scoped read-only-by-default MCP servers, wrap the council in a deterministic harness with schema-enforced I/O and eval gates, isolate subagents in git worktrees, and treat the repo as production software — and note that five of the council's six "do-not-cite" dated claims turned out to be TRUE once verified against primary sources.

## Executive synthesis

The seven-model council converged unusually tightly on the architecture, and independent verification did not disturb the structural consensus: thin always-loaded root manifest that acts as a map, just-in-time skill loading, compaction that preserves decisions rather than history, MCP as the context-reduction layer (not just a tool bus), determinism living in the harness rather than the model, orchestrator-worker subagent fan-out with worktree isolation, councils reserved for high-stakes decisions, real SDLC on the repo, and a portfolio pattern of "architecture public, data private." All of that is VERIFIED or strongly CORROBORATED and is safe to build on and to describe in interview copy.

The sharpest adjudication finding is a reversal of the council's own risk framing. The council flagged its most specific and current 2026 claims — a Claude Code token-inflation bug, an OX Security MCP RCE, the MCP donation to a Linux Foundation body, a CodeRabbit agentic CLI, and FDE hiring growth — as "highest fabrication risk, do not repeat as fact," because Gemini and Grok-x-search sourced them from aggregator blogs rather than primary docs. On verification, five of those six are real and accurate to the stated specifics. The council conflated "cited from a low-quality source" with "probably false." The correct action was not to cut these claims but to re-cite them to primary sources — which this report does. This is a useful, transferable lesson: aggregator-sourced does not mean fabricated, and a conservative flag is not a verdict.

Concretely: Claude Code v2.1.100+ does silently inflate token usage by roughly 20k tokens per request (Anthropic's own issue tracker, #46917, plus independent proxy-log reverse-engineering). OX Security's April 2026 "Mother of All AI Supply Chains" disclosure documents a real, systemic stdio-transport RCE across the official MCP SDKs (CVE-2026-30623), which Anthropic classified as intentional design. MCP was donated to the Linux Foundation's Agentic AI Foundation on 9 December 2025, at "over 97 million monthly SDK downloads." CodeRabbit ships a real CLI authenticated with an agentic API key (`cr-***` prefix, `cr --agent` mode) built for agentic coding loops. And FDE/Applied-AI postings grew 729% in the twelve months through April 2026, with mid-to-senior comp clustering in a $300–550K band. Each of these is now safe to cite — with the primary source, not the blog.

Two things were CUT. The specific Claude Code context-window numbers ("Pro ~44k / Max20 ~220k per 5-hr window," row 10) rest on a single aggregator source and are exactly the kind of precise, changeable spec that damages credibility if wrong — cut as single-source and unverified. Opus's higher "under ~500 lines / ~5k tokens" root-manifest budget (row 5) contradicts the ~150–200 line consensus and its own self-flag; the 500 number is not usable, though it survives as a noted minority position. One claim was softened rather than cut: Grok-x-search's ">100 tracked job postings mention Agentic AI" (row 52) is directionally supported by the verified hiring boom but the precise count is not independently confirmed — cite the trend, not the number.

For Relocation OS specifically: the design the council recommends and this adjudication endorses is a personal MCP server plus Skills bundle plus eval harness, running identically under Claude Code and Codex, CodeRabbit-reviewed, with a synthetic-data public twin and a "how it fails / threat model" section. Relocation OS already has this shape. The gaps to close are the eval harness with numeric regression gates, MCP write-scoping (read-only default, writes behind confirmation), and the synthetic-twin/redaction layer for public showcase. The verified OX Security MCP RCE gives the threat-model section a concrete, current, real exhibit: stdio command-injection surface and how your server scopes against it.

## Verified findings (high confidence)

Memory architecture:
1. Memory is tiered into system/global, project, and local/ephemeral scopes (all 7; Anthropic memory docs). [Row 1]
2. Root manifest is a thin index/map — names + pointers, not monolithic instructions (all 7). [Row 2]
3. Just-in-time / progressive-disclosure skill loading is the default (5 models; Anthropic Skills docs). [Row 3]
4. `/compact` + `/clear` preserve goals/decisions/contracts and discard intermediate reasoning and logs (6 models; Claude Code docs). [Row 6]
5. Durable state must be written to disk before compaction (4 models). [Row 7]
6. Oversized memory files cause instruction dilution and "lost in the middle" degradation (6 models; arXiv 2307.03172). [Row 8]
7. AGENTS.md is the cross-runtime convention across Codex/Cursor/Aider (agents.md; now a Linux Foundation AAIF project — see finding 20). [Row 9]
8. **Claude Code v2.1.100+ silently inflates token usage by ~20k tokens/request** — real, unpatched through at least v2.1.133; likely broken prompt caching. [web-verified: GitHub anthropics/claude-code #46917, HN 47752049]. [Row 11]

MCP and knowledge bases:
9. MCP is the de-facto 2026 standard for agent-to-tool/data connectivity (all 7). [Row 12]
10. Expose a second-brain as an MCP server with typed search/read/list tools rather than dumping the corpus (all 7). [Row 13]
11. "Grep/index before you embed" — lexical first, embeddings as semantic fallback, hybrid for large corpora (6 models). [web-verified: Anthropic context-engineering; "start with agentic search, add semantic only if grep stops being good enough"]. [Row 14]
12. Commonly shipped servers: filesystem, git/GitHub (5 models; modelcontextprotocol/servers). [Row 15]
13. MCP security = least privilege, read-only default, write/read tool separation, HITL on destructive ops, scoped dirs, secrets in env/vault (all 7). [Row 17]
14. **OX Security disclosed a systemic MCP SDK stdio-transport RCE in April 2026** (CVE-2026-30623), spanning the official Python/TypeScript/Java/Rust SDKs; Anthropic deemed the stdio execution model intentional and put sanitization on the developer. [web-verified: ox.security; thehackernews.com 2026/04; CSA Labs]. [Row 20]
15. **MCP was donated to the Linux Foundation's Agentic AI Foundation on 9 Dec 2025, at over 97 million monthly SDK downloads** (co-founded by Anthropic, Block, OpenAI; goose and AGENTS.md joined as founding projects). [web-verified: anthropic.com; blog.modelcontextprotocol.io; linuxfoundation.org]. [Row 21]

Determinism:
16. Wrap LLM calls in a deterministic orchestration script; model called only at specific nodes; "workflows > agents" for anything testable (all 7; Anthropic "building effective agents," OpenAI Agents SDK). [Row 24]
17. Structured outputs / strict JSON schema at every LLM boundary (5 models; OpenAI Structured Outputs). [Row 25]
18. Bounded loops (max iterations, explicit stop), not free-form ReAct (5 models). [Row 26]
19. Eval gates decide accept/reject; failures trigger retry/repair or human handoff (all 7). [Row 27]
20. Reproducibility = functional determinism: temp 0 + seed where supported + logged run manifest (4 models). [Row 28]
21. Golden transcripts + deterministic replays; diff structured outputs, not raw text (all 7). [Row 29]
22. Named eval frameworks in real use: promptfoo, inspect_ai, braintrust, OpenAI Evals, Langfuse (official docs). [Row 31]

Subagents and councils:
23. Orchestrator-workers fan-out with per-subagent context isolation, minimal packet, restricted tools; parent aggregates typed results (all 7; Anthropic multi-agent research system). [Row 32]
24. Git-worktree isolation per code-writing subagent to prevent diff clobbering (6 models; git-worktree + Claude Code common-workflows). [Row 33]
25. Councils reserved for high-stakes/irreversible/disagreement-valuable decisions; single strong model for routine (all 7). [Row 34]
26. "Plan with strong model, execute with light model" tiering (5 models; Anthropic guidance). [Row 35]
27. Adjudication via structured voting / LLM-as-judge / HITL; rank by evidence quality, not model charisma (all 7). [Row 37]

SDLC:
28. CodeRabbit reviews CLAUDE.md/AGENTS.md/SKILL.md/.claude/** as first-class targets (6 models; CodeRabbit docs). [Row 40]
29. CI includes prompt linting, schema/manifest validation, secret scanning, dead-link checks, eval gates that block merge (5 models). [Row 41]
30. Named CI tooling in use: promptfoo, GitHub Actions, Gitleaks, pytest, OpenAI Evals (official docs). [Row 42]
31. **CodeRabbit ships a CLI authenticated by an agentic API key** (`coderabbit auth login --api-key "cr-***"`, `cr --agent` for structured JSON output) built for agentic coding loops with Claude Code and Codex. [web-verified: docs.coderabbit.ai/cli; coderabbit.ai blog. Exact "March 2026" release month not independently pinned — cite the capability, hedge the date]. [Row 43]

Hiring signal:
32. The hiring line is "uses Claude Code" vs "builds agentic systems" — memory architecture, shipped MCP servers, evals, determinism, observability (all 7). Company-specific job-post wording remains uncertain. [Row 46]
33. Shipping an MCP server (not just consuming one) is a top differentiator (5 models). [Row 47]
34. **FDE/Applied-AI is the fastest-growing role; postings +729% YoY (12 months through April 2026); mid-to-senior comp clusters $300–550K** (staff/principal at frontier labs higher). [web-verified: paraform, recruitingfromscratch, getperspective]. [Row 51]
35. Portfolio pattern: synthetic-data twin repo, architecture diagrams over transcripts, public evals + gitignored corpus, redacted sample transcript (all 7). [Row 53]

## Corroborated findings (medium confidence)

- Root CLAUDE.md/AGENTS.md target ≈150–200 lines. Direction verified (Anthropic: keep it lean); the exact number is folklore — treat 150–200 as a band, not a rule. [Row 4]
- Vector/KB server categories are solid (Chroma/Qdrant/Turbopuffer, Basic Memory/Obsidian, Context7/Supabase, knowledge-mcp/LightRAG); the exact niche package names are partly self-flagged — trust the category, verify the package before citing. [Row 16]
- MCP tool annotations `readOnlyHint` / `destructiveHint` exist (Opus; consistent with MCP spec). [Row 18]
- Config lives in `.mcp.json` (Claude) / `~/.codex/config.toml` (Codex); OAuth 2.1 + PKCE for remote servers (Grok-x-search). [Row 22]
- GPT-5 caveat worth keeping: golden transcripts are brittle; prefer invariant assertions (citations present, prohibited files untouched, schema valid). Reasoned minority dissent, not consensus. [Row 30]
- Multi-agent systems use ~10–15× the tokens of single-agent chats (2 models; Anthropic multi-agent post). [Row 36]
- Result aggregation via a typed ResultEnvelope carrying provenance + confidence (3 models). [Row 39]
- CodeRabbit has a Claude Marketplace integration + multi-stage agentic pipeline (single source, but the agentic-CLI direction is verified via finding 31). [Row 44]
- "Every skill/subagent has a corresponding eval file; CI fails on eval regression" separates pro from hobby repos (3 models). [Row 45]
- Multi-runtime portability (same skills under Claude Code + Codex) is a distinct signal (2 models). [Row 48]
- Observability (Langfuse/Braintrust/Arize traces) signals production thinking (2 models). [Row 49]
- Companies value MCP/agents/evals/RAG for applied/FDE roles — product areas well-grounded (Anthropic Claude Code/MCP/Skills; OpenAI Agents SDK/Structured Outputs/Evals; Databricks MLflow/Mosaic AI; HF smolagents/Hub; Cohere Command/RAG/rerank/North; Mistral Agents API/La Plateforme). Exact current job-post language is UNCERTAIN per every model — do not quote a posting as requiring X. [Row 50]
- Agentic-AI hiring is booming enough that "Agentic AI" appears across many active postings (directional; the specific ">100 tracked" count is not independently confirmed — cite the trend, not the number). [Row 52]
- A "how it fails / threat model" section is a stronger signal than a demo video (3 models). [Row 54]
- Strongest single 2026 portfolio artifact: personal MCP server + Skills bundle + eval harness, deployed, CodeRabbit-reviewed, identical under Claude Code + Codex (3 models; community sentiment, self-flagged by Opus). [Row 55]

## Model-distinctive findings (architecturally attributed)

- Invariant Labs MCP prompt-injection notification, June 2025 (Opus; named primary-ish source invariantlabs.ai). Kept — consistent with the later, verified OX Security disclosure line of research. [Row 19]
- Cloudflare remote MCP hosting as a standard personal deployment target (Opus; Cloudflare docs). Kept as a concrete, plausible deployment path. [Row 23]
- `llm-consortium` (Simon Willison's `llm` CLI) as a reference personal-council implementation (Opus; llm.datasette.io). Kept — draws on Opus's grounding in the open-source LLM-tooling ecosystem. [Row 38]

## Open disagreements / flagged for judgment

- Root-manifest size: consensus ~150–200 lines vs Opus's "under ~500 lines / ~5k tokens" (row 5). Use the 150–200 band. Do not cite 500 as a target; it is a self-flagged minority outlier.

## Appendix: rejected / reclassified claims (audit trail)

| # | Item | Source | Classification / verdict | Rationale |
|---|---|---|---|---|
| 5 | Root budget "under ~500 lines / ~5k tokens" | OPUS (council) | CUT (as a usable number) — minority outlier | Contradicts the ~150–200 consensus and Opus's own self-flag; survives only as a noted minority position, not a citable target |
| 10 | Claude Code Pro window ~44k / Max20 ~220k tokens per 5-hr window | GEM (council) | CUT — single-source, unverified spec | One aggregator/YouTube source; precise changeable spec; high credibility cost if wrong in interview copy; not load-bearing for design |
| 11 | v2.1.100+ ~20k invisible tokens/request | GEM (council) | RESCUED → VERIFIED | Council flagged as fabrication risk; web-verified real via GitHub issue #46917 + HN + proxy-log analyses. Cite primary source, not the blog |
| 20 | OX Security MCP stdio RCE, April 2026 | GEM (council) | RESCUED → VERIFIED | Real; CVE-2026-30623; OX Security "Mother of All AI Supply Chains"; TheHackerNews 2026/04; CSA Labs |
| 21 | MCP → LF Agentic AI Foundation late 2025; 97M+ downloads | GEM + G4X (council) | RESCUED → VERIFIED | Real; AAIF announced 9 Dec 2025; "over 97 million monthly SDK downloads" per MCP blog |
| 43 | CodeRabbit agentic CLI (cr-***), March 2026 | GEM (council) | RESCUED → VERIFIED (date hedged) | CLI + agentic API key confirmed real; exact release month not independently pinned |
| 51 | FDE +729% YoY, $300–550K comp | GEM (council) | RESCUED → VERIFIED | "729% growth in FDE postings in the 12 months through April 2026" matches exactly; $300–550K band confirmed |
| 52 | "Agentic AI" in >100 tracked job postings | G4X (council) | SOFTENED → CORROBORATED (directional) | Hiring boom verified; specific count not independently confirmed. Cite trend, not the >100 figure |

**Meta-note for future dealbreaker runs:** the council's blanket "highest fabrication risk — do not repeat as fact" flag on Gemini/Grok-x-search dated claims was wrong for 5 of 6. Aggregator-sourced is not the same as false. When a claim is dated and specific, verify before cutting; a conservative flag is a prompt to check, not a verdict.
