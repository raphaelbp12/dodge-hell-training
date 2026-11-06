# Plan V15: Composite Patterns, Bombs As Their Own Shot And Front-Relative Aim

Phases 49-55. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 49-55 build and why. It is not authorization to implement a phase by itself.

The attack model cannot describe three things the user sees in footage: a ring whose arms each fire a pattern, a bomb defined by where and when it explodes, and a shot fired relative to the enemy's front. This plan adds all three to the engine and the authored schema, and lets the tagger record, preview and export them. Exactly one shipped attack changes: `white-bomb-targeted` finally lands on the player.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 49-55. Later explicit user decisions override older statements; record changes here.
- [Plan V14](plan-v14.md), [plan V13](plan-v13.md) and [plan V8](plan-v8.md): the preview's and tagger's existing decisions (M, Z and T). This plan supersedes only the ones named under Confirmed Design; all others stand.
- [`docs/killer-bee-queen-source.md`](killer-bee-queen-source.md): the wiki prose behind "targeted Dazing White Bombs at players" and "4-directional spreads of Yellow, Red, and Blue Glaives". The wiki gives no shot count or cone width for those spreads.
- The user's video observation that the Killer Bee Queen's first phase (phase index 0) fires a shot relative to her front. The wiki does not mention this: it describes that phase's stingers as "directed spreads" at nearby players, and the source document has no occurrence of "front", "ahead", "behind" or "facing". This is a user observation, not a wiki fact. No shot was named.
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification.
- [The deferred register](deferred-work.md): D19 and D20 stay deferred. This plan adds D27-D31.
- The user's answers on 2026-11-05 to the numbered `/brainstorm` questions 1-42, recorded below under the N prefix.

## Completed Baseline

Phases 1-36, 41 and 46-48 are complete. Phases 43-45 of V13 are implemented with manual checks pending, and V10 and V12 stand as recorded in [the implementation plan](../implementation-plan.md). This plan builds on the game and tagger as V14 leaves them.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V9 archive](plan-v9.md) | 36 | Phase-3 cadence retune from tagged video evidence |
| [V10](plan-v10.md) | 37-40 | World-scale re-anchor, octagonal boss room, Killer Honey, centre spawn |
| [V11](plan-v11.md) | 41 | The player's true body, plus its recorded follow-up |
| [V12](plan-v12.md) | 42 | The dev container |
| [V13](plan-v13.md) | 43-45 | Shot patterns, burst tagging, study load and edit, autosaved sessions |
| [V14](plan-v14.md) | 46-48 | The live tag preview beside the video |

## Confirmed Design

Carried forward unchanged: the `research/` boundary (T13), the development-only guard (T14), `mediaTime` as the source of recorded times and the preview's only clock (T19, M01), sprite-level tagging (T20), top-level phase attribution (T25), the 2D-canvas preview (M10), the adjustable player point (M08), persisted panel state only (M24), and every T, Z and M decision not named below. The fixed-step clock, once-only hit rule and lifetime-only expiry also stand.

This plan's delta:

- **A ring's arm can fire a pattern.** `armPattern` is `single`, `spread`, `scatter` or another `ring`, recursively. Absent means `single`, so existing JSON is untouched.
- **A bomb is its own shot type.** It is authored as `"type": "bomb"` with range, time and detonation radius, and has its own runtime list, collision and drawing. This supersedes K02's `lob` motion kind and the `lob` entry in the project instructions' motion rule.
- **A bomb can target the player.** It lands on the player's position at fire time, in a fixed time, at any distance. `white-bomb-targeted` adopts this, advancing the Queen's rules identity from `killer-bee-queen-nest-paladin-v11` to `killer-bee-queen-nest-paladin-v12`.
- **Spreads and scatters can aim relative to the enemy's front.** Front is the enemy's movement heading.
- **Tags can carry typed geometry.** A tag may carry a typed cone width, rotation rate and rotation phase. This supersedes T27 and V13's "no geometry" exclusion for exactly those fields. Each is an estimate typed by a person, not a measurement.
- **The preview draws composites and rotation, and has an enemy-rotation slider.** This supersedes M06 for `rotating-arm` tags only. A tag's aim and geometry override the matched attack's, extending M05.
- **A tag can be exported as an authored attack,** as JSON to paste into `enemies.json`.

