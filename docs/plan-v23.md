# Plan V23: The Game Plays The Study

Phases 97-100. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work. This file is the authority for what phases 97-100 build and why. It is not authorization to implement any phase by itself.

The tagger's preview reproduces the solo-nest video of the Killer Bee Queen, but the game does not: phase 6, for example, fires a wall of stingers where the video shows an escalating machine gun. This plan makes the game fire exactly what the preview draws. An attack track's marks become the attack, export writes them into the monster's file, the engine fires them at the marked times, and the preview and the game share one schedule. Only shot timing is in scope; positioning and movement are not.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and the approved technical approach for phases 97-100. Later explicit user decisions override older statements; record changes here.
- [The study-parity draft](study-parity-plan.md), written 2026-11-18, and its findings P01-P07. It is the evidence for this plan. Its "Decisions" and "Phases" sections are superseded by this file wherever they differ.
- `app/src/research/study-game-parity.test.ts`, written with the draft. On the committed study (`docs/killer-bee-queen-study-TFclwuPtC94.json`) and the shipped Queen file it shows: the game fires exactly the typed cadence of each track (60 of 60 guard cases pass); all 14 measured telegraphs differ from the shipped ones; all 46 tracks with volley marks fire differently from their marks. These 60 failures are kept as `test.fails`.
- The user's answers on 2026-11-19 to the `/brainstorm` questions 1-40, recorded below as Q01-Q23.

## Completed Baseline

Every earlier plan stands with the status its row in [the implementation plan](../implementation-plan.md) records. This plan builds on the tagger and the engine as V22 leaves them.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V18](plan-v18.md) | 73-78 | One file per monster, monster drafts, the draft preview and its export |
| [V19](plan-v19.md) | 79-82 | Every monster can be tagged, the phase-scoped draft, hover help, the test clip |
| [V20](plan-v20.md) | 83-88 | The study as a timeline: boundaries, attack tracks, marks, fit, bombs, reconcile and export |
| [V21](plan-v21.md) | 89 | The tagger in every environment |
| [V22](plan-v22.md) | 90-96 | Pre-merge quality gates: lint boundaries, properties, contracts, mutation, benchmarks |

## Confirmed Design

Carried forward unchanged: the one-way `research/` boundary (T13) and the development-only guard (T14); `mediaTime` as the only tagger clock (T19, M01, L32); one fixed emitter and one monster in the preview (L16); the copy box writing no file (L23) and applying an export as a separate approved change (L25); one autosave slot per video file and monster (Z28, L33); the study timeline of boundaries, status spans, attack tracks and scratch (E02, E04, E16, E20); attack tracks as `AuthoredAttack` definitions (E03); bomb throw and detonation marks and their pairing (E08) and the scale calibration (E09); the four tagger steps (E11); every V22 gate; and every gameplay rule not named below, for every monster.

Superseded by this plan:

- **E05 and E13's "measured, then accepted" rule (Q13, Q14, Q15).** There is no Accept step anywhere. Measured segment values and measured bomb values are always exported.
- **E06 and E17, the cadence fit and its threshold override (Q09, Q17).** `fitCadence`, the Fit panel and the burst-gap threshold override are removed.
- **E07, the end mark as a diagnostic only (Q07).** On a periodic track the end mark is the stop mark and is exported. D45 is promoted by this plan.
- **E12, the Observed, Fitted and Both preview modes (Q17).** The preview draws one thing: what the game will fire.
- **E19, "no file under `app/src/game/` changes".** Phase 97 changes the engine and phase 100 changes the Queen's data.

This plan adds, as a delta:

- **Marks are the attack (Q02, Q03, Q04, Q05, Q08).** A track with volley marks in a segment the video shows is authored by those marks. The game fires each marked volley at its offset from the segment's entry, including several in one frame, and the attack is silent after its last mark.
- **Periodic is opt-in (Q06, Q07).** A track marked periodic repeats its marked cycle every typed period until its stop mark or its segment's end.
- **One schedule for preview and game (Q09, Q17, Q18).** One pure function turns an attack's marks into volley times and burst indices. The simulation, the preview and the timeline all call it.
- **The rest of the export is measured (Q13, Q14, Q16).** Telegraph, sub-phase duration, `exitAfterSeconds`, invulnerable duration and bomb flight values come from the video. Unmarked tracks in segments the video shows are dropped. Segments the video never shows keep their shipped attacks.
- **A parity panel (Q19)** shows, per track, whether the game will fire its marks.

Derived constraint, not a separate decision: because the game must equal the preview, every aiming input the preview uses today keeps its current origin. A ring's rotation and an arm's spread are measured from the window's epoch: the segment entry plus the measured telegraph, which phase 98 exports, so the game's epoch equals the preview's. Only volley times count from the segment entry (Q03).

## Recorded User Decisions - 2026-11-19

