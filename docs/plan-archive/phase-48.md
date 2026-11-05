# Phase 48: Panel Size, Persistence And Coverage

> Step prompts and execution records for phase 48 of [plan V14](../plan-v14.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 48.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-48.md` and replace the plan's step lines with one-sentence outcomes.

### Step 48.1 - Show/Hide, Size Presets And The Preference Adapter

Status: complete. Dependencies: phase 47.

**Implementation prompt**

Create `app/src/research/previewPreference.ts` with `PREVIEW_SIZE_PIXELS`, `PreviewSize` and `PreviewPreferenceValue` from [plan V14](../plan-v14.md), a named `PREVIEW_PREFERENCE_STORAGE_KEY`, and a `PreviewPreference` adapter over an injected `() => Storage` accessor, following the `ZoomPreference` pattern in `app/src/storage/zoom.ts`. It provides `get()` and `set(value)`. The default is `{ shown: true, size: "medium" }` (M35). A missing, unreadable or invalid stored value falls back to the default, and a failed read or write never throws into the route (M18, M24).

In the panel, add a show/hide toggle and small, medium and large preset buttons that set the canvas side to 320, 480 or 720 px (M25). When hidden, the panel collapses so the video takes the space and no frame is computed or drawn. Store `{ shown, size }` on every change, and read it once when the route opens. Replace step 47.2's fixed 480 px with the stored size. Changing size keeps the zoom level and re-clamps the pan.

**Focused checks**

Write failing tests first with a fake `Storage` for: the default when nothing is stored; a round trip; invalid JSON, an unknown size and a non-boolean `shown` each falling back to the default; an unrelated key being ignored; and read and write failures not throwing.

**Acceptance**

The adapter is independent of React. Manual check: hide the panel, reload, and confirm it stays hidden; choose large, reload, and confirm it is large.

### Step 48.2 - Playwright Coverage Without A Video

Status: complete. Dependencies: 48.1.

**Implementation prompt**

Add one Playwright spec for the preview (M21, M30). Read `app/playwright.config.ts` first: the case must run only in the development-server project, be skipped when `PLAYWRIGHT_LIVE_URL` is set (the tagger is absent from production builds), and its title must not match the production-assets project's `/production assets/` filter.

The test opens `?tagger=1` with empty `localStorage`, dismisses the saved-session list if it appears, and loads a small in-memory v2 study through the study file input (Z14). It then checks that:

- The preview panel is visible at the medium size, and its canvas is 480 px square.
- The open-a-video note is shown.
- Hiding the panel hides the canvas, and showing it again restores it.
- Choosing small and large changes the canvas size to 320 and 720 px.
- After choosing large and hiding the panel, a reload restores the hidden state, and showing it again gives a large canvas.

No video fixture is added (T17).

**Focused checks**

The spec itself is the check. Run only it with `npm run test:e2e -- --grep "<the spec's title pattern>"`, delegated to the `verifier` subagent.

**Acceptance**

The spec passes against the development server and is not run by the live-URL or production-assets projects.

### Step 48.3 - Tagger Guide Section

Status: complete. Dependencies: 48.1.

**Implementation prompt**

Add a short "Preview" section to `docs/tagger-guide.md` (M36). It explains that the preview follows the presented video frame; that it borrows speed, motion and shape from the matching authored attack, so it shows the tags played with the game's current geometry rather than measured geometry; when a tag is not previewed and where the count appears; that rings do not rotate and scatter is spread evenly; the player sliders; wheel zoom, drag pan and reset; the size presets and show/hide, and that only those two persist; and the burst highlight from a row click. Keep the guide's existing sections unchanged.

**Focused checks**

None; documentation only.

**Acceptance**

The section matches the implemented behaviour. Run `npm run verify` once at the end of the phase.

## Execution record

Added the localStorage preference adapter, show/hide and size presets, the no-video Playwright case (`tagger preview panel`, chromium project only) and the tagger-guide Preview section. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved. Manual checks with a real video are not performed.
