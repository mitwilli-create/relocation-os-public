# ADR-0007: Public cut and portfolio sanitization

Date: 2026-07-09
Status: Accepted

## Context

Module 5 ships the public showcase artifact: architecture public, data private. The
build plan (Row 53, verified) fixes the pattern as a synthetic-data twin, diagrams over
transcripts, public evals with a gitignored corpus, and one redacted sample. This ADR
locks the mechanism: where the public cut lives, how it is produced, and how we prove no
personal content reached it.

The failure mode this decision guards against is the worst one in the whole build: a fact
about Mitchell's life becomes publicly readable. That raises the bar above "looks clean."
The proof has to be mechanical and it has to run against the exact bytes that get
published.

Two facts constrain the design and were verified this session, not assumed:

1. **This repo is private** (`gh repo view`: `relocation-os`, PRIVATE). GitHub cannot
   expose one branch or one directory of a private repo publicly. To show any part of it
   you make the whole repo public, which publishes `main`'s entire commit history, PR
   bodies, and ADRs. Several of those reference private reasoning. So any "public branch"
   or "public/ directory" inside this repo is off the table by construction, not by
   preference.
2. **Git history is itself a leak vector.** Even if every current tracked file is clean,
   old commits, reverted content, and PR text are not. A published artifact that shares
   this repo's history inherits that exposure.

The privacy machinery this builds on already exists: `scripts/privacy-check.sh` (ADR-0004)
runs a structural layer (always) plus a marker scan that reads its regex list from a
gitignored file, and it already honors a `PRIVACY_PATTERNS_FILE` override. The skill
authoring pattern is locked in ADR-0006. This ADR composes both; it does not change them.

## Decision

1. **The public cut is a separate public GitHub repository, not a branch or directory of
   this private repo.** A purpose-built public repo starts with clean history, so a
   stranger who clones it gets only the synthetic showcase with zero archaeology. This is
   the only option that satisfies "learns the architecture and nothing about Mitchell's
   life" against the git-history vector, and it is effectively forced by fact 1 above.

2. **The cut is produced deterministically into a gitignored build directory.**
   `scripts/sanitize-for-portfolio.mjs` assembles the cut at `dist/public-cut/` (added to
   `.gitignore`). The source of truth is `git ls-files`: only tracked files are copied, so
   `memory/private/` is excluded by construction (it is gitignored, never tracked). The
   script is idempotent and standalone, per the determinism rules and the ADR-0006 script
   posture. It never hand-edits; the public repo is regenerated, never patched in place.

3. **A synthetic twin replaces the private corpus on the identical schema.** Fictional
   person, fictional constraints, same file shapes as `memory/private/`
   (`personal-context.md`, `eliminators.txt`, the scouting `mission-brief`). Because it is
   fictional it is safe to track in this repo, at `memory/synthetic/`. The cut ships
   `memory/synthetic/` as sample data and keeps `memory/private/` gitignored and absent, so
   the public repo demonstrates the real quarantine pattern rather than hiding it. To run
   the OS against the twin, a documented setup step copies `memory/synthetic/` into the
   gitignored `memory/private/` slot, mirroring how the real private corpus is restored on
   a working machine.

4. **Verification runs the FULL marker list against the exact published bytes.** The full
   list is the union of the two gitignored sources: the privacy patterns
   (`memory/private/privacy-patterns.txt`) and the eliminated-location names
   (`memory/private/eliminators.txt`), the latter converted to literal patterns. The script
   assembles this combined marker file in the OS temp directory (never inside the repo or
   the cut), points `PRIVACY_PATTERNS_FILE` at it, runs `scripts/privacy-check.sh` against
   `dist/public-cut/`, and deletes the temp file. Any marker hit is a non-zero exit and the
   build fails. The combined file is sensitive; it lives only in tmp and only for the
   duration of the scan.

5. **The skill follows ADR-0006 exactly.** Canonical `skills/sanitize-for-portfolio/SKILL.md`
   (frontmatter `name` + `description` only), two committed discovery symlinks
   (`.claude/skills/sanitize-for-portfolio`, `.agents/skills/sanitize-for-portfolio`, both
   to `../../skills/sanitize-for-portfolio`), deterministic logic in
   `scripts/sanitize-for-portfolio.mjs`, and a `scripts/skills-selftest.mjs` case wired into
   CI. The model selects the skill; the script enforces the gate.

6. **Enforcement is in code and fail-loud, never prose or `.gitignore` alone.** Consistent
   with ADR-0004 and ADR-0006: `.gitignore` is not a security boundary. If either marker
   source is missing (for example on a machine without private memory restored), the build
   refuses rather than silently producing an unverified cut. A missing marker source is a
   hard stop, not a skipped check, because here the scan is the entire point of the run.

## Alternatives considered

- **Orphan branch (for example `public-cut`) in this repo.** Rejected: you cannot publish
  one branch of a private repo without making the whole repo public, which exposes `main`'s
  history and PR text. Fact 1.
- **A tracked `public/` directory in this repo.** Rejected for the same reason: it lives
  inside the private repo and cannot be shown without exposing everything.
- **Scrub this repo's history with git filter-repo and push the result public.** Rejected
  as the primary mechanism: history rewriting is fragile (one missed ref or reflog entry
  leaks), and it produces a redacted private repo rather than a purpose-built showcase with
  a synthetic twin. A fresh-history public repo is both safer and a better portfolio object.
  Kept in reserve only as a forensic option if the synthetic approach ever proves
  insufficient.
- **Manual copy-and-redact into the public repo.** Rejected: non-deterministic,
  unauditable, and exactly the discipline-over-mechanism failure the eval harness exists to
  replace. The cut must be reproducible from a script and provable by the gate.
- **Ship the real `privacy-patterns.txt` in the public repo so its gate is runnable.**
  Rejected: that file IS the sensitive list; publishing it defeats its purpose. The public
  repo ships no real marker file; the marker scan self-skips there (correct, there is no
  private data to protect), and an optional synthetic marker file may demonstrate the
  format alongside the synthetic twin.
- **Council routing before this ADR.** Considered per the session handoff and declined:
  once fact 1 (private repo) collapsed the location decision to a single privacy-safe
  option, the remaining choices are mechanical and well-grounded in ADR-0004 and ADR-0006.
  The council is reserved for genuinely-open, high-stakes questions; this no longer is one.

## Consequences

- The repo gains `memory/synthetic/` (tracked, fictional), `skills/sanitize-for-portfolio/`
  plus its two symlinks, `scripts/sanitize-for-portfolio.mjs`, a `.gitignore` entry for
  `dist/`, and a `skills-selftest.mjs` case. Producing the public artifact is one script
  run.
- There are two repositories after this module: this private one (source of truth) and the
  public showcase (regenerated output). The public repo is never hand-edited; it is the
  script's product.
- The Module 5 DONE-WHEN gate ("privacy gate passes against the public cut with the full
  marker list") is literally the script's exit code, so it is CI-checkable and not a
  judgment call.
- Pushing the verified `dist/public-cut/` to the new public repo is an outward,
  Mitchell-driven step, handled with the same 5-W handoff as PR creation and merge.
- The portfolio page on storytellermitch.com links the public repo, not this one.
- Reviewers check the sanitize script for scope (does it copy only tracked files, does it
  scan the exact bytes, does it fail loud on a missing marker source), the same way ADR-0006
  makes reviewers check skill scripts for scope widening.
