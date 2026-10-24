# Project Instructions

- Read [the implementation plan](../implementation-plan.md) and [the original draft](../first-draft.md). The plan records later approved decisions; ask about conflicts rather than silently choosing behavior.
- Implement only the requested step. Check dependencies first, preserve unrelated work, and stop for unapproved design choices. Do not automatically implement later phases.
- Follow YAGNI, DRY, TDD, and SOLID without speculative frameworks. Write a focused failing behavior test before implementation, then run it after the smallest change. Documentation and generated scaffolding use relevant structural/build checks.
- Use named constants and typed configuration for gameplay values, with units and a documented source or user approval. Never invent ROTMG fidelity claims.
- The app is pure frontend in `app/`: React, TypeScript, Vite, Phaser, CSS Modules, npm, Vitest, and Playwright. Generate the bootstrap through the official Vite CLI; never hand-write replacement bootstrap files. Install packages through npm and preserve the lockfile.
- Keep models, configuration, and simulation independent of React, Phaser, DOM, and localStorage. Phaser owns runtime integration/drawing; React owns screens/HUD; a storage adapter owns persistence. Do not update React per projectile per frame or introduce a second simulation clock.
- Shards reverse velocity once, expire only by lifetime, and can hit the player only once using per-shard hit state. No stored firing origin, collision despawn, or global invulnerability unless explicitly approved.
- Ask before changing gameplay scope, rules, or tuning. Record approved deviations and comparison-breaking rules versions.
- Do not create a backend, accounts, player attacks, seal activation, touch controls, shrinking arenas, or a tuning UI for this slice.
- Once step 2.2 establishes scripts, run relevant checks from `app/`: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`. Before then, inspect available scripts rather than assuming they exist.
- Report actual checks and blockers. Update only the requested step's status after its acceptance criteria pass. Never commit, push, or claim a live deployment without authorization and evidence.