# Phase 61: Saved Attacks

> Step prompts and execution records for phase 61 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 61.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-61.md` and replace the plan's step lines with one-sentence outcomes.

### Step 61.1 - The Pure Model

Status: pending. Dependencies: phase 60.

**Implementation prompt**

Create `research/savedAttacks.ts`, pure and independent of React and the DOM, with results shaped like `EditResult` so a failure leaves state unchanged:

- `createSavedAttack(name, sticky, cadence, existing)`: the next unused stable id (`attack-1`, `attack-2`, ...), the sticky's attack fields without the phase (S27), and the S28 cadence rule. It rejects a blank or duplicate name.
- `renameSavedAttack(id, name, existing)`: the same name rules (S35). Ids never change.
- `updateFromSticky(attack, sticky)`: replaces the attack fields, leaving the name and cadence (S33).
- `deleteSavedAttack(id, existing, tags)`: rejected with a count while any tag uses it (S36).
- `stickyFromSavedAttack(attack, sticky)`: copies its values, keeps the phase, and sets `savedAttackId` (S32).
- `isStickyModified(sticky, attack)`: whether the attack fields differ, ignoring fields the pattern ignores.
- `detachTag(tag, attack)`: an unlinked tag with the attack's values, rejected on a repeat row (S34, S43).

**Focused checks**

Write failing `savedAttacks.test.ts` cases first, one per rule and rejection, including a rename leaving linked tags resolving, and detach then `resolveTags` giving the same field values.

**Acceptance**

Saved attacks pass `validateObservationExport` after every operation.

### Step 61.2 - Recording And Editing Linked Tags

Status: pending. Dependencies: 61.1.

**Implementation prompt**

In `research/taggingOptions.ts`, `createTag` returns a `LinkedTag` when the sticky has a `savedAttackId` and is not modified, and an unlinked tag otherwise (S32). `stickyKey` uses the attack id when it would link. `editTag` works on stored tags: on a linked tag, time, phase and burst edit as usual, and an attack field is rejected with "Detach this tag first" (S34). A linked tag cannot gain attack fields, and an unlinked tag cannot gain `savedAttackId` (S34).

**Focused checks**

Write failing `taggingOptions.test.ts` cases first: linked and modified recording; burst continuation across linked tags of one attack and not of another; each edit rule; and the same interval readout as an unlinked group.

**Acceptance**

A linked tag stores no attack values, and an attack's edit reaches all its tags through `resolveTags`.

### Step 61.3 - The Panel And Columns

Status: pending. Dependencies: 61.2.

**Implementation prompt**

In `research/TaggerRoute.tsx`, add to the Tag panel:

- An Attack dropdown with None, copying values through `stickyFromSavedAttack` (S32). The "Recording:" line names the attack and shows "modified" when `isStickyModified`, saying the next tag will be unlinked.
- "Save as attack", asking for a name and the three cadence values, with `shotIntervalSeconds` hidden at one shot per burst (S28, S31).
- With an attack chosen: "Update from sticky", a rename field and Delete, each showing its refusal through the existing `error` line (S33, S35, S36).

Number keys 1-9 changing the shot count count as changing a control. In Tags, a linked row shows its attack fields read-only and a Detach button (S34). Tags and Summary gain an Attack column with the saved attack's name (S46), which `formatSummaryRow` resolves from the id. Every change sets `dirty`. "Use these settings" on a linked row chooses its attack (S20).

**Focused checks**

Extend `taggingOptions.test.ts` for the Summary name lookup. Manual, recorded as performed or blocked: save an attack, record linked tags, change a control and see the unlinked warning, update, rename and see the new name everywhere, try to delete an attack in use, detach and delete, then reload and restore the session.

**Acceptance**

Rename changes no link, and the panel always says whether the next tag will be linked.

### Step 61.4 - Exporting A Saved Attack

Status: pending. Dependencies: 61.3.

**Implementation prompt**

In `research/exportAttack.ts`, a linked tag exports with a slug of its saved attack's name plus `-tagged` for the attack id and for any projectile variant (S37), taking `shotsPerBurst` and `cooldownAfterLastShotSeconds` from the saved attack, `shotIntervalSeconds` from it above one shot per burst, and everything else from the match (S45). Add a named `slugOf(name)` with lowercase letters, digits and hyphens only. Unlinked tags keep N42 exactly. Update the export box's note for a linked tag: cadence is typed, not measured, and the phase is at its first volley (N43).

**Focused checks**

Write failing `exportAttack.test.ts` cases first: two saved attacks from one match give different ids; cadence comes from the attack at one and at three shots per burst; every result passes `validateAttack` and, where present, `validateProjectile`; a name of only symbols falls back to the attack's stable id, so the id is never empty; and an unlinked tag's result is unchanged.

**Acceptance**

No cadence is computed from tag times (T32), and an exported id is always valid.