Explicitly not added: re-authoring any other shipped attack, a shipped front-aimed attack, aimed rings, position-targeted bombs, speed-based targeted bombs, predictive lead or homing, inner-ring rotation, patterns other than rings hosting arms, per-arm projectiles or cadences, a nesting or volley cap, recursive tags, recorded player positions, per-burst advance or arm spread in the preview, cadence derived from tags, writing `enemies.json` from the browser, schema v3, and a new Playwright case.

## Recorded User Decisions - 2026-11-05

Scope and shipped change:

- **N01 - Capability only, with one exception.** Nothing shipped changes except `white-bomb-targeted`. Composite and front-aimed patterns are exercised by tests and test fixtures until a later decision authors them.
- **N02 - The targeted white bomb lands on the player.** The Queen's phase-index-0 `white-bomb-targeted` adopts N27. Its cadence and damage are unchanged. Its rules identity becomes `killer-bee-queen-nest-paladin-v12`; older attempts stay stored and are excluded from the new best, as usual. The Crystal Worm's rules identity does not change.

Composite patterns:

- **N03 - An arm may fire any pattern.** `armPattern` is `single`, `spread`, `scatter` or `ring`, nested without restriction. The user chose this over a closed, non-recursive set, knowing a ring inside a ring from a shared origin only adds bearings.
- **N04 - Only rings host arms.** A `spread` or `scatter` has no `armPattern`.
- **N05 - `armPattern` is optional.** Absent means `single`. All 53 existing rings stay byte-identical.
- **N06 - An inner pattern has no aim.** It centres on its arm's bearing. An inner spread or scatter holds only its count and width. Consequently a ring of spreads is oriented only by its ring's phase, and can never point at the player or the enemy's front.
- **N07 - One emitter radius, per shot.** Only the outermost ring has `emitterRadiusTiles`, and inner patterns reject it. Each shot spawns offset along its own bearing, as spreads do today, and not from a shared arm tip.
- **N08 - A gap removes a whole arm.** Gap sectors are tested on the outermost ring's arm bearing, as they are today. Per-burst advance and arm spread likewise act on the outermost arms' bearings.
- **N09 - Arms are uniform.** One attack has one projectile, one cadence and one `armPattern` for all its arms. Colour stacking stays multiple attacks.
- **N10 - No nesting or volley cap.** The validator enforces no depth or shot limit, and the existing `safeCount` rule still applies to each count. A typo can therefore author a huge volley, and that risk is accepted.
- **N11 - An inner ring is static.** It holds `arms`, an optional `phaseOffsetDegrees` relative to its arm, and its own optional `armPattern`. Rotation, per-burst advance, gaps and arm spread are rejected on an inner ring. Only the outermost ring rotates.
- **N12 - Scatter draws.** A volley draws one unit-random value per final scatter shot, in depth-first arm order. A shot a gap removes still consumes its draw, so the draw count is a constant of the pattern and the generator's stream does not depend on rotation. The gap clause was settled while writing this plan to preserve determinism.

Player aim and front:

- **N13 - Player aim is captured at fire time.** There is no lead and no homing, as today.
- **N14 - Rings have no aim.** Rings keep their absolute phase; `aim` stays on `spread` and `scatter`. See D29.
- **N15 - The preview's player is the slider point.** Aimed shots are therefore approximate against the video, and tags do not record the player's position.
- **N16 - Front-relative aim.** `aim: "front"` with a required `offsetDegrees` (0 ahead, 180 behind, any finite angle otherwise) joins `player` and `fixed` on `spread` and `scatter`. Its source is the user observation named above.
- **N17 - Front is the movement heading.** `EnemyState` gains `headingRadians`, updated when an enemy's position changes by movement and held otherwise. An archetype has an optional `initialHeadingDegrees`, required only if one of its attacks, in any phase or sub-phase, aims `front`. Absent, the heading starts at 0.
- **N18 - No shipped front shot yet.** The Queen's first phase is not re-authored, per N01. See D27.
- **N19 - A front tag has no number.** The tag records `aim: "front"` only.
- **N20 - An enemy-rotation slider.** The preview gains one heading slider that turns `front`-aimed shots only; rings and `fixed` shots stay absolute, as they are in the game. There is one value for the whole study. It starts at the primary archetype's `initialHeadingDegrees`, or 0. An arrow on the emitter shows it, shots in flight follow it live, and it resets on reload. This replaces the "no slider" part of the user's original answer to question 16.

Bombs:

