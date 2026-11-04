# Phase 34: The Tagger

> Step prompts and execution records for phase 34 of [plan v8](../plan-v8.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 34.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-34.md` and replace the plan's step lines with one-sentence outcomes.

This phase builds the whole tool: its pure model first, then the route, then the surfaces that make tagging fast.

### Step 34.1 - The Tag Model, Validator And Interval Derivation

Status: complete. Dependencies: 33.1.

**Implementation prompt**

Create the `research/` boundary and all of its pure logic. Write a focused failing test first.

Create `app/src/research/tagging.ts` with the `TagKind`, `Tag`, `VideoProvenance`, `ObservationExport` and `IntervalSummary` types exactly as declared in [plan v8](../plan-v8.md)'s Target Data Shapes. Do not widen them and do not add fields the plan does not declare: a `schemaVersion`, `formatId`, `shotsMode`, `subPhaseIndex`, `outlierIndices`, per-tag `encounterId`, despawn time or angle field each reopens a decision the plan settled by cutting it.

This module is pure, per T13. It must not import React, Phaser, any DOM type, the video APIs, or anything under `game/simulation/`, `game/session/` or `game/phaser/`. Nothing under `game/` may import from `research/`; that direction is one-way. Keep that constraint as a comment rather than an automated assertion.

Implement `validateObservationExport(value: unknown): ObservationExport`. Per T31 it validates **structure only** and throws on malformed input without coercing, mirroring how `config/data.ts` validates the runtime data files. Reject, each with a message naming the offending path:

- a missing or non-string `encounterId`
- a malformed `provenance`: a non-string `fileName`, a `sourceUrl` that is neither a string nor null, a `frameRate` or `durationSeconds` that is not a positive finite number
- a `recordedAt` that is not an ISO date string
- a `tags` value that is not an array
- a tag whose `timeSeconds` is negative or not finite
- a tag whose `kind` is not one of the two literals
- a tag whose `shots` is not a positive integer
- a tag whose `spriteId` is not a non-empty string
- a tag whose `phaseIndex` is not a non-negative integer

Do **not** check `spriteId` against the appearance catalog or `phaseIndex` against the encounter's phase count here, and do not compare `timeSeconds` against `provenance.durationSeconds`. T31 is explicit about why: this validator guards a committed evidence file for the long term, and a referential check would let a later configuration change invalidate a historically accurate observation. Put that reasoning in a comment so a later reader does not "strengthen" the validator and break the phase 35 test. Catching an impossible selection belongs in the tool, where it is actionable, and the tool achieves it by only offering real options.

Implement `summarizeTags(tags)` per T32. It groups by the three-part key `(phaseIndex, spriteId, kind)`, sorts each group's tags by `timeSeconds` ascending, takes successive differences as the interval list, and reports `sampleCount` as the number of intervals, one fewer than the group's tag count. A group with a single tag yields `sampleCount: 0` with a mean and standard deviation of 0 and must still appear in the output: a lone tag is a real observation the phase 35 write-up needs to see, not something to drop. Use the population standard deviation, since these are complete observations of a tagged run rather than a sample drawn from one, and note that in a comment.

Sort the returned summaries deterministically by the three-part key so output is stable across runs and diffs cleanly.

The derivation stops here. It must not emit `shotsPerBurst`, `shotIntervalSeconds`, `cooldownAfterLastShotSeconds` or anything else shaped like authored cadence, because that mapping is the tuning decision held under D13 and T08 forbids acting on it.

**Focused checks:** focused failing test on `validateObservationExport` first. Then: a minimal well-formed export passes and is returned unchanged; each rejection above is asserted individually with its path named; `shots` of 0, -1 and 1.5 fail while 1 passes; a `sourceUrl` of null passes and of 42 fails. Assert explicitly that an unknown `spriteId` and an out-of-range `phaseIndex` both **pass**, with a comment tying the assertion to T31, so a future change that adds referential checks fails a test rather than silently shipping. For `summarizeTags`: tags out of time order are sorted before differencing; two groups differing only in `kind` stay separate; a one-tag group appears with `sampleCount: 0`; mean and population standard deviation match hand-computed values on a fixed list; output order is deterministic across two calls with shuffled input. All four routine gates.

**Acceptance:** `app/src/research/tagging.ts` declares the five types exactly as the plan specifies, with no cut field reintroduced; the validator is structural only, with tests pinning that an unknown sprite and out-of-range phase pass; `summarizeTags` groups by the three-part key with documented single-tag and population-statistics behaviour and deterministic ordering; no output field resembles authored cadence; the module is pure and the dependency on `game/config/` is one-way; all four gates pass.

### Step 34.2 - The Dev-Only Route And Frame-Accurate Timestamping

Status: complete. Dependencies: 34.1.

**Implementation prompt**

Add the route, load a video and make the current frame's exact time knowable.

Create the tagger UI under `app/src/research/`, per T13. Mount it behind an `import.meta.env.DEV` guard so `npm run build` excludes it, per T14. Do not add a second Vite entry point and do not change the build configuration: the guard is the whole mechanism.

Reach it through the existing query-string convention rather than inventing a new one. Follow the style of `game/config/drill.ts`, but keep the parsing in `research/`; do not add a research concern to `drill.ts`.

The route renders a `<video>` element and a file input. T17 keeps the video out of the repository, so the only way in is `<input type="file" accept="video/*">` plus `URL.createObjectURL`. Revoke the object URL when the file changes and on unmount.

Capture provenance once here, per T18. Take `fileName` and `durationSeconds` from the loaded file and the video element's metadata. Take `sourceUrl` and `frameRate` from text inputs, since neither is discoverable from the file. There is no `formatId` field; T18's list is the whole set.

Show the encounter selector, reading available encounters from `game/config/` per T16, defaulting to the Killer Bee Queen. The selected encounter is recorded once on the export, not per tag.

Track the presented frame's time with `requestVideoFrameCallback`, keeping `metadata.mediaTime` as the authoritative current time. This is the substance of T19: `mediaTime` is the presentation timestamp of the frame actually on screen, so it is correct regardless of what the frame-rate field says. Re-register the callback after each invocation while a video is loaded, and cancel it on unmount.

Do not read `video.currentTime` for anything recorded. It is sampled outside the frame callback and does not identify the displayed frame. Using it for a non-recorded affordance such as a seek-bar position is fine and worth a comment distinguishing the two uses.

Add only the transport controls T35 permits: play and pause, and a one-frame step backward and forward using `1 / frameRate` as the seek delta. There is no playback-rate control, no one-second jump and no frame-index display. Bind the steps and play/pause to keys as well as buttons, since tagging with a mouse is unusable: arrow keys for frame steps and space for play/pause, with the browser's default scrolling prevented while the tagger has focus.

A frame step seeks and then waits for the next frame callback, so the displayed time must come from that callback rather than from the value you seeked to; the browser snaps to the nearest frame boundary. Make that ordering explicit in code and in a comment, because reversing it would silently reintroduce frame-rate-dependent timestamps.

Display the current `mediaTime` numerically to at least three decimal places.

**Focused checks:** focused Vitest on the pure helpers only, per T15: the query-string parsing for the route, the seek-delta computation from a frame rate, and the key-to-action mapping. Assert the step delta for 30 and 60 fps and that a zero or negative frame rate is rejected rather than yielding an infinite delta. Add a provenance-assembly helper test: file metadata plus the two typed fields produce a `VideoProvenance` that the validator's provenance branch accepts. Do not unit-test `requestVideoFrameCallback`, the video element or the file input, and do not assert the import graph. Confirm by code search that no recorded path reads `currentTime`. Confirm by hand that `npm run build` output does not contain a string unique to the tagger, and record that in the execution notes; this is a manual confirmation, not a test, per the plan's review gates. All four routine gates.

**Acceptance:** the route renders only under `import.meta.env.DEV`, with its absence from the production build confirmed by hand and recorded; a local video loads through a file picker with its object URL revoked on change and unmount; all four provenance fields are captured once here and the encounter is selected from configuration; the displayed time comes from `mediaTime` and never from `currentTime` or the frame-rate field; only play/pause and single-frame steps exist, bound to keys without page scrolling; no second Vite entry and no build-config change; all four gates pass.

### Step 34.3 - Tagging Surfaces, The Readout And Export

Status: complete. Dependencies: 34.2.

**Implementation prompt**

Make tagging fast, self-checking and exportable.

Build the sprite picker per T20. The option list is exactly the appearance ids in `app/src/game/data/projectile-appearances.json`, read through `game/config/`, which already contains precisely the 19 sprite-level entries: 16 projectile sprites plus `red-bomb`, `white-bomb` and `blue-bomb`. Do not derive, group or invent a sprite list and do not add variant entries. The catalog is already sprite-level because each appearance covers every wiki row sharing that sprite, which is why `red-stinger-large` serves rows 2, 21 and 23.

Render each non-bomb option's thumbnail from its resolved pixel grid, reusing the appearance resolution `game/config/` already performs rather than re-reading or re-resolving the JSON. Draw to a small canvas or an equivalent grid of coloured cells, nearest-neighbour scaled so pixels stay crisp. Keep the renderer local to the picker; it has no bearing on how the game draws projectiles and must not be shared with or change anything under `game/phaser/`.

Bomb entries render as a label plus a swatch of the appearance's `bodyColor`, per T21. Do not render a bomb animation frame: that is the one appearance shape whose pixel data is a frame sequence, and special-casing the renderer for three of nineteen entries is not worth it.

Show each option's id as text beside its thumbnail. The id is what lands in the tag and what phase 35 writes up.

Add the phase control, reading the selected encounter's authored top-level phases from `game/config/` per T16 and labelling each by its authored id rather than a bare index. There is no sub-phase control: T25 cuts the field because phase 3 has no sub-phases.

Add the kind toggle for T24, `volley` or `rotating-arm`, and the `shots` control for T23. Bind number keys 1 through 9 to set `shots` directly, since it changes more often than the sprite does. The control's own range is its validation; do not add a separate rejection path for values it cannot produce.

Everything selectable is sticky, per T22: sprite, phase, kind and shots persist across tags, and a single key records a tag at the current frame using them. Show all four together in one place, prominently enough that a glance before a keypress confirms what will be recorded. A mis-set sticky selection silently mislabels a run of tags, which is this design's main failure mode.

Each tag records `timeSeconds` from the frame callback's `mediaTime` plus the four sticky fields, producing exactly the `Tag` shape from step 34.1.

Add a tag list showing time, sprite, phase, kind and shots, newest first, with a per-row delete. Per-row delete is the single correction mechanism under T35; there is no undo, because deleting the newest row is the undo.

Add the readout T28 specifies, and only that: the interval since the previous tag in the group matching the current sticky selection. One subtraction. There is no running mean, sample count or outlier flag in the UI, and T29 removes outlier detection entirely. The interval alone is what reveals a missed tag or a double-tap at the moment it happens.

Add an export action assembling an `ObservationExport` with the selected `encounterId`, the captured provenance, `recordedAt` as the current ISO date, and the tags sorted by `timeSeconds`. Run it through `validateObservationExport` before offering the download and surface any error in the UI rather than downloading an invalid file. Download via a blob URL, revoked afterwards.

There is no import or resume, per T30, and no unload guard. The download goes to the browser's download location; the user places it under `docs/` in phase 35. The route must not attempt to write into the repository, and T08 forbids touching anything under `app/src/game/data/`.

**Focused checks:** focused failing test first on the option-list builder: it returns exactly T20's entry count for the Killer Bee Queen in catalog order, each with an id and a flag marking whether it is a bomb; the three bomb ids are flagged and the rest are not. Test the pixel-grid-to-cells helper on a small fixture including a transparent cell. Test the phase-option builder: it returns the encounter's top-level phases labelled by authored id, with no sub-phase entries. Test the tag-construction helper: it copies all four sticky fields and takes its time from the supplied `mediaTime` argument. Test the readout selector: given tags and a sticky selection it returns the interval since the previous tag in that group, and a well-defined empty result when the group has no previous tag. Test export assembly: a helper taking encounter, provenance, tags and a date returns an export the validator accepts with tags time-sorted; an invalid payload surfaces the error instead of returning. Do not unit-test the canvas drawing or the download. All four routine gates.

**Acceptance:** the picker lists exactly the catalog's appearance ids with thumbnails from resolved pixel grids, bombs as label plus `bodyColor` swatch, and ids visible as text; phase selection comes from configuration with authored ids and no sub-phase control; the kind toggle and sticky `shots` exist with number-key entry; all four sticky fields are visible together and one key records a tag at the frame-callback time; the tag list supports per-row delete and nothing else; the readout shows only the interval since the previous tag in the current group; export validates before downloading and surfaces errors; no import, resume or unload guard exists; nothing is written into the repository and nothing under `app/src/game/data/` changes; all four gates pass.

### Execution record

Implemented on 2026-11-03 in the working tree; nothing was committed, pushed or deployed. This record covers steps 34.1-34.3. The code was built under the user's explicit instruction to implement the whole V8 plan before phase 33 was measured. Phase 33 was then measured from the supplied video: phase 3 contains only 2 intervals, below T02's minimum of 5, and the phase 7 fallback also falls short. The user explicitly waived the minimum in T36 and accepted the 7.0 s mean and 0.0 s deviation, so this phase is complete under that waiver. It is not a T02 pass; the waiver is recorded in the plan and in phase 33's record.

#### Files and boundaries

- Added `app/src/research/tagging.ts`: the five plan types, structural validator and interval derivation. It imports nothing.
- Added `app/src/research/taggingRoute.ts`: pure query parsing, frame-step arithmetic, key mapping, editable-target check and provenance assembly. It imports only the `VideoProvenance` type.
- Added `app/src/research/taggingOptions.ts`: appearance and phase options, pixel-grid flattening, sticky tag construction, readout selector and validated export assembly.
- Added `app/src/research/TaggerRoute.tsx` and `TaggerRoute.module.css`: the dev-only route.
- Added `app/src/research/tagging.test.ts`, `taggingRoute.test.ts` and `taggingOptions.test.ts`.
- Changed `app/src/game/config/encounter.ts` only to export `PROJECTILE_APPEARANCES`, the already-resolved 19-entry catalog. No authored value changed.
- Changed `app/src/main.tsx` to mount the route behind `import.meta.env.DEV` and `?tagger=1` through a dynamic import.
- No file under `app/src/game/data/` changed. Nothing under `game/` imports from `research/`. No video was committed or added to `.gitignore`.

#### TDD and focused checks

- 34.1: `src/research/tagging.test.ts` was written first and failed on the missing module; after implementation all 29 cases passed. Every rejection case asserts the offending path, and the file pins structural-only validation with explicit unknown-sprite and out-of-range-phase passes, single-tag groups, population standard deviation and deterministic ordering.
- 34.2: `src/research/taggingRoute.test.ts` was written first and failed on the missing module; after implementation all 18 cases passed. It covers the query convention, 30/60 fps steps, invalid frame rates, the key map, coarse jump mapping, provenance assembly accepted by the validator, editable-target detection, and the distinction between editable and activation targets that keeps Enter usable on a focused radio while a focused button keeps its own activation.
- 34.3: `src/research/taggingOptions.test.ts` was written first and failed on the missing module; after implementation all 10 cases passed. It covers exactly 19 catalog options and three bombs, no sub-phase entries, transparent pixel cells, sticky tag construction, readout selection and time-sorted validated export assembly.

#### Review follow-up

Three independent reviews found no P0 and no phase-acceptance failure, but they found two data-integrity issues and several smaller ones, all corrected before the final gate:

- Changing the encounter selector now clears the tag list, so a tag recorded under one encounter cannot be relabelled and exported under another (T16).
- A frame step now marks the seek pending until the next `requestVideoFrameCallback`; the Record action refuses a tag whose `mediaTime` still names the pre-seek frame, with a 500 ms safety release for a step that lands on the already displayed frame.
- A focused button or link keeps Enter and Space for its own activation, while a focused radio or checkbox keeps Space and leaves Enter available to record. The earlier rule made Enter dead on a radio and stole Enter from the Export and Delete buttons.
- Changing the video file now clears the typed source URL and resets the frame rate, so provenance cannot mix an old source with a new file.
- Export appends the download anchor, removes it, and revokes the blob URL in a later task rather than in the same click task.
- The tagger CSS no longer defines unscoped global `button` rules.
- The dev dynamic import has a failure path instead of leaving a blank page.

#### Post-completion transport addition (T37)

The user asked for buttons that make bigger jumps because frame stepping through the nine-minute source video is too slow. Added -5 s/+5 s and -30 s/+30 s buttons, with Shift+ArrowLeft/Right jumping 5 s and PageUp/PageDown jumping 30 s. A jump is a non-recorded seek: it pauses, clamps to the video bounds, marks the seek pending, and still records from the next `mediaTime` callback. A manual smoke test with the synthetic clip confirmed that forward and back jumps clamp to the ends and that the keyboard equivalents work. The action-map tests cover the new keys.

The same user pass showed a dense Red Glaive ring of about 64 projectiles and a four-bomb ring. The shots input had capped at 9, which would have under-recorded the observation. It now accepts any positive integer; number keys 1-9 remain quick presets, and the validator test pins a 64-projectile count. The research suite is now 58 cases.

#### Full gate and production exclusion

`npm run verify` from `app/` passed lint, typecheck, test (876 tests) and build. The build emitted one JavaScript and one CSS asset. A byte search of `dist/assets/*.js` found none of `data-tagger-route`, `Killer Bee Queen tagger`, `Record tag` or `No previous tag in this group`, and no separate tagger chunk existed, so the route is absent from the production bundle. This was a manual confirmation, not a test, as the plan requires. The final build hashes were `index-DsI6AzQb.js` and `index-D_nCrz8E.css`, with the existing roughly 1.87 MB chunk warning unchanged.

#### Manual smoke test

A synthetic 64x64, 1.42-second WebM was generated inside the browser with `MediaRecorder` and loaded through the file picker. It was never placed in the repository. The route rendered at `?tagger=1`, loaded the file, reported its duration, displayed `mediaTime` to three decimals, stepped by a frame, accepted a phase-3 `red-glaive`/`volley`/4-shots sticky selection, recorded two tags with Enter, showed `0.432 s since previous`, listed both tags newest first, and exported `killer-bee-queen-observations.json` that `validateObservationExport` accepts. The synthetic tags are not evidence and were not committed.

A code search confirmed the only `video.currentTime` read is the seek target in `seekBy`; the comment there and the frame-callback path keep every recorded time on `mediaTime` (T19).
