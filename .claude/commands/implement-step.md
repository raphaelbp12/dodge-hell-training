---
description: "Implement one approved vertical-slice plan step with focused TDD and verification."
argument-hint: "Step ID, for example 3.3"
---

<!-- Mirror of .github/prompts/implement-step.prompt.md. Keep both in sync. -->

Implement only step `$1` from [the implementation plan](../../implementation-plan.md). If `$1` is empty, treat the user's arguments as the step ID: `$ARGUMENTS`.

1. Read the plan's confirmed design, architecture, shared prompt contract, and requested step. Follow the [project instructions](../../CLAUDE.md).
2. If the step ID is absent or invalid, ask for it. Inspect dependency statuses and their recorded evidence; if incomplete, report the blocker instead of implementing dependencies automatically.
3. Read the approved mechanics document if it exists (`docs/mechanics.md`) and the nearby implementation/tests. If required mechanics or approval are missing, ask the user and stop dependent work. Research step 1.1 must stop for its approval gate.
4. State the exact scope and focused validation check. Implement the requested prompt with a failing test first for testable behavior. Bootstrap only through commands; do not hand-create generated application scaffolding.
5. Run the required focused checks and relevant gates. Do not broaden scope to unrelated failures. Do not claim unavailable checks passed.
6. Record the step's actual checks, outcomes, approved deviations, and blockers in the plan. Mark it complete only if every required acceptance criterion is met.
7. Finish with changed files, validation results, remaining questions/blockers, and any manual verification instructions. Do not begin the next step, commit, or push.