- **Q01. Goal and scope.** For a study, the game fires the same volleys at the same times as the tagger preview draws. Monster positioning and movement, the order of shots inside one volley, and scatter randomness (drawn evenly in the preview, by the seeded generator in the game) are out of scope.
- **Q02. Marks are the attack.** An attack track with at least one volley mark, in a segment that has at least one window in the study, is authored by its marks. Marking is authoring: nothing is accepted afterwards.
- **Q03. Time origin.** A mark's offset is its time minus its window's start (the boundary, the segment's entry), not the telegraph end. A mark during the telegraph fires during the telegraph.
- **Q04. Several windows.** When a track's segment appears in more than one window, the marks of the first window are the attack, and every game entry of that segment replays them. A later window whose marks differ is reported in the parity panel, never exported.
- **Q05. After the last mark.** A non-periodic marked attack is silent from its last volley until its segment ends.
- **Q06. Periodic tracks.** A person may mark a track periodic and type its period in seconds. Its marks in its first window are one cycle. Cycle `k` fires the cycle's volleys shifted by `k * periodSeconds`; the period runs from the first volley of one cycle to the first volley of the next. A period shorter than the cycle is allowed, and cycles then overlap.
- **Q07. The stop mark.** A periodic track's end mark (`X`, `AttackTrack.endSeconds`) is its stop mark, exported as an offset from its window's start. No cycle starts after the stop mark; a cycle already running finishes. Without a stop mark the cycles repeat until the segment ends. Shots already fired keep flying until they expire. This promotes D45 and supersedes E07. On a non-periodic track the end mark changes nothing and is not exported.
- **Q08. Every marked volley fires.** Two marks in the same frame are two volleys, and the game fires every volley that falls due inside one fixed step.
- **Q09. Burst grouping.** The marks of a cycle are grouped into bursts by `splitGaps` with its automatic threshold, identically in the preview and the game. The burst count keeps growing across cycles, so a spiral keeps turning. The per-track threshold override is removed.
- **Q10. Data shape.** A marked attack carries a `marks` key next to the attack's other fields. An attack has exactly one of `marks` and `cadence`; the validator rejects both or neither. Export writes `marks` and omits `cadence` on a marked track.
- **Q11. Existing cadences stay.** Every attack without `marks` keeps the current `cadence` fields and fires exactly as today, for all 12 monsters.
- **Q12. Debug sliders.** The developer debug panel's timing overrides do not affect an attack with `marks`.
- **Q13. Segment values are measured.** Export always writes, per segment, the median over its windows of: the telegraph (from `telegraphEndSeconds`); a sub-phase's `durationSeconds`, from windows that end at another boundary of the same phase only; a phase's `exitAfterSeconds`, where the phase authors one, from windows that end at a boundary; and `invulnerableOnEnterSeconds`, from spans attributable to the segment (E05). A segment with no usable measurement keeps its shipped value. Supersedes E05 and E13's accept rule.
- **Q14. Bomb values are measured.** A bomb track's median measured flight time and range are exported through the projectile variant (`bombVariantOf`) whenever they exist, with no Accept.
- **Q15. Study format version 6.** The study drops `acceptedSegmentValues`, `cadenceSource`, `burstGapThresholdSeconds` and `projectileOverride`, and adds an optional `periodSeconds` per track. A version 5 study converts on load and its accepted values are discarded. `attack.cadence` stays in each track, unchanged, and export ignores it on a marked track.
- **Q16. What export keeps.** A track with no volley marks, in a segment that has a window, is dropped from the export. A segment with no window in the study keeps its shipped attack list and values unchanged.
- **Q17. One preview.** The Fit panel, `fitCadence`, every Accept button, the predicted-volley ticks and the Observed/Fitted/Both toggle are removed. The preview always draws what the game will fire.
- **Q18. Repeat ticks.** A periodic track's repeated cycles are drawn as faint ticks in its timeline row, up to its stop mark or its window's end.
- **Q19. Parity panel.** A separate, read-only panel lists per track whether the game's volleys match its marks and the first mismatch time; the tracks export drops; the segment values export changes from the shipped file; and later windows whose marks differ from the first. It never blocks export.
- **Q20. Sub-phase order.** Sub-phases keep cycling in authored order. Following the video's order is deferred as D46.
- **Q21. Chain shots.** No shot fires further shots in this plan. Deferred as D47.
- **Q22. The Queen plays her study.** The last step pastes the re-exported Queen file, bumps the Queen's `rulesVersion` and the rules fingerprint, and turns the parity tests into ordinary passing tests.
- **Q23. The custom content draft** (`docs/custom-content-plan.md`) is left unchanged; its own `/brainstorm` renumbers it past V23.

## Architecture

| Module | Change |
| ------ | ------ |
| `app/src/game/simulation/marks.ts` (new) | Pure schedule: from an attack's `marks`, the volleys due between two offsets, each with its burst index and shot index. The only place the Q06-Q09 rules live. No research import. |
| `app/src/game/config/data.ts`, `encounter.ts` | Validate `marks` (Q10) and carry it into `AttackSpec`. |
| `app/src/game/simulation/simulation.ts`, `phases.ts` | A marked attack's clock counts from its segment's entry and fires every due volley in a step through `marks.ts` (Q03, Q08); debug overrides skip it (Q12). |
| `app/src/research/study.ts`, `studyMigrate.ts`, `taggerSessions.ts` | Study version 6 and its conversion (Q15). |
| `app/src/research/studyExport.ts` | Marks, measured segment values and bomb values into the file (Q02-Q07, Q13, Q14, Q16). |
| `app/src/research/draftPreview.ts`, `previewModel.ts`, `PreviewPanel.tsx`, `timelineModel.ts`, `TaggerTimeline.tsx` | Draw volleys from `marks.ts`; remove the fitted path and the toggle; repeat ticks (Q17, Q18). |
| `app/src/research/parity.ts` (new), `ParityPanel.tsx` (new) | The parity report and its panel (Q19). |
| Removed | `FitPanel.tsx`, `fitCadence` and its tests, the accept edits in `studyEdits.ts`, the Accept controls in `ReconcilePanel.tsx`, the residual and null-cadence warnings in `studyWarnings.ts` (Q17). `splitGaps` and `pairDetonations` stay. |

## Target Data Shapes

A marked attack in a monster file (Q10). Offsets are seconds from the segment's entry; each inner list is one burst, in time order; bursts are in time order:

```json
{
  "id": "machine-gun-5-shots",
  "projectile": "red-stinger-small",
  "tuningSource": "video-observation",
  "pattern": { "kind": "ring", "arms": 2, "...": "..." },
  "marks": {
    "bursts": [[4.867], [5.067]],
    "periodSeconds": 4.0,
    "stopAfterSeconds": 20.0
  }
}
```

`bursts`: non-empty; every offset finite and at least 0; offsets non-decreasing across the flattened list. `periodSeconds`: optional, finite, greater than 0. `stopAfterSeconds`: optional, finite, at least 0, only with `periodSeconds`. An attack with `marks` has no `cadence`.

A study track, version 6 (Q15):

```ts
type AttackTrack = Readonly<{
  id: string;
  location: SegmentRef;
  attack: AuthoredAttack;          // `cadence` kept, ignored when the track has marks
  marks: readonly Mark[];
  endSeconds?: number;             // the stop mark on a periodic track
  periodSeconds?: number;          // present = periodic (Q06)
  measuredRangeTiles?: readonly (number | null)[];
}>;
```

`StudyV6` is `StudyV5` with `schemaVersion: 6`, without `acceptedSegmentValues`, and with tracks of the shape above. A session draft carrying a study moves to `draftVersion: 5`.

## Approved Scope And Review Gates

In scope: Q01-Q22 only.

Out of scope: monster positioning and movement; sub-phase order (D46); chain shots (D47); a per-volley shot count; writing any file from the tagger (L23); every other monster's data; the deferred register's other entries.

Review gates:

- Phases 97-99 change no shipped data file, no `rulesVersion` and no simulation snapshot. Every existing attack fires as today; the existing simulation, property and characterization tests pass unchanged.
- Each step's focused test file runs alone with `npx vitest run <path>`, and `npx tsc -b` passes before a test change is reported.
- `npm run bench` against `main` and the benchmark gate for phase 97, which touches `simulation.ts`.
- `npm run test:mutation:diff`, by the `verifier` subagent, for every step that changes a module in the Stryker mutate globs.
- `npm run verify` from `app/` at the end of each phase, by the `verifier` subagent.
- Phase 100's data change bumps the Queen's `rulesVersion` and `rules-fingerprint.json` together (V22 A12).
- A property, contract or mutation finding on current code stops the phase for a user decision (V22 A10).
- UI steps record their manual checks as performed or blocked.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 97 | Marked Attacks In The Game | complete | None |
| 98 | Study Version 6 And The Measured Export | complete | Phase 97 |
| 99 | One Preview, The Timeline And The Parity Panel | complete (manual checks blocked) | Phase 98 |
| 100 | The Queen Plays Her Study | implemented; findings F100-1 to F100-4 await a user decision | Phase 99 |

## Phase 97: Marked Attacks In The Game

[Archive](plan-archive/phase-97.md).

- 97.1-97.3: complete. Attacks carry exactly one of `marks` and `cadence`, `markedVolleysBetween` is the one schedule, and the simulation fires every due marked volley from the segment's entry while every cadence attack stays byte-identical.

## Phase 98: Study Version 6 And The Measured Export

[Archive](plan-archive/phase-98.md).

- 98.1-98.3: complete. Studies are schema 6 and drafts are version 5, and export writes marks, measured segment values and measured bomb variants with no Accept.

## Phase 99: One Preview, The Timeline And The Parity Panel

[Archive](plan-archive/phase-99.md).

- 99.1-99.3: complete with manual checks blocked. The preview draws the game's schedule, the fit and every Accept are gone, the timeline shows periodic repeats, and a read-only parity panel sits in Reconcile.

## Phase 100: The Queen Plays Her Study

[Step prompts](plan/phase-100.md).

- 100.1 - Re-Export And Ship The Queen: implemented. The Queen file is the study's export at rulesVersion v14, and four parity cases and one soak case are `test.fails` findings awaiting a decision. Dependencies: phase 99.
