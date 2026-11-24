#!/usr/bin/env bash
# Fails when this branch removes or rewrites lines in test files.
#
# Adding is fine: new test files, new tests, new checks in a test. Removing or
# changing a line of an existing test means a test was weakened or rewritten,
# which a reviewer should look at on purpose. CI runs this on every pull
# request as the `test-changes` job; it is informative, not a required check.
#
# Usage: scripts/check-test-changes.sh [base]   (default: origin/main)
set -euo pipefail

base="${1:-origin/main}"
test_files='(\.spec\.ts|\.int-spec\.ts|\.test\.tsx)$|^apps/frontend/e2e/'

changed=()
# --no-renames: a renamed or moved test shows up as removed + added, so it's flagged too.
while IFS=$'\t' read -r added deleted file; do
  [[ "$file" =~ $test_files ]] || continue
  if [[ "$deleted" != "0" ]]; then
    changed+=("$file")
    echo "::error file=$file::Existing test lines removed or rewritten (+$added -$deleted)"
  fi
done < <(git diff --numstat --no-renames "$base...HEAD")

if [[ ${#changed[@]} -eq 0 ]]; then
  echo "OK: test files only gained lines compared with $base."
  exit 0
fi

echo
echo "These test files lost or changed lines compared with $base:"
printf '  %s\n' "${changed[@]}"
echo
echo "If the change is intended, explain why in the pull request."
echo
git --no-pager diff --no-renames "$base...HEAD" -- "${changed[@]}"
exit 1
