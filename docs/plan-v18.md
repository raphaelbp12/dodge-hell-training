# Plan V18: Monster Drafts In The Tagger

Phases 73-78. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 73-78 build and why. It is not authorization to implement a phase by itself.

All of the Killer Bee Queen's phases are implemented, but they are not correct, and the tagger can only describe them by starting from nothing. This plan lets a person choose an encounter and a monster, load that monster's current attacks from the game, edit them, line them up with a video by pressing a button on the right frame, and copy the result back as that monster's data file. The game's data files stay the only model of an encounter's behaviour. To make one monster's export unable to touch another monster, `enemies.json` is split into one file per monster, with no change to gameplay.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 73-78. Later explicit user decisions override older statements; record changes here.
- [Plan V16](plan-v16.md), [plan V15](plan-v15.md), [plan V14](plan-v14.md), [plan V13](plan-v13.md) and [plan V8](plan-v8.md): the tagger's and preview's existing decisions (S, N, M, Z and T). This plan supersedes only the ones named under Confirmed Design; all others stand.
- A code and data audit on 2026-11-07. Its findings: `enemies.json` holds 12 monsters, of which the Killer Bee Queen has 8 phases, 11 sub-phases and 60 attack entries; 10 minion monsters hold 18 attack entries; a tag or saved attack cannot hold a projectile variant, `initialDelaySeconds`, sub-phase membership, per-burst advance, gap sectors or arm spread; `enemies.json` round-trips byte-identically through `JSON.stringify(data, null, 2)` plus a trailing newline; `data.ts:15` is its only code importer; and `config.test.ts` and the simulation's characterization snapshots pin authored values.
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification. Step 77.1 adds one clarifying sentence there (L01).
- [The deferred register](deferred-work.md): this plan adds D38-D42. D14, D26, D34 and D35 stay deferred.
- The user's answers on 2026-11-07 to the numbered `/brainstorm` questions 1-40, recorded below under the L prefix. Questions 26-28 were withdrawn when the user chose to configure one monster at a time. Answer 29a (no data change) was replaced by 34a, and answer 19a (one whole-file export) was narrowed by 34a and 35a.

No value here is a ROTMG fidelity claim. Every value a person types into the draft is that person's estimate, and applying one to the game is a separate approved change (L27).

## Completed Baseline

Phases 1-36, 41 and 46-64 are complete, phases 43-45 of V13 are implemented with manual checks pending, and V10, V12 and V17 stand as recorded in [the implementation plan](../implementation-plan.md). This plan builds on the tagger as V16 leaves it. V17's interface work was uncommitted when this plan was written. It does not touch `app/src/research/`, `game/config/data.ts` or `game/data/enemies.json`, so V18 neither depends on it nor conflicts with it.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V13](plan-v13.md) | 43-45 | Shot patterns, burst tagging, study load and edit, autosaved sessions |
| [V14](plan-v14.md) | 46-48 | The live tag preview beside the video |
| [V15](plan-v15.md) | 49-55 | Composite patterns, bombs as their own shot, front aim, typed geometry, tag export |
| [V16](plan-v16.md) | 56-64 | Bomb throws, saved attacks, repeats and tuning in the tagger |
| [V17](plan-v17.md) | 65-72 | Interface redesign |

## Confirmed Design

Carried forward unchanged: the `research/` boundary (T13), the development-only guard (T14), `mediaTime` as the source of frame-derived times and the preview's only clock (T19, M01), shape-only study validation (T31), derivation stopping at statistics (T32), the 2D-canvas preview (M10), one global player point (M08), even draws for scatter in the preview, first-match matching for tags (M03), N38's exclusions for tags, the one attack export box writing no file (N41), every tag and saved-attack rule from V16, and every other T, Z, M, N and S decision not named below.

This plan's delta:

- **Each monster has its own data file.** `game/data/enemies.json` becomes `game/data/enemies/<archetype-id>.json`, one per monster, merged by the loader into exactly the data it holds today. This is the plan's only change under `app/src/game/`, apart from exporting one existing helper.
- **The tagger chooses an encounter and a monster.** A study belongs to one monster. Older studies belong to their encounter's primary monster.
- **A study can hold a lossless draft of its monster's attacks.** The draft keeps authored attacks in the game's own `AuthoredAttack` shape, separate from tags and saved attacks, plus one anchor per block.
- **The draft has its own preview,** drawn from the video's `mediaTime`. It uses the game's clock arithmetic and its per-burst advance, arm spread and burst index. This does not change N38 for tags.
- **A monster's file is exported through a copy box.** This extends N41. Nothing is written to disk.
- **Tags exist only in the primary monster's study.** Their rules do not change.
- **Studies are schema v4 and drafts are version 3.** Older files still load. Autosave slots are keyed by video and monster, which amends Z28 (L33).
- **A development-only editor that produces data for a person to apply is allowed.** This clarifies the project instructions' "tuning UI" exclusion (L01).