- **N21 - A bomb is an authored type.** A `projectiles.json` entry with `"type": "bomb"` holds `rangeTiles`, `travelSeconds` and `detonationRadiusTiles`, and keeps its other non-motion fields. It has no `speedTilesPerSecond` and no `motion`. Entries without `type` are bullets, exactly as authored today. `lob` leaves the motion kinds. Any pattern may fire a bomb.
- **N22 - A bomb has its own runtime.** `state.bombs` holds `BombState`, with its own advancing, collision and drawing, separate from `state.shards`. Bombs follow the same phase and clear rules as shards and keep the once-only hit.
- **N23 - One id sequence, merged order.** Bombs and shards share `nextShardId`, and each step resolves both lists merged by id. Same-seed runs therefore stay identical to before the split, and a test proves it before the targeted-bomb change lands.
- **N24 - Range is authored.** Range is measured from the spawn point. All five shipped bombs author `rangeTiles: 1.8` with `travelSeconds: 0.6`, exactly where speed 3 × 0.6 s lands them today. The wiki lists no bomb speed, so the old speed had no source.
- **N25 - A bomb's speed is derived.** Velocity is (destination − spawn) / `travelSeconds`. No speed exists anywhere on a bomb.
- **N26 - Inspection and tests.** Scene inspection reports bombs separately from shards. Tests that look for bombs in `state.shards` are rewritten, an accepted exception to "existing tests pass unchanged". Reported shard totals sum both lists where they meant all projectiles.
- **N27 - A targeted bomb's timing is time only.** It lands exactly on the target in `travelSeconds` at any distance, with no clamp, and its `rangeTiles` is ignored. Its speed varies with distance. See D31.
- **N28 - A bomb targets the player only.** `target: "player"` is the only target. See D28.
- **N29 - The target lives on the attack.** The same bomb is thrown both targeted and in rings, so `target` is an `AttackSpec` field, not a projectile field. The landing point is captured at fire time.
- **N30 - A targeted bomb is single-shot.** The validator requires a `spread` with `shots: 1` and `aim: "player"`, firing a bomb. Any other combination, including any ring or arm, is rejected.

Tagger:

- **N31 - Tag shape.** `pattern` and `shots` keep their meaning, with `shots` as arms. Rings gain optional `armPattern` (`spread`, `scatter` or `ring`) and `shotsPerArm`. Bomb targeting adds no tag field. `armPattern` joins the Z06 grouping key.
- **N32 - Schema v2 stays.** Every new field is optional and additive. No version bump, and committed evidence stays byte-identical.
- **N33 - One level only.** A tag describes one level of nesting. Deeper nesting is authored in JSON.
- **N34 - A typed cone.** `armArcDegrees` is required when `armPattern` is `spread` or `scatter`, and absent otherwise. It supersedes T27 for this one field.
- **N35 - Typed rotation.** `clockwiseDegreesPerSecond` and `initialPhaseDegrees` are optional, each independently, on `rotating-arm` tags only. They are sticky fields copied to new tags and editable per row, so a person can type a per-burst correction. They supersede T27 for these two fields.

Preview:

- **N36 - Matching ignores arm content.** A tag matches by sprite and pattern family as today (M03), so a composite tag matches a plain ring. The ring supplies the projectile's motion; the tag's arms, `armPattern`, shots per arm and cone override it, so `yellow-glaive-spread-ring` draws at once. A tag with no `armPattern` draws single-shot arms even on an authored composite, because the tag wins. A tag with no matching attack stays unmatched.
- **N37 - Preview rotation.** A `rotating-arm` tag's arm 0 bearing is its phase + its rate × (tag time − first tag time in its `groupKey` group). Each of rate and phase is the tag's typed value, else the matched attack's authored one, so existing tags start rotating in the preview. A `fixed-ring` tag has rate 0, even on a rotating attack. It only sets the bearing each volley fires on; no arm is drawn. This supersedes M06 for `rotating-arm`.
- **N38 - Per-burst advance and arm spread stay excluded.** M06 stands for both. `white-bomb-advance` draws every burst at the same angle unless a person types a different phase on that tag.
- **N39 - A tag's aim overrides the attack's.** A tag's `player` or `front` replaces the authored aim. A `fixed` tag behaves as today. The front offset is the matched attack's authored offset, or 0 if it has none.
- **N40 - A targeted bomb lands on the slider point.** This closes the gap between M08 and `poseAtAge`, which passes no player position today. It applies only when the resolved pattern is one shot; a tag with more shots uses the bomb's `rangeTiles`, because the tag's count wins (M05).

