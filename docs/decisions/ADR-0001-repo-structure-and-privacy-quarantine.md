# ADR-0001: Repo structure, dual-runtime contract, and privacy quarantine

Date: 2026-07-08
Status: Accepted

## Context

Relocation OS must (a) run identically under Claude Code and Codex, (b) hold deeply personal decision context (values-based eliminations, salary figures, identity details), and (c) eventually serve as a public portfolio artifact reviewed by CodeRabbit. Raw personal data and a public showcase cannot be the same artifact.

## Decision

1. **Private GitHub repo** with a gitignored `memory/private/` directory holding all personal context. Tracked memory files reference private files by path but never quote them.
2. **Canonical harness in CLAUDE.md, mirrored in AGENTS.md.** Divergence is a bug fixed in the same commit. This gives dual-runtime behavior without duplicating logic beyond a thin summary.
3. **Tiered memory:** index-first `memory/MEMORY.md` (Tier 1, always loaded, <400 tokens), topic files (Tier 2, lazy loaded), private tier (gitignored).
4. **Mission folders** as the unit of work, each with a deterministic `pipeline.md` and blocking gates.
5. **Portfolio output is a derived artifact:** a sanitized case study cut at v1.0, not the repo itself.

## Alternatives considered

- Public repo with encrypted private files: rejected; encryption in a public repo invites scrutiny of exactly the material being protected, and key handling adds failure modes.
- Two repos (public framework + private data): viable later; premature now. The gitignore quarantine gives the same boundary with less coordination overhead. Revisit at v1.0.
- Single CLAUDE.md symlinked to AGENTS.md: rejected; the runtimes benefit from slightly different framing, and symlinks behave inconsistently across tools.

## Consequences

- `scripts/privacy-check.sh` becomes load-bearing and must be maintained as private-memory content evolves.
- Contributors (including future Claude/Codex sessions) must read the harness contract before acting; the contract is the enforcement mechanism.
- The public case study requires a deliberate sanitization pass at v1.0 rather than being free.
