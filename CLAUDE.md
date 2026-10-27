# Project Instructions

> Mirror of [`.github/copilot-instructions.md`](.github/copilot-instructions.md). The two files are the same contract for different agents; when one changes, change the other in the same commit.

- Read [the implementation plan](implementation-plan.md) and [the original draft](first-draft.md). The plan records later approved decisions; ask about conflicts rather than silently choosing behavior.
- Implement only the requested step. Check dependencies first, preserve unrelated work, and stop for unapproved design choices. Do not automatically implement later phases.
- Follow YAGNI, DRY, TDD, and SOLID without speculative frameworks. Write a focused failing behavior test before implementation, then run it after the smallest change. Documentation and generated scaffolding use relevant structural/build checks.
- Use named constants and typed configuration for gameplay values, with units and a documented source or user approval. Never invent ROTMG fidelity claims.
- The app is pure frontend in `app/`: React, TypeScript, Vite, Phaser, CSS Modules, npm, Vitest, and Playwright. Generate the bootstrap through the official Vite CLI; never hand-write replacement bootstrap files. Install packages through npm and preserve the lockfile.
- Keep models, configuration, and simulation independent of React, Phaser, DOM, and localStorage. Phaser owns runtime integration/drawing; React owns screens/HUD; a storage adapter owns persistence. Do not update React per projectile per frame or introduce a second simulation clock.
- A projectile's motion kind is authored per projectile: `linear`, `boomerang`, `turning`, `wavy` or `lob`. The rule that a shard reverses velocity once and expires only by lifetime describes the `boomerang` kind specifically, not every projectile. The per-projectile once-only hit rule is unchanged for every kind. No stored firing origin, collision despawn, or global invulnerability unless explicitly approved.
- Ask before changing gameplay scope, rules, or tuning. Record approved deviations and comparison-breaking rules versions.
- [The deferred register](docs/deferred-work.md) lists recognised, deliberately postponed work that is not approved; do not implement something listed there without an explicit user decision promoting it.
- `WebFetch` returns an empty document for RealmEye wiki pages. Fetch them with `curl` and a desktop user agent instead, then strip script/style tags and parse the rendered markup.
- Do not create a backend, accounts, player attacks, seal activation, touch controls, shrinking arenas, or a tuning UI for this slice.
- Once step 2.2 establishes scripts, run `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build` from `app/` for every change; before then, inspect available scripts rather than assuming they exist. Do not run the full `npm run test:e2e` suite as a matter of routine - CI runs it on every push. While authoring or extending Playwright coverage, run only the test(s) you just added or changed, for example `npm run test:e2e -- --grep "<test name or pattern>"`, to confirm they pass. Run the full `test:e2e` suite locally only to reproduce a failure the pipeline reported, or when the user explicitly asks for a full acceptance run.
- Report actual checks and blockers. Update only the requested step's status after its acceptance criteria pass. Never commit, push, or claim a live deployment without authorization and evidence.
- Large files are a recurring token cost, not a one-time one: avoid re-reading a whole file you already have in context this session, and prefer `grep`/targeted line-range reads over a full read when you only need one function or section. Keep `implementation-plan.md` small by archiving each phase's full prompts and records to `docs/plan-archive/phase-<n>.md` as soon as that phase's last step completes (see the plan's own "Keep this file small" note), leaving one summary line per step behind.
- After committing and pushing, do not watch or poll the resulting GitHub Actions run or Pages deployment (no `gh run watch`, no repeated status checks). Report that the push was made and stop; the user checks pipeline and deployment status themselves unless they explicitly ask you to check it.

## Mirrored agent files

| GitHub / Copilot | Claude Code |
| --- | --- |
| `.github/copilot-instructions.md` | `CLAUDE.md` |
| `.github/prompts/implement-step.prompt.md` | `.claude/commands/implement-step.md` |
| `.github/workflows/pages.yml` | `.claude/commands/verify.md` |