Explicitly not added: a new shared format, any change to gameplay, rules or `rulesVersion`, editing of phase, sub-phase or monster-level values, editing of the projectile catalog, controls for per-burst advance, gap sectors or arm spread, several monsters in one preview, moving emitters, the Worm's repeating spawn schedule, automatic sub-phase cycling, several anchors per block, a calculated initial delay, a button that writes files, a bundled multi-monster export, an edited-monster marker in the selector, tags or saved attacks on minions, binding a tag to a draft attack (D34), a video-free draft preview (D26), anchor markers on the timeline, and a new Playwright case.

## Recorded User Decisions - 2026-11-07

### Boundaries

- **L01 - The editor is allowed.** A development-only tagger editor that produces monster JSON for a person to apply, and that the running game never reads, is not a tuning UI. The project instructions gain a clarifying sentence in step 77.1.
- **L02 - One model.** The game's enemy data remains the only model of behaviour. The tagger edits a working copy in the game's `AuthoredAttack` shape, and no new shared format exists.
- **L03 - One file per monster.** The data splits into `app/src/game/data/enemies/<archetype-id>.json`, 12 files merged by the loader. The merged data must equal today's data exactly, and no rules identity moves.
- **L04 - A lossless draft.** Loaded attacks live in a new draft, separate from tags and saved attacks. Converting them would lose the fields the audit lists. An untouched draft must export byte-identically to the monster's file.

### Choosing A Monster

- **L05 - Every monster.** Every monster the encounter can reach is available: its primary monster and every monster reached by walking authored spawns, including a spawn's own spawns.
- **L06 - Two selectors.** The editor selects an encounter, then a monster in it, over the monster files.
- **L07 - One study per monster.** A study holds one monster's draft and anchors, even when one recording shows several monsters.
- **L08 - Switching monsters keeps the video.** Picking another monster keeps the open video and its time, autosaves the current study, then opens the selected monster's saved study for that video, or an empty study if there is none.
- **L09 - Tags in the primary study only.** Tags and saved attacks appear only in the primary monster's study. A minion study shows only the draft editor. A tag's phase is a boss phase and its matching reads the primary monster, so it has no meaning for a minion.

### Editing

- **L10 - Add, delete and edit.** A person can add an attack, delete one and edit one.
- **L11 - Other values stay read-only.** Phase and sub-phase values (health gates, durations, telegraphs, movement, spawns) and monster-level values (health, contact damage, body, blocking) are shown where useful and never edited here. A person changes them by hand in the file.
- **L12 - Projectiles come from the catalog.** An attack's projectile is picked from the existing catalog. The catalog is not edited.
- **L13 - Controls for the familiar fields.** Controls exist for the fields tags already support, plus the cadence. `perBurstAdvanceDegrees`, `gapSectorsDegrees`, `armSpreadDegreesPerSecond` and `maxArmSpreadDegrees` have no controls, are shown read-only, and survive export unchanged.

### Preview

- **L14 - The game's inputs.** A draft attack is drawn with its real burst index, volley index and time since its clock's epoch, so per-burst advance and arm spread show as they do in the game. N38 still governs tags.
- **L15 - One source at a time.** In a primary study a switch chooses whether the preview draws the draft or the tags, never both. A minion study always draws the draft.
- **L16 - One monster, one fixed emitter.** The preview draws only the selected monster, from the existing fixed emitter, with no movement. A nest therefore fires from the emitter rather than its real position, and a chasing monster stays still. Timing and shape can be checked. Other monsters are not drawn.

### Sync

- **L17 - Anchors belong to blocks.** A block is a phase with no sub-phases, or one sub-phase. Every monster has its own block list, and each block has a "Starts here" button using the presented frame's `mediaTime`. Attacks are never anchored individually.
- **L18 - Sub-phases are separate blocks.** Each sub-phase has its own anchor. There is no automatic cycling. A block runs the phase's attacks plus that sub-phase's attacks, matching `activeAttacks`.
- **L19 - A block with no authored duration.** It stops firing at the monster's next anchor in video time, or at the end of the video. Shots already fired finish their flight.
- **L20 - An anchor means entry.** The anchor is the moment the block is entered. The preview adds the block's authored telegraph, as the game does.
- **L21 - One anchor per block.** Pressing the button again moves it. To check a later cycle, move the anchor.
- **L22 - Anchors are not game data.** An anchor only aligns a study and is never exported. `initialDelaySeconds` stays a typed value, and T32 stands.

