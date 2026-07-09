# The guardrails

A field checklist for teams adopting AI-assisted delivery where mistakes are expensive.

The organizing idea: **map where being wrong is cheap and visible vs. expensive and silent.
Automate the first. Gate the second.** Every rule below sits on one of those boundaries.

They come in two layers: **what an agent may change** (1–9), and **what it may claim** (10–13, the claims layer most teams miss).

---

### 1. No auto-merge. Ever.
A human reads and approves every change. The pipeline should make review *trivial* while leaving that
approval to a person. The moment the machine merges itself, you've automated away the only thing that
catches the failures the machine can't see in itself.

### 2. Isolate every agent run.
Run each agent in its own working tree / sandbox. A wrong or half-finished attempt must never be able
to corrupt the shared branch. Isolation turns "the agent broke main" from a possibility into a
category error.

### 3. Cap the self-correction loop, then escalate.
Two fix rounds, maximum. If an agent can't converge in two passes, it stops and hands off to a human.
A spiraling agent is almost never a code-quality problem. The task is usually underspecified. Looping
harder burns money and hides the real issue.

### 4. Schema changes stay in human hands.
Database migrations are the highest-blast-radius, hardest-to-reverse class of change there is. No
agent writes them. This one rule prevents a disproportionate share of catastrophic, hard-to-detect
incidents.

### 5. Don't generate code across your invariant boundary. Spec against it.
Find the layer where your system's invariants live (the integration contract, the security boundary,
the money/PII path). Let agents *specify* against it; never let them *write* it. Keep the machine on
the side of the wall where being wrong is cheap and recoverable.

### 6. No environment or config changes.
Config drift is a silent production incident on a delay. Agents propose; humans apply config and
environment changes, deliberately and visibly.

### 7. Anything that changes how the system reasons needs explicit human approval.
Model choices, routing logic, the kernel of how the system makes decisions: these are human calls by
definition. Automate the thing that does the automating and you lose oversight of it without noticing.

### 8. Roll out in widening phases. You're growing trust, not installing a tool.
Start with agents assisting and humans doing most of the work. Widen automation only as the team
develops *calibrated* trust: the earned knowledge of which outputs to wave through and which to read
line by line. That calibration has a clock speed. You accrue it through real use, and no slide deck
installs it for you.

### 9. Generated artifacts: one source of truth, transform a copy, reconcile before rebuild.
The rules above are about code. This one is about everything else the machine produces: documents,
deliverables, reports. Pick the authoritative representation for each artifact and never regenerate it
through a lossy format: a `.docx` with embedded screenshots does **not** survive a round-trip to
markdown; the rebuild looks complete and silently drops them. Agents transform a *copy*; you promote
only after verifying. And when a human edits the delivered artifact directly, fold that change back into
the source *before* the next rebuild, or the build quietly overwrites their work. Pure
expensive-and-silent: the output looks whole while content went missing.

---

## The claims layer: is what the agent *says* even true?

The rules above bound what an agent may *change*. These bound what it may *claim*. In high-stakes
delivery the failures that hurt you are usually the quiet ones: a load-bearing fact (what's merged,
what's live, what's safe) stated with total confidence and quietly wrong, surviving review because the
output reads clean.

### 10. A claim about state is a question for the system, not the model.
"Is it merged?" is a git question, answered with `merge-base --is-ancestor` or a content grep that
survives a squash. Verify the one fact a decision hinges on against the source of record, never the
agent's summary of it.

### 11. A passing self-check is not grounding.
An agent confirming its own work proves the check ran. It says nothing about whether the work is
right. Grounding means checking against something the agent didn't produce: the code, the data, the
record.

### 12. Render status from data instead of narrating it.
A "done" reported in prose is the last hallucination surface. Generate reports and dashboards
deterministically from structured data, a script over JSON. Status is computed from the record, so
there's no prose step left to hallucinate a "done" in.

### 13. Redundant agents that read the same input are not redundant.
Two agents agreeing is worthless if they read the same derived artifact; a bug in the derivation
defeats both. Make verifiers adversarial and independent, then have a human confirm against the source
before acting. And when you strip a fabrication from one place, grep the whole document; it survives
in the siblings.

---

## How to use this

1. Print it. Put it at the top of your `AGENTS.md` or contributing guide (see
   [`templates/AGENTS.md`](templates/AGENTS.md)).
2. Before you wire up a single agent, walk *your* codebase and write down your own
   expensive-and-silent failure classes. Those become your hard gates.
3. Wire a check that enforces the mechanical ones (see
   [`skills/guardrail-check.md`](skills/guardrail-check.md)).

The orchestration is the easy part. The gates are the product.
