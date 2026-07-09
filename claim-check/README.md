# claim-check

Verify an AI agent's **state claims** about a change against the actual repository, and flag the
ones that are confidently wrong.

When an agent finishes a task it tells you things: "merged into main", "created the config file",
"no secrets added", "tests pass". In high-stakes delivery the claim that hurts you is the load-bearing
one stated with full confidence and quietly false. It reads clean, so it survives review. This is
guardrails [#10 and #12](../GUARDRAILS.md) turned into code:

> **#10** A claim about state is a question for the system, not the model.
> **#12** Render status from data, not narration.

`claim-check` is that system. It takes the agent's claims as a list, asks **git** whether each one is
true, and prints `PASS` / `FAIL` / `UNVERIFIABLE`. It is a real program running git plumbing. There is
no model in the loop deciding the verdict, which is the whole point: the earlier "runnable" skill in
this repo was still a model narrating PASS/FAIL over a diff, and that is the hallucination
surface it was meant to close. This one is deterministic. Same repo state, same claims file, same
answer, every time.

## What it verifies

| claim_type | Fields | The question it asks git |
|---|---|---|
| `merged` | `target`, `base` | `git merge-base --is-ancestor <target> <base>`: is that commit reachable from base? |
| `contains_commit` | `target`, `base` | Same primitive, framed as "does base contain this commit". |
| `path_exists` | `target`, `ref` (default `HEAD`) | `git ls-tree --name-only <ref> -- <target>`: is the path in that tree? |
| `no_secrets_added` | `target` (a diff range or a commit) | `git diff <range>`, then scan the **added** lines for secret-shaped literals. |

`base` can be set per claim or once with `--base`. A `target` that git cannot resolve (an object you
never fetched, a bad ref) comes back `UNVERIFIABLE`, never `FAIL`. The honest answer to a commit you
can't see is "I don't know", and the tool holds that line.

## What it will not do

This is the part most tools skip, so it gets its own section.

- **It does not run your tests, build, or linter.** A `tests_pass`, `builds`, `deployed`, `reviewed`,
  or `works` claim comes back `UNVERIFIABLE` with a reason, because none of those are answerable from
  repo state alone. The tool refuses to pretend it checked something it didn't. Any claim_type it
  doesn't recognise is `UNVERIFIABLE` too.
- **`merged` reads FAIL for squash and rebase merges.** `--is-ancestor` asks whether that exact commit
  id is in base. A squashed or rebased branch lands under a *new* commit, so its original head is
  genuinely not an ancestor and the check says so. For those, verify by content or by path, not by the
  branch's commit id. The reason line says this on every `merged` FAIL so nobody misreads it. (This is
  why the demo's true case below pins the squash commit that actually lives on main, not the PR's head.)
- **`no_secrets_added` is a coarse net.** It catches private-key blocks, AWS / GitHub / Slack / Google /
  Stripe token shapes, and long values assigned to secret-ish names. It will miss a custom secret format
  and it can false-positive. Read a `PASS` as "nothing obvious was added". It is not a clean bill of
  health. For a real gate, layer a dedicated scanner (gitleaks, trufflehog) behind it.

The value is the honesty of that boundary. A verifier that fakes the checks it can't run is worse than
no verifier, because you trust it.

## Run it

```
node claim-check.js <claims.(json|yaml)> [--repo <dir>] [--base <ref>] [--json]
node claim-check.js -            # read claims from stdin
```

