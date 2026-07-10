# Relocation OS

A personal agentic operating system for planning an international relocation, built to run identically under Claude Code and Codex, with deterministic orchestration, tiered memory, and a CodeRabbit-reviewed software development lifecycle.

## What this is

Relocation OS turns a high-stakes life decision (relocating from Seattle to Spain) into an engineered system: a council of nine specialized research agents (six mission roles and three standing relocation-lifecycle roles), a locked-decision registry that prevents re-litigating settled questions, and a mission pattern that converts each trip or evaluation into a reproducible pipeline with auditable outputs.

It is also a working demonstration of production agentic-system patterns: context-budget engineering, multi-model verification, privacy quarantine, and deterministic harness design.

## Architecture at a glance

```
relocation-os/
├── CLAUDE.md            Harness contract for Claude Code sessions
├── AGENTS.md            Same contract for Codex sessions
├── ARCHITECTURE.md      System design and interconnects
├── memory/              Tiered memory (index-first, lazy loaded)
│   ├── MEMORY.md        Tier 1: index, always loaded
│   ├── *.md             Tier 2: loaded on demand by topic
│   └── private/         Personal data, gitignored, never committed
├── missions/            One folder per trip/evaluation, each a pipeline
├── council/             Mission + standing agent roles and coordination rules
├── evals/               Schemas, fixtures, and golden files for the CI eval gate
├── skills/              Reusable skills (populated from research phase)
├── knowledge/           Research reports, adjudicated findings, KB source
├── docs/                SDLC, architecture decision records
└── scripts/             Deterministic orchestration and validation
```

## Design principles

1. **Determinism first.** Orchestration lives in scripts and structured pipelines, not in model improvisation. Same inputs, same pipeline, same shape of output.
2. **Context economy.** Tier 1 memory is an index measured in hundreds of tokens. Everything else loads lazily by topic. Knowledge bases and MCP servers replace flat-file dumping.
3. **Locked decisions are locked.** Settled constraints live in a registry the harness must consult before acting. No agent re-litigates them.
4. **Privacy quarantine.** Personal data lives in `memory/private/`, which is gitignored. The repo demonstrates the system; it does not publish the life.
5. **Verified, not vibes.** Research flows through a multi-model council, then an adjudication pass that classifies every claim before it enters the knowledge base.
6. **Dual runtime.** CLAUDE.md and AGENTS.md carry the same contract so any Claude Code or Codex instance behaves identically here.

## System interconnects

| System | Location | Role |
|---|---|---|
| council-os | `~/Documents/council-os` | Multi-model research routing and evidence KB |
| career-ops | `~/Documents/career-ops` | Job-search state; relocation gates on a signed offer |
| voice-os | `~/Documents/voice-os` | Corpus-backed drafting for outward communications |
| second brain | career-ops corpus | Prior positions and research, queried not duplicated |

## Lifecycle

Every change follows the SDLC in [docs/SDLC.md](docs/SDLC.md): research → ADR → implement → CodeRabbit review → verify → merge. Research phases run through the council-of-models pipeline and land in `knowledge/research/` with per-claim attribution.

## Status

- [x] v0.1: harness, tiered memory, mission pattern, council roles, SDLC
- [x] eval harness: CI-enforced invariant gates on every PR (Module 2, ADR-0003)
- [ ] v0.2: skills and agent definitions informed by adjudicated community research
- [ ] v0.3: knowledge-base MCP for context reduction (relocation-kb server shipped, Module 3 / ADR-0005; second-brain + career-ops servers pending)
- [ ] v0.4: first mission executed end to end (2026 scouting trip)
- [ ] v1.0: sanitized public case study for portfolio