Export:

- **N41 - Export as JSON.** A selected tag shows its `AuthoredAttack` JSON in a read-only box, with a copy button. A person pastes it into `enemies.json`. Nothing writes a file, so this stays clear of the out-of-scope tuning UI. The browser's clipboard failing leaves the box usable.
- **N42 - Missing fields come from the match.** `projectile` and `cadence` come from the matched attack, the id is the attack's id plus `-tagged`, and `tuningSource` is `video-observation`. An unmatched tag cannot export. Cadence is never derived from intervals (T08, T32, D13).
- **N43 - Typed values are exported.** The exported pattern is the same one the preview draws, including the tag's aim override, converted to authored form. `initialPhaseDegrees` is therefore measured at the first tag, not at the game's clock start, and a `fixed-ring` exports rate 0. A front-aimed export shows a note that the archetype needs `initialHeadingDegrees`.

## Architecture

| Module | Addition |
| ------ | -------- |
| `game/config/data.ts` | Authored bomb entry, `armPattern`, `aim: "front"`, `target`, `initialHeadingDegrees`, and their validators |
| `game/config/encounter.ts` | `ProjectileSpec` becomes `BulletSpec \| BombSpec`; runtime validators; the cross-field rules for N17 and N30 |
| `game/simulation/bombs.ts` (new) | `createBomb`, `advanceBomb`, `resolveBombDestination`, the id-merged step order |
| `game/simulation/patterns.ts` | Recursive arm expansion, draw counting, front aim |
| `game/simulation/simulation.ts` | `state.bombs`, the merged step, heading updates, `target` passed at fire time |
| `game/phaser/encounter.ts` | Separate bomb drawing and inspection |
| `research/tagging.ts`, `taggingOptions.ts` | New tag fields, shape checks, edits, sticky values, grouping |
| `research/previewModel.ts` | Tag geometry override, rotation, aim override, heading input |
| `research/PreviewPanel.tsx`, `previewDraw.ts` | Heading slider and arrow |
| `research/exportAttack.ts` (new) | Pure tag-to-`AuthoredAttack` conversion |

`game/` stays free of React, Phaser and storage in its config and simulation layers. `research/` still imports from `game/` and never the other way. The preview still has no clock of its own and React still holds only inputs, never one element per projectile.

## Target Data Shapes

```ts
/** N03/N04/N06/N11: what one arm of a ring fires. Absent on a ring means single. */
export type ArmPattern =
  | Readonly<{ kind: "single" }>
  | Readonly<{ kind: "spread"; shots: number; arcDegrees: number }>
  | Readonly<{ kind: "scatter"; shots: number; coneDegrees: number }>
  | Readonly<{
      kind: "ring";
      arms: number;
      phaseOffsetDegrees?: number;
      armPattern?: ArmPattern;
    }>;

export type RingPattern = Readonly<{
  // ...existing fields unchanged...
  armPattern?: ArmPattern;
}>;

/** N16: joins the existing player and fixed cases on spread and scatter. */
type FrontAim = Readonly<{ aim: "front"; offsetDegrees: number }>;
```

```ts
/** N21-N25: authored. `type` is absent on every bullet entry. */
type AuthoredBomb = Readonly<{
  type: "bomb";
  source: string;
  damageHp: number;
  armorPiercing: boolean;
  conditions: readonly ConditionApplication[];
  appearance: string;
  expiration: "lifetime-only";
  hitPolicy: "once-per-shard";
  rangeTiles: number;
  travelSeconds: number;
  detonationRadiusTiles: number;
}>;

/** Runtime: every existing field, with `type` added. */
export type BulletSpec = Readonly<{ type: "bullet"; /* ...today's fields... */ }>;
/** Runtime: today's non-motion fields plus the three bomb values. No speed. */
export type BombSpec = Readonly<{ type: "bomb"; rangeTiles: number; travelSeconds: number; detonationRadiusTiles: number; /* ... */ }>;
export type ProjectileSpec = BulletSpec | BombSpec;

export type BombState = {
  id: number; // Shared with shards (N23).
  projectileId: string;
  orientationRadians: number;
  positionTiles: Vector2;
  velocityTilesPerSecond: Vector2;
  ageSeconds: number;
  lifetimeSeconds: number;
  damageHp: number;
  hasHitPlayer: boolean;
  detonationTargetTiles: Vector2;
};

export type AttackSpec = Readonly<{
  // ...existing fields unchanged...
  target?: "player"; // N28-N30.
}>;
```

