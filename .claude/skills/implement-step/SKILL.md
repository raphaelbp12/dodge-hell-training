---
name: implement-step
description: "Implement one approved implementation-plan step, for example 21.3, with focused TDD and verification. Use only when the user runs /implement-step <step-id>."
argument-hint: "Step ID, for example 21.3"
disable-model-invocation: true
---

Implement only the plan step the user named with this command: `$ARGUMENTS`. If that reads as a literal placeholder, use the step ID the user typed after `/implement-step`. If it is absent or invalid, ask for it. Follow [the project instructions](../../../AGENTS.md).

1. **Load the plan once per session, by section.** Read [the implementation plan](../../../implementation-plan.md) from the top through its Phase Index section. Skip "Recorded User Decisions" and "Target Data Shapes" unless the step cites a decision (K-number) or a data shape; then read only that part. Do not reread these sections for a later step in the same session.
2. **Read only the requested step.** Its line in the Phase Index links its phase file under `docs/plan/`. Read that file's introduction, then grep `^### Step <id> ` and read that section alone. Completed dependencies are summarised by their one-line index entries; open an archive in `docs/plan-archive/` only when a summary does not answer a specific question.
3. **Check dependencies.** If any dependency is not complete, report the blocker and stop. Do not implement dependencies.
4. **Read mechanics by section.** `docs/mechanics.md` and `docs/killer-bee-queen-source.md` are large: grep for the decision IDs, mechanic names or table rows the step cites and read those sections only. If required mechanics or approval are missing, ask and stop dependent work.
5. **Implement with TDD.** State the scope and the focused checks. Write a focused failing test first for testable behaviour, then the smallest change that passes it. While iterating, run only the focused test files.
6. **Verify once.** When the step is done, run the step's focused checks, `npm run verify` from `app/` once, and only the Playwright tests the step names. Do not broaden scope to unrelated failures or claim unavailable checks passed.
7. **Record.** Write the execution record below the step's prompt in its phase file. Mark the step `complete` in the phase file and on its plan index line only if every acceptance criterion is met. If this completes the phase, move the phase file to `docs/plan-archive/phase-<n>.md` and give each index line a one-sentence outcome.
8. **Report** changed files, check results, open questions and blockers, and manual verification steps. Do not start the next step, commit or push.
