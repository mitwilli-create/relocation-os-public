# Architecture

## The problem this system solves

Relocation decisions sprawl: flights, visas, taxes, neighborhoods, seasonal timing, values constraints, and a job search all interact. Chat sessions lose state, re-argue settled questions, and dump full context into every prompt. Relocation OS fixes this with four mechanisms.

## 1. Tiered memory (context economy)

- **Tier 1** (`memory/MEMORY.md`): an index, always loaded, target under 400 tokens.
- **Tier 2** (`memory/*.md`): topic files loaded only on match. A flight-booking task never loads visa-tax memory.
- **Private tier** (`memory/private/`): personal context, gitignored, loaded for personalization, never emitted into tracked artifacts.
- Facts carry last-confirmed dates; anything over 90 days old gets re-verified before action.

The `relocation-kb` MCP server (Module 3, ADR-0005) exposes `knowledge/` and tracked `memory/` as read-only, scoped tools (`search_claims`, `read_claim`, `list_topics`), so sessions retrieve claims through tool calls instead of reading whole files. It never exposes `memory/private/`. Second-brain and career-ops servers clone the pattern later, each with its own scope.

## 2. Locked-decision registry (determinism of intent)

`memory/constraints.md` is a table of decisions with classes (hard eliminator, soft preference, blocking prerequisite, hard gate). The harness contract requires consulting it before planning work and surfacing conflicts rather than resolving them silently. This is what stops agent drift from re-litigating values calls.

## 3. Mission pipelines (determinism of execution)

Each mission folder contains a `pipeline.md`: ordered steps, an owner per step, blocking gates, and fixed output schemas. Gate 0 of the current mission (the 10-day math) blocks all downstream sections by construction, not by hoping the model remembers.

## 4. Council + adjudication (verified research)

Research questions fan out to a multi-model council (7 premium models via council-os), then pass through a dealbreaker adjudication that classifies each claim: verified (3+ models), corroborated (2), unique, contradicted, or stale. Only surviving claims graduate into `memory/` or the KB. Raw reports stay in `knowledge/research/` for audit.

## Interconnects

- **career-ops** owns the job-search state. Relocation OS reads its gate (signed offer with work-from-abroad) and never duplicates its data.
- **voice-os** drafts any outward communication (emails to landlords, gestorías, visa lawyers) in Mitchell's calibrated voice.
- **council-os** provides the model-routing knowledge base the researcher agent reads to pick lineups.
- **second brain** (career-ops corpus) is queried for prior positions before generating anything original.
- **Portfolio** consumes a sanitized case study cut from this repo at v1.0, never the raw repo.

## Dual-runtime contract

CLAUDE.md (canonical) and AGENTS.md (mirror) carry the same rules so Claude Code and Codex sessions are interchangeable. Divergence is treated as a bug and fixed in the same commit.

## SDLC

Branch + PR, CodeRabbit auto-review on every PR, ADRs in `docs/decisions/` for non-trivial changes, `scripts/privacy-check.sh` as a pre-commit guard that fails if private-memory markers appear in tracked files. Details in [docs/SDLC.md](docs/SDLC.md).
