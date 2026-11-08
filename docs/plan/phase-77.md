# Phase 77: The Draft Panel

> Step prompts and execution records for phase 77 of [plan V18](../plan-v18.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 77.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-77.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 77.1 - The Boundary, Loading And The Block List

Status: implemented, manual checks blocked. Dependencies: phase 76.

**Implementation prompt**

In `AGENTS.md`'s Scope and design section, keep "a tuning UI" in the out-of-scope list and add one sentence: a development-only tagger editor that produces monster JSON for a person to apply, and that the running game never reads, is not a tuning UI (plan V18 L01). Make no other change to that file.

Create `research/DraftPanel.tsx` as a separate component rendered by the route, with CSS Modules like its neighbours. It shows a **Load from game** button that loads `AUTHORED_MONSTER_FILES[archetypeId]`, confirming inline before replacing a draft (L29). Any anchor dropped by a reload is named in a notice. Before loading, the panel shows only that button.

Once loaded, list the monster's phases and blocks in authored order. Each block row shows its label, telegraph and duration read-only (L11), a **Starts here** button, its anchor time if set, and a **Clear** button (L17, L21, L35). A phase's attacks are listed under the phase, and a sub-phase's under the sub-phase. Show read-only monster-level values only if that needs no new model.

**Starts here** records the presented frame's `mediaTime`, through the same guard that refuses a tag while a seek is pending (T19). It is disabled with no video. Setting or clearing an anchor marks the study dirty so autosave runs.

**Focused checks**

Pure logic is already covered by phase 74. Check by hand: loading the Queen lists 15 blocks and 60 attack entries; a press records the shown frame time; pressing again moves it; Clear removes it; a press during a seek is refused; the preview starts firing from the anchor; and a reload after moving a hand-changed phase id reports the dropped anchor.

**Acceptance**

Editing the panel's state never reaches the running game: nothing under `game/` imports the panel or draft. The `AGENTS.md` change is exactly the one sentence.

**Execution record**

Added the one sentence to `AGENTS.md`, and `research/DraftPanel.tsx` with Load from game (inline confirm, dropped-anchor notice), the block list with Starts here, anchor time and Clear, and the attack lists. Nothing under `game/` imports the panel or draft. Manual checks BLOCKED (no browser or video).

### Step 77.2 - The Attack Editor

Status: implemented, manual checks blocked. Dependencies: 77.1.

**Implementation prompt**

Add an editor for the selected attack, using the existing commit-on-blur input pattern and each operation from step 74.2. It has controls for the L13 fields only: a projectile select over the catalog showing its sprite and id (L12); pattern kind; the fields of that kind; aim and its bearing or offset; `target`; and the four cadence values, including `initialDelaySeconds` (L22). Show `perBurstAdvanceDegrees`, `gapSectorsDegrees` and the arm-spread fields read-only when present (L13). An edit the game's validators refuse leaves the draft unchanged and shows the validator's message. A kind change that removes fields names them in a notice. The preview updates from the draft on the next presented frame, through the existing path.

Add **Add attack** at each phase and sub-phase, asking for an id, and **Delete** with the existing inline confirmation (L10). The defaults are labelled as a starting point, not a value from the game.

**Focused checks**

Check by hand: change a Queen ring's arms and rotation and see the preview change while paused and playing; change `initialDelaySeconds` and see the first volley move; pick another projectile; try a duplicate id, a zero cooldown and a `target` on a ring and read each refusal; change the kind on an attack with per-burst advance and read the notice; add and delete an attack; reload the page and confirm autosave restored the edits.

**Acceptance**

Fields with no control survive editing the same attack, confirmed by the step 74.2 tests and by the export in step 77.3. Editing never touches anchors, phase values or monster values.

**Execution record**

Added the attack editor (projectile select with sprite, kind, fields, aim, target, four cadence values, read-only hidden ring fields, add with id, delete with inline confirm). Edits go through `editAttack`, so refusals show the validator message. Manual checks BLOCKED.

### Step 77.3 - The Export Box

Status: implemented, manual checks blocked. Dependencies: 77.2.

**Implementation prompt**

Add a read-only export box to the panel, using the same copy behaviour as `ExportBox` (L23, L24). It shows `monsterFileText` for the current draft against the current `AUTHORED_MONSTER_FILES` entry (L30) and `monsterFilePath` as the place to paste it. Add a plain note beside it: pasting this changes gameplay, and the `rulesVersion` bump and test updates are a separate approved change (L27). A refusal from `monsterFileText` replaces the text with its message. Nothing is written to disk, and the existing per-tag attack export stays as it is in a primary study.

**Focused checks**

Check by hand: with an untouched Queen draft, paste the box into a scratch file outside the repository and confirm `diff` with `app/src/game/data/enemies/killer-bee-queen.json` is empty; then edit one attack and confirm the diff shows only that attack; edit a bee and confirm the path names the bee's file; hand-change a phase value in a monster's file, let the dev server reload, and confirm export keeps it. Restore any file changed for this check.

**Acceptance**

No file under `app/src/game/` differs after the step. `npm run verify` passes.

**Execution record**

Added the read-only export box with Copy file, the target path and the rulesVersion note. A refusal replaces the text with its message. Manual diff checks BLOCKED; byte identity is covered by the 74.3 unit test for all 12 monsters.
