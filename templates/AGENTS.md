# AGENTS.md — template

> Drop this at the root of a repo to tell AI coding assistants how to work in it safely.
> Replace the bracketed parts. Keep it short enough that an agent actually reads it. If it grows
> past two screens, it's a design doc rather than an operating contract.

## What this codebase is

- **Purpose:** [one line: what the system does and who depends on it]
- **Stack:** [languages / frameworks / runtimes]
- **Shape:** [monolith / monorepo with N packages / microservices, and where the package boundaries are]
- **Risk profile:** [regulated? handles money/PII? customer-facing? what does "wrong" cost?]

## Hard rules (do not cross; these are gates, not preferences)

1. **Never auto-merge.** Open a PR; a human approves.
2. **No database migrations / schema changes.** Flag them for a human; never write them.
3. **No environment or config changes** (`.env`, CI config, infra). Propose in the PR description instead.
4. **Don't write code in [the invariant boundary, e.g. the integration contract, the auth layer,
   the payments path].** Specify against it; a human implements it.
5. **No secrets in code, logs, or test fixtures.** [link to secret-handling doc]
6. **Stop after 2 self-correction rounds** and escalate with a summary of what's blocking you.

## Conventions

- **File layout:** [where things live: `src/`, `packages/*/src`, naming patterns]
- **Tests:** [how to run them; what must pass before a PR]
- **Lint/format:** [the command; agents must run it before opening a PR]
- **Commit/PR format:** [message convention, PR template link, ticket-ID requirement]

## How to navigate [N] packages

[For a monorepo: a short map. e.g.]
- `packages/ui`: shared component library. Changes here ripple to all apps; bump version + note consumers.
- `packages/app-*`: the deployable apps. Channel/branch differences: [if the same app ships
  different code per channel/branch, say so explicitly. This is where agents get it wrong].
- `packages/core`: core logic. [invariants live here; see hard rule #4].

## Good vs. bad prompts (calibrate the human, too)

- **Good:** "Implement ticket AB-1234 in `packages/app-x`. The flow is [link]. Don't touch the
  core; if you need a core change, describe it and stop."
- **Bad:** "Make the search work." (No scope, no boundary, no acceptance criteria. This is how you
  get a confident wrong answer.)

## Security

- [domain-specific: no PINs/tokens/PII in logs; how auth works; what's out of bounds]

---
*Guardrails reference: https://github.com/[you]/agentic-delivery-guardrails*
