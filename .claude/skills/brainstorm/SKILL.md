---
name: brainstorm
description: "Design a new planning effort end-to-end: research, batch every open design question, then write a new docs/plan-v<N>.md and its docs/plan/phase-*.md step prompts. Use only when the user runs /brainstorm <topic>."
argument-hint: "A topic or goal for the new planning effort, e.g. 'Oryx 1 as a third encounter'"
disable-model-invocation: true
---

Act as a Senior Product Owner, responsible for defining the scope, decisions, and design of new planning efforts. Your role is to ensure that all necessary design questions are identified, researched, and resolved before any implementation begins. Your main focus is to avoid scope creep. You must ask questions to remove what is not needed from the plan, rather than adding unnecessary elements. Your main goal is to find the minimal viable plan that addresses the topic effectively.

Do not assume anything, always ask instead of making decisions on your own.

Design a brand-new plan version for this command's topic: `$ARGUMENTS`. If that reads as a literal placeholder, use the words the user typed after `/brainstorm`. If no topic was given, ask for one before doing anything else. Follow [the project instructions](../../../AGENTS.md) throughout - this skill's whole job is to produce the decisions and scope that later implementation work is bound by, so its research and sourcing discipline matters as much as `/implement-phase`'s does.

This skill never implements anything. It never edits `app/`. Its only output is planning documents, written once, at the end.

## 1. Orient

- Read `implementation-plan.md`'s Current Plan table: the highest plan number in use, the highest phase number in use anywhere, and every decision-letter prefix already spent. The new plan is always `docs/plan-v<highest + 1>.md`, even if an earlier plan is still mid-implementation - never append to an existing plan-vN file. Its phases continue numbering from the global highest phase number; its decisions get a letter not already in that table.
- Read the active plan-vN file's "Confirmed Design" and "Approved Scope And Review Gates" sections (not its full step prompts) so the new plan's scope is stated as a delta against what already stands, not a restatement of it.
- Read `AGENTS.md`'s Scope and design section, and the out-of-scope list there and in [the deferred register](../../../docs/deferred-work.md) (titles and one-line reasons only). A brainstormed topic that collides with something already deferred or declared out of scope is a question for round 1 ("re-open D0x?"), not a silent decision either way.
- For anything requiring ROTMG fidelity (an encounter, a mechanic, a stat table), research it now, before drafting questions: `curl` the relevant RealmEye wiki pages with a desktop user agent (`WebFetch` returns empty documents for them), strip script/style tags, and transcribe exact numbers with their page as the cited source. Never propose an invented number as if it were sourced, and never guess a fidelity claim.

## 2. Draft every open design question

Write down every design choice this topic requires before asking any of them - do not ask one, wait, then think of the next. Model these the way K01-K18 and G01-G22 were framed in the archives: each is a closed design fork (not an open-ended "what do you think"), each states the options and the consequence of each, and each is small enough to answer in one sentence.

Cover at minimum: what the new plan adds and what it explicitly does not (mirroring "Confirmed Design"); any value that must be authored vs. sourced from the wiki, and how a missing specific is handled (placeholder-and-move-on, per the standing K16 policy, unless the user says otherwise this time); any interaction with an out-of-scope or deferred item; any new data shape or architecture boundary the existing module table does not already cover; determinism, performance-bound or behaviour-identical constraints analogous to the ones the active plan already carries, if this topic risks them.

**Scope-cut pass.** For every element the topic could plausibly include, first draft the question "does this need to exist at all?" and only then, if it survives, the questions about how it should work. Minimal viable scope is the default framing for this whole skill: a question's recommended option should be the smaller or cut choice unless there is a concrete reason the fuller choice is actually necessary, and that reason must be stated, not assumed.

## 3. Ask in batches, iterate to zero

Do not use `AskUserQuestion` for this. Post the full current set of open questions as a single numbered list in a normal chat reply, not a tool call. Number every question continuing from the last batch (never restart at 1 within one `/brainstorm` session). For each one, give exactly two answer options as short labelled choices (e.g. "(a) ... (b) ..."), a one-clause note on what each implies, and mark which one is recommended and why in one short clause - per the scope-cut pass above, that is normally the smaller option, but say so explicitly rather than leaving it implied. Do not impose a fixed left/right ordering on which letter is the cut option versus the fuller one; frame each pair on its own merits. Then stop and wait for the reply - do not write any file yet.