### Export

- **L23 - A copy box.** Export is a read-only box with a copy button. Nothing is written to disk and the build configuration does not change.
- **L24 - One monster's whole file.** The box holds the selected monster's complete file text and names its path. Editing several monsters means one paste each.
- **L25 - No edited marker.** The selector does not mark edited monsters. Each study has its own export box, and the session list shows which monster each saved session belongs to.
- **L26 - Provenance on edit.** Editing or adding an attack sets its `tuningSource` to `video-observation`. An edited attack keeps its id, with no `-tagged` suffix.
- **L27 - Applying is separate.** Each applied export is its own approved change that bumps `rulesVersion` and updates test pins and snapshots. This plan loosens no test.

### Persistence And Later Game Changes

- **L28 - A full copy.** A study stores a full copy of its monster's attacks and anchors, in schema v4 studies and autosave. There is no merging if the game changes later.
- **L29 - Load from game.** An explicit "Load from game" button loads the study's monster, with the existing inline confirmation before replacing a draft. It replaces only the attacks: anchors stay. A study that has never loaded draws nothing in draft mode.
- **L30 - Export starts from the current file.** The export takes the monster's current file in the game and replaces only its attack lists from the draft, so hand edits to phase values survive. It refuses, naming the id, if a phase or sub-phase in the draft and in the file no longer correspond.

### Deferred Items This Touches

- **L31 - D34 stays deferred.** Tags stay first-match and independent of the draft.
- **L32 - D26 stays deferred.** `mediaTime` stays the only clock, so the draft preview needs a video.

### Consequences Recorded While Writing This Plan

These follow from the decisions above rather than from a separate question. The user may overrule any of them.

- **L33 - Autosave slots per video and monster (amends Z28).** One slot per video file name would make a second monster's study overwrite the first. The primary monster keeps today's key, so existing slots keep working; a minion's key adds its archetype id.
- **L34 - One active block per monster.** L19 names the next anchor as the stop for a block with no duration. A block with an authored duration also stops at the monster's next anchor if that comes first, because in the game a monster runs one block at a time and a health gate can end a timed sub-phase early. Blocks anchored at the same time resolve in authored order, and the later one wins.
- **L35 - An anchor can be cleared.** A wrong anchor shortens the block before it, so each anchor has a Clear button as well as being movable.
- **L36 - A projectile with no sprite draws nothing.** The preview needs an appearance to draw. Only `crystal-worm-child-shard` lacks one, which is D14's subject, so the Worm's `spiral-shards` can be edited and exported but not seen. The panel says so rather than showing an empty preview silently.
- **L37 - One exported helper.** `attackSpecFromAuthored` in `game/config/encounter.ts` gains the `export` keyword, so the preview and export validation reuse the game's conversion rather than duplicating it. The behaviour does not change.

## Architecture

Additions only. The one-way `research/` boundary (T13) stands: nothing under `game/` imports from `research/`.

| Module | Owns | Must not |
| ------ | ---- | -------- |
| `game/data/enemies/<archetype-id>.json` | One monster's authored data, as a plain archetype object | Hold anything shared between monsters |
| `game/config/data.ts` | Importing the 12 files in today's order, merging them for `validateArchetypes`, and exporting the raw parsed files as `AUTHORED_MONSTER_FILES` | Change any validation or derived value |
| `research/monsterDraft.ts` | Pure: the monster list, the block list, loading a draft, editing attacks, and building the export text | Import React, the DOM or storage, or write anywhere |
| `research/draftPreview.ts` | Pure: block windows from anchors, volley times from cadence, and one preview frame | Run the simulation, own a clock, or read tags |
| `research/DraftPanel.tsx` | The block list, anchor buttons, attack editor, load button and export box | Own the video, seek logic or study storage, which stay in the route |
| `research/TaggerRoute.tsx` | The monster selector, study switching, and hiding tag controls in a minion study | Hold draft logic that can live in a pure module |

## Target Data Shapes

