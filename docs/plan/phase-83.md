# Phase 83: Vocabulary And Glossary

> Step prompts and execution records for phase 83 of [plan V20](../plan-v20.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 83.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-83.md` and replace the phase's line in the plan file with a one-sentence outcome.

This phase changes words only. It runs first so that every later phase, and every label those phases add, uses the glossary's vocabulary (E01). Nothing under `app/src/game/` changes.

### Step 83.1 - The Glossary List

Status: pending. Dependencies: none.

**Implementation prompt**

Rewrite `app/src/research/glossary.ts` so it holds every project-specific term the tagger will use after this plan, in the order a newcomer should read them, and export the list of terms that must exist. Each meaning is one or two plain sentences about the tagger itself. Use exactly these terms and keep the wording close to the meanings given here; later phases rely on these words.

```ts
export type GlossaryEntry = Readonly<{ term: string; meaning: string }>;

/** E01: every term here must have an entry; the test enforces it. */
export const REQUIRED_TERMS: readonly string[] = [
  "Study", "Video clock", "Presented frame", "Frame rate",
  "Phase", "Sub-phase", "Segment", "Boundary", "Window", "Telegraph", "Invulnerable",
  "Track", "Structure track", "Attack track", "Status track", "Scratch track", "Selected attack",
  "Mark", "Volley", "Throw mark", "Detonation mark", "End mark", "Span",
  "Attack", "Attack definition", "Projectile", "Pattern", "Aim", "Arm", "Arm pattern", "Emitter", "Bomb", "Target",
  "Cadence", "Burst", "Shot interval", "Cooldown", "Initial delay", "Burst gap threshold",
  "Fit", "Residual", "Measured", "Estimate", "Authored", "Accepted",
  "Preview", "Observed volley", "Ghost volley",
  "Scale calibration", "Range", "Flight time",
  "Reconcile", "Export", "Monster file", "Projectile variant", "Warning",
];

export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: "Study", meaning: "Everything recorded for one monster on one video: its structure, status, attack tracks and scratch marks. It autosaves per video and monster." },
  { term: "Video clock", meaning: "The video's own time. Every time in the tagger comes from it, never from a seek target." },
  { term: "Presented frame", meaning: "The video frame currently shown. A mark records the presented frame's time." },
  { term: "Frame rate", meaning: "How many frames the video presents per second. It is used only to step one frame at a time." },
  { term: "Phase", meaning: "A stage of a monster's fight, entered at a health fraction. A monster's attacks are authored per phase." },
  { term: "Sub-phase", meaning: "A part of a phase with its own telegraph, duration and attacks. Sub-phases cycle in order while the phase lasts." },
  { term: "Segment", meaning: "The unit of structure: a phase with no sub-phases, or one sub-phase. Every attack belongs to one segment." },
  { term: "Boundary", meaning: "The frame a segment is entered. Press Segment starts here to add one. The same segment can be entered many times." },
  { term: "Window", meaning: "The stretch of video from a boundary to the next boundary or the video end. Attacks of that segment fire inside it." },
  { term: "Telegraph", meaning: "The warning time at the start of a segment, before its attacks fire. Press Telegraph ends here to measure it." },
  { term: "Invulnerable", meaning: "A stretch where the monster takes no damage. Record it as a span on the status track." },
  { term: "Track", meaning: "One row of the timeline. The structure track, the status track, one attack track per attack, and the scratch track." },
  { term: "Structure track", meaning: "The row holding boundaries and telegraph ends." },
  { term: "Attack track", meaning: "The row for one attack: its definition, its marks and its fit." },
  { term: "Status track", meaning: "The row holding spans such as invulnerable." },
  { term: "Scratch track", meaning: "The row for marks that belong to no attack yet. Create an attack from them later." },
  { term: "Selected attack", meaning: "The attack track that Enter records to. Press 1 to 9 to select one, 0 for the scratch track." },
  { term: "Mark", meaning: "One time-stamped observation on a track, at the presented frame." },
  { term: "Volley", meaning: "One firing, where all of an attack's projectiles leave together. Each volley is one mark." },
  { term: "Throw mark", meaning: "A bomb attack's volley mark: the frame the bomb leaves the monster." },
  { term: "Detonation mark", meaning: "The frame a bomb explodes. It pairs with the throw mark before it." },
  { term: "End mark", meaning: "The frame an attack visibly stops. It is a check only: the game runs an attack until its segment ends." },
  { term: "Span", meaning: "A stretch with an in and an out on the status track." },
  { term: "Attack", meaning: "A repeating firing of one projectile in one pattern with one cadence, belonging to one segment." },
  { term: "Attack definition", meaning: "An attack's projectile, pattern, aim and cadence, in the shape the game's monster file uses." },
  { term: "Projectile", meaning: "What an attack fires, from the game's projectile catalog: its sprite, speed, range and motion." },
  { term: "Pattern", meaning: "Where the shots go: a ring of arms, a spread across an arc, or a scatter inside a cone." },
  { term: "Aim", meaning: "What a spread or scatter points at: the player, the monster's front, or a fixed bearing." },
  { term: "Arm", meaning: "One spoke of a ring. An arm fires a single shot or a small pattern of its own." },
  { term: "Arm pattern", meaning: "What each arm of a ring fires: a single shot, a spread, a scatter or an inner ring." },
  { term: "Emitter", meaning: "The fixed point the preview fires from. It never moves, even for a monster that chases." },
  { term: "Bomb", meaning: "A projectile that flies for a set time, then explodes. It hits only by exploding." },
  { term: "Target", meaning: "A bomb thrown at the player's position. It lands there whatever the distance, so it has no range." },
  { term: "Cadence", meaning: "An attack's timing: shots per burst, shot interval, cooldown and initial delay." },
  { term: "Burst", meaning: "Several volleys close together, followed by a cooldown." },
  { term: "Shot interval", meaning: "Seconds between the volleys inside one burst." },
  { term: "Cooldown", meaning: "Seconds from a burst's last volley to the next burst's first volley." },
  { term: "Initial delay", meaning: "Seconds from the end of a segment's telegraph to the attack's first volley." },
  { term: "Burst gap threshold", meaning: "The gap length that separates a shot interval from a cooldown. The fit chooses it; you can override it." },
  { term: "Fit", meaning: "The cadence derived from a track's marks. Accept it to make it the attack's cadence." },
  { term: "Residual", meaning: "How far a mark lies from the nearest volley the fit predicts, in seconds. A large residual means the fit does not match the video." },
  { term: "Measured", meaning: "A value derived from marks on the video clock." },
  { term: "Estimate", meaning: "A value you typed by eye, such as a cone width. It is not a measurement." },
  { term: "Authored", meaning: "A value as it stands in the game's monster file." },
  { term: "Accepted", meaning: "A measured or typed value you chose to export in place of the authored one." },
  { term: "Preview", meaning: "The canvas beside the video that draws the study's volleys at the presented frame." },
  { term: "Observed volley", meaning: "A mark drawn as its attack, fired at the mark's time." },
  { term: "Ghost volley", meaning: "A volley the accepted cadence predicts, drawn faintly so you can compare it with the marks." },
  { term: "Scale calibration", meaning: "One drag across the monster's body on the video, so distances on the video can be read in tiles." },
  { term: "Range", meaning: "How far a bomb flies, in tiles, measured from the monster's centre at the throw to the explosion's centre." },
  { term: "Flight time", meaning: "Seconds from a throw mark to its detonation mark." },
  { term: "Reconcile", meaning: "The step where measured, typed and authored values sit side by side and you accept the ones to export." },
  { term: "Export", meaning: "Copying the monster file text, or the study JSON, to paste by hand. The tagger writes nothing." },
  { term: "Monster file", meaning: "The game's JSON file for one monster under game/data/enemies/." },
  { term: "Projectile variant", meaning: "A copy of a catalog projectile with a measured flight time or range, to paste into the projectile catalog by hand." },
  { term: "Warning", meaning: "A check the study fails, such as a mark outside its segment's window. Warnings never block an export." },
];
```

Keep `GlossaryPanel.tsx` as it is: it renders `GLOSSARY`.

**Focused checks**

A failing-first test in `app/src/research/glossary.test.ts`: every term in `REQUIRED_TERMS` has exactly one entry in `GLOSSARY`; no entry's term is blank; no two entries share a term; no meaning contains the words "block", "sticky", "typed estimate" or "anchor".

**Acceptance**

The test passes. `npx vitest run src/research/glossary.test.ts` is green. No other file changes in this step.

### Step 83.2 - The Words In Use

Status: pending. Dependencies: 83.1.

**Implementation prompt**

Replace the retired words in the texts that will survive this plan, so that no interface text, help text or step-guide text says "block", "anchor", "sticky" or "typed estimate". Touch only strings, never behaviour:

- `app/src/research/helpText.ts`: "block" becomes "segment", "anchor" becomes "boundary", "typed estimate" becomes "estimate", "Starts here" becomes "Segment starts here". Keep every constant name; later phases delete the ones they retire.
- `app/src/research/stepGuide.ts`: the same replacements. Do not restructure the steps here; phase 85 rewrites `STEP_GUIDES`.
- `app/src/research/DraftPanel.tsx`, `app/src/research/TypedFieldControls.tsx`, `app/src/research/SavedAttackPanel.tsx` and `app/src/research/TaggerRoute.tsx`: visible labels and `aria-label` texts only. Where a Playwright test in `app/tests/app.spec.ts` selects by one of those labels, update that selector to the new label.
- `docs/tagger-guide.md`: replace the "Terms" section with the sentence "Every term is defined in the tagger's Glossary dialog; the list below mirrors it." followed by one bullet per `GLOSSARY` entry, in the same order and wording.

**Focused checks**

A grep over `app/src/research/*.ts`, `app/src/research/*.tsx` and `docs/tagger-guide.md` for the words `sticky`, `typed estimate`, `Starts here` and `anchor` finds only code identifiers and comments, never a quoted interface string. Run the Playwright tagger cases whose selectors changed: `npm run test:e2e -- --grep "tagger"`.

**Acceptance**

Every string replacement listed is made, the grep finds no interface text with a retired word, the targeted Playwright cases pass, and `npm run verify` passes once at the end of the phase.
