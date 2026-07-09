#!/usr/bin/env bash
# claim-check self-test.
# Builds a throwaway git repo with known ground truth, runs claim-check against it,
# and prints the verdicts. This is the committed, reproducible evidence behind the
# claim that claim-check is verified on a controlled repo: run it yourself.
#
#   bash claim-check/selftest.sh      # needs node + git on PATH
#
# Ground truth built below, and the verdict each claim must get:
#   1 contains_commit  c2 (an ancestor of main)      -> PASS
#   2 merged           an unmerged feature branch    -> FAIL
#   3 path_exists      a file that exists at main     -> PASS
#   4 path_exists      a file that does not exist     -> FAIL
#   5 no_secrets_added a commit that added an AWS key -> FAIL
#   6 no_secrets_added a clean commit                 -> PASS
#   7 tests_pass       (not answerable from the repo) -> UNVERIFIABLE
# Expected summary: 3 PASS, 3 FAIL, 1 UNVERIFIABLE. Exit code 1.

set -u
here="$(cd "$(dirname "$0")" && pwd)"
cc="$here/claim-check.js"
d="$(mktemp -d)"
trap 'rm -rf "$d"' EXIT

git -C "$d" init -q -b main
git -C "$d" config user.email selftest@example.com
git -C "$d" config user.name selftest

mkdir -p "$d/packages/prisma"
printf 'model X {}\n' > "$d/packages/prisma/schema.prisma"
printf 'hello\n'     > "$d/foo.txt"
git -C "$d" add -A && git -C "$d" commit -qm c1

printf 'more\n' >> "$d/foo.txt"
git -C "$d" add -A && git -C "$d" commit -qm c2-clean
C2=$(git -C "$d" rev-parse HEAD)

printf 'const k = "AKIAIOSFODNN7EXAMPLE";\n' > "$d/config.js"
git -C "$d" add -A && git -C "$d" commit -qm c3-secret

git -C "$d" checkout -q -b feature "$C2"
printf 'x\n' > "$d/feature.txt"
git -C "$d" add -A && git -C "$d" commit -qm feat
FEAT=$(git -C "$d" rev-parse HEAD)
git -C "$d" checkout -q main
C3=$(git -C "$d" rev-parse HEAD)

cat > "$d/claims.yaml" <<EOF
- claim_type: contains_commit
  target: $C2
  base: main
- claim_type: merged
  target: $FEAT
  base: main
- claim_type: path_exists
  target: packages/prisma/schema.prisma
  ref: main
- claim_type: path_exists
  target: does/not/exist.txt
  ref: main
- claim_type: no_secrets_added
  target: $C3
- claim_type: no_secrets_added
  target: $C2
- claim_type: tests_pass
  target: the suite
EOF

echo "Expected: 1 PASS  2 FAIL  3 PASS  4 FAIL  5 FAIL  6 PASS  7 UNVERIFIABLE  (exit 1)"
echo
node "$cc" "$d/claims.yaml" --repo "$d" --base main
