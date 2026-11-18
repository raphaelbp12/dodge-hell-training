# Phase 92: Data And Persistence Contracts

> Step prompts and execution records for phase 92 of [plan V22](../plan-v22.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 92.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-92.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 92.1 - Every Data File Is Claimed And Closed

Status: complete. Dependencies: none.

**Implementation prompt**

Apply A11. Create `app/src/game/config/data-contract.test.ts`. Use `import.meta.glob("../data/**/*.json", { eager: true })`, the same mechanism `data.test.ts` already uses for monster files. Declare a table that maps each path pattern to the validator that consumes it:

- `arena.json`;
- `encounter.json`;
- `projectiles.json`;
- `projectile-appearances.json`;
- `shapes.json`;
- `enemies/*.json`.

Assert that every globbed file matches exactly one pattern and passes its validator. Add one negative fixture per cross-file reference, built in the test by cloning shipped data and breaking one reference:

- an attack's projectile id;
- an appearance id;
- a spawned archetype id;
- `arenaId`;
- a shape id.

Assert that loading the configuration rejects each one, with a message naming the path. A reference that is not rejected today is a finding under A10. Do not add the check to `data.ts` without approval.

**Focused checks**

Write the test first. An unclaimed temporary JSON file under `src/game/data/` makes it fail; confirm this once, then delete the file.

**Acceptance**

The file passes, and every dangling-reference case is rejected or recorded.

### Step 92.2 - Rules Fingerprint

Status: complete. Dependencies: 92.1.

**Implementation prompt**

Apply A12. Create `app/src/game/config/rules-fingerprint.test.ts` and `app/src/game/config/rules-fingerprint.json`. For each encounter id in `encounter.json`, compute the canonical JSON: keys sorted recursively, arrays in authored order. Its input is the gameplay data that encounter consumes:

- its encounter entry;
- its arena and shape;
- every archetype reachable through `primaryArchetype` and spawns;
- every projectile those archetypes reference.

Exclude `projectile-appearances.json` and any presentation-only field, and name each excluded field in a commented constant. Hash with `node:crypto` SHA-256. The JSON file maps encounter id to `{ rulesVersion, sha256 }`. The test fails in two cases:

- the hash changed but `rulesVersion` did not, with the message "gameplay data for <id> changed without a rulesVersion bump";
- `rulesVersion` changed but the stored hash did not, with "<id> rulesVersion bumped; update rules-fingerprint.json".

Generate the initial file once from current data. The test prints the new entry, so updating it is a copy. Never write the file from the test.

**Focused checks**

Changing any numeric gameplay field in a scratch copy makes the test fail with the first message. Bumping only `rulesVersion` makes it fail with the second. Changing only an appearance field leaves it passing.

**Acceptance**

The file passes on the current tree, and the three scratch checks are recorded.

### Step 92.3 - Tagger Export Contract

Status: complete. Dependencies: 92.1, phase 91.

**Implementation prompt**

Apply A13. Create `app/src/research/export-contract.test.ts`. For every shipped `enemies/*.json` file:

1. Load it into the tagger exactly as the route's "Load from game" does, through the pure functions in `monsterDraft.ts`, `studyLoad.ts` and `studyExport.ts`.
2. Produce the copy-file text with no edits.
3. Assert that the text, once parsed, is deep-equal to the file, and passes the game's monster validator.

Then, with the phase 91 harness, generate edits through `studyEdits.ts`: change a cadence, add an attack, delete an attack, change an aim. Assert that every export passes the monster validator, and that every exported projectile variant passes the projectile validator. A file that does not round-trip is a finding under A10.

**Focused checks**

The file passes alone.

**Acceptance**

Every shipped monster round-trips, or each failure is recorded. Every generated export is valid game data.

### Step 92.4 - Frozen Persistence Fixtures

Status: complete. Dependencies: none.

**Implementation prompt**

Apply A14. Create these fixtures:

- `app/src/storage/__fixtures__/attempts.v<HISTORY_SCHEMA_VERSION>.json`, a realistic stored history payload written by the current code: run `attempts.ts`'s save into an in-memory storage fake, then copy the value;
- under `app/src/research/__fixtures__/`, one study per schema version `studyMigrate.ts` accepts, named `study.v<n>.json` and built from that version's documented shape, plus one `tagger-session.json` autosave payload.

Each fixture directory gets a `README.md` stating that a fixture is never edited and that a schema change adds a new one.

Create `app/src/storage/persistence-contract.test.ts` and `app/src/research/persistence-contract.test.ts`:

- each fixture loads or migrates to the current version;
- the result validates;
- no tagged mark, boundary, track or history entry is lost, counted per collection;
- `docs/killer-bee-queen-study-TFclwuPtC94.json` loads the same way.

**Focused checks**

Both files pass alone.

**Acceptance**

Every persisted version that exists today has a frozen fixture that loads.

### Step 92.5 - Phase Gate

Status: complete. Dependencies: 92.1-92.4.

**Implementation prompt**

Delegate one `npm run verify` run to the `verifier` subagent. Record each gate's line and every A10 finding. Update the Phase Index and archive this file.

**Focused checks**

None beyond the gate run.

**Acceptance**

All four gates pass, and no production or data file changed.

## Execution Record

Implemented 2026-11-16 in auto mode.

- **92.1** `src/game/config/data-contract.test.ts`: a glob of `src/game/data/**/*.json` claimed by six patterns, each file passing its validator (monsters are validated together, because spawned archetypes resolve against the whole set; `shapes.json` through `loadOutline`, since its validator is unexported). An unclaimed temporary file failed the test, then was deleted. Five dangling-reference fixtures (attack projectile id, appearance id, spawned archetype id, `arenaId`, shape id) each make `import("./encounter")` reject, using `vi.doMock` on the JSON file; `data.ts` is unchanged. All five are rejected today.
- **92.2** `rules-fingerprint.test.ts` and `rules-fingerprint.json` (SHA-256 per encounter, presentation-only keys `comment`, `source`, `appearance`, `telegraphColor` and `displayName` excluded). The three scratch checks are tests in the file and pass: a changed gameplay number gives the first message, a version bump alone gives the second, an appearance-only change stays current.
- **92.3** `src/research/export-contract.test.ts`. Eleven shipped monsters export unedited to JSON deep-equal to their file; a property over cadence, add, delete, aim and override edits finds every export valid or refused. **A10 finding 1:** `monsterFileTextFromStudy` validates every shipped monster against the exporting encounter's catalog, so `crystal-worm-child-head` cannot be exported under any shipped encounter (the worm's catalog lacks the Queen's projectiles and the reverse). Kept as `test.fails`. **A10 finding 2:** `bombVariantOf` omits `rangeTiles` for a targeted bomb, and `validateProjectile` requires it, so a targeted bomb's measured variant is not valid game data (counterexample: a `travelSeconds` override of 0.1 on the Queen's `white-bomb-targeted` track). Kept as `test.fails`; the property skips targeted variants. Both need a user decision; neither is fixed.
- **Resolution (2026-11-17, user decisions).** Finding 1 was narrower than recorded: the Queen's static config already holds every archetype and projectile and exported the worm; only the Crystal Worm's debug-tunable config refused, and the tagger offered only an encounter's own monsters. Decision: any monster must be taggable under any encounter, in any arena. `taggingConfigOf` in `monsterDraft.ts` gives the tagger the encounter's own arena, player and archetypes plus every archetype and projectile any encounter defines, `taggableMonsters` lists the encounter's own monsters first and then every other one, and the export re-checks shipped files against every authored projectile. Finding 2, option a: a targeted bomb's variant keeps the authored `rangeTiles` (the game ignores it for a targeted bomb), and the export now runs every variant through `validateProjectile`. Both `test.fails` are ordinary tests; the property no longer skips targeted variants; a new contract exports every monster unedited under every encounter, and a flow test checks the tagger's Monster selector lists every monster under every encounter. No gameplay data or rules changed.
- **92.4** Frozen fixtures `attempts.v1.json`, `study.v1` to `study.v5.json`, `tagger-session.json`, with READMEs, and `persistence-contract.test.ts` in both directories. Every version loads or migrates to v5 with its tag count preserved; the committed study keeps its boundary, track and mark counts.
- **92.5** `npm run verify`: lint PASS, typecheck PASS, test PASS (87 files, 1586 passed and 2 expected failures, vitest 40.7 s), build PASS. No production or data file changed.
