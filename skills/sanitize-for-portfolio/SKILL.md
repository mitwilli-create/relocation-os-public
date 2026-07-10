---
name: sanitize-for-portfolio
description: Build the public portfolio cut of this repo and prove it carries no private content. Use when producing or refreshing the public case-study repo, before pushing anything public, or to verify a proposed public cut against the full private marker list. Copies only tracked files (memory/private excluded by construction), stands the synthetic twin in for the private corpus, and runs the cut's own privacy gate against itself with the combined marker list (privacy patterns plus eliminated-location names). Refuses to pass on any marker hit or a missing marker source; it never pushes.
---

# sanitize-for-portfolio

Produce the public cut and verify it, deterministically. This is the enforcement tool for
Module 5 (ADR-0007). The build and the proof live in `scripts/sanitize-for-portfolio.mjs`;
this skill routes to it and relays the verdict. It never pushes anything: publishing is an
outward, human-driven step.

## Procedure

1. **Run the engine from the repo root:**

   ```sh
   node scripts/sanitize-for-portfolio.mjs          # build dist/public-cut/ and verify
   node scripts/sanitize-for-portfolio.mjs --json    # machine-readable result
   ```

   It enumerates tracked files (`git ls-files`), copies them into `dist/public-cut/`
   (gitignored) preserving the ADR-0006 skill symlinks, makes the cut a real git repo, then
   runs the cut's own `scripts/privacy-check.sh` against it with the full marker list.

2. **Read the verdict, not just the exit code.** On PASS the cut is clean against every
   marker. On FAIL the output names the offending pattern by number and the file by path
   (never the marker text), so it is safe to paste into a PR.

3. **Act on the exit code:**
   - `0` cut built and verified clean. Publishable. Next is the outward step below.
   - `1` cut built but a private marker leaked into a tracked file. DO NOT publish. Fix the
     leak in the source repo (the marker belongs only in gitignored `memory/private/`), then
     rebuild.
   - `2` usage, IO, or git error, or a missing marker source. A missing marker file is a
     hard refusal, not a skip: the scan is the whole point, so an unverified cut is never
     produced.

4. **Publishing is outward and human-driven.** On PASS, a person reviews `dist/public-cut/`
   and pushes it to a NEW public repo. The skill and script stop at the verified cut; they
   have no push path, by design.

## Rules

- The full marker list is the union of the privacy patterns and the eliminated-location
  names, both read from gitignored `memory/private/`. If either is absent the run refuses
  (exit 2); it does not fall back to a partial scan (ADR-0007 decision 6).
- Scope is tracked files only. `memory/private/` is excluded because it is never tracked,
  not because the script filters it; the script also asserts the cut contains no
  `memory/private/`. Do not add a step that copies untracked or private files into the cut.
- The synthetic twin at `memory/synthetic/` is the public stand-in for the private corpus.
  Keep it fictional; it is verified against the same full marker list as everything else.
- The combined marker file is sensitive and lives only in a temp path for the duration of
  the scan. Never write it into the repo or the cut, and never print marker content; report
  hits by number and path (the underlying gate already does this).
- No interactive prompts. The engine builds once, scans once, and exits.