After the user answers a batch, check whether any answer exposes a _new_ fork that round 1 could not have anticipated (approving a mechanic can reveal a sub-decision the way K17's contact damage emerged from transcribing a minion). If so, post only those new questions as another numbered list, continuing the numbering. Repeat until a full round produces zero new questions. Do not re-ask a settled question, and do not silently resolve one yourself - if you are tempted to assume an answer, that is a sign it belongs in the next batch.

**Tracking declined options.** When the user picks the non-recommended option, or declines an element outright, that is not automatically a deferred-work entry - most declined micro-choices (naming, sequencing, which module owns a field) are just answered and dropped. A declined fork earns a new entry in [the deferred register](../../../docs/deferred-work.md) only if it passes all three of: (1) it is a recognisable feature a user of the finished product could ask "why doesn't this exist"; (2) declining it leaves a real fidelity or capability gap worth disclosing, not just an implementation-detail choice; (3) there is a plausible future unblocking condition. Keep a running list of forks that pass this test as you go; do not write them yet.

## 4. Assign IDs and lay out phases

Once every question is settled:

- Pick the plan's decision-letter prefix (unused in the Current Plan table) and number every recorded decision sequentially from 01 under it.
- Group the approved work into phases of related, dependency-ordered steps - small enough that each phase is a sensible single `/implement-phase` unit, the way phases 19-24 each covered one coherent slice. Continue phase numbers from the global highest.
- For each step, work out its dependencies (the previous step, or an earlier phase) before writing prompts - a step whose prerequisites are unclear is a sign the phase needs to be split differently, not a detail to fix later.

## 5. Write everything, in one pass

Only now write files - never partially, never before every question from step 3 is settled.

- **`docs/plan-v<N>.md`** — follow the structure and heading order of [`docs/plan-v5.md`](../../../docs/plan-v5.md): intro paragraph pointing back to `implementation-plan.md` for process; Sources And Decision Authority; Completed Baseline (the table of prior plans, with this plan's predecessor added); Confirmed Design (carried-forward design plus this plan's additions, phrased as a delta); Recorded User Decisions under the new letter; any derived tables a decision requires (a timeline, a bound - only if this topic needs one, do not invent one to match the template); Architecture (only the boundary/module additions this plan needs); Target Data Shapes (only new or changed shapes); Approved Scope And Review Gates; Phase Index; then one short status-list section per phase (id, title, status `pending`, dependencies) linking to its `docs/plan/phase-<n>.md`. Leave out any section the topic genuinely does not need rather than padding it to match the example.
- **`docs/plan/phase-<n>.md`** per phase — follow the structure of [`docs/plan/phase-21.md`](../../../docs/plan/phase-21.md): the intro blockquote pointing to this new plan-vN file and to `implementation-plan.md`, then one `### Step <phase>.<i> - <Title>` section per step with `Status: pending. Dependencies: <ids>.`, an **Implementation prompt** (self-contained: what to build, which named constants or data shapes it touches, which decision ID it traces to), **Focused checks** (what a failing-first test must cover), and **Acceptance** (the criteria `/implement-phase` checks before marking it complete). Do not write an "Execution and verification" section - `/implement-phase` adds that when the step is actually implemented.
- **`implementation-plan.md`** — add one new row to the Current Plan table: phases, status `drafted`, the chosen decision prefix, and a link to the new file. Do not change any other row.
- **`docs/deferred-work.md`** — append one new entry per fork that passed the three-part test in step 3, under the next unused `D0x` id, in the register's existing format (**What.** / **Why deferred.** / **Blocked on.** / **Fidelity gap this leaves.**). Skip this file entirely if nothing passed the test; do not touch any existing entry.

## 6. Report

List the files written, the plan and phase numbers assigned, the decision prefix chosen, and a one-line summary of what was approved. End with a **Declined / Deferred** bullet list: every fork that passed the three-part test, its new `D0x` id, and one clause of why it was cut - or state plainly that none met the bar this round. Do not start implementing any phase, and do not commit or push.
