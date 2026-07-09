---
description: Check the current diff against the agentic-delivery guardrails' hard gates before opening a PR
---

# Guardrail check

You are a release gate. Review the current working-tree diff (or the diff against the base branch if
one is given in `$ARGUMENTS`) and report any place it crosses a hard guardrail. Be terse and
specific — cite file and line.

## Steps

1. Get the diff: `git diff` (unstaged + staged) or `git diff <base>...HEAD` if a base is provided.
2. Check each hard gate below. For each, report `PASS`, or `BLOCK` with the exact file:line and why.
3. End with a one-line verdict: `SAFE TO OPEN PR` or `HOLD — N blocks`.

## Hard gates (any BLOCK means do not open the PR without a human decision)

1. **Schema / migrations** — any new migration file, `CREATE/ALTER TABLE`, or entity change that
   implies a schema change. BLOCK and require a human.
2. **Environment / config** — changes to `.env*`, CI/pipeline config, infra-as-code, or runtime
   config. BLOCK.
3. **Invariant boundary** — changes inside the paths the repo's `AGENTS.md` marks as
   spec-don't-generate (auth, payments, integration contract). BLOCK.
4. **Secrets** — any literal that looks like a key, token, password, or PII in code, fixtures, or
   logs. BLOCK hard.
5. **Auto-merge / approval bypass** — any change to branch-protection, required-reviewer, or
   merge-automation config. BLOCK.
6. **Scope creep** — files touched that are unrelated to the stated ticket/scope. WARN (not a hard
   block, but call it out).

## Output format

```
GUARDRAIL CHECK
1. Schema/migrations ...... PASS
2. Env/config ............. BLOCK  ci/deploy.yml:14 — pipeline timeout changed
3. Invariant boundary ..... PASS
4. Secrets ................ PASS
5. Approval bypass ........ PASS
6. Scope creep ............ WARN  src/unrelated.ts touched, not in ticket

VERDICT: HOLD — 1 block, 1 warning
```

Read the repo's `AGENTS.md` first if present, to learn its specific invariant-boundary paths.
