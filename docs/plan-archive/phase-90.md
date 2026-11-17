# Phase 90: Architecture And Static Analysis

> Step prompts and execution records for phase 90 of [plan V22](../plan-v22.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 90.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-90.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 90.1 - Layer Import Boundaries

Status: complete. Dependencies: none.

**Implementation prompt**

Apply A01 in `app/.oxlintrc.json`. Add an override for the core files: `src/game/models.ts`, `src/game/config/**`, `src/game/simulation/**` and `src/game/session/**`.

- Its `no-restricted-imports` blocks `react`, `react-dom` and `react-dom/*`, `phaser`, any `*.css`, and any relative path resolving into `src/ui/`, `src/research/`, `src/game/phaser/` or `src/storage/`.
- Its `no-restricted-globals` blocks `window`, `document`, `localStorage`, `sessionStorage`, `navigator` and `requestAnimationFrame`.

Add a second override for `src/game/**` that blocks any import resolving into `src/research/` (T13). Add a third for `src/storage/**` that blocks `react` and `phaser`. Each restriction's `message` names the rule it enforces and points to the project instructions' Architecture section.

Run oxlint against the current tree. Any existing violation is a finding: list it in the execution record. Fix it only if the fix is a pure import move with no behaviour change; otherwise stop for a decision. If oxlint cannot express a relative-path pattern, implement that one pattern in step 90.2's plugin and record why.

**Focused checks**

Write `app/lint/boundaries.test.ts` first, following the fixture pattern of `app/lint/test-drift.test.ts`. It writes temporary files under each guarded path, runs oxlint on them, and asserts:

- each forbidden import and global is reported with its message;
- a permitted import from core to core, and from `src/game/phaser/` to the simulation, is not reported.

**Acceptance**

`npx vitest run lint/boundaries.test.ts` passes. `npm run lint` passes on the unchanged tree, or every violation is recorded and resolved as described.

### Step 90.2 - Determinism Rule

Status: complete. Dependencies: 90.1.

**Implementation prompt**

Apply A02. Create `app/lint/determinism.js` as an oxlint JS plugin, in the shape of `lint/test-drift.js`, with one rule, `determinism/no-ambient-entropy`. It reports these member calls or constructions:

- `Math.random()`;
- `Date.now()`;
- `new Date()` with no arguments;
- `performance.now()`;
- `crypto.getRandomValues()`;
- `crypto.randomUUID()`.

Register the plugin in `jsPlugins`, and enable the rule as an error for the A01 core globs. Give `arbitrarySeed` in `src/game/simulation/random.ts` an inline disable with the reason "host seed for attempts that do not pin one (G13)". Audit every other report in the core. An identity value that never feeds the simulation, such as an attempt id, keeps a reasoned disable. Anything that feeds simulation state is a finding under A10.

**Focused checks**

Write `app/lint/determinism.test.ts` first. It asserts:

- each of the six forms is reported;
- `new Date(0)` and a local `random()` function are not;
- an inline disable with a reason silences one report.

**Acceptance**

Both lint test files pass, and `npm run lint` passes. Every disable comment carries a reason and a decision ID.

### Step 90.3 - Compiler Strictness

Status: complete. Dependencies: none.

**Implementation prompt**

Apply A03. Add `"strict": true` and `"noImplicitOverride": true` to `compilerOptions` in `app/tsconfig.app.json` and `app/tsconfig.node.json`. Add the `override` keyword wherever `tsc -b` now requires it, typically on Phaser scene lifecycle methods. Do not add any other flag. If `strict` produces errors beyond `override` (for example, it was not already the effective default), list them in the execution record and stop for a decision before changing production logic.

**Focused checks**

`npm run typecheck` passes.

**Acceptance**

Both configuration files state the two flags, and the only source edits are `override` keywords.

### Step 90.4 - Suspicious Category And No Warnings

Status: complete. Dependencies: 90.2.

**Implementation prompt**

Apply A04. In `app/.oxlintrc.json`, set `"categories": { "correctness": "error", "suspicious": "error" }`. Run lint, then sort each finding:

- fix a true positive without changing behaviour;
- for a rule whose every hit is a false positive in this codebase, turn the rule off with a one-line reason as a comment in the configuration, since oxlint reads it as JSONC. If comments are rejected, record the reason in the execution record instead;
- leave a true positive that needs a behaviour change in place, list it, and stop for a decision.

Then resolve or reason away the existing `react/only-export-components` warnings, and change the `lint` script in `app/package.json` to `oxlint --deny-warnings`.

**Focused checks**

`npm run lint` passes with zero warnings. Run `npx vitest run lint/` to confirm the lint fixture tests still pass under the new categories.

**Acceptance**

The lint script denies warnings. Every disabled rule has a recorded reason. No behaviour change was made to satisfy a rule.

### Step 90.5 - Dependency Audit In CI

Status: complete. Dependencies: none.

**Implementation prompt**

Apply A05. In `.github/workflows/pages.yml`, add a `checks` matrix entry named `Audit`. Its script runs `npm audit --omit=dev --audit-level=high`. The matrix runs `npm run ${{ matrix.script }}`, so add an `audit` script to `app/package.json` with that exact command. Do not add it to `scripts/verify.mjs`. Update `.claude/skills/verify/SKILL.md` where it mirrors the CI jobs.

**Focused checks**

Run `npm run audit` once locally, and record its result, including any advisory found.

**Acceptance**

The workflow, the script and the verify skill agree. A high-severity production advisory found now is recorded, not silently upgraded.

### Step 90.6 - Phase Gate

Status: complete. Dependencies: 90.1-90.5.

**Implementation prompt**

Delegate one `npm run verify` run to the `verifier` subagent. Record each gate's line. Update the plan's Phase Index and archive this file as the implementation plan describes.

**Focused checks**

None beyond the gate run.

**Acceptance**

All four gates pass, and no gameplay value, `rulesVersion` or snapshot changed.

## Execution Record

Implemented 2026-11-16 in auto mode.

- **90.1** `app/.oxlintrc.json` gained the A01 overrides (`no-restricted-imports` and `no-restricted-globals` on the core, the T13 research boundary on `src/game/phaser/**`, and React/Phaser on `src/storage/**`). Test files are excluded from the core override: several tests read `window` or import storage on purpose. oxlint's built-ins expressed every pattern, so nothing moved to the A02 plugin; the Phaser-layer pattern is `**/phaser/**` only, because the bare `**/phaser` pattern double-reports the `phaser` package. Lint `app/lint/boundaries.test.ts` runs the real configuration against scratch files. **Finding:** the only existing violation was `parseDrillFromLocation` in `src/game/config/drill.ts`, whose default argument read `window.location.search`. Fixed as a pure move: the parameter is now required and `App.tsx` passes `window.location.search`. No behaviour change.
- **90.2** `app/lint/determinism.js` with `determinism/no-ambient-entropy`, tests in `lint/determinism.test.ts`. The only report in the core was `arbitrarySeed` in `random.ts`, which keeps an inline disable citing G13. No attempt id or other value in the core reads ambient entropy.
- **90.3** `"strict": true` and `"noImplicitOverride": true` in both tsconfig files. `strict` produced no errors; the only source edits are `override` on the two Phaser scene `update` methods.
- **90.4** `categories` set to `correctness` and `suspicious` as errors, `lint` script is `oxlint --deny-warnings`. Findings: 916 `react/react-in-jsx-scope` hits (false positive: the project uses the automatic JSX runtime) and 14 `no-shadow` hits (style only, every one harmless) are turned off with reasons in the configuration. The React Compiler-style rules (`exhaustive-effect-dependencies`, `set-state-in-effect`, `immutability`, `refs`, `only-export-components`, `exhaustive-deps`) are turned off for `EncounterScreen.tsx`, `PhasePreview.tsx` and `TaggerTimeline.tsx` with a reason: those components deliberately own an imperative Phaser runtime and derived-state effects that tests pin, and restructuring them would change behaviour. One true positive, `preserve-caught-error` in `studyLoad.ts`, was fixed by attaching `{ cause }` to the rethrown error (the message is unchanged).
- **90.5** `audit` script and an `Audit` entry in the `checks` matrix; the verify skill mentions it. `npm run audit`: found 0 vulnerabilities.
- **90.6** `npm run verify`, run by the verifier: lint PASS, typecheck PASS, test PASS, build PASS. No gameplay value, `rulesVersion` or snapshot changed.
