# Per-PR classification data

Full, auditable classification behind the 100-PR study in [`README.md`](./README.md). One row per
pull request, ordered by PR number (newest first). Every value is derived purely from the GitHub
file list of each merged PR — see the README for the exact API queries and method.

## Sample

- **Repository:** `calcom/cal.diy` (the repository formerly published as `calcom/cal.com`; GitHub
  redirects the old name and returns repository id `350360184`). The rename matters for
  reproducibility: the REST API 301-redirects `calcom/cal.com` and the Search API rejects the old
  name outright, so the queries below use the canonical `calcom/cal.diy`.
- **Sample definition:** the 100 most-recently-*created* merged PRs as of 2026-06-14, retrieved via
  the Search API (`is:pr is:merged`, `sort=created`, `order=desc`, first 100 results).
- **N = 100.** All 100 were confirmed merged (every item carried a non-null `pull_request.merged_at`).
- **PR number range:** #28625 – #29561.
- **Merge-date range:** 2026-03-28 to 2026-06-14.

## Column legend

| Column | Meaning |
|---|---|
| **PR#** | GitHub pull request number (`https://github.com/calcom/cal.diy/pull/<PR#>`) |
| **Files** | Number of changed files GitHub reports for the PR. `3000 (API cap)` means the PR exceeded the GitHub `/files` hard cap of 3000 — its true count is ≥3000. |
| **Migration?** | `yes` if any changed file is under `packages/prisma/migrations/**` or is a `schema.prisma` file |
| **Bundled?** | For migration PRs only: `yes` if the PR also changes at least one non-migration file (migration not isolated); `no (isolated)` if it contains only schema/migration files; `-` if not a migration PR |
| **CI/config?** | `yes` if any changed file is under `.github/workflows/**`, `.github/**` YAML, an `.env*` file, a `Dockerfile`/`docker-compose*`, `turbo.json`, or `vercel.json` |

## Table

