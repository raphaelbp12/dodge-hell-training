# Phase 76: Choosing A Monster

> Step prompts and execution records for phase 76 of [plan V18](../plan-v18.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 76.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-76.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 76.1 - The Monster Selector And One Study Per Monster

Status: implemented, manual checks blocked. Dependencies: phase 75.

**Implementation prompt**

In `research/TaggerRoute.tsx`, add a monster selector beside the encounter selector, listing `monstersOfEncounter(config)` by readable name, and hold `archetypeId` and `monsterDraft` as study state (L06, L07). A study loaded or restored with `archetypeId: null` belongs to the primary monster. Pass both through `exportTags`, autosave, `applyStudy` and `restoreSession`, and run the referential load check from step 74.4. Changing encounter selects its primary monster.

Add pure `monsterSwitchPlan` to `research/studyLoad.ts`, and use it for switching (L08). It decides from the current video name, the current study's unsaved state, whether autosave is failing, and whether a slot exists for the selected monster. Switching writes the current study to its slot, then opens the selected monster's slot for this video, or an empty study that keeps `sourceUrl` and `frameRate`. It never touches the video element or `mediaTime`. If autosave is failing and the study has unsaved work, it asks for the existing inline confirmation first, naming what would be lost.

Extend `videoChoiceDecision`, `encounterChangeDecision`, `loadDecision` and their messages so a draft counts as content to confirm before replacing, as tags do. The session list shows each entry's monster (L25). A downloaded minion study is named `<encounter>-<archetype>-observations.json`; a primary study keeps today's name.

**Focused checks**

Write failing cases first for `monsterSwitchPlan` and the extended decisions: switching with a slot opens it; switching with none starts empty and keeps provenance; no video means no slot is written; failing autosave with unsaved work asks first; a draft requires confirmation on a new video, encounter change and study load. Then check by hand in the running route: tag a little on the Queen, switch to a bee and back, and confirm the video did not reload, its time held and the tags returned.

**Acceptance**

A primary study with no draft behaves as it does today, including its autosave key and download name. Switching monsters never loses a saved study.

**Execution record**

Added the monster selector, `archetypeId` and `monsterDraft` study state, `monsterSwitchPlan`, draft-aware `loadDecision`, `videoChoiceDecision` and `encounterChangeDecision`, `observationFileName`, the referential check on load and restore, and a Monster column in the session list. Pure parts are tested. Manual check BLOCKED: no browser or video was available in this session, so switching on the running route was not exercised.

### Step 76.2 - Minion Studies And The Preview Source

Status: implemented, manual checks blocked. Dependencies: 76.1.

**Implementation prompt**

In a minion study, hide the tag controls, tag table, interval summary, saved-attack panel, per-row attack export and the preview's tuning controls (L09). Keep the video, its transport and frame stepping, the timeline, provenance fields and study save and load. Add one pure helper deciding what shows, so the rule has one home. Do not change tag behaviour in a primary study.

Add the preview source (L15). A primary study has a Draft and Tags switch, starting on Tags and moving to Draft when a draft loads; it is view state and is not saved. A minion study always draws the draft. Give `PreviewPanel` a draft frame path that calls `draftPreviewAt` with the video's presented `mediaTime` and duration, and leave its tag path unchanged. It shows a short note naming `undrawnAttackIds` (L36) and, in draft mode, a note that the emitter is fixed and only the selected monster is drawn (L16). The tuning controls and unmatched-tag notice stay on the tag path only.

**Focused checks**

Write failing cases first for the visibility helper, for primary and minion studies. Then check by hand: a bee study shows no tag controls and keeps the video controls, and the switch in a Queen study changes only what the canvas draws. The panel itself arrives in phase 77, so check draft drawing here with a draft restored from a test fixture.

**Acceptance**

A Queen study on Tags draws exactly what it draws today. The draft path reads `mediaTime` and starts no timer of its own (M01, L32). `npm run verify` passes.

**Execution record**

Added `studySections` (one home for what a minion study hides), the Draft and Tags switch and the draft path of `PreviewPanel` (reads `mediaTime`, starts no timer, shows the fixed-emitter and no-sprite notes). Manual checks BLOCKED for the same reason as 76.1.
