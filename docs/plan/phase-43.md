# Phase 43: Shot Patterns And Burst Tagging

> Step prompts and execution records for phase 43 of [plan V13](../plan-v13.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 43.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-43.md` and replace the plan's step lines with one-sentence outcomes.

### Step 43.1 - Schema v2 And The v1 Upgrade

Status: implemented, manual checks pending. Dependencies: V8 phase 34.

**Implementation prompt**

In `app/src/research/tagging.ts`, add the v2 `Tag`, `TagPattern`, `TagAim`, `ObservationExport` and `StudyState` shapes from [plan V13](../plan-v13.md)'s Target Data Shapes (Z02, Z03, Z05, Z08, Z21, Z26). Keep the old shape as a named v1 type.

`validateObservationExport` accepts both versions. A file with no `schemaVersion` is checked as v1, `schemaVersion: 2` is checked as v2, and any other value is rejected. It remains shape-only under T31 and still returns the caller's object unchanged. The v2 rules are:

- `pattern` is one of the five values, including `volley` (Z04).
- `aim` is required on `spread` and `scatter`, and rejected on every other pattern (Z05).
- `burstId`, when present, is a positive integer (Z08).
- `timeSource`, when present, is exactly `"typed"` (Z21).

Add a pure `studyFromExport(validated)` that returns a `StudyState`. For v1 it maps `kind` to `pattern`, adds no `aim` or `burstId`, and sets `provenance.frameRate` to `null` (Z12, Z27). For v2 it copies the values.

Do not edit `docs/killer-bee-queen-observations.json`.

**Focused checks**

Write failing tests first for: the committed JSON validating as v1; each v2 rule accepting and rejecting; an unknown `schemaVersion` being rejected; no referential check existing; a v1 upgrade mapping both old kinds and nulling the frame rate; a v2 round trip being unchanged; and neither function mutating its input.

**Acceptance**

Both versions validate structurally, v1 upgrades only in memory, and the committed JSON is byte-identical and still covered by its schema test.

### Step 43.2 - Burst-Aware Derivation

Status: implemented, manual checks pending. Dependencies: 43.1.

**Implementation prompt**

Update `summarizeTags` to the new `IntervalSummary` shape. Group by phase, sprite, pattern and aim (Z06), then apply the burst derivation rules in plan V13's Target Data Shapes (Z10). Every result lists `intervalsSeconds`, sorted in time order within its scope (Z11). Ordering stays deterministic: compare phase, sprite, pattern, aim, then scope.

It must not emit `shotsPerBurst`, `shotIntervalSeconds` or `cooldownAfterLastShotSeconds` (T32). Update `readoutInterval` to the same group key. It stays one number, computed from all tags in the group (T28).

**Focused checks**

Write failing tests first for: a no-burst group keeping today's mean and deviation; the committed pilot's `bee-shot` tags staying one `all` result after upgrade, since they carry no `burstId`; two bursts producing correct between-burst and within-burst lists; a standalone tag counting as a burst start; concurrent groups with different aim staying separate; a single burst with one volley producing zero-sample results; and the absence of cadence-mapping fields.

**Acceptance**

Burst timing is no longer mixed into one mean, non-burst output keeps its values, and derivation contains no tuning decision.

### Step 43.3 - Pattern, Aim And The Presented Frame Rate

Status: implemented, manual checks pending. Dependencies: 43.1.

**Implementation prompt**

In `taggingOptions.ts`, replace `kind` in `StickySelection` and `createTag` with `pattern` and `aim`. Add a pure list of the four offerable patterns (Z03, Z04). `createTag` attaches `aim` only for `spread` and `scatter`. `assembleExport` writes `schemaVersion: 2`.

In `TaggerRoute.tsx`, replace the two kind radios with pattern radios. Show an aim choice only for `spread` and `scatter`. The sticky aim starts at `player` and is displayed in the sticky summary line, so the default is visible. The sticky summary's shots label reads "arms" for ring patterns and "shots" otherwise. Rename the tag table's "Kind" column to "Pattern" and show `aim` there.

Remove `DEFAULT_FRAME_RATE`. The frame-rate field starts blank and is labelled as the video's presented rate. Stepping, recording and export each show an error when no positive rate is entered (Z26). Jumps stay available, since they use no frame rate. Recorded times still come only from `mediaTime`.

**Focused checks**

Write failing tests first for: `createTag` including `aim` only on the two patterns; the offerable list excluding `volley`; `assembleExport` writing `schemaVersion: 2` and passing its validator; and a pure guard that rejects a blank, zero or non-finite rate.

**Acceptance**

Each of the four patterns can be selected and recorded, `volley` is not offered, and no default frame rate remains. Manual check: record and export one tag of each pattern with `npm run dev` and `?tagger=1`.

### Step 43.4 - Burst Keys

Status: implemented, manual checks pending. Dependencies: 43.3.

**Implementation prompt**

Extend `TaggerAction` and `actionForKey` (Z09): `b` or `B` returns a record action starting a new burst, `Shift+Enter` returns a record action continuing a burst, and `Enter` keeps its standalone meaning. Treat a held `b` like a held `Enter`, so key repeat records nothing.

Add a pure `assignBurst(tags, sticky, mode)` in `taggingOptions.ts`:

- `new` returns one more than the highest `burstId` in the study, or 1 when none exists.
- `continue` returns the highest `burstId` among tags matching the current phase, sprite, pattern and aim, or `null` when none matches.

`recordTag` shows an error and records nothing when `continue` returns `null`. Show the burst group in the tag table. Update the visible key help text.

**Focused checks**

Write failing tests first for: the key map, including `Shift+Enter` not resolving to standalone record; new-id assignment; continuing the correct one of two concurrent bursts; `continue` with no match returning `null`; and existing `isActivationTarget` behaviour still applying to a focused button.

**Acceptance**

A rotating-arm burst can be recorded as separate volleys sharing one `burstId`, and an invalid continuation records nothing. Manual check: record two bursts and confirm the exported `burstId` values.

### Step 43.5 - Live Summary Panel

Status: implemented, manual checks pending. Dependencies: 43.2, 43.4.

**Implementation prompt**

Add a summary panel to `TaggerRoute.tsx`, derived directly from `summarizeTags(tags)` with no stored summary state (Z11). It covers the whole study and shows one row per result: phase label (or the raw index if unknown), sprite, pattern, aim, scope, sample count, mean, deviation and raw intervals. Long interval lists wrap or scroll inside their own container. T28's single-number readout stays.

Put any formatting of intervals and labels in a pure helper. Add no filter, sort control, or derived cadence field.

**Focused checks**

Write failing tests first for the pure formatting helper: rounding, an empty interval list, and an unknown phase index.

**Acceptance**

The panel updates as tags change and shows burst scopes separately. Manual check: confirm the panel against a hand calculation on two bursts. Run `npm run verify` once at the end of the phase.

## Execution record

Implemented 2026-11-05 in `app/src/research/`: `tagging.ts` (v1/v2 types, `validateObservationExport` for both versions, `validateTag`, `studyFromExport`, burst-aware `summarizeTags`, `groupKey`), `taggingOptions.ts` (offerable patterns, aim, `createTag`, `assignBurst`, `readoutInterval`, `formatSummaryRow`, v2 `assembleExport`), `taggingRoute.ts` (`B`/`Shift+Enter` keys, `parseFrameRate`) and `TaggerRoute.tsx` (pattern/aim radios, burst buttons, blank presented frame rate, live summary panel). Steps 43.1-43.5 were written test-first in the matching `*.test.ts` files; `docs/killer-bee-queen-observations.json` is unchanged.

Manual checks (record one tag of each pattern, two bursts, hand-check the summary panel) were NOT performed: no browser was available. They remain for the user.
