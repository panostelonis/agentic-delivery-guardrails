# Designing a 7-agent delivery pipeline that humans still own

*A design for high-stakes, AI-assisted delivery, where a human still owns every expensive decision.
The principles and structure are below. What's portable is the reasoning.*

---

The easy 80% of agentic delivery is getting agents to write code. The hard part, the part worth
writing down, is designing the system so a team can move much faster **without the machine ever
being the thing that decides what ships.** Bounded speed, not raw speed, is the requirement.

Here's the shape I designed, the guardrails that make it safe, and the principle underneath.

## The pipeline: seven agents, one human gate

A single feature flows through seven specialized agents, each with a narrow job:

1. **Diff agent.** Reads the change request and current state; produces a precise scope, including
   what's explicitly *out*.
2. **Flow-mapper agent.** Maps the change onto the system's real flows end to end (UI → API →
   integration boundary), so downstream agents work against reality.
3. **Frontend implementation agent.** Implements the client side against the mapped flow.
4. **Backend implementation agent.** Implements the service side.
5. **Integration-spec agent.** Produces the spec for the downstream integration/middleware layer.
   It *specs*; it does not generate that code (see the principle below).
6. **PR agent.** Assembles a reviewable pull request with a structured description.
7. **Review-fix agent.** Runs the change through the same review rules a senior human would, and
   applies fixes for a strictly bounded number of rounds.

A human owns the gate at the end. Nothing merges itself.

## The guardrails are the product

Anyone can wire seven agents together. What makes it usable in a regulated codebase is the set of
things the system is *structurally not allowed to do*. See [`../GUARDRAILS.md`](../GUARDRAILS.md)
for the full set. The short version: no auto-merge, worktree isolation, cap fix-rounds at two, no
schema changes, spec-don't-generate across the invariant boundary, no env/config changes, model-level
changes need approval, roll out in widening phases.

That list is a **map of where being wrong is expensive.** Every guardrail sits on a
boundary where an error is hard to detect, hard to reverse, or both. That's the whole design method.
You don't decide what to automate by asking "what can the agents do?" You ask "where is a mistake
cheap and visible, and where is it catastrophic and silent?" Automate the first; gate the second.

## Roll it out in widening phases

The adoption is four phases with *progressively widening automation*. Agents
assist → agents own the mechanical middle → the loop tightens → humans own the gates and the
hard-boundary classes only. The phasing is how a team builds *calibrated trust*,
knowing from experience which outputs to wave through and which to read line by line. That accrues on
a clock you can't rush.

## The principle: contract as firewall

When a team is moving fast with AI, or when its skills don't fully match the work, the leverage
move is to **centralize the system's invariants behind a frozen contract, so the fast-moving part
literally cannot reach what it can't reason about.** Conway's law on purpose. The
spec-don't-generate rule is exactly this: the invariants live on the far side of a wall, and nothing
on the near side can write through it.

## What to steal

1. **List your expensive-and-silent failure classes first.** They become hard gates before you write
   any orchestration.
2. **Make the human gate non-negotiable, and make review cheap.** The pipeline's job is to produce
   reviewable changes. It does not replace the reviewer.
3. **Cap the self-correction loop.** Two rounds, then escalate. A spiraling agent is a spec problem
   disguised as a code-quality one.
4. **Spec across the dangerous boundary; don't generate across it.**
5. **Roll out in widening phases.** You're growing trust, which is different from installing a tool.

The headline most people want is "the AI ships the feature." The one that survives a regulated
production environment is quieter: **the humans still own every decision that's expensive to get wrong,
and the machine made all the cheap ones fast enough that they had time to.**