No dependencies. Node 14+ and git on PATH. Exit code is `1` if any claim FAILs, else `0`, so it drops
straight into a pre-PR hook or CI step. `UNVERIFIABLE` does not fail the run; it is a flag that a human
has to check that fact another way. `--json` emits the same result as structured data, so a dashboard
can render status from it instead of from prose (guardrail #12 applied to the tool's own output).

## Reproducible demo: catching a false "merged" claim on a public repo

The demo runs against [`calcom/cal.com`](https://github.com/calcom/cal.com) so anyone can reproduce or
dispute it. Two of the claims lean on immutable commits and one on a permanently-closed PR, so the
verdicts stay valid as `main` moves on.

```bash
# 1. Blobless clone: full commit graph (ancestry works), no file blobs.
git clone --filter=blob:none --no-checkout https://github.com/calcom/cal.com.git
cd cal.com

# 2. Fetch the head of PR #19464, which was CLOSED WITHOUT MERGING, into the
#    local object store so the tool can resolve it.
git fetch origin pull/19464/head

# 3. Verify the claims (claims file is in this repo).
node /path/to/claim-check/claim-check.js \
  /path/to/claim-check/examples/calcom-demo.yaml \
  --repo . --base origin/main
```

The claims file states five things an agent might report. One is false:

```yaml
# TRUE   the squash commit that landed PR #27588 lives on main
- { claim_type: contains_commit, target: 48cbb94af256fdef4cf5f88fc34b33e8789ae451, base: origin/main }
# FALSE  this is the head of PR #19464, which was closed WITHOUT merging
- { claim_type: merged,          target: 6feeb745688164564abba0007106cbe9da755df4, base: origin/main }
# TRUE   the Prisma schema is where it should be
- { claim_type: path_exists,     target: packages/prisma/schema.prisma, ref: origin/main }
# TRUE   PR #27588 added no secret-shaped literal
- { claim_type: no_secrets_added, target: 48cbb94af256fdef4cf5f88fc34b33e8789ae451 }
# UNVERIFIABLE, and the tool says so instead of guessing
- { claim_type: tests_pass,       target: the routing-forms suite }
```

Actual output (verbatim):

```
claim-check — 5 claim(s) against .../cal.com  (base: origin/main)

   1  PASS          contains_commit 48cbb94af2…
        48cbb94af2… is an ancestor of origin/main
   2  FAIL          merged 6feeb74568…
        6feeb74568… is not an ancestor of origin/main (a squash- or rebase-merged branch also reads FAIL here — verify those by content/path, not by this commit id)
   3  PASS          path_exists packages/prisma/schema.prisma
        "packages/prisma/schema.prisma" exists at origin/main
   4  PASS          no_secrets_added 48cbb94af2…
        no secret-shaped literals in added lines of 48cbb94af256fdef4cf5f88fc34b33e8789ae451
   5  UNVERIFIABLE  tests_pass the routing-forms suite
        this tool does not run tests

VERDICT: 3 PASS · 1 FAIL · 1 UNVERIFIABLE — HOLD (a claim is false)
```

Claim 2 is the one that matters. An agent that reported "PR #19464 is merged" would sound exactly as
confident as it did about the four true claims. git settles it in one call. PR #19464 is a real,
closed-unmerged cal.com PR ([`fix: Data migration on Postgres`](https://github.com/calcom/cal.com/pull/19464));
its head commit was never merged, so it is not an ancestor of `main`, so the claim is false.

### The secrets rule actually fires

Claim 4 passing on a clean PR does not prove the detector works, so here it is catching a planted key.
A four-line repo, an added AWS key, a claim that no secrets were added:

```
   1  FAIL          no_secrets_added 78459e4f0a…
        added secret-shaped literal — config.js:2 (aws-access-key-id)

VERDICT: 0 PASS · 1 FAIL · 0 UNVERIFIABLE — HOLD (a claim is false)
```

The same run left a nearby `"secret1"` test fixture alone. The generic rule needs a value of 16+
characters, which is what keeps short mock strings from tripping it while a real 20-character AWS key
gets caught.

## Claims input format

JSON is primary. A small YAML subset is accepted too: a list of maps with plain string values, which is
all a claims file needs. JSON equivalent of the demo:

```json
[
  { "claim_type": "contains_commit", "target": "48cbb94af256fdef4cf5f88fc34b33e8789ae451", "base": "origin/main" },
  { "claim_type": "merged", "target": "6feeb745688164564abba0007106cbe9da755df4", "base": "origin/main" },
  { "claim_type": "path_exists", "target": "packages/prisma/schema.prisma", "ref": "origin/main" },
  { "claim_type": "no_secrets_added", "target": "48cbb94af256fdef4cf5f88fc34b33e8789ae451" },
  { "claim_type": "tests_pass", "target": "the routing-forms suite" }
]
```

## Where this fits

Guardrails 1 through 9 bound what an agent may change. 10 through 13 bound what it may claim, and that
claims layer is the one most teams have no tool for. This is the tool. Point it at the facts a
decision hinges on before you act on the agent's summary of them.
