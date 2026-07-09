# Roadmap

This repo is built openly, around one idea: **adopt AI without losing control of correctness, of cost, or of your dependencies, by putting what you can't fully trust behind a boundary you own, and verifying it with checks you run.** Everything below is that same idea, at different stages.

## Here now
- **The guardrails, two layers.** What an agent may *change* (1–9) and what it may *claim* (10–13, the claims layer).
- **The 100-PR study.** How often the dangerous kind of change actually shows up in a live codebase (public data, reproducible).
- **Worked checks on real public PRs.** A cal.com schema gate, a Medusa CI-config gate, and a comparison against OpenAI Codex's own `AGENTS.md`.
- **A drop-in `AGENTS.md` template.**

## Also here now
- **The claim-checker.** A runnable, deterministic tool that checks an agent's state claims ("merged", "done", "no secrets added") against the repo, and says plainly which it can't verify. Built, with a committed self-test (`claim-check/selftest.sh`) that reproduces the controlled-repo verification, plus a reproducible demo against a live public one.

## Next — the economics & control of AI adoption
The same control thesis, applied to the money and the dependencies. This is direction only; nothing here is built out yet.
- **Cost discipline.** As pricing shifts from flat/abundant to metered, wasteful AI habits turn into a bill. Cost becomes a gate type of its own, one measured in *spend* rather than blast-radius: opt in before you fan out, batch verification, resume instead of relaunch, route work to the cheapest model that passes the check. The metric is cost per outcome, not tokens consumed.
- **Model portability / no lock-in.** The hedge against a provider's price or capability change: put the model behind a contract you own, the same spec-don't-generate firewall as guardrail #5, so a switch becomes an adapter swap rather than a rewrite. Evals (scoring output on your own tasks, the claim-checker engine) are what turn a switch into a measured decision.
- **Take the pipeline to a public end-to-end run.** The seven-agent design in [`pipeline/DESIGN.md`](pipeline/DESIGN.md), carried to a real run on a public repo. The prompts, the raw output, and whatever broke, landed in [`examples/`](examples/).

## The rule for what lands here
Everything in this repo runs on public data anyone can re-check; client-specific work stays private. A backlog item graduates to "here now" only when there's a real, reproducible artifact behind it. Never a promise.
