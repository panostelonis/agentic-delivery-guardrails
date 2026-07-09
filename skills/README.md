# Skills

Claude Code commands that check your changes against the guardrails, not just describe them.

Install: copy a file into `~/.claude/commands/` (global) or `.claude/commands/` (per-repo), then
invoke it as `/<name>` in Claude Code.

| Skill | What it does |
|---|---|
| [`guardrail-check.md`](guardrail-check.md) | Reviews the current diff against the repo's hard gates and flags any crossing before you open a PR |
| `review-changes.md` | *(coming)* A generic, ISO-25010-flavored change review you can tune to your codebase's rules |

These are deliberately generic. The value is the *shape* — a review that knows your hard gates and
refuses to wave through a schema change or a config edit. Fork and tune to your repo.
