# Phase 35: The Phase-3 Measurement And Write-Up

> Step prompts and execution records for phase 35 of [plan v8](../plan-v8.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 35.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-35.md` and replace the plan's step lines with one-sentence outcomes.

This phase produces the evidence the plan exists for, and judges whether the format is worth repeating. It still changes no gameplay value.

### Step 35.1 - Perform The Phase-3 Measurement

Status: pending. Dependencies: 34.3.

**Implementation prompt**

Tag phase 3 and commit the raw evidence. The user drives the tool; your job is to scope the run, receive the export and place it.

The measurement target is phase 3 and nothing else, per T10. `phase-3-pond-barrage` authors 7 attacks, and T11 covers every attack identifiable in that phase rather than only the anchor. Work from the authored attack list in `app/src/game/data/enemies.json` and from the phase-3 prose in [the source extract](../killer-bee-queen-source.md), which describes the glaive wave, two counter-rotating three-armed blue spirals, a two-armed red spiral, yellow rings and bee bursts.

Cadence is periodic, so roughly ten consecutive intervals per distinct attack characterises it and more adds precision nobody needs. Agree the per-attack target with the user before tagging starts.

Include the Red Glaive wave, per T12, even though phase 33 already measured it by hand. Re-tagging it is roughly ten keypresses and it cross-checks the tool against an independent measurement, which is the cheapest confidence available that the frame-callback timestamps are right. Report the tool's mean, phase 33's hand-measured mean and the difference between them. Do not invent a tolerance for that comparison: T12 requires reporting the numbers, not grading them.

Tell the user plainly what the tool cannot resolve, so no effort is wasted on it. Variants sharing a sprite are not distinguishable by eye and are out of scope under D19; of the sprites phase 3 may use, `red-glaive`, `blue-ball` and `yellow-ball` each cover more than one variant, so picking among them would record a guess. Angles, cone widths and rotation rates are out of scope under D20. For a rotating attack the tag marks one arm's shot with `shots` as the arm count, per T24.

Remind the user to export before stopping. T30 removed import, resume and the unload guard on the basis that the pilot is a single sitting, so an unexported session is lost work.

Receive the exported JSON and place it at `docs/killer-bee-queen-observations.json`, per T33. Place it as exported. Do not hand-edit it: it is raw evidence, and an edited tag list is no longer traceable to the session that produced it. If something is wrong, re-tag and re-export.

Check the export's `provenance.sourceUrl` against the video identity phase 33 recorded, per T07. If they differ, the user tagged a different upload or download and phase 33's calibration does not cover this file; record the discrepancy and re-run phase 33's measurement against the new video before continuing.

T08 holds throughout: nothing under `app/src/game/data/` changes in this phase or anywhere in this plan.

**Focused checks:** no new automated test in this step. Run `validateObservationExport` against the placed file and confirm it passes. Confirm `provenance.sourceUrl` matches phase 33's recorded identity, or record the discrepancy and the re-run. Report the tag count, the phase-3 attacks covered, any attack that could not be tagged with the reason, and the glaive-wave cross-check as three numbers.

**Acceptance:** `docs/killer-bee-queen-observations.json` exists, is the unedited tool export, and passes `validateObservationExport`; every tag is in phase 3; the glaive wave was re-tagged and the cross-check reported as tool mean, hand mean and difference; `provenance.sourceUrl` matches phase 33's identity or a discrepancy is recorded with a re-run calibration; covered and uncovered attacks are reported; nothing under `app/src/game/data/` changed.

### Step 35.2 - Write Up The Observations

Status: pending. Dependencies: 35.1.

**Implementation prompt**

Turn the raw tags into something a later decision can act on. Create `docs/killer-bee-queen-observations.md` now, per T33, because this is when it has content.

It is a sibling of, and explicitly not part of, [the source extract](../killer-bee-queen-source.md): that file holds wiki evidence and this one holds measurements. Say so in the opening paragraph, and state that it is evidence rather than a design decision or authorization to retune, matching the source extract's own framing.

Generate the tables with a script rather than hand-transcribing them, the same discipline the source extract records for its own tables. Drive the script from `summarizeTags` so the document and the tool agree by construction. A throwaway script outside the repository is fine.

Write these sections:

- **Provenance And Access Method.** The four `VideoProvenance` fields from the committed JSON, the date, and who measured. Record that tag times are relative to video start so each maps onto a `&t=` parameter, and that the video itself is not committed, per T17.
- **Calibration.** The anchor, its wiki-sourced target cited to the source extract's prose table rather than restated as a new claim, phase 33's readings and computed mean, and the verdict. Then the T12 cross-check: the tool's mean for the same wave, the hand-measured mean, and the difference.
- **Measured Cadences.** One row per summary group: phase, sprite id, kind, sample count, mean interval and standard deviation. Include the raw interval list per group, since T29 removed outlier detection and a reader scanning ten intervals can see a doubled one directly. Order by sprite then kind so it reads consistently.
- **Phase-To-Projectile Binding.** Which sprites were observed in phase 3. This begins to narrow the "Known ambiguity" the source extract records, where the wiki gives no way to bind a projectile row to a phase. State it as an observation of one recording and one phase, not a general rule: a sprite absent here was not necessarily absent from the encounter.
- **Confidence And Limits.** State these plainly, because the document's value depends on a reader knowing what it does not establish: small groups are weak and the sample count is shown so a reader can judge for themselves; variants sharing a sprite are unresolved under D19; no angle, cone or rotation data exists under D20; only phase 3 is measured and the other seven phases are unmeasured under D22; and the phase duration observed in the video is a function of that group's damage output, not intrinsic to the boss, so it must not be read as an authorable value.
- **Relationship To Authored Data.** For each measured group, note the authored attack in `enemies.json` it appears to correspond to and that attack's current `tuningSource`. Do not propose new cadence values and do not frame differences as corrections: T32 stops this plan at measured intervals and T08 forbids retuning, with the decision held under D13. Flag any correspondence that is itself uncertain rather than asserting a mapping the tags do not support.
- **Was This Worth Repeating.** One short section answering the pilot's actual question: whether this format gives a future retuning decision what it needs, what was awkward or ambiguous while tagging, and what would need to change before the remaining phases are measured under D22. This is the section that makes the pilot a pilot rather than a seventh of a fight-wide run.

**Focused checks:** no automated test; no code under `app/` changes in this step, so `npm run verify` is skipped per the project instructions. Re-run the generating script and confirm the committed tables match its output exactly. Spot-check two rows against the raw JSON by hand. Confirm no section proposes an authored cadence value, and that the limits section names D13, D19, D20 and D22 along with the phase-duration caveat.

**Acceptance:** `docs/killer-bee-queen-observations.md` exists with all seven sections; its tables are script-generated and reproducible from the committed JSON; the calibration section reports the T12 cross-check; the binding section is framed as a single-recording, single-phase observation; the limits section names D13, D19, D20, D22 and the phase-duration caveat; the worth-repeating section answers the pilot's question directly; nothing in the document proposes or implies a new authored value.

### Step 35.3 - Guard The Evidence And Record The Addition

Status: pending. Dependencies: 35.2.

**Implementation prompt**

Add the one test that protects the committed file, and record what this plan added.

Add the schema test T34 requires: a focused Vitest case reading `docs/killer-bee-queen-observations.json` and asserting `validateObservationExport` accepts it. This mirrors how the runtime data files are validated in `app/src/game/config/data.test.ts`. Its purpose is narrow and worth a comment, since nothing at runtime reads this file: it is cited evidence a future phase will consume, so a malformed or hand-broken version should fail a gate rather than be discovered later. Resolve the path relative to the test file; do not copy the JSON into `app/`.

The test is durable only because T31 keeps validation structural. Note in the comment that a referential check added to the validator would make this test fail on an unrelated configuration change, so the two decisions are linked.

Record the tooling addition in [the mechanics contract](../mechanics.md), briefly: the `research/` boundary and its one-way dependency, the dev-only route and its exclusion from production, and that `docs/killer-bee-queen-observations.json` and its markdown are evidence rather than runtime data. The contract records the rule, not the implementation.

Leave the README alone unless it already lists developer entry points that a reader would expect to include this route.

Do not promote D13, D19, D20, D21 or D22. This plan produces evidence that makes a future retuning decision possible; making that decision, or extending measurement to the remaining phases, requires an explicit user decision. Archiving this plan and its phase files is covered by [the implementation plan](../../implementation-plan.md)'s Phase Lifecycle And Archiving section and is not restated here.

**Focused checks:** the new schema test, watched failing first by pointing it at a deliberately malformed fixture before pointing it at the real file. Then `npm run verify` from `app/`, since this step changes code under `app/`. Confirm by hand that the production build still excludes the tagger route, as step 34.2 established, and record it.

**Acceptance:** a focused test validates the committed JSON through `validateObservationExport`, with a comment explaining its purpose and its dependence on T31; the mechanics contract records the research boundary, the dev-only route and the evidence files; the README is untouched unless it already lists developer entry points; no deferred item is promoted; `npm run verify` passes and the build's exclusion of the route is confirmed and recorded.
