# What the AI-delivery risk surface actually looks like across 100 merged PRs

*A 100-PR study. A single guardrail-check watches one gate fire on one real PR. This asks how often the gate would fire at
all, by classifying 100 consecutive merged PRs from a real, recognizable codebase against the
guardrail-relevant signals and reporting the aggregate numbers.*

This is observational. Nothing here is a criticism. Every PR in the sample was written, reviewed, and merged by
the cal.com team and is, as far as this study is concerned, a perfectly good change. Bundling a
migration with the application code that uses it is a normal, common practice across the whole
industry. The point is to find out *where* a guarded AI-delivery pipeline would actually insert a
human gate in a stream of real changes, and how busy that gate would be.

---

## 1. The question, and why it matters

If you let agents contribute code, you need to know which of the guardrails earns its keep and which
is just overhead. "Schema changes stay in human hands" sounds important, but if 40% of your PRs touch a
migration, that gate is a constant tax, and if 1% do, it is a rare, cheap, high-value tripwire. The
honest answer is a number, and the number is codebase-specific. Nobody, as far as I can find, has
published it for a well-known production codebase.

So: over a defined window of real merged PRs, **how often does each guardrail-relevant signal
actually occur?** Specifically:

- How many PRs touch a **database migration or `schema.prisma`** (guardrail #4)?
- When a PR *does* touch a migration, is it **isolated**, or **bundled** with application/test code?
  (This is the headline: it is the difference between a clean two-minute human review of a migration
  and a 15-file review where the risky part is buried.)
- How many PRs touch **CI / config / environment** files (guardrail #2/#6)?
- What does the **file-count distribution** look like, overall and for schema PRs specifically?

## 2. Method (reproducible)

**Subject.** [`calcom/cal.com`](https://github.com/calcom/cal.com), an open-source scheduling
platform (Next.js, Prisma, Turborepo monorepo, tens of thousands of stars), self-hosted in
production by many teams. One reproducibility note up front: the repository has since been **renamed
to `calcom/cal.diy`** (repository id `350360184`). The old name 301-redirects on the REST API and is
rejected by the Search API, so the canonical name `calcom/cal.diy` is used in every query below. It
is the same repository.

**Sample.** The **100 most-recently-created merged PRs** as of **2026-06-14**, via the GitHub Search
API:

```
GET https://api.github.com/search/issues
    ?q=repo:calcom/cal.diy+is:pr+is:merged
    &sort=created&order=desc&per_page=100&page=1
```

All 100 results carried a non-null `merged_at` (every one is genuinely merged). They span
**PR #28625 – #29561**, merged **2026-03-28 to 2026-06-14**. **N = 100.**

**Per-PR data.** For each PR, the changed-file list:

```
GET https://api.github.com/repos/calcom/cal.diy/pulls/{number}/files?per_page=100&page=N
```

**Classification** (purely from file paths, no diff content):

- *Migration?* Any file under `packages/prisma/migrations/**` or any `schema.prisma`.
- *Bundled?* A migration PR that also changes at least one non-migration file.
- *CI/config?* Any file under `.github/workflows/**`, `.github/**` YAML, `.env*`, a
  `Dockerfile`/`docker-compose*`, `turbo.json`, or `vercel.json`.
- *File count*: the number of files GitHub reports (capped by GitHub at 3000; see limitations).

The full per-PR table is in [`data.md`](./data.md) for independent audit.

## 3. Findings

> ### Headline
> **In this sample of 100 merged PRs, exactly 1 touched a database migration / `schema.prisma`, and
> that 1 was bundled with application and test code (15 files total). Zero schema PRs in
> the window were schema-only.**
>
> So the schema gate would have fired **once in 100**, a rare event. On the one occasion it
> fired, the change it guards was already mixed in with 13 other files. The gate is cheap to run and
> almost never interrupts anyone. When it *does*, it points at exactly the situation it exists
> for: the highest-blast-radius change in the batch, bundled rather than isolated for review.

### Results table

| Signal | Count / 100 | % of sample |
|---|---|---|
| Touches a migration or `schema.prisma` | **1** | **1.0%** |
| Of those, **bundled** with non-migration files | 1 | 100% of migration PRs |
| Of those, **schema-isolated** | 0 | 0% of migration PRs |
| Touches CI / config / env | 5 | 5.0% |
| **Neither** migration nor CI/config | 94 | 94.0% |

### File-count distribution (all 100 PRs)

| Statistic | Value |
|---|---|
| Min | 1 file |
| 25th percentile | 1 file |
| **Median** | **1 file** |
| 75th percentile | 3 files |
| 90th percentile | 6 files |
| 95th percentile | 13 files |
| Max | ≥3000 (one PR, #28903, hit the GitHub `/files` cap) |
| Mean | 32.8 (see note) |

| Files per PR | # of PRs |
|---|---|
| 1 | 57 |
| 2–5 | 33 |
| 6–10 | 4 |
| 11–25 | 4 |
| 26–100 | 1 |
| >100 | 1 |

**The mean (32.8) is a trap; ignore it.** It is dragged up almost entirely by a single repo-wide PR
(#28903) that hit the 3000-file API cap. The *typical* PR is tiny: **57 of 100 change exactly one
file, and 90 of 100 change five files or fewer.** That is a small-PR culture, and it is consistent
with cal.com's own `AGENTS.md`, which instructs contributors to "keep PRs under 10 code files" and to
"separate database/schema changes, backend logic, and frontend UI into different PRs." The one
migration PR in the sample (15 files) is, by that team's own written rule, exactly the kind of change
they would prefer to see split.

### The single migration PR

[PR #29022](https://github.com/calcom/cal.diy/pull/29022), *cleanup(webhooks): remove instant
meeting trigger support*, changed 15 files, including
`packages/prisma/migrations/20260430000000_drop_instant_meeting_webhook_trigger/migration.sql` and
`packages/prisma/schema.prisma`, plus 13 application/test files. It was bundled. This is the
one PR in 100 where the schema gate applies, and it is the same shape the companion single-PR study
examined in detail: a real, healthy change whose riskiest component is not separated for review.

## 4. Honest limitations

- **This is one window of one repo.** N = 100, a ~2.5-month slice (2026-03-28 to 2026-06-14). It says
  what this sample looked like; it does **not** say "cal.com always does this," and it certainly does
  not generalize to other codebases. A migration-heavy quarter, or a different project, would produce
  very different ratios. The right reading is "schema PRs were rare *in this window*," not "cal.com
  rarely changes its schema."
- **Sampling is by creation date rather than merge date.** The Search API sorts by `created`. The set is the
  100 newest-created merged PRs, which is a clean, reproducible definition but not identical to "the
  100 most-recently-merged."
- **File-path classification is blunt by design.** It sees *that* a file under
  `packages/prisma/migrations/**` changed; it cannot see *what* the migration does, whether an
  `ALTER TYPE … ADD VALUE` is transaction-safe, whether a new column needs a backfill, or whether
  there is a tested rollback. Those are exactly the judgments the guardrail routes to a human. The
  count tells you how *often* a human is needed. It does not tell you what they should conclude.
- **The GitHub `/files` endpoint caps at 3000 files.** One PR (#28903) exceeded it; its true file
  count is ≥3000 and its full file list is truncated. This affects only the max/mean of the
  distribution (already flagged as unreliable) and does not change the migration or CI tallies. That
  PR touches CI/`.env` files, which are visible within the first 3000, and touches no migration.
- **"Bundled" is computed only where a migration exists.** With a single migration PR in the sample,
  the bundling rate (100%) rests on n=1. It is a real, verified data point, though still just one
  point, and the README says so rather than dressing it up as a trend.

## 5. A concrete contribution candidate (offered as a draft, not a bug report)

cal.com already runs a Prisma CI job,
[`.github/workflows/check-prisma-migrations.yml`](https://github.com/calcom/cal.diy/blob/main/.github/workflows/check-prisma-migrations.yml),
but it checks one thing: that the migrations *match the schema* (drift detection via
`prisma migrate diff`). It does **not** flag the situation this study measured: a migration arriving
**bundled** with application code, which is the moment a guarded pipeline wants a human to own the
merge.

Here is a small, additive job that mechanizes the boundary cal.com's own `AGENTS.md` already
states ("ask first" on `schema.prisma`; "separate database/schema changes ... into different PRs"). It
does not block, rename, or duplicate the existing drift check. It labels the PR and posts a
checklist so the migration gets a deliberate human read:

```yaml
# .github/workflows/flag-bundled-migrations.yml
name: Flag bundled migrations for human review
on:
  pull_request:
    paths:
      - "packages/prisma/migrations/**"
      - "packages/prisma/schema.prisma"

permissions:
  pull-requests: write   # to label + comment; never to merge

jobs:
  flag:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect bundling
        id: detect
        run: |
          base="${{ github.event.pull_request.base.sha }}"
          head="${{ github.event.pull_request.head.sha }}"
          changed=$(git diff --name-only "$base" "$head")
          migration=$(echo "$changed" | grep -E '^packages/prisma/(migrations/|schema\.prisma)' || true)
          other=$(echo "$changed" | grep -vE '^packages/prisma/(migrations/|schema\.prisma)' || true)
          if [ -n "$migration" ] && [ -n "$other" ]; then
            echo "bundled=true" >> "$GITHUB_OUTPUT"
          else
            echo "bundled=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Label + checklist
        if: steps.detect.outputs.bundled == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.addLabels({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
              labels: ['schema-change: human-review']
            });
            await github.rest.issues.createComment({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
              body: [
                'This PR changes a Prisma migration **and** application code in the same change set.',
                'Per `AGENTS.md` ("separate database/schema changes into different PRs"), a maintainer',
                'should confirm the migration is reviewed on its own terms before merge:',
                '',
                '- [ ] Migration is forward-only **or** has a tested rollback',
                '- [ ] Any new column has a considered default / backfill plan',
                '- [ ] `ALTER TYPE ... ADD VALUE` (if present) is safe inside the deploy transaction',
                '- [ ] Could this migration ship as its own PR ahead of the app code?',
                '',
                '_Automated note — does not block merge; a human owns the decision._'
              ].join('\n')
            });
```

This is offered as a draft contribution. It shows what cal.com's *existing* "ask first"
rule would look like wired in front of agent contributions: a tripwire that, on the evidence of this
study, would fire roughly **once every hundred PRs** and do nothing the other 99 times. Cheap to run,
rare to trigger, and it points at exactly the change you most want a person to read.

## 6. What this means for you

For your own adoption, gating schema changes is a given. The open question is how often that gate
will interrupt you. Run the same classification on your last hundred merged PRs.
If the answer looks like this sample (schema PRs rare, and bundled when they occur), a path-level gate
on your migrations directory is nearly free: it sits quiet almost all the time and earns its entire
keep on the rare PR where the highest-blast-radius change is mixed into a larger diff.

The classification here is mechanical and re-runnable. The guardrails it tests against are in
[`GUARDRAILS.md`](../../GUARDRAILS.md); the per-PR rubric is
[`skills/guardrail-check.md`](../../skills/guardrail-check.md). Point them at your own repo and see
what your real risk surface looks like. Then you will know which gates to wire and how busy they
will be.
