#!/usr/bin/env sh
#
# Self-check for .githooks/commit-msg.
# Run:  sh .githooks/commit-msg.test.sh
#
# expect: 0 = hook accepts, 1 = hook rejects.

set -u
hook="$(dirname "$0")/commit-msg"
tmp="$(mktemp)"
pass=0
fail=0

check() {
  expect="$1"
  msg="$2"
  printf '%s\n' "$msg" > "$tmp"
  if sh "$hook" "$tmp" >/dev/null 2>&1; then got=0; else got=1; fi
  if [ "$got" = "$expect" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAIL: expected accept=$expect, got=$got -> $msg"
  fi
}

# --- accepted ---
check 0 "feat: add login"
check 0 "fix(auth): handle expired token"
check 0 "feat(api)!: drop v1 endpoints"
check 0 "docs: update README"
check 0 "chore(deps): bump expo"
check 0 "refactor(chatbot/rag): split retrieve step"
check 0 "Merge branch 'main' into feature/x"
check 0 "Revert \"feat: add login\""
check 0 "fixup! feat: add login"
check 0 ""

# --- rejected ---
check 1 "add login"
check 1 "feat add login"
check 1 "feat: "
check 1 "feature: add login"
check 1 "feat(Scope): add login"
check 1 "fix: something wrong."
check 1 "feat(): empty scope"
check 1 "feat: $(printf 'x%.0s' $(seq 1 120))"

rm -f "$tmp"
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
