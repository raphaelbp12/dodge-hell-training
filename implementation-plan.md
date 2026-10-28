# Implementation Plan

Deliver a pure-frontend ROTMG-inspired training game: repeatedly survive a faithful recreation of a real ROTMG boss encounter, inspect results, and retry immediately.

This file is the reusable process for every planning effort in this repository: it does not change between plan versions and carries no gameplay content, decisions or data shapes. It is a plan, not authorization to implement anything by itself - a phase is only implemented when requested, one at a time, through `/implement-phase <phase-id>`.

## Current Plan

| Plan | Phases | Status | Decision prefix | File |
| ---- | ------ | ------ | ---------------- | ---- |
| V1 | 1-7 | archived | n/a | [`docs/implementation-plan-v1.md`](docs/implementation-plan-v1.md) |
| V2 | 8-14 | archived | n/a | [`docs/implementation-plan-v2.md`](docs/implementation-plan-v2.md) |
| V4 | 15-18 | archived | G | [`docs/implementation-plan-v4.md`](docs/implementation-plan-v4.md) |
| V5 | 19-24 | active | K | [`docs/plan-v5.md`](docs/plan-v5.md) |

(V3 was superseded before archiving; see the V4 archive's own history if that gap matters.) The active row holds the decisions, confirmed design, data shapes, scope and phase index that are specific to that effort. Read it, not this file, for anything about what phases 19-24 actually build.

More than one plan-vN file can exist at once. A row's status is `drafted` from the moment `/brainstorm` writes it until its first phase is actually implemented, then `active`; a drafted plan does not replace or pause the active one. Each plan version picks its own, never-reused decision-letter prefix (G, K, ...) for its recorded decisions, so a decision ID is globally unambiguous. Phase numbers are global and sequential across every plan version - a new plan continues from the highest phase number used anywhere, it never restarts at 1.

## Execution Modes

Two modes are available and the user chooses per request:

- **Single phase (default).** Run exactly one phase, then stop and report. Do not commit, push, deploy or begin the next phase. This is the mode whenever the user does not say otherwise.
- **Batch, on explicit request.** When the user explicitly asks for a batch - naming the phases - run them in dependency order, each with its own focused checks, execution record and gate run before the next begins. A failed gate stops the batch and is reported; it is never recorded as complete. Still no commit, push or deployment without separate authorization. A batch request covers only the phases named in it and does not carry to later requests.

## Phase Lifecycle And Archiving

Phases start pending. After completing a phase, replace its status with `complete` both in its phase file and on its line in the active plan-vN file's Phase Index, record the actual checks and outcomes below each step's prompt in the phase file, and note any approved deviations. Do not mark a phase complete when its required checks are blocked. Do not automatically start the next phase.

Step prompts never live in a plan-vN file: each pending phase has its own `docs/plan/phase-<n>.md`, and the plan-vN file keeps one line per phase (id, title, status, dependencies). As soon as every step in a phase is complete, move that phase file to `docs/plan-archive/phase-<n>.md` (see [`docs/plan-archive/phase-19-20.md`](docs/plan-archive/phase-19-20.md) for the format) and give the phase's line in the plan-vN file a one-sentence outcome.

When every phase in the active plan-vN file is complete, archive it as `docs/implementation-plan-v<N>.md` following the existing v1/v2/v4 convention, and start `docs/plan-v<N+1>.md` for the next effort. Update the table above in the same change.

## How To Read A Phase Prompt

- **The phase prompt is the authority for what to build.** This file and the active plan-vN file are the authority for how and why. If they conflict, stop and ask rather than choosing.
- **Routine gates, scope discipline, TDD and disclosure rules** are defined once in [the project instructions](AGENTS.md) and in the `/implement-phase` skill; they are not restated here. Do not duplicate them into a new plan-vN file either.
- Never silently resolve a gameplay ambiguity or a conflict with a recorded decision. Research it, explain alternatives, and ask the user for approval before dependent implementation.

## Customization Choice

Shared engineering rules live only in `AGENTS.md`, which Copilot and other agents read directly and `CLAUDE.md` imports for Claude Code. The `/implement-phase` and `/verify` workflows live only in `.claude/skills/<name>/SKILL.md`, which both Claude Code and Copilot load. The reusable plan process lives only here; plan-specific content lives only in the active `docs/plan-v<N>.md`. Each file is the single source of truth; there are no mirrored copies to keep in sync.
