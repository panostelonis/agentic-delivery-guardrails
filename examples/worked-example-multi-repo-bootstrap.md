# Pattern: a gated, agent-driven multi-repo delivery-prep workflow

A reusable pattern for using fanned-out AI agents to do the heavy lifting of delivery-prep across a
large multi-repo estate, while keeping a human on every irreversible or outward-facing step. The
orchestration is the easy part; the gates and scrubs are what make the output shippable. This is a
generic reference pattern. It doesn't describe any specific engagement.

## The shape of the work

Suppose you need to prepare a sizeable estate for a delivery push: many services across one or more product lines,
plus shared libraries. The kind of output an agent fleet can draft fast:

- a programme tracker and a generated dashboard,
- a quality README for every repository,
- a standards / remediation package (and, where relevant, a client-facing version),
- functional design documents,
- the first code-change branches and commits.

Almost all of it can be machine-generated. The discipline is that **none of it ships without a gate.**
What follows maps the work onto the change-control guardrails, then records the finer mechanisms that do the
real safety work.

## The change-control guardrails, as they show up in a run like this

1. **No auto-merge.** Every code change goes up as a branch for human review. Agents prepare and push;
   opening and merging the pull requests stays with people. The run's job is to make review trivial. It does not
   remove the reviewer.
2. **Isolate every agent run.** Fan out one-agent-per-repo and one-agent-per-flow, each strictly
   scoped: read this repo, write only to a staging path (or return findings and write nothing). No
   agent can touch a shared branch or another agent's output.
3. **Cap the self-correction loop.** Tell agents to verify against ground truth and *flag*, then
   stop. When a claim doesn't match the code, it surfaces as a flag for a human. That is how
   doc/code drift gets caught instead of silently "fixed" and propagated.
4. **Schema changes stay human.** Keep migrations out of scope for the fleet; hold the boundary on
   docs and config-adjacent artifacts.
5. **Spec against the invariant boundary, don't generate across it.** Agents author *design* documents
   and specs that reference the external integration contract; they never generate the contract or the
   integration code. The machine stays on the cheap-to-be-wrong side of the wall.
6. **No environment or config changes.** Config externalization and a feature-flag inventory are
   *documented and proposed*; applying them stays a deliberate human step.
7. **Changes to how the system reasons need human approval.** Usually out of scope for a prep run;
   note its absence on the record rather than assuming it.
8. **Roll out in widening phases.** Pilot the first code commit on **one** repo, verify it end-to-end
   (right files, right author, clean diff, branch on the remote), and only then repeat across the rest.

## The finer mechanisms (the layer under the principles)

These tactical gates do the real work. They are checklist-able.

- **Stage before you touch.** Produce everything in a staging area first; nothing reaches a real repo
  or remote until it's been looked at. "Prepared" and "applied" are different verbs.
- **Explicit-paths commits, never `add -A`.** Each commit adds named files only, and a `.gitignore`
  excludes tool, build, and local-config artifacts, so secrets, build output, and scratch files
  *cannot* be swept into a repo by reflex.
- **Identity gate.** The tooling refuses to commit until a real, human-provided author identity is
  given. It does not guess one.
- **Two-tier artifacts, verified not trusted.** Keep an internal-detail set and an
  external/shareable set. Anything outward-facing is scrubbed of exploit detail, secrets, and internal
  references, and the scrub is checked with a search.
- **De-AI-ification pass.** Strip generated prose of the tells that mark it as machine-written: long
  dashes, middle dots, ellipsis characters, leftover "instructions to the reader". Take extra care in
  any non-English target language. Output should read like a person wrote it.
- **Read-only fences on human-owned artifacts.** Never overwrite a document a human has hand-edited;
  produce additions as separate delta/companion documents for manual merge.
- **Single source of truth, generated views.** One editable source feeds a regenerated dashboard and
  any board export; the derived views are never hand-edited. This is what keeps the picture from
  drifting.
- **Verify claims against the code.** Have agents cross-check their own assertions against the actual
  files (a doc naming a library the code doesn't use; an env var named wrongly are typical catches).
- **Dry-run by default.** The script that touches repos previews by default; committing and pushing
  are separate, explicit flags.
- **Transparent, scoped hook bypass.** If a pre-existing, unrelated pre-commit check is broken in one
  repo's environment, a docs-only commit may use an explicit, *stated* bypass, but only when the change touches nothing
  the check guards.
- **Don't block the team.** Introduce quality gates visible-first. A CI test gate
  "runs and reports" before it is allowed to fail a build, so adoption never freezes people already
  working.

## The one-line lesson

The orchestration is the easy part. Agents are good at fan-out and first drafts. The value is in the
gates and the scrub: staging, explicit-path commits, the internal/shareable split, the de-AI-ification
pass, and a human on every irreversible or outward step. **The machine does the volume; the
guardrails make it shippable.**
