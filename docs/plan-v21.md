# Plan V21: The Tagger In Every Environment

Phase 89. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phase 89 builds and why. It is not authorization to implement the phase by itself.

The video tagger has been a development-only route since plan V8 (T14): `app/src/main.tsx` renders it only when `import.meta.env.DEV` is true, and the footer link to it is behind the same guard. A production build, including the GitHub Pages deployment, drops the route entirely. This plan makes the tagger reachable in every environment the project runs in.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phase 89. Later explicit user decisions override older statements; record changes here.
- [The plan V8 archive](plan-v8.md): T14, the development-only guard, which this plan supersedes. Every other T decision stands.
- [Plan V16](plan-v16.md) S47 and [plan V18](plan-v18.md) L01: the clarifying sentences in the project instructions that call the tagger development-only. This plan rewords them (B03); their substance stands.
- The user's request on 2026-11-14: remove the guard that only allows the tagging page in development, so it can be accessed in any environment the project runs. The decisions below were answered by the user in that `/brainstorm` session.
- A code audit on 2026-11-14. Its findings: the guard is `import.meta.env.DEV && isTaggerRequested(window.location.search)` in `app/src/main.tsx`; the footer renders `<a href="?tagger=1">Video tagger (dev)</a>` behind `import.meta.env.DEV` in `app/src/ui/Footer.tsx`; several `app/src/research/*` module comments and one comment in `app/src/game/config/encounter.ts` call the tagger "dev-only"; and Playwright runs any test whose title matches `/production assets/` in the `production-chromium` project against `vite preview` of the production build under the Pages base path (`app/playwright.config.ts`).
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification. Step 89.2 rewords two sentences there (B03).
- [The deferred register](deferred-work.md): nothing is promoted or added.

No value here is a gameplay value or a ROTMG fidelity claim.

## Completed Baseline

This plan builds on the tagger as it stands after V19, and is independent of the drafted V20 phases: it changes only how the route is reached, not what the tagger does.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger behind the development-only guard (T14) |
| [V19](plan-v19.md) | 79-82 | Every monster can be tagged, the phase-scoped draft, hover help, the test clip |
| [V20](plan-v20.md) | 83-88 | The timeline tagger (drafted) |

## Confirmed Design

Carried forward unchanged: the `?tagger=1` query parameter and `isTaggerRequested` (T13), the one-way `research/` boundary (T13), the tagger as a lazily loaded chunk with no second Vite entry point and no build-configuration change, the fallback to the game when the chunk fails to load, and every rule under `app/src/game/`.

Superseded by this plan: the development-only guard (T14).

This plan adds, as a delta:

- **The tagger runs in every environment (B01).** The `import.meta.env.DEV` condition is removed from the route check in `main.tsx`. The dynamic `import("./research/TaggerRoute")` stays, so the production build emits the tagger as a separate chunk that only `?tagger=1` fetches; a player who never opens it downloads nothing extra.
- **The footer links to it everywhere (B02).** The footer link renders in every environment, labelled "Video tagger".
- **The wording follows (B03, B04).** The project instructions and the source comments stop calling the tagger development-only.
- **A production-build check proves it (B05).** One Playwright test opens `?tagger=1` on the production preview under the Pages base path.

## Recorded User Decisions - 2026-11-14

- **B01 - Remove the guard, keep the lazy chunk.** Delete only `import.meta.env.DEV &&` from the route condition. Keep the dynamic import and its separate chunk; do not import the tagger statically.
- **B02 - Footer link in every environment.** Remove the `import.meta.env.DEV` guard from the footer link and relabel it from "Video tagger (dev)" to "Video tagger". The link target stays `?tagger=1`.
- **B03 - Reword the tuning-UI clarifications.** In the project instructions' out-of-scope paragraph, the S47 and L01 sentences say "A development-only tagger control" and "A development-only tagger editor". Reword them to "A tagger control" and "A tagger editor", keeping every other word, so the clarification that the tagger is not a tuning UI still holds once the tagger ships.
- **B04 - Update every "dev-only" comment.** Every source comment that describes the tagger as development-only or "dev-only" is reworded to say the tagger, including the `main.tsx` guard comment, which instead cites B01 and the lazy chunk. Comments only; no identifier renames.
- **B05 - Prove it on the production build.** Add one Playwright test, titled so it matches `/production assets/` and therefore runs in the `production-chromium` project against `vite preview`, that loads `?tagger=1` under the Pages base path and asserts the tagger renders with no page error.

## Approved Scope And Review Gates

In scope: B01-B05 only.

Out of scope: any change to what the tagger does, any new route or entry point, any build or deployment configuration change, renaming `research/` modules or identifiers, and anything under `app/src/game/` except the one comment B04 names.

Review gates: the focused unit tests for any changed module, `npm run verify` from `app/` at the end of the phase, and the one new Playwright test run alone with `npm run test:e2e -- --grep "<its title>"`.

## Phase Index

- [Phase 89 - The Tagger In Every Environment](plan-archive/phase-89.md). Status: complete. Dependencies: none. Outcome: the `?tagger=1` route and the footer link now work in every environment, as a lazy chunk, proven by a production-build Playwright test.
