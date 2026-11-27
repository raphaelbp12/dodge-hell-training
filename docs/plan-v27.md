# Plan V27: Encounter Page Opens Over Plain HTTP

Phase 104. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work. This file is the authority for what phase 104 builds and why. It is not authorization to implement the phase by itself.

GitHub issue #30: opening the dev server at `http://192.168.150.10:5173/dodge-hell-training/` crashes the encounter page with `crypto.randomUUID is not a function`. Browsers expose `crypto.randomUUID` only in secure contexts (HTTPS or `localhost`); a LAN address over HTTP is not one. The only call in `app/src` is `app/src/ui/EncounterScreen.tsx:153`, whose result prefixes history keys (`${runtimeId}:${attemptId}`) and is never a seed or simulation input. This plan reproduces the failure in a test first, then removes the dependency on a secure context.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved approach for phase 104. Later explicit user decisions override older statements; record changes here.
- GitHub issue #30 (text above) and its request to reproduce the error locally via tests before fixing it.
- The user's answers of 2026-11-27 to the `/brainstorm` questions 1-6, recorded below as D-27-1 to D-27-6.

## Completed Baseline

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V26](plan-v26.md) | 103 | Doc-only pull requests skip the Pages checks |

## Confirmed Design

Carried forward unchanged: every gameplay rule, the simulation, every `rulesVersion`, the history record shape and the dev server configuration.

This plan adds, as a delta: the per-mount runtime id of the encounter screen no longer requires a secure context.

## Recorded User Decisions - 2026-11-27

- **D-27-1. Fallback id.** A helper uses `crypto.randomUUID` when it exists and otherwise builds a UUID-formatted id from `crypto.getRandomValues`, which works in insecure contexts. The id format is unchanged. (Question 1a.)
- **D-27-2. Location.** The helper is a private function in `EncounterScreen.tsx`, next to its only caller. No shared util module. (Question 2a.)
- **D-27-3. Reproduction.** A Vitest unit test of `EncounterScreen` stubs `crypto.randomUUID` to `undefined` and expects the screen to mount. It must fail on the current code before the fix. No Playwright spec. (Question 3a.)
- **D-27-4. No audit.** Only `randomUUID` is fixed; no survey of other secure-context-only APIs. (Question 4a.)
- **D-27-5. No dev HTTPS.** The dev server gets no HTTPS option and no new dependency. (Question 5a.)
- **D-27-6. No deferred entry.** Nothing declined passes the deferred-register test. (Question 6a.)

## Architecture

- `app/src/ui/EncounterScreen.tsx`: a private `createRuntimeId()` replaces the direct `crypto.randomUUID()` call at line 153. Simulation, models and storage are untouched.

## Target Data Shapes

None. History ids keep the `<uuid>:<attemptId>` shape.

## Approved Scope And Review Gates

In scope: D-27-1 to D-27-6 only.

Out of scope: a shared id util; auditing other browser APIs; dev-server HTTPS; Playwright coverage; any gameplay, data or `rulesVersion` change.

Review gates:

- Only `app/src/ui/EncounterScreen.tsx`, its test file and plan files change.
- The new test is shown failing on the unfixed code first.
- `npm run verify` from `app/` passes; the full non-soak browser suite is run before the pull request is pushed, per the project instructions.
- No commit, push or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 104 | Encounter Page Opens Over Plain HTTP | complete | None |

## Phase 104: Encounter Page Opens Over Plain HTTP

[Step prompts](plan/phase-104.md).

- 104.1 - Reproduce The Missing randomUUID Failure: complete. Dependencies: none.
- 104.2 - Fall Back To getRandomValues: complete. Dependencies: 104.1.
