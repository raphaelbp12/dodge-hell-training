# Plan V19: The Tagger For Every Monster, One Phase At A Time

Phases 79-82. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 79-82 build and why. It is not authorization to implement a phase by itself.

The tagger is this project's tool for creating and correcting monsters, but plan V18 left it shaped around the boss and around the whole fight at once. Tags and saved attacks exist only in the primary monster's study, and the Monster draft panel lists every phase together, although a person works one phase at a time. This plan lets every monster be tagged, makes the draft panel, its preview, its load and its export work on the selected phase only, adds hover help to the tagger, and gives automated checks a generated test clip so the tagger can be exercised with a video loaded.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 79-82. Later explicit user decisions override older statements; record changes here.
- [Plan V18](plan-v18.md) and [plan V16](plan-v16.md): the draft's and the tagger's existing decisions (L and S). This plan supersedes or amends only the ones named under Confirmed Design; all others stand.
- A code audit on 2026-11-12. Its findings: every tag reader reaches the boss through `primaryArchetype(config)` (`phaseOptions` in `taggingOptions.ts`, `resolveTagMatch` in `previewModel.ts`, and through them `tagMatchStatus`, `matchTagAttack`, `authoredAttackFromTag` and `restoreSticky`); `studyMonsterProblem` and `studySections` in `studyLoad.ts` are the only places that refuse or hide tags on a minion; schema v4 studies already carry `tags` and `savedAttacks` for any monster, and every session already stores `sticky.phaseIndex`; the boss's phase is the Tag panel's Phase select (`sticky.phaseIndex`), which sits below the draft panel; the tagger's timeline markers come from tags only; and `app/tests/app.spec.ts:2811` already generates a short WebM in the page, so no video file is stored.
- [The tagger guide](tagger-guide.md): its worked example at line 173 says to press Starts here "when its telegraph ends", which contradicts L20. Step 82.2 corrects it (J09).
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification.
- [The deferred register](deferred-work.md): this plan promotes D38 (J18) and adds D43. D26, D34, D35, D37 and D39-D42 stay deferred.
- The user's answers on 2026-11-08 to 2026-11-12 to the numbered `/brainstorm` questions 1-26, recorded below under the J prefix. Answers 2b and 3a were superseded by 24a and 16a, as recorded under J02 and J03.

No value here is a ROTMG fidelity claim. Tooltip texts describe the tagger's own behaviour and make no claim about the game being recreated.

## Completed Baseline

Phases 1-36, 41, 46-64 and 73-75 are complete, phases 43-45 of V13 and 76-78 of V18 are implemented with manual checks pending, and V10, V12 and V17 stand as recorded in [the implementation plan](../implementation-plan.md). This plan builds on the tagger as V18 leaves it.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V13](plan-v13.md) | 43-45 | Shot patterns, burst tagging, study load and edit, autosaved sessions |
| [V14](plan-v14.md) | 46-48 | The live tag preview beside the video |
| [V15](plan-v15.md) | 49-55 | Composite patterns, bombs as their own shot, front aim, typed geometry, tag export |
| [V16](plan-v16.md) | 56-64 | Bomb throws, saved attacks, repeats and tuning in the tagger |
| [V17](plan-v17.md) | 65-72 | Interface redesign |
| [V18](plan-v18.md) | 73-78 | One file per monster, monster drafts, the draft preview and its export |

## Confirmed Design

Carried forward unchanged: the `research/` boundary (T13), the development-only guard (T14), `mediaTime` as the only clock (T19, M01, L32), first-match tag matching (M03, L31), one fixed emitter and one monster in the preview (L16), the anchor as block entry (L20), one anchor per block (L21), anchors never exported (L22), the copy box writing no file (L23), provenance on edit (L26), applying an export as a separate approved change (L27), schema v4 studies and per-monster autosave slots (L33), and every other T, Z, M, N, S and L decision not named below.

This plan's delta:

- **Every monster can be tagged.** Tags and saved attacks exist in every monster's study, and their phase list, matching, preview, export and session restore read the selected monster. This promotes D38 and supersedes L09.
- **The Draft/Tags switch shows on every monster.** This amends L15, which kept a minion on the draft.
- **One phase value per study.** `sticky.phaseIndex` indexes the selected monster's top-level phases. The Tag panel and the Monster draft panel each show a Phase select bound to it, and it is restored from the study's session.
- **The draft panel shows only the selected phase.** Its blocks, anchors and attack lists are those of the selected phase.
- **The draft preview draws only the selected phase's blocks.** Every anchor, in any phase, still ends the block before it. This amends what L34 draws, not how a window ends.
- **Load from game, with a draft present, replaces only the selected phase's attacks.** The first load still copies the whole monster. This amends L29.
- **The export is still the monster's whole file, but replaces only the selected phase's attack lists.** Every other phase comes untouched from the current file, and only the selected phase must still correspond. This amends L24 and L30.
- **Hover help.** A `?` with native `title` text beside every control in the Monster draft panel and beside every other tagger section's heading.
- **A generated test clip for Playwright.** One shared helper and one new case. This amends V18's "no new Playwright case" for this plan only.

