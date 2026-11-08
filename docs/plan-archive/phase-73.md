# Phase 73: One File Per Monster

> Step prompts and execution records for phase 73 of [plan V18](../plan-v18.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 73.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-73.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 73.1 - Split The Enemy Data

Status: complete. Dependencies: none.

**Implementation prompt**

Split `app/src/game/data/enemies.json` into `app/src/game/data/enemies/<archetype-id>.json`, one file per entry under `archetypes` (L03). Each file holds that archetype object exactly as authored, including its own `comment`, written as `JSON.stringify(archetype, null, 2)` plus a trailing newline. Generate the files with a throwaway script outside the repository, then delete `enemies.json`. Move the file's top-level `comment` into a code comment beside the imports in `game/config/data.ts`, so its provenance note survives.

In `game/config/data.ts`, replace the one import of `enemies.json` with 12 explicit imports in today's archetype order. Build `{ archetypes: { ... } }` from them with each key equal to its archetype id, and pass that to `validateArchetypes` unchanged. Export the raw parsed files as `AUTHORED_MONSTER_FILES`, a frozen record from archetype id to parsed JSON, for the tagger's load and export. Do not use a glob, because order must stay exact and a stray file must not join the game silently.

In `game/config/encounter.ts`, add the `export` keyword to `attackSpecFromAuthored` and change nothing else (L37).

No gameplay value, validator, `rulesVersion` or derived config changes.

**Focused checks**

Before deleting `enemies.json`, write a temporary failing test asserting that the merged object deep-equals `enemies.json`, with the same key order at the top level, then make it pass and remove it along with the old file. Add a lasting test in `game/config/data.test.ts`: `AUTHORED_MONSTER_FILES` has one entry per authored archetype, each entry's key matches its file name, and every monster file's text equals `JSON.stringify(parsed, null, 2)` plus a newline, read through a raw import.

**Acceptance**

The temporary equality test passed before removal, and its result is recorded here. `config.test.ts`, `data.test.ts` and every characterization snapshot pass with no snapshot or pinned value changed. Both `rulesVersion` values are unchanged. `git diff` shows no change under `app/src/game/` other than the data split, the `data.ts` imports and export, and the one `export` keyword.

**Execution record**

Split `enemies.json` into 12 files under `app/src/game/data/enemies/` (written with `JSON.stringify(archetype, null, 2)` plus a newline by a Node script, so number formatting matches the loader round trip), deleted `enemies.json`, moved its top-level comment into `data.ts`, replaced the import with 12 explicit imports in the original order, and exported the frozen `AUTHORED_MONSTER_FILES`. Added the `export` keyword to `attackSpecFromAuthored`. The temporary test asserting that the merged object deep-equals the former file, with the same key order, passed before the old file and the test were removed. The lasting test in `data.test.ts` checks one file per archetype, matching names and canonical text. `rulesVersion` and all snapshots are unchanged.

### Step 73.2 - Point Current Text At The New Files

Status: complete. Dependencies: 73.1.

**Implementation prompt**

Update text a person still reads that names `enemies.json`: the two validator messages in `game/config/data.ts` (`must name an archetype defined in enemies.json`) to say `game/data/enemies/`; the comment in `ui/EncounterScreen.tsx`; the comments, `FRONT_EXPORT_NOTE` and the paste instruction in `research/exportAttack.ts`, `research/exportAttack.test.ts` and `research/TaggerRoute.tsx`; and the `enemies.json` mentions in `docs/tagger-guide.md`. Name the monster's file where the text tells a person where to paste.

Do not edit archived plans, older plan files, or `docs/mechanics.md`'s historical decision text, which describe what was true when written.

**Focused checks**

Adjust any test asserting the changed strings, including a `config.test.ts` or `data.test.ts` assertion on the validator message, before changing the strings. Grep `app/src`, `app/tests` and `docs/tagger-guide.md` for `enemies.json` and confirm no match remains.

**Acceptance**

The grep is empty. No behaviour changes. `npm run verify` passes.

**Execution record**

Updated the two validator messages, the `EncounterScreen` comment, `exportAttack.ts`, its test comment, the `TaggerRoute` paste instruction and `docs/tagger-guide.md` to name `game/data/enemies/`. A grep for `enemies.json` over `app/src`, `app/tests` and the guide is empty.