| PR# | Files | Migration? | Bundled? | CI/config? |
|---|---|---|---|---|
| 29561 | 5 | no | - | no |
| 29556 | 1 | no | - | no |
| 29544 | 2 | no | - | no |
| 29538 | 1 | no | - | no |
| 29535 | 2 | no | - | no |
| 29521 | 1 | no | - | no |
| 29519 | 1 | no | - | no |
| 29517 | 1 | no | - | no |
| 29496 | 3 | no | - | no |
| 29478 | 1 | no | - | no |
| 29477 | 1 | no | - | no |
| 29468 | 1 | no | - | no |
| 29466 | 1 | no | - | no |
| 29458 | 1 | no | - | no |
| 29346 | 2 | no | - | no |
| 29292 | 1 | no | - | no |
| 29282 | 5 | no | - | no |
| 29260 | 18 | no | - | no |
| 29245 | 3 | no | - | no |
| 29236 | 2 | no | - | no |
| 29226 | 1 | no | - | no |
| 29046 | 2 | no | - | no |
| 29035 | 8 | no | - | no |
| 29034 | 4 | no | - | no |
| 29029 | 6 | no | - | no |
| 29028 | 1 | no | - | yes |
| 29022 | 15 | yes | yes | no |
| 29021 | 1 | no | - | no |
| 29020 | 1 | no | - | no |
| 29019 | 7 | no | - | no |
| 29017 | 1 | no | - | no |
| 29016 | 1 | no | - | no |
| 29015 | 1 | no | - | no |
| 29014 | 1 | no | - | no |
| 29013 | 1 | no | - | no |
| 29012 | 1 | no | - | no |
| 29011 | 1 | no | - | no |
| 29010 | 1 | no | - | no |
| 29007 | 1 | no | - | no |
| 29005 | 1 | no | - | no |
| 29000 | 1 | no | - | no |
| 28973 | 1 | no | - | no |
| 28966 | 1 | no | - | no |
| 28958 | 1 | no | - | no |
| 28954 | 4 | no | - | no |
| 28953 | 2 | no | - | no |
| 28952 | 5 | no | - | no |
| 28951 | 2 | no | - | no |
| 28944 | 3 | no | - | no |
| 28941 | 2 | no | - | no |
| 28937 | 1 | no | - | no |
| 28910 | 1 | no | - | no |
| 28907 | 1 | no | - | no |
| 28906 | 1 | no | - | no |
| 28905 | 1 | no | - | no |
| 28904 | 5 | no | - | no |
| 28903 | 3000 (API cap) | no | - | yes |
| 28901 | 1 | no | - | no |
| 28898 | 1 | no | - | no |
| 28897 | 1 | no | - | no |
| 28894 | 2 | no | - | no |
| 28893 | 5 | no | - | no |
| 28892 | 1 | no | - | no |
| 28891 | 1 | no | - | no |
| 28890 | 1 | no | - | no |
| 28889 | 12 | no | - | no |
| 28888 | 43 | no | - | no |
| 28877 | 2 | no | - | no |
| 28876 | 2 | no | - | no |
| 28875 | 1 | no | - | no |
| 28873 | 3 | no | - | no |
| 28872 | 3 | no | - | no |
| 28868 | 1 | no | - | no |
| 28850 | 3 | no | - | no |
| 28832 | 3 | no | - | no |
| 28827 | 1 | no | - | no |
| 28787 | 2 | no | - | no |
| 28783 | 2 | no | - | no |
| 28774 | 1 | no | - | yes |
| 28773 | 1 | no | - | no |
| 28769 | 1 | no | - | no |
| 28767 | 1 | no | - | no |
| 28765 | 2 | no | - | no |
| 28756 | 2 | no | - | no |
| 28753 | 1 | no | - | no |
| 28724 | 1 | no | - | no |
| 28721 | 1 | no | - | no |
| 28719 | 1 | no | - | no |
| 28704 | 2 | no | - | yes |
| 28703 | 13 | no | - | yes |
| 28701 | 6 | no | - | no |
| 28700 | 1 | no | - | no |
| 28682 | 2 | no | - | no |
| 28679 | 1 | no | - | no |
| 28672 | 1 | no | - | no |
| 28647 | 1 | no | - | no |
| 28631 | 2 | no | - | no |
| 28630 | 1 | no | - | no |
| 28626 | 1 | no | - | no |
| 28625 | 3 | no | - | no |

## The 1 migration PR, in detail

**PR #29022** — *cleanup(webhooks): remove instant meeting trigger support* — 15 changed files, of
which the schema-relevant ones are:

- `packages/prisma/migrations/20260430000000_drop_instant_meeting_webhook_trigger/migration.sql`
- `packages/prisma/schema.prisma`

The remaining 13 files are application and test code (webhook handlers, tRPC, UI, tests). This is the
single PR in the sample where guardrail #4 (schema stays in human hands) and the migration half of
the bundling question both apply. It is bundled, not isolated.

## The 5 CI/config PRs, in detail

| PR# | Files | CI/config files touched |
|---|---|---|
| 29028 | 1 | `apps/web/vercel.json` |
| 28903 | ≥3000 | `.env.example`, `.env.appStore.example`, ~35 `.github/workflows/*.yml`, `docker-compose.yml`, several `.env.example` under apps (large repo-wide change; file list truncated at the API cap) |
| 28774 | 1 | `.github/workflows/i18n.yml` |
| 28704 | 2 | `.github/workflows/i18n.yml` |
| 28703 | 13 | `.github/actions/devin-session/action.yml`, `.github/workflows/cubic-devin-review*.yml` (+ related) |

## Near-misses worth noting (correctly *not* counted as migrations)

Path-substring matching on "prisma" alone would over-count. These two PRs touch a path containing
"prisma" but are **not** schema changes, and the classifier correctly excludes them:

- **PR #29029** — touches `packages/prisma/package.json` (a package manifest, not a migration or
  `schema.prisma`).
- **PR #28903** — touches `.github/workflows/check-prisma-migrations.yml` and several
  `prisma-*.repository.ts` files, but no `migration.sql` and no `schema.prisma`. Counted as CI/config
  (it changes a workflow), not as a migration.
