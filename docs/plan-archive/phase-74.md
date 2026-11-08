# Phase 74: The Monster Draft

> Step prompts and execution records for phase 74 of [plan V18](../plan-v18.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 74.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-74.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 74.1 - Monsters, Blocks And Loading

Status: complete. Dependencies: phase 73.

**Implementation prompt**

Create `research/monsterDraft.ts`, pure, with the `DraftBlock` and `MonsterDraft` shapes from the plan's Target Data Shapes.

- `monstersOfEncounter(config)` returns the primary monster first, then every monster reached by walking authored spawns on phases and sub-phases recursively, each once, in first-seen order (L05). `game/config/phaseDossier.ts` shows the walk.
- `blocksOfMonster(archetype)` returns one block per phase with no sub-phases and one per sub-phase (L17, L18). A sub-phase block takes `telegraphSeconds` and `durationSeconds` from the sub-phase. A phase block takes `telegraphSeconds` and `exitAfterSeconds`, as `durationSeconds`, from the phase, matching `enterPhase` and `enterSubPhase`.
- `loadMonsterDraft(rawFile, previous)` copies every attack list from a raw `AUTHORED_MONSTER_FILES` entry, in authored order and with every authored field, into a `MonsterDraft` (L04, L28). Anchors come from `previous` for blocks that still exist, and the function also returns any anchor it dropped so the caller can say so (L29). With no `previous`, anchors are empty.
- `activeDraftAttacks(draft, blockId)` returns the phase's attacks, then the sub-phase's, matching `activeAttacks` (L18).
- `setAnchor(draft, blockId, seconds)` and `clearAnchor(draft, blockId)` return a new draft (L21, L35).

**Focused checks**

Write failing `monsterDraft.test.ts` cases first: the Queen's encounter lists 11 monsters and the Worm's lists 1; the Queen has 15 blocks, with the right telegraph and duration on a sub-phase block, on `phase-6-nests` (29 s) and on an untimed phase; a nest has 2 blocks and a bee has 1; a phase-level attack appears in each of its sub-phases' active lists; and a reload keeps an anchor, drops one for a missing block and reports the drop.

**Acceptance**

The module imports no React, DOM, storage or simulation. A loaded draft deep-equals the file's attack lists for all 12 monsters.

**Execution record**

Added `research/monsterDraft.ts` (`monstersOfEncounter`, `blocksOfMonster`, `loadMonsterDraft`, `activeDraftAttacks`, `setAnchor`, `clearAnchor`) with `monsterDraft.test.ts`. The Queen lists 11 monsters and 15 blocks; the Worm lists 1. A loaded draft deep-equals the file for all 12 monsters.

### Step 74.2 - Editing Attacks

Status: complete. Dependencies: 74.1.

**Implementation prompt**

Add pure edit operations to `research/monsterDraft.ts`, each returning `{ ok: true, value }` or `{ ok: false, error }` and leaving the input unchanged on failure, matching `savedAttacks.ts`:

- `editAttack(draft, location, change)` applies a field change to one attack, keeps its id and sets `tuningSource` to `video-observation` using the existing `EXPORT_TUNING_SOURCE` (L26). The fields are the ones L13 names: projectile; pattern kind; a ring's arms, arm pattern, shots per arm, arm arc or cone, rotation rate, initial phase and emitter radius; a spread's or scatter's shots, arc or cone, aim, offset or fixed bearing, and emitter radius; the four cadence values; and `target`.
- A change of pattern kind keeps what still applies, removes what does not, and returns the removed field names so the panel can show them. Fields without controls (L13) survive any edit that keeps the kind `ring`.
- `addAttack(draft, location, id)` adds an attack from a named `NEW_ATTACK_DEFAULTS`, documented as an input convenience and not an observation, using the first catalog projectile and `tuningSource: "video-observation"` (L10, L12).
- `deleteAttack(draft, location, id)` removes one attack (L10).

Validate every result with the game's exported `validateAttack`, passing `AUTHORED_PROJECTILES`' ids and the other attacks' ids within the monster, then with `validateAttackSpec(config, attackSpecFromAuthored(attack))`. Report the validator's message unchanged as the error. A `location` names a phase id and an optional sub-phase id.

**Focused checks**

Write failing cases first: an edit changes only the named field and sets `tuningSource`; `perBurstAdvanceDegrees`, `gapSectorsDegrees` and arm-spread fields survive an edit to the same ring; an unknown projectile, a non-positive cadence value, a duplicate id and a `target` on a ring are refused with the input unchanged; ring to spread reports the removed fields; and add and delete act only at their location.

**Acceptance**

No edit can produce an attack the game's validators refuse. No operation touches anchors or any value outside the attack lists (L11).

**Execution record**

Added `editAttack`, `addAttack`, `deleteAttack` and `NEW_ATTACK_DEFAULTS`, validated through the validators `validateAttack` and `validateAttackSpec` with their messages passed through unchanged. `editAttack` and `addAttack` take the encounter config as a final argument because validation needs the projectile catalog.

### Step 74.3 - The Export Text

Status: complete. Dependencies: 74.2.

**Implementation prompt**

Add `monsterFileText(draft, currentRawFile, config)` to `research/monsterDraft.ts`. Starting from a deep copy of the monster's current raw file, it replaces each phase's and sub-phase's `attacks` value in place, by id, so key order and every other field stay as they are (L30). It refuses, naming the id, when a phase or sub-phase exists on one side but not the other. It validates the result by passing the merged monster set through `validateArchetypes`, then each attack through `validateAttackSpec`. It returns `JSON.stringify(result, null, 2)` plus a trailing newline, and it never includes an anchor (L22). Add `monsterFilePath(archetypeId)`, which returns the repository-relative path shown in the box (L24).

**Focused checks**

Write failing cases first: for each of the 12 monsters, loading and exporting untouched is byte-identical to the file's raw text; a hand-changed phase value in `currentRawFile` survives export (L30); a missing phase and a missing sub-phase are each refused by name; an edited attack appears in place with its id kept; and the output contains no anchor.

**Acceptance**

The byte-identical test covers all 12 monsters by iterating `AUTHORED_MONSTER_FILES`, not a hand-kept list.

**Execution record**

Added `monsterFileText(archetypeId, draft, currentRawFile, config)` and `monsterFilePath`. An untouched export is byte-identical for all 12 monsters (iterating `AUTHORED_MONSTER_FILES`). The archetype id is an extra first parameter because the merged-set validation needs it.

### Step 74.4 - Schema V4, Draft Version 3 And Slots

Status: complete. Dependencies: 74.1.

**Implementation prompt**

In `research/tagging.ts`, add `ObservationExportV4` and extend `StudyState` as the plan shows. `validateObservationExport` accepts versions 2, 3 and 4 or none, checking on v4 that `archetypeId` is a nonempty string and that `monsterDraft` is null or structurally a draft: arrays of phases with string ids and record attacks, and an `anchors` record of finite nonnegative numbers. Attack contents are not checked against the game here, so a study stays loadable after the game changes (T31). `studyFromExport` gives older files `archetypeId: null` and `monsterDraft: null`. `assembleExport` always writes v4, and the route passes the study's monster and draft.

In `research/studyLoad.ts`, add a pure referential check for the route: an `archetypeId` that is not in `monstersOfEncounter`, or a non-primary study carrying tags or saved attacks (L09), produces a load error naming the problem.

In `research/taggerSessions.ts`, raise the draft to version 3, carrying `archetypeId` and `monsterDraft`, and keep reading versions 1 and 2 as the primary monster with no draft. `TaggerSessions.keyFor(fileName, minionArchetypeId?)` keeps today's key when the argument is absent and otherwise appends the id (L33). `SessionListEntry` gains `archetypeId`. `write` chooses the key from the draft, so the primary monster's slot stays where it is today.

**Focused checks**

Write failing cases first: a v4 round trip including a draft and anchors; each older version loads with a null monster and draft; a malformed draft and a negative anchor are rejected; `docs/killer-bee-queen-observations.json` still passes unchanged and stays byte-identical; two monsters on one video write two slots, and neither overwrites the other; an existing version 2 slot still restores as the primary monster; and the referential check catches an unknown monster and tags on a minion.

**Acceptance**

Existing tests for older files pass unmodified except where they assert the written schema or draft version. `npm run verify` passes.

**Execution record**

Schema v4 (`ObservationExportV4`, `validateMonsterDraft`), `StudyState.archetypeId` and `monsterDraft`, session drafts at version 3, `TaggerSessions.keyFor(fileName, minionArchetypeId?)`, `write(draft, primaryArchetypeId?)` (the primary id lets the primary monster keep today's slot), `SessionListEntry.archetypeId`, and `studyMonsterProblem` in `studyLoad.ts`. Tests asserting the written schema or draft version were updated (3 to 4, 2 to 3, and one `schemaVersion: 4` rejection test moved to 5). `docs/killer-bee-queen-observations.json` is untouched and its test passes.