```ts
// research/monsterDraft.ts
export type DraftBlock = Readonly<{
  /** `phaseId`, or `phaseId/subPhaseId` for a sub-phase. */
  id: string;
  phaseId: string;
  subPhaseId: string | null;
  label: string;
  /** The sub-phase's telegraph, or the phase's when it has no sub-phases. */
  telegraphSeconds: number;
  /** `durationSeconds`, or `exitAfterSeconds`; null when neither is authored. */
  durationSeconds: number | null;
}>;

export type MonsterDraft = Readonly<{
  phases: readonly Readonly<{
    phaseId: string;
    attacks: readonly AuthoredAttack[];
    subPhases: readonly Readonly<{
      subPhaseId: string;
      attacks: readonly AuthoredAttack[];
    }>[];
  }>[];
  /** Block id to video seconds; never exported (L22). */
  anchors: Readonly<Record<string, number>>;
}>;

// research/tagging.ts
export type ObservationExportV4 = Readonly<{
  schemaVersion: 4;
  encounterId: string;
  archetypeId: string;
  provenance: VideoProvenance;
  recordedAt: string;
  savedAttacks: readonly SavedAttack[];
  tags: readonly StoredTag[];
  monsterDraft: MonsterDraft | null;
}>;

export type StudyState = Readonly<{
  encounterId: string;
  /** Null on a study older than v4, which means the primary monster. */
  archetypeId: string | null;
  provenance: StudyProvenance;
  savedAttacks: readonly SavedAttack[];
  tags: readonly StoredTag[];
  monsterDraft: MonsterDraft | null;
}>;
```

The game's clock, which the draft preview reproduces (`simulation.ts:updateAttackClock`, `phases.ts:enterSubPhase`):

```text
epoch            = anchor + telegraphSeconds
burstPeriod      = (shotsPerBurst - 1) * shotIntervalSeconds + cooldownAfterLastShotSeconds
volleyTime(g, s) = epoch + initialDelaySeconds + g * burstPeriod + s * shotIntervalSeconds
ringPhase(t)     = initialPhase + clockwiseDegreesPerSecond * (t - epoch)
```

A block fires volleys only before its end, which is the earliest of `anchor + durationSeconds`, the monster's next anchor, and the end of the video.

## Approved Scope And Review Gates

- After phase 73, no file under `app/src/game/` changes for the rest of this plan. In phase 73 the merged data must equal `enemies.json` as it stood, every simulation snapshot must pass unchanged, and both `rulesVersion` values stay as they are.
- `docs/killer-bee-queen-observations.json` stays byte-identical, and its schema test keeps passing.
- A study with no draft, on the primary monster, behaves as it does today: its tags, saved attacks, preview, exports and autosave slot.
- For each of the 12 monsters, loading a draft and exporting it untouched produces text byte-identical to its file.
- Every number added is a named constant or a person's typed estimate. The starting values of a new attack are input conveniences, labelled so. No fidelity claim is made.
- New testable behaviour is written test-first in pure modules. No Playwright case is added. Each UI step records its manual checks as performed or blocked.
- `npm run verify` passes at the end of each phase.
- No commit, push, deployment, change to shipped tuning or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 73 | One File Per Monster | complete | None |
| 74 | The Monster Draft | complete | Phase 73 |
| 75 | The Draft Preview | complete | Phase 74 |
| 76 | Choosing A Monster | implemented, manual checks blocked | Phase 75 |
| 77 | The Draft Panel | implemented, manual checks blocked | Phase 76 |
| 78 | Guide And Acceptance | guide written, acceptance blocked | Phase 77 |

## Phase 73: One File Per Monster

Enemy data now lives in 12 per-monster files merged by the loader into exactly the former data, with no gameplay change. Archive: [`phase-73.md`](plan-archive/phase-73.md).

## Phase 74: The Monster Draft

A pure monster draft loads, edits and exports each monster byte-identically, with schema v4 studies and per-monster autosave slots. Archive: [`phase-74.md`](plan-archive/phase-74.md).

## Phase 75: The Draft Preview

A pure draft preview reproduces the game's clock from block anchors and matches a real simulation run. Archive: [`phase-75.md`](plan-archive/phase-75.md).

## Phase 76: Choosing A Monster

Status: implemented; manual checks blocked (no browser or video in the implementing session). Dependencies: phase 75. Steps: [`phase-76.md`](plan/phase-76.md).

## Phase 77: The Draft Panel

Status: implemented; manual checks blocked. Dependencies: phase 76. Steps: [`phase-77.md`](plan/phase-77.md).

## Phase 78: Guide And Acceptance

Status: guide written; the real-video acceptance run (78.2) is blocked. Dependencies: phase 77. Steps: [`phase-78.md`](plan/phase-78.md).
