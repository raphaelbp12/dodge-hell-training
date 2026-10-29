---
name: implement-phase
description: "Implement one approved implementation-plan phase, or a single step of one, for example 23 or 23.6, with focused TDD and verification. Use only when the user runs /implement-phase <id>."
argument-hint: "Phase or step ID, for example 23 or 23.6"
disable-model-invocation: true
---

Act as a Senior Software developer, follow TDD, SOLID, YAGNI and DRY principles. Focus on reusing existing over creating new solutions.

Implement only what the user named with this command: `$ARGUMENTS`. If that reads as a literal placeholder, use the ID the user typed after `/implement-phase`. If it is absent or invalid, ask for it. The ID is either a whole phase (`23`) or a single step of one (`23.6`); a step ID means implement that step alone, then stop. Follow [the project instructions](../../../AGENTS.md).

1. **Load the owning plan once per session, by section.** More than one `docs/plan-v*.md` can exist; find the one whose Phase Index lists the requested phase, or the phase part of a step ID (grep `^| <phase> |` across `docs/plan-v*.md` if `implementation-plan.md`'s Current Plan table does not make it obvious). Read that file from the top through its Phase Index section. Skip "Recorded User Decisions" and "Target Data Shapes" unless the step cites a decision (its lettered ID) or a data shape; then read only that part. Do not reread these sections for a later step in the same session.
2. **Read only what the ID names.** The Phase Index line links the phase file under `docs/plan/`, named `phase-*.md` containing the phase number. For a step ID, read that step's `### Step <id>` section only, plus one grep of the file's `### Step` and `Status:` lines for the phase's step list and statuses; do not read the whole phase file. For a whole-phase ID, read the phase file. Completed dependencies are summarised by their one-line index entries; open an archive in `docs/plan-archive/` only when a summary does not answer a specific question.
3. **Check dependencies.** Use the status lines from step 2. If any dependency is not complete, report the blocker and stop. Do not implement dependencies.
4. **Read cited sources by section.** The step and the active plan file's Sources section name the documents an authored value must trace to (mechanics contracts, source extracts). These are large: grep for the decision IDs, mechanic names or table rows the step cites and read those sections only. If required sourcing or approval is missing, ask and stop dependent work.
5. **Implement with TDD.** State the scope and the focused checks. Write a focused failing test first for testable behaviour, then the smallest change that passes it. While iterating, run only the focused test files.
6. **Verify once.** When the phase is done, run the phase's focused checks, `npm run verify` from `app/` once, and only the Playwright tests the phase names. Do not broaden scope to unrelated failures or claim unavailable checks passed.
7. **Record.** Write the execution record below the phase's prompt in its phase file. Mark the phase `complete` in the phase file and on its plan index line only if every acceptance criterion is met. If this completes the phase, move the phase file to `docs/plan-archive/phase-<n>.md` and give each index line a one-sentence outcome.
8. **Report** changed files, check results, open questions and blockers, and manual verification steps. Do not start the next phase, commit or push.
