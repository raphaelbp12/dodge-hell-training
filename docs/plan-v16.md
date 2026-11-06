# Plan V16: Bomb Throws, Saved Attacks And Tuning Repeats In The Tagger

Phases 56-64. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 56-64 build and why. It is not authorization to implement a phase by itself.

The tagger cannot say how a bomb was thrown, silently fails to draw most of what can be selected, and makes a person record every volley of a repeating attack by hand. This plan lets a tag state a bomb's targeting, range and flight time, adds a timeline and clearer tag rows, and adds named saved attacks that repeat on a typed cadence and can be tuned while watching the pattern they draw in the preview. It changes the tagger only: no game file, shipped attack or rules identity changes.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 56-64. Later explicit user decisions override older statements; record changes here.
- [Plan V15](plan-v15.md), [plan V14](plan-v14.md), [plan V13](plan-v13.md) and [plan V8](plan-v8.md): the tagger's and preview's existing decisions (N, M, Z and T). This plan supersedes only the ones named under Confirmed Design; all others stand.
- A browser audit of the tagger on 2026-11-05, driven in headless Chromium with a WebM generated in the page, and a data audit of `matchTagAttack` against every shipped attack. Its findings: 101 of the 608 offered phase, sprite and pattern combinations for the Killer Bee Queen match an attack; four of her eight phases fire no bomb; a `white-bomb` tag with aim `fixed` exports as a targeted attack; 78 of the 79 authored patterns have `emitterRadiusTiles: 0`; 39 of the 40 authored bullets are `linear`; at 1440x900 the record button sits at y=1561 and the Tags panel at y=2044.
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification. Step 63.1 adds one clarifying sentence there (S47).
- [The deferred register](deferred-work.md): this plan adds D32-D37. D19, D20, D26, D28 and D31 stay deferred.
- The user's answers on 2026-11-05 to the numbered `/brainstorm` questions 1-60, plus the three earlier answers on tag fields, targeted range and range export, recorded below under the S prefix.

No value here is a ROTMG fidelity claim. Every typed value is a person's estimate, labelled as one.

## Completed Baseline

Phases 1-36, 41 and 46-55 are complete. Phases 43-45 of V13 are implemented with manual checks pending, and V10 and V12 stand as recorded in [the implementation plan](../implementation-plan.md). This plan builds on the tagger as V15 leaves it. V15's work was uncommitted when this plan was written.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V9 archive](plan-v9.md) | 36 | Phase-3 cadence retune from tagged video evidence |
| [V13](plan-v13.md) | 43-45 | Shot patterns, burst tagging, study load and edit, autosaved sessions |
| [V14](plan-v14.md) | 46-48 | The live tag preview beside the video |
| [V15](plan-v15.md) | 49-55 | Composite patterns, bombs as their own shot, front aim, typed geometry, tag export |

## Confirmed Design

Carried forward unchanged: the `research/` boundary (T13), the development-only guard (T14), `mediaTime` as the source of frame-derived times and the preview's only clock (T19, M01), sprite-level tagging (T20), top-level phase attribution (T25), derivation stopping at statistics (T32), the 2D-canvas preview (M10), one global player point (M08), first-match matching for bullets (M03), the tag's geometry winning over the attack's (M05, N36), per-burst advance and arm spread staying out of the preview (N38), the one export box writing no file (N41), and every other T, Z, M and N decision not named below.

This plan's delta:

- **A tag can state a bomb's throw.** It carries `target`, typed range and typed flight time. This supersedes N31's sentence "Bomb targeting adds no tag field" and N40's rule that targeting comes from the matched attack.
- **Bomb tags match more widely.** Any attack firing the sprite in the tag's phase matches, then the first in any phase. This extends M03 and M04 for bombs only.
- **A tag can carry more typed geometry.** A top-level cone, a fixed bearing, a front offset and an emitter radius. These extend the V15 exception to T27 and supersede N19's "front records only the aim" and N39's "a `fixed` tag behaves as today".
- **Linear bullets can carry typed speed and range,** exported as a projectile variant. This extends N42, which took the projectile only from the match.
- **Studies gain saved attacks and repeats.** A saved attack is a named set of attack fields plus a cadence. A linked tag points at one, and a linked tag can repeat until an end time, which the preview expands into volleys.
- **A typed cadence exports as written.** A linked tag's cadence comes from its saved attack. This amends N42 for typed values only. T32 stands: no cadence is ever computed from tag times.
- **Studies are schema v3 and drafts are version 2.** This reverses V15's "no schema v3". Older files still load.
- **The preview can tune.** Controls in the preview panel edit a study's typed estimates live. They never touch game data.
- **One new Playwright case.** This supersedes T15 and V15's "no new Playwright case" for exactly this case.

