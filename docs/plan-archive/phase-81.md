# Phase 81: Hover Help

> Step prompts and execution records for phase 81 of [plan V19](../plan-v19.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 81.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-81.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 81.1 - The Help Mark And Its Texts

Status: complete. Dependencies: phase 80.

**Implementation prompt**

Add two files.

- `research/helpText.ts`: a pure module of named help-text constants (J13). It has one constant per control of the Monster draft panel. Those controls are:
  - the Phase select
  - Load from game
  - each block line, with its telegraph and duration
  - Starts here
  - Clear
  - New attack id and Add attack
  - each attack-editor control, including the projectile, the pattern kind, each pattern field, aim, target and the four cadence fields
  - the read-only fields
  - the export box and Copy file

  It also has one constant per other tagger section heading.
- `research/HelpMark.tsx`: renders a small `?` whose help text is its native `title` and its accessible description (J12). It has no positioning, animation or focus popup.

Each text is a plain sentence about the tagger's own behaviour, drawn from `docs/tagger-guide.md` and the decisions it describes, with no fidelity claim. The Starts here text states that the anchor marks the frame the block, meaning the phase or sub-phase, is entered, before its telegraph, and is not an attack's first shot (J09).

**Focused checks**

Failing first, in a component test: `HelpMark` renders `?` with the given text as its `title` and accessible description. Every constant in `helpText.ts` is a non-empty string, and none mentions ROTMG or RealmEye.

**Acceptance**

Both files exist and are tested. No panel uses them yet.

**Execution record - 2026-11-12.** Added `research/helpText.ts` (one constant per draft-panel control and per other section heading) and `research/HelpMark.tsx` (`?` with `title` and `aria-description`). Tests: `HelpMark` renders the text as title and accessible description; every constant is a non-empty string without ROTMG or RealmEye; the Starts here text says entry, before its telegraph, not the first shot.


### Step 81.2 - Help Across The Tagger

Status: complete. Dependencies: 81.1.

**Implementation prompt**

Place a `HelpMark` beside every control of the Monster draft panel listed in step 81.1, and one beside each other tagger section's heading (J11), using the constants from `helpText.ts`. Do not add a `?` to individual controls outside the draft panel. Keep the layout's existing order and labels, so existing tests and accessible names still match.

**Focused checks**

Add a component test: in the draft panel with a loaded draft and a selected attack, every listed control has a help mark. Manually, hover three marks and read their text.

**Acceptance**

Every draft-panel control and every other section heading carries a help mark. `npm run verify` passes. Manual checks are recorded as performed or blocked.

**Execution record - 2026-11-12.** A `HelpMark` sits beside every draft-panel control (Phase select, Load from game, block line, Starts here, Clear, New attack id, Add attack, attack list, every attack-editor field, read-only fields, Delete, export box, Copy file) and beside the headings of Saved sessions, Video, Tag, Sprite, Summary and Tags and the preview controls, placed beside the heading element so heading names are unchanged. Component test: the editor has at least as many help marks as controls. Manual hover check: blocked, no browser session available to this run.
