# ADR-0004: Privacy pattern quarantine and the CI enforcement split

Date: 2026-07-08
Status: Accepted
Amends: ADR-0003 point 5

## Context

`scripts/privacy-check.sh` carried its sensitive-marker regex list as a plaintext array inside the tracked script. The list itself discloses the protected categories (eliminated-city markers, salary bands, personality and identity details), which defeats part of the quarantine the moment the repo becomes public per Module 5 of the build plan, and already discloses category specifics to anyone reading the private repo. A second pressure comes from CI: Module 2 (ADR-0003) shipped `.github/workflows/checks.yml`, whose `gates` job runs the privacy script on every PR and push, but a CI checkout must never contain the private list. The gate needs to protect its own configuration.

ADR-0003 point 5 decided the opposite of what this ADR needs: it kept the marker list single-sourced inside `scripts/privacy-check.sh` so the eval runner would not duplicate it. That call was correct for its purpose (the runner still must not re-implement the list) but it left the list in a tracked file. This ADR amends that point: the list moves out of the script into gitignored private memory, and the runner still delegates to the script rather than duplicating anything.

## Decision

1. **The pattern list moves to gitignored private memory:** `memory/private/privacy-patterns.txt`, one POSIX extended regex per line, comments and blank lines ignored, matched case-insensitively. It is covered by the existing `memory/private/` gitignore rule and inherits the quarantine contract: never quoted into tracked files, commit messages, or PR text.
2. **The script becomes two layers.** Layer 1, structural checks that need no private data: no tracked files under `memory/private/`, the `.gitignore` quarantine line still present, no tracked env files. Layer 2, the marker scan against the pattern file. When the pattern file is absent the scan is skipped with a loud NOTE and the exit code reflects structural results alone.
3. **Explicit CI split: CI enforces Layer 1 only.** The marker scan is local-only and runs wherever the pattern file exists (Mitchell's machines, pre-commit). The existing `gates` job in `.github/workflows/checks.yml` (ADR-0003) runs the same script unchanged and with no flags; this ADR adds no new workflow and does not alter that job. Behavior depends only on pattern-file presence, not on environment detection, so the script stays deterministic and standalone: in CI the file is absent and the scan self-skips, on Mitchell's machines it is present and the scan runs.
4. **Worktree and override resolution.** The script resolves the pattern file through `git rev-parse --git-common-dir`, so linked worktrees use the main checkout's copy. `PRIVACY_PATTERNS_FILE` overrides the path; Module 5's public-cut verification uses this to run the full private list against the sanitized artifact.
5. **Leak reports name patterns by number, never by content**, so gate output can be pasted into PRs or issues without re-leaking a marker.
6. **History caveat, accepted.** The old plaintext list remains in this private repo's git history. Acceptable because the Module 5 public artifact is a fresh cut with synthetic data (ADR-0001, build plan Module 5), not a de-privatized fork of this history. If that plan changes, a history rewrite becomes a prerequisite to going public.

## Alternatives considered

- **Hashed matching** (store salted hashes of markers, hash candidate content at scan time): rejected. Hashing only supports exact-string equality, and the markers are regexes precisely because sensitive values appear in many formats (the salary bands especially). Complexity up, coverage down.
- **Encrypted pattern file committed to the repo** (git-crypt or age): rejected for the reason ADR-0001 rejected encrypted private files, and CI decryption would place key material in the environment being excluded.
- **Generic-only checks everywhere, dropping the marker scan:** rejected. The specific markers are the layer with teeth, and Module 5 verification depends on running the full list against the public cut.
- **CI reading patterns from a GitHub Actions secret:** rejected. It copies the sensitive list into GitHub's secret store for near-zero benefit: structural checks plus CodeRabbit cover the CI side, and marker hits are caught locally before push. Revisit only if a contributor without local private memory ever gets push access.

## Consequences

- A machine without `memory/private/privacy-patterns.txt` restored gets a degraded, structural-only gate. The NOTE makes this visible on every run; restoring private memory now includes this file.
- CI green means structurally clean, not marker-clean. Marker cleanliness is asserted by the local run; PR verification evidence quotes the local PASS line, which includes the scanned-pattern count.
- The pattern file is load-bearing private state: extending `memory/private/` means extending the pattern file in the same change. This carries forward ADR-0001's maintenance consequence for the script.
- ADR-0003 point 5 is amended, not reversed: the marker list is no longer single-sourced in the tracked script, but its intent (the eval runner does not duplicate the list) holds. `scripts/run-evals.mjs` still delegates to `scripts/privacy-check.sh`, which is now the only reader of the gitignored pattern file.
- `docs/SDLC.md` gains the two-layer privacy-gate description; the CI-gate section added by Module 2 is unchanged and already documents that the `gates` job runs the script.