Explicitly not added: any change under `app/src/game/`, an attack picker, a bulk edit by burst, a timeline zoom, typed motion for non-`linear` bullets, a typed detonation radius, a displayed bomb speed, a typed per-burst advance, a saved-attack library shared across studies, linking an existing tag to a saved attack, a saved-attack button on rows, a key for "End repeat here", a range limit on targeted bombs, position-targeted bombs (D28), speed-based targeted bombs (D31), detonation tagging (D19), a video-free preview (D26), measured geometry (D20), compact layout, playback speed, undo, and per-tag player positions.

## Recorded User Decisions - 2026-11-05

### Scope

- **S01 - The tagger only.** No file under `app/src/game/` changes, and no rules identity moves. `research/` may keep importing what `game/` already exports.
- **S02 - The two aim bugs are fixed.** A `fixed` bomb tag no longer exports as targeted, and a `front` tag's preview and export agree.
- **S03 - No attack picker.** First-match hides one of 60 attacks (`blue-ball-spiral-ccw`), and a typed negative rate covers it. See D34.
- **S04 - Schema v3.** Export always writes `schemaVersion: 3`. Files of v1, v2 and v3 all load, with older files upgraded in memory. `docs/killer-bee-queen-observations.json` stays byte-identical.
- **S05 - Draft version 2.** Autosaved drafts become version 2, and version 1 drafts upgrade on restore, so nothing is lost unless a person discards it.
- **S06 - One Playwright case.** It generates a WebM in the page with `MediaRecorder`, then records a linked tag, ends a repeat, tunes, and checks markers and export. The approach worked in headless Chromium during the audit.

### Bomb throws

- **S07 - A tag carries bomb targeting and range.** Supersedes N31's sentence. The fields are typed estimates and appear only for a bomb sprite.
- **S08 - A checkbox.** "Targets the player" sits beside Aim. It is enabled only for a bomb `spread` with one shot and aim `player`, the shape N30 requires. Aim keeps covering direction.
- **S09 - The tag decides.** An absent `target` means not targeted, and the matched attack's `target` is ignored. Old tags that borrowed targeting now land at range. This is the root cause fix for S02.
- **S10 - Bomb matching.** A bomb tag matches the first attack firing its sprite in the tag's phase, whatever the pattern family, otherwise the first attack firing it in any phase in authored order. The status names the attack borrowed. If the family differs, only the projectile and emitter radius are borrowed and the pattern is built from the tag, with neutral defaults for anything it does not state (step 60.2).
- **S11 - Range and time; speed is calculated.** A bomb tag can type range in tiles and flight time in seconds. Speed is derived internally, never displayed and never exported.
- **S12 - Targeted bombs ignore range.** Range is disabled on a targeted bomb, because N27 lands it on the player at any distance. Flight time still applies.
- **S13 - Typed projectile values export as a variant.** A typed range, time, bullet speed or bullet range exports a `-tagged` projectile entry for `projectiles.json` beside the attack that references it, both shown in the export box. The game model is untouched.
- **S14 - Grouping.** `target` and the saved attack's id join `groupKey`. Typed range does not.

### Timeline

- **S15 - One bar.** A scrub bar covers the whole video with a playhead and a go-to-time field. No zoom.
- **S16 - A marker per volley.** Every volley gets a marker, including each volley of a repeat.
- **S17 - Tag keys.** `[` and `]` seek to the previous and next volley across all tags.

### Status and rows

- **S18 - Match status.** The Tag panel states what a new tag would do before recording: "Plays as `<attack id>`" or "Won't preview: `<reason>`". Each row shows the same as a badge. No filtering of the sprite picker.
- **S19 - Encounter confirmation.** Changing encounter asks for confirmation whenever tags or saved attacks exist. Cancelling keeps the current encounter.
- **S20 - Row editing.** Each row gains "Use these settings", which copies its fields and phase into the sticky selection. Geometry inputs get visible labels. The table is compacted, with an always-visible actions column. No bulk edit.
- **S21 - The title names the encounter.** The heading reads the selected encounter's display name.

### Typed geometry

- **S22 - More typed geometry.** Spread and scatter gain a typed top-level cone, `fixed` a typed bearing and `front` a typed offset. Each is an estimate, and front's offset still defaults as N39 says.
- **S23 - A `fixed` tag with no typed bearing.** It uses the matched attack's bearing when that attack is fixed. Otherwise it is not drawn and the status says "needs a bearing". No direction is invented, and such a tag cannot export.
- **S24 - Typed speed and range for `linear` bullets only.** Other motion kinds keep authored values. Fields are speed and range, matching `speedTilesPerSecond` and `motion.rangeTiles`.
- **S25 - Typed emitter radius on rings.** Without this, nearly every rotating attack fires from one point and the displacement the user wants cannot appear.

