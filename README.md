# Agentic Delivery Guardrails

**Checks and language for putting AI coding agents to work in a codebase where a wrong change is expensive to catch or slow to undo.**

Someone above you has decided AI is coming into the codebase. It happens to be one where a silent wrong change costs real money, or draws a regulator's attention, or wakes someone at 2am. Most writing about AI-assisted development is about going faster. Going faster is the easy part. The hard part is bounding it: letting the machine make the cheap, reversible calls quickly while making sure it never quietly makes an expensive one.

Two things in this repo are worth your time before anything else. One is a way to check whether what an agent *tells* you is actually true. The other is a real number for how often the dangerous kind of change even shows up in a live codebase. Both are below. The generic change-control rules most teams already know come after.

## Start here: is what the agent says even true?

Most guardrail advice bounds what an agent is allowed to *change*. That half is well covered. The half that quietly burns high-stakes teams is what an agent is allowed to *claim*. The failures that hurt are rarely loud errors. A load-bearing fact ("it's merged," "the tests cover it"), stated with total confidence and quietly wrong, passes review because the summary reads clean.

Four rules push back on that (guardrails 10 to 13 in [`GUARDRAILS.md`](GUARDRAILS.md)):

- **A claim about state is a question for the system, not the model.** "Is it merged?" is a git question. Answer it with `merge-base --is-ancestor` or a content grep that survives a squash, against the source of record, never the agent's prose.
- **A passing self-check is not grounding.** An agent confirming its own work proves the check ran. It says nothing about whether the work is right. Grounding means checking against something the agent didn't produce: the code, the data, the record.
- **Render status from data.** A "done" written in prose is the last place a hallucination hides. Have a script compute status from structured data instead of trusting an agent to assert it.
- **Redundant agents reading the same input are not redundant.** Two agents agreeing means nothing if they both read the same derived artifact. One bug upstream fools both, and a human still has to confirm against the source.

This is the part I've seen made explicit far less often than the change side.

## Then: what the risk surface actually looks like

Before you decide which gates to wire, it helps to know how often each one would even fire. So I measured. [The 100-PR study](examples/2026-06-14-calcom-corpus-study/README.md) classifies 100 consecutive merged PRs from a large public codebase (cal.com) purely by which files they touch.

What it found:

- About **6 in 100** PRs touch the irreversible surface at all. One touched a database migration; five touched CI or config.
- **57 of 100** changed a single file. Ninety changed five files or fewer.
- The one migration PR arrived bundled with thirteen other files. That is exactly the case a gate exists to catch: the highest-blast-radius change buried in a larger diff.

A path-level gate on your migrations and config directories is nearly free. It sits quiet on the ~94% of PRs that never go near the dangerous surface, and it earns its whole keep on the few where the risky change is mixed in with everything else. The study is fully reproducible on public data, limitations and all, including the ones that weaken my own headline. Run the same classification on your last hundred PRs and you will know your own number.

## The supporting checklist: what an agent may change

Guardrails 1 to 9 in [`GUARDRAILS.md`](GUARDRAILS.md) cover the change side: no auto-merge, isolate each agent run, cap the self-correction loop, keep schema and config and reasoning-level changes in human hands, spec against your invariant boundary rather than generating across it, and roll out in widening phases.

If you have thought hard about AI adoption already, most of these will be familiar, and that's fine. They are here so the boundary is complete and a new team has all of it in one place. The differentiated value in this repo lives in the two sections above.

## What's inside

| Path | What it is |
|---|---|
| [`GUARDRAILS.md`](GUARDRAILS.md) | The thirteen guardrails, in two layers: what an agent may *change* (1 to 9) and what it may *claim* (10 to 13, the claims layer). |
| [`examples/`](examples/) | Reproductions on public code: the 100-PR study and a comparison against OpenAI Codex's own `AGENTS.md`. |
| [`skills/`](skills/) | Runnable Claude Code commands, including a guardrail-check that reviews a diff against the rules before you open a PR. |
| [`templates/AGENTS.md`](templates/AGENTS.md) | A drop-in `AGENTS.md` template for a real, multi-package repo. |
| [`pipeline/DESIGN.md`](pipeline/DESIGN.md) | The design of a seven-agent pipeline where a human owns every expensive decision. |

## Who this is for

You lead a team, or you carry the engineering-manager title, and adoption of AI has just landed on you in a codebase where being wrong is costly and slow to detect (fintech, healthcare, utilities, public sector, infrastructure). You need two things quickly: language to draw defensible boundaries with the people pushing for raw speed, and a check you can actually run instead of one more manifesto. That is what this is. It assumes you understand your own system's risks better than any framework can, and it hands you the vocabulary and one working check to apply that judgement.

If you already run agents safely at scale, you are past most of this. The 100-PR study and the claims layer may still be new.

## The one idea underneath

Map where being wrong is cheap and visible against where being wrong is expensive and silent. Automate the first freely. Gate the second, and verify the claims the agent makes about both. The gates and the claim-checks are the point.

## Status

Early and openly built. The guardrails come from experience keeping AI-assisted delivery safe in high-stakes systems; everything shown here runs on public data anyone can re-check. The examples are being added over time. Issues and PRs are welcome, especially "here is a failure class your guardrails miss."

## License

MIT, see [LICENSE](LICENSE). Use it, adapt it, ship it.

---

*Maintained by Panos Telonis. I write about keeping AI-assisted delivery safe in high-stakes environments.*
