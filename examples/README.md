# Examples — the method on public code

This is where the guardrails get tested against real, public code anyone can inspect.

The plan is to run the guarded pipeline (or individual guardrails) against real open-source
codebases, and commit the artifacts here: the agent prompts, the PRs produced, the guardrail-check
output, and any before/after measurements. Because the target repos are public, anyone can
reproduce, re-run, or dispute the result.

## What's here

- [x] **Reference pattern: a gated, agent-driven multi-repo delivery-prep workflow**
      ([`worked-example-multi-repo-bootstrap.md`](worked-example-multi-repo-bootstrap.md)). A reusable
      pattern for fanning out agents to draft delivery-prep across a large estate (tracker, dashboard,
      per-repo READMEs, standards/remediation package, design docs, first branches) while a human gates
      every irreversible or outward step. Maps onto the guardrails plus the finer mechanisms
      (staging, explicit-path commits, identity gate, internal/shareable scrub, de-AI-ification pass,
      read-only fences, single-source-of-truth, dry-run). This is the design of the method. Reproduced
      public runs are in Planned.
- [x] **Comparison: an agent-builder's own rules vs. the guardrails**
      ([`2026-06-14-codex-agentsmd/`](2026-06-14-codex-agentsmd/)). OpenAI Codex's `AGENTS.md` mapped
      row-by-row against the guardrails. The validation case: a team that *builds* coding agents
      independently drew the same invariant (#5), reasoning-kernel (#7), and bounded-change (#3)
      boundaries, stated in prose, not yet enforced as gates.

- [x] **The 100-PR study: what the risk surface actually looks like**
      ([`2026-06-14-calcom-corpus-study/`](2026-06-14-calcom-corpus-study/)). Classified 100 merged
      cal.com PRs: 57% change a single file (90% ≤5), and only ~6% touch a migration or CI/config. The
      irreversible-mistake surface is small and concentrated. That is the quantitative argument for
      *cheap* path-level gates. (Schema PRs were rare in the window, 1 of 100, so the bundling rate
      rests on n=1; stated as a single data point, not a trend.)

## Planned

- [ ] **A guarded change end-to-end.** Take a small `good first issue`, run it through the pipeline
      with worktree isolation and the 2-round cap, link the resulting PR.
- [ ] **The cost of a missing gate.** A deliberately ungated agent run vs. a gated one on the same
      task, showing what the gate caught.

Each reproduction lands as a dated subfolder with: the task, the prompts, the raw agent output, the
guardrail-check result, and a short write-up of what held and what didn't.

> Honesty note: where a reproduction shows the method *failing* or a guardrail being insufficient,
> that gets committed too. A safety framework that only ever reports success isn't one.