### Saved attacks

- **S26 - Named saved attacks plus repeat.** Several spans of footage share one rotation and one tuning.
- **S27 - Contents.** Every sticky attack field except the phase, plus a cadence. The phase stays on the tag.
- **S28 - The cadence is required.** It uses the game's three values, entered when saving: `shotsPerBurst`, `shotIntervalSeconds` (hidden and absent when `shotsPerBurst` is 1) and `cooldownAfterLastShotSeconds`. A 0.4 s repeat is one shot per burst with a 0.4 s pause.
- **S29 - Linked by id.** A linked tag stores only its time, phase, saved attack id, its repeat end if any, and its burst number if any. Values are looked up, so there is one source of truth and editing the attack changes every tag using it.
- **S30 - Stored in the study.** Saved attacks travel in the export and autosave. They clear with the tags when the encounter or video changes.
- **S31 - Created from the sticky selection.** A "Save as attack" action. No save button on rows.
- **S32 - Choosing an attack.** An Attack dropdown, default None, copies the attack's values into the sticky controls. Changing a control marks the panel "modified", and recording then makes an unlinked tag until a person uses "Update from sticky" or "Save as attack".
- **S33 - Update from sticky.** Overwrites the attack's fields from the sticky selection. It leaves the name and cadence alone.
- **S34 - Linked rows.** Attack fields are read-only with a Detach button that copies the values onto the tag. Time, phase and burst stay editable, plus the repeat end. An existing tag cannot be linked afterwards.
- **S35 - Rename.** A saved attack can be renamed at any time. Tags stay linked through the id, names are unique within a study, and later exports use the new name.
- **S36 - Delete is guarded.** Deleting a saved attack is blocked while any tag uses it.
- **S37 - Exported ids.** A linked tag's attack and projectile variant take the saved attack's name, as a slug, plus `-tagged`. Unlinked rows keep N42's naming.

### Repeats

- **S38 - One row.** A repeat is a linked row with an end time. The preview expands it into volleys, so a typed change of cadence moves every volley, and generated volleys never pose as observations.
- **S39 - Bursts repeat too.** Volley times follow the game's clock: volley `k` fires at `start + floor(k / shotsPerBurst) * ((shotsPerBurst - 1) * shotIntervalSeconds + cooldownAfterLastShotSeconds) + (k mod shotsPerBurst) * shotIntervalSeconds`, while that time is at or before the end.
- **S40 - Setting the end.** "End repeat here" stores the presented frame's time on the selected linked row, otherwise on the latest linked row of the chosen attack before the current frame. It is a button, with no key. The end must be after the row's time. Pressing it after a typed end stores a frame-derived end and removes the typed mark.
- **S41 - The end can be typed.** A row field shows it, and a typed value gets a permanent-until-recaptured `typed` mark of its own. Clearing the field removes the repeat.
- **S42 - No Burst number on a repeat row.** The cadence already defines its bursts, so the two fields exclude each other.
- **S43 - No detach on a repeat row.** Clear its end or delete it first, so a detach never silently removes volleys.
- **S44 - The rotation clock.** One clock per saved attack per phase, starting at its earliest volley and turning through gaps. Arm 0 of a volley is the phase plus the rate times the volley's time since the clock started. Unlinked tags keep N37. Rate only: N38 stands, see D35.
- **S45 - Export.** A linked tag exports `shotsPerBurst` and `cooldownAfterLastShotSeconds` from its saved attack, and `shotIntervalSeconds` from it when `shotsPerBurst` is above 1. The remaining cadence fields come from the match.
- **S46 - Summary.** A repeat row counts as one sample at its first volley. Generated volleys are excluded, because their intervals would only echo the typed number. Summary and Tags gain an Attack column showing the saved attack's name.

### Tuning in the preview

- **S47 - Allowed in the tagger.** These controls edit only a study's typed estimates, never game data. The project instructions' "tuning UI" exclusion gets a clarifying sentence.
- **S48 - What is tuned.** The selected row. A linked row tunes its saved attack, so every linked tag follows. An unlinked row tunes that row's rate, phase and radius only. Nothing is tunable with no row selected.
- **S49 - Which values.** Rotation rate, initial phase, emitter radius, and on a linked row `shotsPerBurst`, `shotIntervalSeconds` and `cooldownAfterLastShotSeconds`. A control appears only where its value applies.
- **S50 - The form.** Number fields, plus a rate slider of ±720 degrees per second. The slider's bound is a named input convenience, not a gameplay value, and a typed number can exceed it.

