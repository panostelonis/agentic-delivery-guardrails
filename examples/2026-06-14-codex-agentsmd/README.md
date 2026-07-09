# Reading OpenAI Codex's own `AGENTS.md` against the guardrails

*Taking a real, recognizable project's AI-contributor guidance and laying it next to the guardrails and the `AGENTS.md` template in this repo, to show how much a thoughtful team already
writes down on its own, and where a written rule could become a mechanized gate.*

This is a comparison. It isn't an audit or a critique, and nobody's PR is on trial here. A serious
engineering team, writing operating guidance for AI contributors with no knowledge of this
checklist, independently lands on several of the same boundaries the guardrails draw. That
convergence is the evidence. Where their prose states a rule that a machine could enforce but
doesn't yet, I note it as an opportunity: the gap between a written "please don't" and an actual
stop. It's never a failing.

---

## 1. The target and why this one is worth studying

[`openai/codex`](https://github.com/openai/codex) is the open-source repo behind OpenAI's Codex
CLI, an agentic coding tool. Its root [`AGENTS.md`](https://github.com/openai/codex/blob/main/AGENTS.md)
is a long, lived-in operating contract for AI contributors working in a large Rust workspace
(`codex-rs`) plus an app-server protocol and some Python. It is a fair and interesting subject for
three reasons.

First, recognizability and stakes: it's a widely used tool with a large, active codebase, and the
guidance is clearly battle-worn rather than aspirational. It cites specific files, specific lint
rules, and specific failure modes the maintainers have actually hit.

Second, the resonance: this is the AI-contributor guidance *of an agentic coding tool*. If anyone
has thought hard about how a fast, low-context contributor goes wrong in a codebase, it's the team
shipping one. So the overlaps below aren't stylistic coincidence. Both documents reason from the
same problem (a capable contributor who doesn't hold the whole system in its head) toward the same
boundaries.

Third, it exercises a genuinely *different* part of the guardrails. Codex's
`AGENTS.md` is convention-dense and invariant-aware rather than schema-heavy, so it exercises the
guardrails that are about reasoning boundaries and bounded change (#3, #5, #7) rather than the
database gate (#4). It's the cleanest available stage for guardrail **#5 (invariant boundary)** and
guardrail **#8 (phased, calibrated trust)**.

## 2. The method (reproducible)

I fetched the raw file from GitHub and read it in full, then walked each of the guardrails
([`GUARDRAILS.md`](../../GUARDRAILS.md)) against it, recording for each: *does their guidance
address this boundary, in their own words?* and *is the rule stated, or actually enforced by a
mechanism?*

- **File:** `AGENTS.md` (repo root), at <https://github.com/openai/codex/blob/main/AGENTS.md>
- **Permalink (pinned to the commit current at the time of writing):**
  <https://github.com/openai/codex/blob/bacfc5e4c097894c927b5451d085fe7e489f8510/AGENTS.md>
- **Commit:** `bacfc5e4c097894c927b5451d085fe7e489f8510`, dated 2026-06-13.
- **Scope:** the root `AGENTS.md` only (the repo also has per-crate guidance; this comparison stays
  with the top-level contract, which is what the template most directly maps to).

Every quote below is copied verbatim from that file at that commit. To reproduce, fetch the raw
file and read it against the comparison table.

## 3. The guardrail-by-guardrail comparison

| # | Guardrail | Addressed in Codex's `AGENTS.md`? | Quote | Stated vs. enforced |
|---|---|---|---|---|
| 1 | No auto-merge. A human approves every change | **Not stated in this file.** The PR/review workflow lives outside `AGENTS.md` (GitHub branch protection, CI). | (none) | Almost certainly enforced *by the platform* (GitHub review + CI), just not in this document. The file is about conventions; merge policy lives elsewhere. |
| 2 | Isolate every agent run (sandbox / worktree) | **Yes, and it's load-bearing.** The file is written *assuming* a sandbox and tells contributors how to behave inside it. | *"You operate in a sandbox where `CODEX_SANDBOX_NETWORK_DISABLED=1` will be set whenever you use the `shell` tool… checks for `CODEX_SANDBOX=seatbelt` are also often used to early exit out of tests…"* | **Enforced.** The sandbox is real (Seatbelt / env flags). The doc teaches the contributor to live within an isolation that already exists. |
| 3 | Cap the self-correction loop; an unbounded task is the real problem | **Yes, in spirit,** via an explicit change-size cap and a "split it" instruction, which targets the same root cause (an over-large, underspecified unit of work). | *"Unless the change is mechanical the total number of changed lines should not exceed 800 lines. For complex logic changes the size should be under 500 lines… explore whether it can be split into reviewable stages…"* | **Stated**, with a code-review rule behind it. Not a loop counter, but a bounded-work rule that addresses the same failure (a contributor spiralling on too big a task). A natural place for a mechanized line-count check. |
| 4 | Schema / migrations stay in human hands | **Adjacent** (this isn't a migration-heavy app). The file does gate build-time file reads and config-schema regeneration. | *"If you add `include_str!`, `include_bytes!`, `sqlx::migrate!`, or similar build-time file or directory reads, update the crate's `BUILD.bazel`…"* and *"If you change `ConfigToml`… run `just write-config-schema`…"* | **Stated** as a "you must regenerate" obligation. There's a `sqlx::migrate!` mention, but no human-only gate on migrations because migrations aren't the risk surface here. |
| 5 | Don't generate code across the invariant boundary — spec against it | **Yes, this is the standout overlap.** The file names a hard, do-not-touch boundary in almost exactly the guardrail's language. | *"Never add or modify any code related to `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR` or `CODEX_SANDBOX_ENV_VAR`."* Also: *"resist adding code to codex-core!"* and *"Keep crate API surfaces as small as possible."* | **Stated as an absolute** ("Never"). This is a textbook invariant boundary. The sandbox-control code is exactly the layer where being wrong is silent and expensive. It's a written hard rule today; it is a prime candidate for a path/symbol gate (see synthesis). |
| 6 | No environment or config changes (agents propose, humans apply) | **Partially: config changes are *coupled to obligations* rather than forbidden.** | *"If you change Rust dependencies (`Cargo.toml` or `Cargo.lock`), run `just bazel-lock-update`… include that lockfile update in the same change."* and *"run `just bazel-lock-check`… so lockfile drift is caught locally before CI."* | **Stated + partly enforced** (a CI lock-check exists). The posture is "if you touch config, here's the ritual that keeps it consistent," rather than a ban on touching it. Reasonable for this repo; differs from the guardrail's propose-don't-apply default. |
| 7 | Anything that changes how the system *reasons* needs explicit human approval | **Yes, strikingly explicit, under "Model visible context."** This is the closest thing to guardrail #7 found in any `AGENTS.md` I've read. | *"Codex maintains a context (history of messages) that is sent to the model… No history rewrite… No unbounded items… No items larger than 10K tokens. Highlight new individual items that can cross >1k tokens as P0. These need an additional manual review."* | **Stated, with a manual-review hook.** They route the highest-leverage reasoning change, what goes into the model's context, to a *named P0 manual review*. That is guardrail #7's exact instinct: the kernel of how the system decides is a human call. |
| 8 | Roll out in widening phases; grow calibrated trust, don't install it | **Implicit, and visible in the file's texture.** No phased-rollout section, but the document *is* accreted calibration: rules that exist because a specific thing went wrong. | *"This rule applies especially to high-touch files that already attract unrelated changes, such as `codex-rs/tui/src/app.rs`… and similarly central orchestration modules."* | **Stated as institutional memory.** The file reads as trust calibrated over time and written down, naming the exact files agents get wrong. That's #8 happening in slow motion; it just isn't framed as a rollout phase. |

## 4. Synthesis

### Where they independently arrived at the same boundaries (the validation point)

Three of the overlaps go beyond generic good-hygiene advice. They're the *specific* boundaries the
guardrails single out, reached independently:

- **The invariant boundary (#5).** "Never add or modify any code related to
  `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR`…" is precisely guardrail #5's move: identify the layer
  where a wrong change is silent and expensive (here, the code that governs the sandbox itself), and
  draw an absolute line around it. Nobody told them to; the problem told them to.
- **Changing how the system reasons (#7).** The "Model visible context" rules (no history rewrite,
  hard token caps, and a *P0 manual review* for anything that grows the context) are guardrail #7
  almost verbatim: the kernel of how the system makes decisions is gated to a human. A team shipping
  an agent treats its context pipeline as the crown jewels, which is exactly why the guardrail names
  it.
- **Bounded work over spiralling (#3).** The 800/500-line caps and "split it into reviewable stages"
  attack the same root cause guardrail #3 does (an over-large, underspecified unit of work), from
  the change-size end rather than the retry-count end.

A guardrail set written for regulated, expensive-to-be-wrong delivery and the operating contract of
an agentic-coding tool *converge on the same three boundaries*: invariant, reasoning-kernel,
bounded-change. When two independent efforts draw the same lines, the lines are probably real.
That's the thesis of this repo: **good guardrails mechanize rules teams already write.** Codex's
`AGENTS.md` is a team already writing them.

### Where a mechanized gate would turn a written rule into an actual stop (opportunities, not gaps)

None of these is a flaw. Each is a place where Codex's *own stated rule* could be backed by a gate
so it can't be missed by a fast contributor under deadline:

- **#5: the "Never modify `CODEX_SANDBOX_*`" rule.** This is the cleanest mechanization opportunity
  in the file. A prose "Never" depends on every contributor reading and remembering it. A path/symbol
  check ("does this diff touch `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR` or `CODEX_SANDBOX_ENV_VAR`?")
  turns it into a BLOCK that fires every time, with no reliance on memory. The rule is already
  written; only the gate is missing.
- **#3: the 800/500-line cap.** A diff-stat check that WARNs past 500 and flags past 800 makes the
  written threshold mechanical and removes the judgment call from the heat of a PR.
- **#7: the >1k-token "P0 manual review."** They already route this to a human; a check that detects
  new context-injecting fragments and *labels the PR P0* would make sure the manual review is never
  skipped silently.
- **#1: auto-merge.** Not in this file at all, which is fine, but it's the one boundary worth
  confirming lives somewhere (branch protection), because it's the guardrail whose absence is
  invisible until the day it isn't.

The pattern across all four: the *rule* exists and is well-reasoned. What a gate adds is that it
fires without anyone having to remember it. That's the entire difference between a guideline and a
guardrail.

## 5. What it means for you

If you're about to write an `AGENTS.md`, the encouraging finding is that you're not inventing
boundaries from scratch. A team as deep in this as the Codex maintainers landed on the same ones,
and you probably already know yours. The less obvious finding is that *writing the rule down is only
half of it.* A "Never modify X" in prose is one capable, hurried contributor away from being crossed.
The same sentence behind a path check is a stop.

So: take the [`AGENTS.md` template](../../templates/AGENTS.md) here, fill in your own invariant
boundary in hard-rule #4 (Codex's is its sandbox-control code; yours might be the auth layer or the
payments path), and then wire the mechanical ones (invariant-path, schema-path, config-path,
change-size) behind [`skills/guardrail-check.md`](../../skills/guardrail-check.md) so they fire on
every diff. The guardrail boundaries are in [`GUARDRAILS.md`](../../GUARDRAILS.md).

Read your own `AGENTS.md` and ask, rule by rule: *is this stated, or is it enforced?* Every "stated"
that matters is a gate waiting to be wired.