```ts
export type TagAim = "player" | "fixed" | "front"; // N19.

export type Tag = Readonly<{
  // ...existing v2 fields unchanged...
  /** N31: rings only. */
  armPattern?: "spread" | "scatter" | "ring";
  /** N31: required with armPattern. */
  shotsPerArm?: number;
  /** N34: required when armPattern is spread or scatter. */
  armArcDegrees?: number;
  /** N35: rotating-arm only. Typed estimates. */
  clockwiseDegreesPerSecond?: number;
  initialPhaseDegrees?: number;
}>;
```

Bearing frames do not change: degrees and radians increase clockwise on screen from +x, with `y` down. A nested shot's bearing is the outermost arm's bearing plus each inner level's offset. The spawn point is enemy + bearing × outermost `emitterRadiusTiles`.

## Approved Scope And Review Gates

- Exactly one shipped attack changes (N01, N02). `git diff` on `enemies.json` across this plan is the `white-bomb-targeted` `target` field alone, and on `projectiles.json` the five bomb entries alone.
- Phase 49 is behaviour-identical: a characterization test written before the split passes unchanged after it (N23). Phase 50 keeps it passing on a configuration with `target` removed, so the only behaviour change is N02.
- Every value added is a named constant or authored field with its source. No fidelity claim is made about front aim beyond the recorded user observation. Typed tag values are labelled estimates.
- `docs/killer-bee-queen-observations.json` stays byte-identical and its schema test keeps passing.
- New testable behaviour is written test-first in pure helpers. No new Playwright case is added. An existing case that reads `.shards` or the rules identity is updated and run alone with `npm run test:e2e -- --grep "<pattern>"`.
- `npm run verify` passes at the end of each phase, and each phase's manual checks are recorded as actually performed or as blocked.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 49 | Bombs Become Their Own Shot | complete | V14 phase 48 |
| 50 | The Targeted Bomb | complete | Phase 49 |
| 51 | Composite Patterns | complete | Phase 49 |
| 52 | Front-Relative Aim | complete | Phase 51 |
| 53 | Tagging Composites And Typed Geometry | complete | Phase 52 |
| 54 | Previewing Composites, Rotation And Front | complete | Phases 50, 53 |
| 55 | Export A Tag As An Attack | complete | Phase 54 |

## Phase 49: Bombs Become Their Own Shot

Status: complete. Dependencies: V14 phase 48. Outcome: Moved bombs to an authored `bomb` type and a separate `state.bombs` runtime with no behaviour change, proven by pre-split characterization snapshots. Archive: [`phase-49.md`](plan-archive/phase-49.md).

## Phase 50: The Targeted Bomb

Status: complete. Dependencies: phase 49. Outcome: Added the player-targeted bomb, adopted it on `white-bomb-targeted` and advanced the Queen to rules identity v12. Archive: [`phase-50.md`](plan-archive/phase-50.md).

## Phase 51: Composite Patterns

Status: complete. Dependencies: phase 49. Outcome: Added the recursive `armPattern`, nested bearing expansion and constant-count scatter draws; nothing shipped uses it. Archive: [`phase-51.md`](plan-archive/phase-51.md).

## Phase 52: Front-Relative Aim

Status: complete. Dependencies: phase 51. Outcome: Added enemy heading, `initialHeadingDegrees` and `aim: "front"`; no shipped attack uses it. Archive: [`phase-52.md`](plan-archive/phase-52.md).

## Phase 53: Tagging Composites And Typed Geometry

Status: complete. Dependencies: phase 52. Outcome: Added composite and typed-geometry tag fields with validation, edits, sticky values, grouping and tagger controls. Archive: [`phase-53.md`](plan-archive/phase-53.md).

## Phase 54: Previewing Composites, Rotation And Front

Status: complete. Dependencies: phases 50, 53. Outcome: Made the preview draw a tag's own geometry, group-relative rotation, front aim, targeted bombs and an enemy-heading slider. Archive: [`phase-54.md`](plan-archive/phase-54.md).

## Phase 55: Export A Tag As An Attack

Status: complete. Dependencies: phase 54. Outcome: Added tag-to-attack export as JSON in a read-only box and updated the tagger guide. Archive: [`phase-55.md`](plan-archive/phase-55.md).