## Architecture

| Module | Addition |
| ------ | -------- |
| `research/tagging.ts` | `StoredTag`, `SavedAttack`, schema v3 validation and upgrade, `resolveTags`, the extended `groupKey`, the Summary's repeat rule |
| `research/taggerSessions.ts` | Draft version 2, its upgrade, the sticky's chosen attack |
| `research/taggingOptions.ts` | New edits, sticky fields, bomb-sprite rules, "use these settings" |
| `research/savedAttacks.ts` (new) | Pure create, rename, update, delete guard, detach and "modified" comparison |
| `research/repeat.ts` (new) | Pure `volleyTimesOf`, the end rules and `endRepeatTarget` |
| `research/timelineModel.ts` (new) | Pure marker fractions and next or previous volley |
| `research/TaggerTimeline.tsx` (new) | The bar, drawn on one canvas, and the go-to-time field |
| `research/taggingRoute.ts` | The `[` and `]` action |
| `research/previewModel.ts` | Tag overlays on the matched projectile, wider bomb matching, `tagMatchStatus`, volley expansion, the saved-attack rotation clock |
| `research/exportAttack.ts` | Projectile variant, saved-attack cadence and ids |
| `research/tuning.ts` (new) | Pure mapping from the selected row to its tunable values and edits |
| `research/PreviewPanel.tsx` | The tuning controls |
| `research/TaggerRoute.tsx` | State for saved attacks, and the new panels, columns and buttons |

`research/` still imports from `game/` and never the other way. The preview has no clock of its own and React still holds only inputs, never one element per projectile or per timeline marker.

## Target Data Shapes

```ts
// research/tagging.ts

/** Everything a saved attack and an unlinked tag have in common. */
export type TagAttackFields = Readonly<{
  spriteId: string;
  pattern: TagPattern;
  aim?: TagAim;
  shots: number;
  armPattern?: TagArmPattern;
  shotsPerArm?: number;
  armArcDegrees?: number;
  clockwiseDegreesPerSecond?: number;
  initialPhaseDegrees?: number;
  emitterRadiusTiles?: number; // S25: rings only.
  coneDegrees?: number; // S22: spread and scatter only.
  fixedBearingDegrees?: number; // S22: aim "fixed" only.
  frontOffsetDegrees?: number; // S22: aim "front" only.
  target?: "player"; // S08: spread, one shot, aim "player".
  bombRangeTiles?: number; // S11: absent when `target` is set (S12).
  bombTravelSeconds?: number; // S11.
  bulletSpeedTilesPerSecond?: number; // S24.
  bulletRangeTiles?: number; // S24.
}>;

type TagCommon = Readonly<{
  timeSeconds: number;
  phaseIndex: number;
  burstId?: number; // S42: never with `repeatEndSeconds`.
  timeSource?: "typed";
}>;

export type UnlinkedTag = TagCommon & TagAttackFields;

export type LinkedTag = TagCommon &
  Readonly<{
    savedAttackId: string;
    repeatEndSeconds?: number; // S38: after `timeSeconds`.
    repeatEndSource?: "typed"; // S41: only with `repeatEndSeconds`.
  }>;

/** What a study stores (S29). */
export type StoredTag = UnlinkedTag | LinkedTag;

/** What every reader uses: a stored tag with its attack's values filled in. */
export type Tag = UnlinkedTag &
  Readonly<{
    savedAttackId?: string;
    repeatEndSeconds?: number;
    repeatEndSource?: "typed";
  }>;

export type SavedAttack = TagAttackFields &
  Readonly<{
    id: string; // Stable and never shown (S35).
    name: string; // Nonblank and unique within the study.
    cadence: Readonly<{
      shotsPerBurst: number;
      shotIntervalSeconds?: number; // S28: required above 1 shot per burst.
      cooldownAfterLastShotSeconds: number;
    }>;
  }>;

export type ObservationExportV3 = Readonly<{
  schemaVersion: 3;
  encounterId: string;
  provenance: VideoProvenance;
  recordedAt: string;
  savedAttacks: readonly SavedAttack[];
  tags: readonly StoredTag[];
}>;

export function resolveTags(
  tags: readonly StoredTag[],
  savedAttacks: readonly SavedAttack[],
): readonly Tag[];
```