Explicitly not added: a summary of anchors in hidden phases, a "first shot here" anchor helper (D43), a change to what an anchor means, keyboard-focus tooltips or a tooltip component beyond a `?` with `title`, a `?` on every control outside the draft panel, a committed video file or an in-app test-clip button, a warning about unexported edits in other phases, a partial-file export format, a new study schema, a saved-attack library across studies (D37), a moving or per-monster emitter (D42), and running V18's blocked manual checks.

## Recorded User Decisions - 2026-11-12

### Every Monster

- **J18 - Every monster can be tagged.** D38 is promoted. Tags and saved attacks exist in every monster's study. The phase list, tag matching, the tag preview, the tag export and sticky restoration read the selected monster's archetype, not the primary monster's. L09 is superseded, and `studyMonsterProblem` no longer refuses tags or saved attacks on a minion.
- **J19 - The source switch on every monster.** The Draft/Tags preview switch shows in every study. This amends L15.
- **J20 - This first.** The generalisation is this plan's first phase, because the phase-scoped draft panel reads its phase from it.

### The Selected Phase

- **J01 - One phase in the draft panel.** The Monster draft panel shows only the selected top-level phase: its blocks (the phase itself, or each of its sub-phases), their anchors, and its phase-level and sub-phase attack lists. Changing phase clears the attack editor's selection.
- **J02 - One phase value, two selects.** Every study has one selected phase, `sticky.phaseIndex`, indexing the selected monster's top-level phases. The Tag panel's Phase select and a Phase select in the Monster draft panel are both bound to it. This follows answer 15b and supersedes answer 2b, whose separate minion select was needed only while minions had no Tag panel.
- **J03 - The phase is restored.** The selected phase is saved in the study's session and restored when the study is reopened, for every monster, as `restoreSticky` already does for the boss. An empty study opens on its first phase. This supersedes answer 3a.
- **J04 - The export replaces only the selected phase.** The export box still holds the selected monster's whole file text (L24). It is built from the current file with only the selected phase's attack lists, phase-level and sub-phase, replaced from the draft. Every other phase comes from the current file, even when the draft holds edits there.
- **J05 - Only the selected phase must correspond.** The export refuses, naming the id, only when the selected phase, or one of its sub-phases, is in the draft or the file but not both. This amends L30.
- **J06 - The preview draws only the selected phase.** The draft preview draws only the selected phase's blocks. Every anchored block of the monster, in any phase, still ends the block before it, so a block with no authored duration stops at the next phase's anchor (L19, L34).
- **J07 - Load replaces only the selected phase.** With a draft present, Load from game replaces only the selected phase's attacks, after the existing inline confirmation, whose message names the phase. Anchors stay. With no draft, Load from game copies the whole monster as before. This amends L29.
- **J08 - No summary of hidden anchors.** Anchors in other phases are not listed in the panel.

### Starts Here

- **J09 - The anchor still means entry.** L20 stands: an anchor marks the frame a block is entered, before its telegraph, never a specific attack. The guide's worked example is corrected to say so, and the Starts here tooltip states it.
- **J10 - No first-shot helper.** No button sets an anchor from an attack's first shot. Recorded as D43.

### Help

- **J11 - Where.** Every control in the Monster draft panel has a `?`, and every other section of the tagger has one `?` beside its heading.
- **J12 - How.** A `?` is a small element whose help text is its native `title`, shown on hover. It also carries the same text as its accessible description, so tests can find it. No tooltip component, positioning or keyboard-focus popup is added.
- **J13 - What the text says.** Each text is a plain sentence about the tagger's own behaviour, drawn from the guide and the decisions it describes. Texts live as named constants in one research module, so the panel and tests share them. No text makes a fidelity claim.

### Test Clip

- **J14 - Generated, not stored.** The test video is generated in the page from a canvas, as `app.spec.ts:2811` already does. No video file is committed and the app gains no test-clip control.
- **J15 - A shared helper and one case.** The generator moves into one shared Playwright helper. The existing case at `app.spec.ts:2811` uses it. One new case opens the tagger, loads the clip, presses Load from game, changes phase, checks that only that phase's blocks show, presses Starts here and sees the anchor.
- **J16 - V18 stays as recorded.** V18's blocked manual checks are not run by this plan.

### Guide

- **J17 - The guide is updated.** `docs/tagger-guide.md` covers tags on every monster, the phase-scoped draft, the help marks, and the corrected anchor example.

### Consequences Recorded While Writing This Plan

These follow from the decisions above rather than from a separate question. The user may overrule any of them.

