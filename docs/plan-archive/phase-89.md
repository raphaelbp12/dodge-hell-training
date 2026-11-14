# Phase 89: The Tagger In Every Environment

> Step prompts and execution records for phase 89 of [plan V21](../plan-v21.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 89.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-89.md` and replace the phase's line in the plan file with a one-sentence outcome.

This phase changes how the tagger is reached, not what it does. Nothing under `app/src/game/` changes except one comment (B04).

### Step 89.1 - Remove The Guard

Status: complete. Dependencies: none.

**Implementation prompt**

In `app/src/main.tsx`, change the route condition from `import.meta.env.DEV && isTaggerRequested(window.location.search)` to `isTaggerRequested(window.location.search)` (B01). Keep the dynamic `import("./research/TaggerRoute")`, its `.then` render and its `.catch` fallback to `<App />` unchanged. Rewrite the comment above the condition: it no longer cites T14; it says the tagger is reachable in every environment (plan V21 B01) and stays a lazily loaded chunk that only `?tagger=1` fetches. Change the `console.error` text from "Failed to load the development tagger" to "Failed to load the tagger".

In `app/src/ui/Footer.tsx`, remove the `import.meta.env.DEV &&` guard on the tagger link and change its text from "Video tagger (dev)" to "Video tagger" (B02). The `href` stays `?tagger=1`.

**Focused checks**

- If a unit test for `Footer` exists, extend it; otherwise add one. It must fail first: the footer renders a link named "Video tagger" with `href` `?tagger=1`. Because Vitest runs with `DEV` true, this test alone cannot prove the guard is gone; step 89.3 provides that proof.

**Acceptance**

- `main.tsx` has no `import.meta.env.DEV` reference; the dynamic import and the fallback are unchanged.
- `Footer.tsx` renders the "Video tagger" link unconditionally.
- `npm run build` still emits the tagger as its own chunk, separate from the main entry chunk.

### Step 89.2 - Reword The Instructions And Comments

Status: complete. Dependencies: 89.1.

**Implementation prompt**

In `AGENTS.md`, in the out-of-scope paragraph of "Scope and design", change "A development-only tagger control that edits only a study's typed estimates and never game data is not a tuning UI (plan V16 S47)." to "A tagger control that edits only a study's typed estimates and never game data is not a tuning UI (plan V16 S47)." and change "A development-only tagger editor that produces monster JSON for a person to apply, and that the running game never reads, is not a tuning UI (plan V18 L01)." to "A tagger editor that produces monster JSON for a person to apply, and that the running game never reads, is not a tuning UI (plan V18 L01)." Change no other words (B03).

Find every source comment under `app/src` that calls the tagger "dev-only", "development-only" or "development tagger" (as of 2026-11-14: `research/taggingRoute.ts`, `research/taggingOptions.ts`, `research/draftPreview.ts`, `research/monsterDraft.ts`, `research/helpText.ts`, `research/studyLoad.ts` and `game/config/encounter.ts`; grep again rather than trusting this list). Reword each so it describes the tagger without the development-only qualifier, keeping every other fact in the comment (B04). Comments only: no identifier, file or module renames.

**Focused checks**

- None: this step changes comments and instruction text only. A grep for `dev-only\|development-only\|development tagger` under `app/src` returns nothing.

**Acceptance**

- The two AGENTS.md sentences read exactly as above.
- The grep above is empty, and no code other than comments changed in this step.

### Step 89.3 - Prove It On The Production Build

Status: complete. Dependencies: 89.1.

**Implementation prompt**

Add one Playwright test to `app/tests/app.spec.ts` whose title contains "production assets", for example "production assets serve the tagger under the Pages project path", so `app/playwright.config.ts` runs it only in the `production-chromium` project against `vite preview` of the production build, and in the `live-chromium` project when `PLAYWRIGHT_LIVE_URL` is set (B05). Model it on the existing "production assets and repeated practice work" test. It collects `pageerror` events, navigates to `?tagger=1`, asserts the response is OK and the pathname is `/dodge-hell-training/`, asserts a stable tagger landmark is visible (use a heading or control the existing tagger tests already rely on), and asserts no page error occurred. Then navigate to the base path without the query, assert the footer shows a "Video tagger" link, click it, and assert the same tagger landmark appears.

**Focused checks**

- The test fails before step 89.1 (the production build drops the route, so the game renders instead) and passes after it. Run it alone: `npm run test:e2e -- --grep "production assets serve the tagger"`. `vite preview` serves `app/dist`, so build first if the run does not do it.

**Acceptance**

- The new test passes in `production-chromium` and is excluded from the `chromium` project by the existing `grepInvert`.
- `npm run verify` from `app/` passes.

## Execution Record

Completed 2026-11-14.

- 89.1: removed the `import.meta.env.DEV` guard from `app/src/main.tsx` (dynamic import, `.then` and `.catch` fallback unchanged; comment now cites plan V21 B01; error text is "Failed to load the tagger") and from the footer link in `app/src/ui/Footer.tsx`, relabelled "Video tagger". Added `app/src/ui/Footer.test.tsx`, which failed first on the old "(dev)" label. `npm run build` emits `TaggerRoute-*.js` as its own chunk.
- 89.2: reworded the two `AGENTS.md` sentences (B03) and the dev-only comments in `research/draftPreview.ts`, `taggingRoute.ts`, `taggingOptions.ts`, `monsterDraft.ts`, `helpText.ts`, `studyLoad.ts` and `game/config/encounter.ts` (B04). Comments only. The grep for `dev-only|development-only|development tagger` is empty.
- 89.3: added the Playwright test "production assets serve the tagger under the Pages project path" in `app/tests/app.spec.ts`. It first failed against a stale `dist`; after `npm run build` it passed in `production-chromium` (`npm run test:e2e -- --grep "production assets serve the tagger"`).
- Checks: `npm run verify` passed lint, typecheck, test and build (run by the verifier subagent). An adversarial reviewer found one defect, a dropped "T14" citation in the `taggingRoute.ts` comment; it was restored and no other defect was reported.