```ts
// research/taggingOptions.ts
export type StickySelection = Readonly<{
  /* ...V15's fields, plus every new TagAttackFields field... */
  savedAttackId?: string; // S32: the chosen attack; absent means None.
}>;

// research/exportAttack.ts
export type ExportedAttack = Readonly<{
  attack: AuthoredAttack;
  /** S13: present when a typed value needs its own catalog entry. */
  projectileVariant?: Readonly<{ id: string; entry: unknown }>;
  aimsFront: boolean;
}>;

// research/previewModel.ts
export type TagMatchStatus =
  | Readonly<{ kind: "plays-as"; attackId: string; borrowedFromPhaseIndex?: number }>
  | Readonly<{
      kind: "wont-preview";
      reason: "no-attack" | "needs-bearing" | "needs-cone" | "legacy-volley" | "unknown-phase";
    }>;
```

## Approved Scope And Review Gates

- No file under `app/src/game/` changes across this plan (S01). Because V15's work was uncommitted when this plan was written, compare against a baseline taken before phase 56 begins, for example a recorded `git diff -- app/src/game | sha256sum`, or commit V15 first if the user authorizes it.
- `docs/killer-bee-queen-observations.json` stays byte-identical, and its schema test keeps passing (S04).
- Every number added is a named constant or a person's typed estimate. The default starting values for typed fields are input conveniences and are labelled so. No fidelity claim is made.
- A tag whose study has no saved attacks and no new typed fields previews and exports as it does today, except where S02, S09 and S10 deliberately change it.
- New testable behaviour is written test-first in pure helpers. Exactly one new Playwright case is added (S06), run alone with `npm run test:e2e -- --grep "<pattern>"`.
- `npm run verify` passes at the end of each phase, and each phase's manual checks are recorded as actually performed or as blocked.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 56 | Schema V3 And Stored Tags | complete | V15 phase 55 |
| 57 | Tagger Housekeeping | complete | Phase 56 |
| 58 | The Timeline | complete | Phase 56 |
| 59 | Typed Geometry And Match Status | complete | Phase 57 |
| 60 | Bomb Throws And Typed Projectile Values | complete | Phase 59 |
| 61 | Saved Attacks | complete | Phase 60 |
| 62 | Repeats | complete | Phases 58, 61 |
| 63 | Tuning In The Preview | complete | Phase 62 |
| 64 | Guide And Acceptance | complete | Phase 63 |

## Phase 56: Schema V3 And Stored Tags

Status: complete. Dependencies: V15 phase 55. Outcome: Added schema v3, stored and linked tags, saved-attack validation, draft version 2 and a route that holds stored tags. Archive: [`phase-56.md`](plan-archive/phase-56.md).

## Phase 57: Tagger Housekeeping

Status: complete. Dependencies: phase 56. Outcome: Titled the page by encounter, confirmed encounter changes, added Use these settings and labelled, compacted rows. Archive: [`phase-57.md`](plan-archive/phase-57.md).

## Phase 58: The Timeline

Status: complete. Dependencies: phase 56. Outcome: Added the pure marker model, `[` and `]` volley stepping and the scrub bar with a go-to-time field. Archive: [`phase-58.md`](plan-archive/phase-58.md).

## Phase 59: Typed Geometry And Match Status

Status: complete. Dependencies: phase 57. Outcome: Added typed cone, bearing, offset and emitter radius, made the tag's aim win, and added one match status. Archive: [`phase-59.md`](plan-archive/phase-59.md).

## Phase 60: Bomb Throws And Typed Projectile Values

Status: complete. Dependencies: phase 59. Outcome: Added bomb targeting, range and time, wider bomb matching, typed linear-bullet values and projectile-variant export. Archive: [`phase-60.md`](plan-archive/phase-60.md).

## Phase 61: Saved Attacks

Status: complete. Dependencies: phase 60. Outcome: Added named saved attacks, linked tags, detach, the Attack panel and columns, and linked export. Archive: [`phase-61.md`](plan-archive/phase-61.md).

## Phase 62: Repeats

Status: complete. Dependencies: phases 58, 61. Outcome: Added repeat rows with volley expansion, End repeat here, a typed end, the rotation clock and the Summary rule. Archive: [`phase-62.md`](plan-archive/phase-62.md).

## Phase 63: Tuning In The Preview

Status: complete. Dependencies: phase 62. Outcome: Added the pure tuning mapping and the preview's tuning controls, and the AGENTS.md clarification. Archive: [`phase-63.md`](plan-archive/phase-63.md).

## Phase 64: Guide And Acceptance

Status: complete. Dependencies: phase 63. Outcome: Rewrote the tagger guide, added the one Playwright case and ran the review gates. Archive: [`phase-64.md`](plan-archive/phase-64.md).
