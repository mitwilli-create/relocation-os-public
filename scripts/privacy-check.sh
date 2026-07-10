#!/usr/bin/env bash
# Privacy gate with two layers (see docs/decisions/ADR-0004):
#
#   1. Structural checks. Always run, need no private data, safe for CI:
#      the memory/private/ quarantine holds and no env files are tracked.
#   2. Marker scan. Runs only where the gitignored pattern file exists
#      (Mitchell's machines): no tracked file may match any private pattern.
#
# The pattern list lives OUTSIDE this script, in gitignored private memory,
# because the list itself discloses exactly what it protects. Pattern file
# format: one POSIX extended regex per line, matched case-insensitively;
# blank lines and lines starting with # are ignored.
#
# Idempotent, standalone. Run from anywhere; operates on the repo containing
# this script. Override the pattern file location with PRIVACY_PATTERNS_FILE
# (used by the Module 5 public-cut verification).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

fail=0

# Layer 1: structural checks (CI enforces these).

if git ls-files | grep -q '^memory/private/'; then
  echo "PRIVACY FAIL: memory/private/ contains tracked files."
  fail=1
fi

if ! grep -qx 'memory/private/' .gitignore; then
  echo "PRIVACY FAIL: .gitignore no longer quarantines memory/private/."
  fail=1
fi

if git ls-files | grep -qE '(^|/)\.env(\.|$)'; then
  echo "PRIVACY FAIL: env file(s) tracked."
  fail=1
fi

# Layer 2: marker scan (local machines only; CI has no pattern file).
# Resolve through git-common-dir so linked worktrees find the main
# checkout's copy of the gitignored pattern file.
MAIN_CHECKOUT="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
PATTERN_FILE="${PRIVACY_PATTERNS_FILE:-$MAIN_CHECKOUT/memory/private/privacy-patterns.txt}"

scanned=0
if [[ -f "$PATTERN_FILE" ]]; then
  patterns="$(grep -vE '^[[:space:]]*(#|$)' "$PATTERN_FILE" || true)"
  if [[ -z "$patterns" ]]; then
    echo "PRIVACY FAIL: pattern file has no patterns: $PATTERN_FILE"
    fail=1
  else
    # Report hits by pattern NUMBER, never by content, so gate output can be
    # pasted into PRs or issues without re-leaking the marker.
    while IFS= read -r pattern; do
      scanned=$((scanned + 1))
      # git grep exits 0 = match, 1 = no match, >1 = error (e.g. malformed
      # regex). Suppress stderr so a bad pattern never echoes its own text,
      # but treat exit >1 as a hard failure: a silently broken pattern would
      # report zero hits and quietly defeat the gate.
      set +e
      hits="$(git grep -lIiE "$pattern" -- . 2>/dev/null)"
      grep_status=$?
      set -e
      if [[ $grep_status -gt 1 ]]; then
        echo "PRIVACY FAIL: marker pattern #$scanned failed to run (malformed regex in pattern file; git grep exit $grep_status)."
        fail=1
      elif [[ -n "$hits" ]]; then
        echo "PRIVACY FAIL: private pattern #$scanned (the ${scanned}th non-comment line of the pattern file) found in tracked file(s):"
        echo "$hits" | sed 's/^/  - /'
        fail=1
      fi
    done <<<"$patterns"
  fi
else
  echo "privacy-check: NOTE marker scan skipped, no pattern file at $PATTERN_FILE (expected in CI; on a local machine this means private memory is not restored)."
fi

if [[ $fail -eq 0 ]]; then
  tracked_count="$(git ls-files | wc -l | tr -d ' ')"
  echo "privacy-check: PASS (structural checks OK; $scanned marker pattern(s) scanned across $tracked_count tracked files)"
fi
exit $fail
