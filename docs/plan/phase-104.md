# Phase 104: Encounter Page Opens Over Plain HTTP

> Step prompts and execution records for phase 104 of [plan v27](../plan-v27.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 104.` for it.

### Step 104.1 - Reproduce The Missing randomUUID Failure

Status: pending. Dependencies: none.

**Implementation prompt**

In `app/src/ui/EncounterScreen.test.tsx`, add a test that stubs `crypto.randomUUID` to `undefined` (restoring it afterwards) and renders `EncounterScreen` the way the existing tests do, expecting it to mount without throwing (D-27-3). Do not change `EncounterScreen.tsx` in this step.

**Focused checks:** run `npx vitest run src/ui/EncounterScreen.test.tsx`; the new test must fail with `crypto.randomUUID is not a function`, and every existing test in the file must still pass.

**Acceptance:** the new test fails on the current code for the reported reason; the stub is restored so other tests are unaffected.

### Step 104.2 - Fall Back To getRandomValues

Status: pending. Dependencies: 104.1.

**Implementation prompt**

In `app/src/ui/EncounterScreen.tsx`, add a private `createRuntimeId()` that returns `crypto.randomUUID()` when it is a function and otherwise a version-4 UUID string built from `crypto.getRandomValues(new Uint8Array(16))` (D-27-1, D-27-2). Replace the call at line 153 with it. Do not add a module, a dependency or a dev-server change (D-27-4, D-27-5).

**Focused checks:** the step 104.1 test passes; a test with `randomUUID` stubbed away asserts the fallback id matches `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`, and a test with it present asserts its value is used.

**Acceptance:** the encounter screen mounts with and without `crypto.randomUUID`; history keys keep the `<uuid>:<attemptId>` shape; `npm run verify` passes from `app/`; the full non-soak browser suite passes before the pull request is pushed; only the files named in the plan's review gates changed.
