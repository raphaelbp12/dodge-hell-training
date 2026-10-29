# Project Instructions

The single source of truth for agent rules in this repository. `CLAUDE.md` only imports this file; never copy these rules into another file.

## Context loading

- Do not read `implementation-plan.md`, `docs/plan-v*.md`, `first-draft.md`, `docs/plan/`, `docs/mechanics.md`, the plan archives or `README.md` unless the user asks, `/implement-phase` or `/brainstorm` runs, or the task changes gameplay rules. Even then, grep for the relevant heading and read that section, not the whole file.
- If a request conflicts with a recorded decision in the plan, ask rather than silently choosing.
- Do not re-read a file already in context this session.
- For code under `app/src`, query the codegraph index first when it is available (`codegraph_explore`, or the `codegraph` CLI): one call returns a symbol's source, its call paths and what depends on it, and the source it returns counts as already read. Use `grep` or a line-range read only for a single known line, or when the index is unavailable. Do not call it before an edit merely to survey blast radius.
- codegraph does not index Markdown, JSON or configuration. For those, grep for the relevant heading or key and read that range, never the whole file.

## Tool use and replies

- Create and change repository files with the Write and Edit tools, never with `cat >` heredocs, `sed -i` or other shell rewrites: those bypass file tracking and echo whole files back into context. Throwaway scripts outside the repository, for example under `/tmp`, may still be written with a heredoc.
- Default to terse chat replies: answer first, drop preamble and restatement, keep every technical fact. Anything persisted stays in full prose - commit messages, plan and phase files, code comments and deferred-register entries - as do questions, warnings and confirmations.

## Scope and design

- Implement only what was requested. Preserve unrelated work, stop for unapproved design choices, and never start a later plan step automatically.
- Follow YAGNI, DRY, TDD and SOLID without speculative frameworks. For testable behaviour, write a focused failing test first, then make the smallest change that passes it.
- Ask before changing gameplay scope, rules or tuning. Record approved deviations and comparison-breaking rules versions.
- Gameplay values use named constants and typed configuration with units and a documented source or user approval. Never invent ROTMG fidelity claims.
- [The deferred register](docs/deferred-work.md) lists recognised, postponed, **unapproved** work. Do not implement anything listed there without an explicit user decision promoting it.
- Out of scope: a backend, accounts, player attacks, seal activation, touch controls, shrinking arenas and a tuning UI.
- `WebFetch` returns an empty document for RealmEye wiki pages. Fetch them with `curl` and a desktop user agent, then strip script/style tags and parse the rendered markup.

## Architecture

- Pure frontend in `app/`: React, TypeScript, Vite, Phaser, CSS Modules, npm, Vitest and Playwright. Install packages through npm and preserve the lockfile.
- Models, configuration and simulation stay independent of React, Phaser, DOM and localStorage. Phaser owns runtime integration and drawing; React owns screens and HUD; a storage adapter owns persistence. Never update React per projectile per frame or add a second simulation clock.
- A projectile's motion kind is authored per projectile: `linear`, `boomerang`, `turning`, `wavy` or `lob`. Reversing velocity once and expiring only by lifetime describes `boomerang` only. The per-projectile once-only hit rule applies to every kind. No stored firing origin, collision despawn or global invulnerability unless explicitly approved.

## Verification

Checks cost time and tokens, so run them at the end of a unit of work, not after each edit.

- While iterating, run only the focused test file from `app/`: `npx vitest run <path>`.
- Run `npm run verify` from `app/` once when a plan phase or a set of code edits under `app/` is finished, before reporting. It runs `lint`, `typecheck`, `test` and `build`, prints one line per gate, and puts full logs in `app/test-results/verification/<gate>.log`. Read a log only when the printed excerpt is not enough. Do not run the four gates separately.
- Skip `npm run verify` when only documentation, plans or agent instruction files changed.
- Playwright is not routine; CI runs the full suite on every push. When adding or changing a Playwright test, run only that test: `npm run test:e2e -- --grep "<pattern>"`. Run the full suite only to reproduce a CI failure or when the user asks for an acceptance run.
- Report the checks you actually ran and any blockers. Never claim a check passed when it did not run.

## Git and deployment

- Never commit, push or claim a live deployment without authorization and evidence.
- After pushing, do not watch or poll GitHub Actions or the Pages deployment. Report the push and stop.

## Instruction files

| File                                      | Role                                                          |
| ----------------------------------------- | ------------------------------------------------------------- |
| `AGENTS.md`                               | Rules for every agent (this file)                             |
| `CLAUDE.md`                               | `@AGENTS.md` import for Claude Code                           |
| `.claude/skills/implement-phase/SKILL.md` | `/implement-phase <id>` workflow, for Claude Code and Copilot |
| `.claude/skills/brainstorm/SKILL.md`      | `/brainstorm <topic>` workflow: produces a new `docs/plan-v<N>.md` and its `docs/plan/phase-*.md` files |
| `.claude/skills/verify/SKILL.md`          | `/verify` workflow; mirrors `.github/workflows/pages.yml`     |