- **J21 - The emitter and heading stay the encounter's.** `emitterTilesOf` and `initialHeadingSliderDegrees` keep reading the encounter's arena and primary monster, so a minion's tags and draft draw from the existing fixed emitter, as L16 already requires of its draft.
- **J22 - No schema change.** Studies stay schema v4 and autosave keys stay as L33 set them. A minion study holding tags, which used to be a load error, now loads. `docs/killer-bee-queen-observations.json` stays byte-identical.
- **J23 - A saved phase that no longer exists.** When a restored `sticky.phaseIndex` is not a phase of the selected monster, the existing `phase-missing` notice applies and the study opens on its first phase.

## Architecture

Additions only. The one-way `research/` boundary (T13) stands: nothing under `game/` imports from `research/`, and no file under `app/src/game/` changes in this plan.

| Module | Change | Must not |
| ------ | ------ | -------- |
| `research/taggingOptions.ts`, `research/previewModel.ts`, `research/exportAttack.ts`, `research/taggerSessions.ts` | Tag readers take the selected archetype id explicitly, with no default | Read `primaryArchetype` for a tag's phase or match |
| `research/studyLoad.ts` | `studyMonsterProblem` stops refusing minion tags; `studySections` shows tagging and the source switch on every monster | Change study validation or schema |
| `research/monsterDraft.ts` | Phase-scoped load and export | Change an untouched phase's text |
| `research/draftPreview.ts` | Draws only the selected phase's blocks | Change how a block window ends |
| `research/helpText.ts` (new) | The tagger's help texts as named constants | Import React, the DOM or storage |
| `research/HelpMark.tsx` (new) | The `?` element: `title` plus accessible description | Position, animate or open on focus |
| `app/tests/` shared clip helper (new) | Generating a short WebM in the page | Write a video file to the repository |

## Target Data Shapes

```ts
// research/monsterDraft.ts
/** J07: with `previous` present, only `phaseId`'s attacks come from the file. */
export function loadMonsterDraft(
  rawFile: unknown,
  previous: MonsterDraft | null,
  phaseId: string,
): Readonly<{ draft: MonsterDraft; droppedAnchors: readonly string[] }>;

/** J04, J05: the whole current file with only `phaseId`'s attack lists replaced. */
export function monsterFileText(
  archetypeId: string,
  draft: MonsterDraft,
  currentRawFile: unknown,
  config: EncounterConfig,
  phaseId: string,
): DraftResult<string>;

// research/draftPreview.ts - draftPreviewAt's input gains:
//   phaseId: string; // J06: only this phase's blocks are drawn; every block's anchor still ends windows.
```

## Approved Scope And Review Gates

- No file under `app/src/game/` changes. Both `rulesVersion` values and every simulation snapshot stay as they are.
- `docs/killer-bee-queen-observations.json` stays byte-identical, and its schema test keeps passing.
- A boss study behaves as it does today apart from the decisions above: its tags, saved attacks, matching, tag exports and autosave slot.
- For each of the 12 monsters and each of its phases, loading a draft and exporting it untouched produces text byte-identical to its file. An edit in one phase never changes another phase's text in that phase's export.
- Every number added is a named constant. No help text makes a fidelity claim.
- New testable behaviour is written test-first in pure modules. One Playwright case is added (J15); each UI step records its manual checks as performed or blocked.
- `npm run verify` passes at the end of each phase.
- No commit, push, deployment, change to shipped tuning or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 79 | Every Monster Can Be Tagged | complete. Every monster now has tags, saved attacks and the source switch, with tag readers following the selected monster. | None |
| 80 | The Phase-Scoped Draft | complete. Load, export and the draft preview are scoped to the selected phase, and the draft panel shows one phase through a Phase select shared with the Tag panel. | Phase 79 |
| 81 | Hover Help | complete. A `?` help mark with native tooltip text sits beside every draft-panel control and every other tagger section heading. | Phase 80 |
| 82 | Test Clip And Guide | complete. A generated test clip helper and one new Playwright case exist, and the tagger guide matches the running tagger. | Phase 81 |

## Phase 79: Every Monster Can Be Tagged

Status: complete. Every monster now has tags, saved attacks and the source switch, with tag readers following the selected monster. Steps archived in [`phase-79.md`](plan-archive/phase-79.md).

## Phase 80: The Phase-Scoped Draft

Status: complete. Load, export and the draft preview are scoped to the selected phase, and the draft panel shows one phase through a Phase select shared with the Tag panel. Steps archived in [`phase-80.md`](plan-archive/phase-80.md).

## Phase 81: Hover Help

Status: complete. A `?` help mark with native tooltip text sits beside every draft-panel control and every other tagger section heading. Steps archived in [`phase-81.md`](plan-archive/phase-81.md).

## Phase 82: Test Clip And Guide

Status: complete. A generated test clip helper and one new Playwright case exist, and the tagger guide matches the running tagger. Steps archived in [`phase-82.md`](plan-archive/phase-82.md).
