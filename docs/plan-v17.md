# Plan V17: Night Hive, a dark UI redesign for Dodge Hell Training

This document is a complete brief for an implementer who has not seen the analysis behind it. Work through the phases in order. Everything here was checked against the code on 2026-11-06 at commit `59f2fb2`, but line numbers can drift, so search for the quoted code rather than trusting a number blindly.

## How to work

1. Read `AGENTS.md` first. Its rules win over this plan if they ever conflict.
2. Do the phases in order. Each phase must leave a working app. Do not start a phase until the previous one passes its checks.
3. Do not change gameplay: no edits to `app/src/game/simulation/` logic, to `app/src/game/data/*.json`, or to any `rulesVersion`. Phase 3 only adds pure read-only helpers beside that code.
4. For new pure logic, write the failing test first, then the code.
5. Run commands from `app/`. While iterating use `npx vitest run <path>`. At the end of each phase run `npm run verify` once. Use the `verifier` subagent if your environment has it.
6. Run Playwright only for tests you changed or that this plan names: `npm run test:e2e -- --grep "<pattern>"`.
7. Do not commit or push unless the user asks.
8. **Stop and report rather than improvise** if a test fails for a reason this plan does not mention, if a snippet does not fit the code you find, or if you are tempted to weaken an assertion that this plan does not tell you to change.
9. Write files with your Write and Edit tools, not shell redirection.

## Why this work exists

The app looks like a settings page wrapped around a game: a pale green shell, native form controls, and 146 px of chrome above the arena at 1440 x 900. The simulation also models far more than the UI shows.

| Already in the game | What the player sees today |
| --- | --- |
| Queen has 112,500 HP draining at 375 HP/s (195 in phase 7), with eight phases at HP thresholds | No boss bar. The phase name appears only inside the Phases panel |
| Sub-phases cycle (red, blue, yellow; circle room, circle pond) | Nothing |
| 13 conditions with authored descriptions | A 10 px chip under the player, and a Controls list mixing conditions with keys |
| Projectile catalog: pixel sprites, damage, armor piercing, conditions, motion kind | Nothing before the fight |
| Paladin derived stats (speed in tiles/s, regeneration) and equipment | Four bare numbers |
| Per-drill comparison identities | A flat list labelled "Current rules" or "Other rules" |

Two defects are also fixed here:

1. **The Queen's personal best is always "None".** `History` in `app/src/App.tsx` compares against `RULES_VERSION`, which is the Crystal Worm's version (`AUTHORED_ENCOUNTER` in `app/src/game/config/data.ts`). Queen attempts, the default encounter, show as "Other rules". A screenshot during planning reproduced this.
2. **The honey floor hides the attacks.** Measured luminance contrast on the current honey `#b5791a`: red stinger 1.1:1, boss body 1.3:1, bomb telegraph 1.2:1, player 3.3:1. Honey also fills most of the Queen's room.

The outcome is a dark interface with a strong identity, where a player can see which phase they are in, what it throws, and whether they are improving. Existing attempts stay comparable, and `rulesVersion` is not bumped.

## Decisions (prefix H)

The user gave full design freedom and asked not to be questioned, then asked for this plan to be handed to another instance. Treat these as approved, and record them in Phase 0.

- **H01** Promote D09 finding F8 (palette duplicated between CSS and Phaser, unused `index.css`).
- **H02** Promote the drawing part of D09 finding F4 (`EncounterScene` split), needed for one shared renderer in Phase 7. The rest of F4 stays deferred.
- **H03** Replace the Home Phases aside from plan V7 with an always-visible inline selector. The live HUD panel keeps its behaviour, including Apply and Escape handling.
- **H04** "No second simulation clock" means per running attempt. The Home preview owns a separate, unsaved simulation that exists only while no encounter is mounted, so two clocks never run together.
- **H05** The personal best uses the selected encounter and drill. Stored records and identities are untouched.
- **H06** During a session the HUD is a left rail at 1100 px and wider, and a compact top band below that.

**Out of scope:** rules, tuning, D24 player sprite, D18 phase selector on results, D17 persisted selector state, D10, new boss art, new audio, touch controls, player attacks, and any tagger redesign. The tagger is already dark and only gets a smoke check.

## Design system

**Subject:** a practice tool for Realm of the Mad God players who die to a boss and want one more attempt. **Primary job:** get from "which phase beats me" to dodging it, then show whether it went better.

**Concept:** a boss title card over a live, real view of the fight. The Home hero is the one bold element. Everything around it stays quiet.

### Colour

| Token | Hex | Role | Contrast on Night |
| --- | --- | --- | --- |
| Night | `#15111B` | Page ground, a plum-black | n/a |
| Comb | `#1E1A26` | Panels | n/a |
| Comb raised | `#262131` | Hover and current rows | n/a |
| Seam | `#3A3246` | Rules and borders, never text | 1.5 |
| Wax | `#EFE6D8` | Primary text | 15.1 |
| Smoke | `#A89BB0` | Secondary text | 7.1 |
| Honey, Ember | `#F2A91E`, `#E5482F` | Queen accent pair | 9.3, 4.7 |
| Crystal, Coral | `#69E8EA`, `#EA7969` | Worm accent pair | 12.7, 6.6 |

The accent pair follows the selected encounter through a `data-encounter` attribute. Use Ember and Coral only for large text, rules and fills. Primary buttons use the accent as background with Night text (9.3 and 12.7).

Player white, boss coral, the HP bar colours and all five telegraph colours stay exactly as they are. They carry gameplay meaning and pixel tests depend on them.

### Type

Both families are OFL-1.1, self-hosted through npm, and were rendered in Chromium during planning. Barlow's tabular figures were measured working: `1111` and `0000` are the same width with `font-variant-numeric: tabular-nums`.

- **Grenze Gotisch** (`'Grenze Gotisch Variable'`): boss names and result titles only, at 40 px or larger. Weight 700.
- **Barlow Semi Condensed** (`'Barlow Semi Condensed'`, 500 and 600): everything else, replacing every `Consolas` and `Trebuchet MS` use.

### Rules that keep it from looking generic

Never use: all-caps labels, tracked-out eyebrows, identical rounded cards, gradient washes, middle-dot metadata, arrows appended to button text, or decorative numbering. Phase numbers are a real sequence and may stay. Corners are 3 px on controls and square on panels. Motion answers an event; the only ambient motion is the hero preview, which stops under reduced motion. Copy is sentence case with plain verbs.

## Layouts

Home at 1440 x 900, hero filling the first screen:

```
+--------------------------------------------------------------------+
| Dodge Hell Training                          Controls  Mute  Debug |
+------------------------+-------------------------------------------+
| ( Queen )( Worm )      |                                           |
| Killer Bee Queen       |          LIVE PHASE PREVIEW               |
| [blackletter, accent]  |     whole room, real simulation,          |
| A fixed Paladin, ...   |     selected or hovered phase             |
|                        |                                           |
| o Full fight           |                                           |
| [ ] Phase 1 - Honey..  |                                           |
| [x] Phase 3 - Pond..   +-------------------------------------------+
| [ ] Phase 4 - Glaive.. | Phase 3 - Pond Barrage                    |
| ...          [ ] Loop  | sprites, damage, conditions, motion,      |
| [ Start ]              | minions                                   |
+------------------------+-------------------------------------------+
  below the fold: practice record / Paladin / changelog / footer
```

Live at 1100 px and wider. The rail takes width, which a dodger has spare, and gives back height, which they do not. At 1440 x 900 the arena goes from 754 px tall to 900 px (19% more) and never sits under the HUD:

```
+-------------+------------------------------------------------------+
| Killer Bee  |                                                      |
| Queen       |                                                      |
| Boss 72%    |                                                      |
| 1 Honey Pnd |                                                      |
| 2 Color Ch. |                                                      |
| 3 Pond Barr.|                 Phaser arena                         |
|   ###---    |              (full viewport height)                  |
|   ends 60%  |                                                      |
| 4 Glaive    |                                                      |
| ...         |                                                      |
| HP 488/775  |                                                      |
| 12.4 s  5   |                                                      |
| Slowed 1.2  |                                                      |
| buttons     |                                                      |
+-------------+------------------------------------------------------+
```

Below 1100 px the rail becomes a top band: name and status row, health and time row, a one-line phase strip, a one-line conditions slot, then buttons.

---

## Phase 0: Record the plan

No app code.

1. Copy this file to `docs/plan-v17.md`.
2. In `implementation-plan.md`, under "Current Plan", add one table row: `| V17 | 65-72 | active | H | [docs/plan-v17.md](docs/plan-v17.md) |`. Find it with `grep -n "Current Plan" implementation-plan.md` and read only that table.
3. In `docs/deferred-work.md`, under `### D09`, add this paragraph: "**F8 and part of F4 promoted.** Plan V17 (H01, H02) resolves F8 through `game/config/palette.ts` and moves arena drawing out of `EncounterScene` into `game/phaser/arena-renderer.ts`. The remaining F4 split, F6 and F9 stay deferred."

Phase numbers map as: this plan's Phase 1 is phase 65, and so on through Phase 8 as 72.

---

## Phase 1: Foundations, with the same layout

Goal: the whole app turns dark and nothing moves. No test should need editing in this phase, because canvas colours do not change until Phase 2.

### 1.1 Install fonts

```bash
cd app
npm install @fontsource-variable/grenze-gotisch @fontsource/barlow-semi-condensed
```

### 1.2 Create `app/src/game/config/palette.ts`

This becomes the single colour source. It has no imports except a type.

```ts
import type { TelegraphColorName } from "./data";

/**
 * The single colour source for CSS and Phaser (plan V17 H01). Presentation
 * only: no value here changes a gameplay rule. Entity, health and telegraph
 * colours are unchanged from before the redesign because they carry gameplay
 * meaning.
 */
export const palette = {
  ui: {
    night: "#15111B",
    comb: "#1E1A26",
    combRaised: "#262131",
    seam: "#3A3246",
    wax: "#EFE6D8",
    smoke: "#A89BB0",
    honey: "#F2A91E",
    ember: "#E5482F",
    crystal: "#69E8EA",
    coral: "#EA7969",
    warning: "#FF8FA3",
  },
  arena: {
    background: "#15111B",
    ground: "#1E1A26",
    groundCellLight: "#252030",
    groundCellDark: "#1A1622",
    grid: "#2F2839",
    boundary: "#7A6C8A",
    honey: "#4A2F0C",
    honeyRim: "#FFCF7A",
    bombKeyline: "#EFE6D8",
  },
  entity: {
    player: "#F0F5EF",
    enemy: "#EA7969",
    shard: "#FFDF69",
    spentShard: "#C9A948",
    lobTelegraph: "#FF5F5F",
  },
  health: {
    fill: "#55D6A0",
    empty: "#592E39",
    border: "#15111B",
  },
  telegraph: {
    white: "#FFFFFF",
    amber: "#FFB347",
    red: "#FF5F5F",
    violet: "#B388FF",
    cyan: "#69E8EA",
  } satisfies Record<TelegraphColorName, string>,
  hitNumber: { fill: "#FF8FA3", stroke: "#15111B" },
  conditionChip: {
    activeFill: "#55303A",
    inertFill: "#2A2A2A",
    activeText: "#FFDF69",
    inertText: "#7A7A7A",
  },
} as const;

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** CSS custom properties for every colour the stylesheets use. */
export function paletteCssVariables(): Readonly<Record<string, string>> {
  const { ui, health, telegraph } = palette;
  return {
    "--night": ui.night,
    "--comb": ui.comb,
    "--comb-raised": ui.combRaised,
    "--seam": ui.seam,
    "--wax": ui.wax,
    "--smoke": ui.smoke,
    "--honey": ui.honey,
    "--ember": ui.ember,
    "--crystal": ui.crystal,
    "--coral": ui.coral,
    "--warning": ui.warning,
    "--hp-fill": health.fill,
    "--hp-empty": health.empty,
    "--telegraph-white": telegraph.white,
    "--telegraph-amber": telegraph.amber,
    "--telegraph-red": telegraph.red,
    "--telegraph-violet": telegraph.violet,
    "--telegraph-cyan": telegraph.cyan,
  };
}
```

Add a small test `app/src/game/config/palette.test.ts`: `hexToNumber("#1E1A26") === 0x1e1a26`, and every value from `paletteCssVariables()` matches `/^#[0-9A-Fa-f]{6}$/`.

### 1.3 Create `app/src/global.css`

Move the `:global` rules out of `App.module.css` (the blocks at the top and `:global(button:disabled)`), and delete them there. Keep `#root` sizing.

```css
:root {
  color-scheme: dark;
  color: var(--wax);
  background: var(--night);
  font: 500 16px/1.45 "Barlow Semi Condensed", system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  scrollbar-color: var(--seam) var(--night);
  --display: "Grenze Gotisch Variable", Georgia, serif;
  --rail-width: 264px;
  --accent: var(--honey);
  --accent-deep: var(--ember);
}
[data-encounter="crystal-worm"] {
  --accent: var(--crystal);
  --accent-deep: var(--coral);
}
*, *::before, *::after { box-sizing: border-box; letter-spacing: 0; }
body { margin: 0; background: var(--night); }
#root { width: 100%; max-width: none; min-height: 100svh; border: 0; text-align: left; }
button {
  font: inherit;
  font-weight: 600;
  color: var(--wax);
  background: var(--comb);
  border: 1px solid var(--seam);
  border-radius: 3px;
  padding: 7px 14px;
  cursor: pointer;
}
button:hover:not(:disabled) { background: var(--comb-raised); border-color: var(--smoke); }
button:disabled { opacity: 0.45; cursor: default; }
button:focus-visible, a:focus-visible, summary:focus-visible, input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
input[type="checkbox"], input[type="radio"], input[type="range"] { accent-color: var(--accent); }
a { color: var(--wax); text-underline-offset: 3px; }
code { font: inherit; color: var(--wax); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

### 1.4 Update `app/src/main.tsx`

Add before `createRoot`:

```ts
import "@fontsource-variable/grenze-gotisch/wght.css";
import "@fontsource/barlow-semi-condensed/latin-500.css";
import "@fontsource/barlow-semi-condensed/latin-600.css";
import "./global.css";
import { paletteCssVariables } from "./game/config/palette";

for (const [name, value] of Object.entries(paletteCssVariables()))
  document.documentElement.style.setProperty(name, value);
// Phaser text draws with whatever is loaded, so ask for the face early.
void document.fonts?.load('600 18px "Barlow Semi Condensed"');
```

Set `data-encounter={selectedEncounterId}` on `<main>` in `App.tsx`.

### 1.5 Update `app/index.html`

- `<title>Dodge Hell Training</title>` (currently `app`).
- Add `<meta name="theme-color" content="#15111B" />`.
- Add `<style>html{background:#15111B}</style>` to prevent a light flash. This is the one permitted literal colour outside `palette.ts`.

### 1.6 Delete `app/src/index.css`

Nothing imports it; `grep -rn "index.css" src index.html` returned nothing during planning. Re-run that grep first.

### 1.7 Retoken the stylesheets

In `App.module.css` and `ui/PhaseSelector.module.css`, replace literals with these variables:

| Old value | New |
| --- | --- |
| `#152c26`, `#183f31` (text) | `var(--wax)` |
| `#e9efeb` (page) | `var(--night)` |
| `#f8fbf8` (panels, dialog, results) | `var(--comb)` |
| `#c4d5cc`, `#648575`, `#386353` (borders) | `var(--seam)` |
| `#4a6b5c`, `#36594b` (secondary text) | `var(--smoke)` |
| `#26885d`, `#299774`, `#55d6a0` (accent, focus) | `var(--accent)` |
| `#164d3b` with white text (`.primary`) | background `var(--accent)`, text `var(--night)` |
| `#24674f` (`.primary:hover`) | `var(--accent)` with `filter: brightness(1.1)` |
| `#993c27`, `#84392e`, `#b3314b` (warnings, hits) | `var(--warning)` |
| `#d6e5dd` (notice background) | `var(--comb)` |
| `#101b1b` (arena, shadows) | `var(--night)` |
| `#86ded9`, `#ea7969` (`.crystal`) | `var(--crystal)`, `var(--coral)` |
| `#29423a`, `#1c302a` (`.specimen`) | `var(--seam)`, `var(--comb)` |
| `Consolas, monospace`, `"Trebuchet MS"` | remove and inherit |

After this, run `grep -nE "#[0-9a-fA-F]{3,8}" src/App.module.css src/ui/PhaseSelector.module.css` and resolve anything left. `#fff` on the countdown becomes `var(--wax)`.

Style the health `<meter>` so it reads on dark. Remove `accent-color` and add:

```css
.health meter { appearance: none; background: var(--hp-empty); border: 0; height: 12px; }
.health meter::-webkit-meter-bar { background: var(--hp-empty); border: 0; border-radius: 0; height: 12px; }
.health meter::-webkit-meter-optimum-value,
.health meter::-webkit-meter-suboptimum-value,
.health meter::-webkit-meter-even-less-good-value { background: var(--hp-fill); }
.health meter::-moz-meter-bar { background: var(--hp-fill); }
```

### Phase 1 checks

- `npm run verify` passes with no test edits.
- Screenshot Home, live and results. All are dark with the same layout.
- `?tagger=1` in dev still loads and looks reasonable, since global button styles changed. It has its own dark CSS.

---

## Phase 2: Arena readability

Goal: attacks stand out. Presentation only, in `app/src/game/phaser/encounter.ts`. No collision data or sprite data changes.

Expected contrast on the new honey, measured during planning:

| On screen | Honey today | Deep honey `#4A2F0C` |
| --- | --- | --- |
| Red stinger | 1.1 | 3.8 |
| Boss body | 1.3 | 4.4 |
| Bomb telegraph | 1.2 | 4.1 |
| Player | 3.3 | 11.2 |
| Yellow stinger | 3.1 | 10.3 |
| Blue stinger | 1.7 | 2.0 |
| Blue bomb | 2.3 | 1.4 |

On floor `#1E1A26`: red stinger 5.3 (was 3.8 to 4.8), blue stinger 2.7 (was 2.0 to 2.5), boss 6.0, blue bomb 2.0. The darkest floor helps every sprite, because all sprites are lighter than it. Blue bombs get worse on honey, so they get a keyline below. Sprite palettes are authored data and must not change.

### 2.1 Point `presentation` at the palette

Replace colour literals in the `presentation` object, keeping every size and timing value:

```ts
const presentation = {
  hudIntervalMilliseconds: 100,
  millisecondsPerSecond: 1000,
  background: hexToNumber(palette.arena.background),
  ground: hexToNumber(palette.arena.ground),
  groundHoneycombLight: hexToNumber(palette.arena.groundCellLight),
  groundHoneycombDark: hexToNumber(palette.arena.groundCellDark),
  grid: hexToNumber(palette.arena.grid),
  boundary: hexToNumber(palette.arena.boundary),
  honey: hexToNumber(palette.arena.honey),
  honeyRim: hexToNumber(palette.arena.honeyRim),
  player: hexToNumber(palette.entity.player),
  enemy: hexToNumber(palette.entity.enemy),
  // telegraphColors: map each name through hexToNumber(palette.telegraph.x)
  // shard, spentShard, lobTelegraph.color, healthBar.fill/empty/border,
  // conditionChip fills and text: same treatment
  bombKeyline: { widthCssPixels: 1.5, color: hexToNumber(palette.arena.bombKeyline) },
  // ...the rest unchanged
```

Keep `hexColourToNumber` where it converts appearance palette strings, or replace it with `hexToNumber`, whichever is one line. Grid and boundary lines keep their current widths.

### 2.2 Bomb keyline

Bomb bodies are drawn in `drawEntities` through the local `draw` helper. Right after the `draw(...)` call in the `for (const bomb of bombs)` loop, add a stroke. The polygon and hitbox do not change.

```ts
const keyline = transformBodyVertices(
  projectile.verticesTiles,
  bomb.positionTiles,
  bomb.orientationRadians,
).map(
  (vertex) =>
    new Phaser.Math.Vector2(vertex.x * pixelsPerTile, vertex.y * pixelsPerTile),
);
this.projectiles
  .lineStyle(
    presentation.bombKeyline.widthCssPixels / this.zoom,
    presentation.bombKeyline.color,
  )
  .strokePoints(keyline, true);
```

### 2.3 Canvas text

In `addHitNumber` and `drawConditionChips`, change `fontFamily` to `'"Barlow Semi Condensed", sans-serif'` and `fontStyle` to `"600"`. Raise `hitNumbers.fontSizeCssPixels` from 18 to 20, because a spec requires the `-128` text to be wider than 30 px and this font is narrower than Consolas. Stroke uses `palette.hitNumber.stroke`.

### 2.4 Update the pixel test

`app/tests/app.spec.ts` `renderedPixels` hardcodes the old ground colour: `if (red === 28 && green === 48 && blue === 42) counts.ground++;`. Import the palette and pass the value in, so test and code cannot drift. `page.evaluate` closures cannot see outer variables, so change the single argument to an object:

```ts
import { hexToNumber, palette } from "../src/game/config/palette.ts";
// ...
const groundColourValue = hexToNumber(palette.arena.ground);

async function renderedPixels(page: Page) {
  return page.locator("canvas").evaluate(
    (canvas, { shardColours, groundColour }) => {
      // ...unchanged, except:
      // if (((red << 16) | (green << 8) | blue) === groundColour) counts.ground++;
    },
    { shardColours: shardColourValues, groundColour: groundColourValue },
  );
}
```

Do not change the player, enemy, health bar, missing health or hit text checks. The colours they test are unchanged. Keep the `expect(pixels.ground).toBeGreaterThan(1000)` threshold.

### Phase 2 checks

- `npm run verify`.
- `npm run test:e2e -- --grep "renders readable nonblank arena"`.
- Find and run the hit number size test: `grep -n "widthCssPixels" tests/app.spec.ts`, then use the enclosing test title.
- Screenshot Queen phases 2, 5 and 8 and look at the blue sprites. The `phase` parameter is a zero-based index, so use `?encounter=killer-bee-queen&phase=1&loop=1`, then `phase=4` and `phase=7`. The player dies quickly when idle, so capture within a few seconds of the countdown ending. If blue sprites are hard to see, report it. Do not add sprite halos, because they would misrepresent hitboxes.

---

## Phase 3: Pure view models

Goal: all data the new UI needs, with tests, and no visual change except the personal best fix.

### 3.1 Extend the phase view

In `app/src/game/phaser/view.ts`, add pure helpers and fields. Test in `view.test.ts`.

```ts
export type PhaseView = Readonly<{
  phaseIndex: number;
  phaseLabel: string;
  phaseCount: number;
  drill: DrillSelection | null;
  /** 0 to 1, or null when the primary enemy has no health (Crystal Worm). */
  bossHealthFraction: number | null;
  /** 0 to 1 through the current phase. */
  phaseProgress: number;
  /** The HP fraction that ends this phase, or null when it ends another way. */
  phaseEndsAtFraction: number | null;
  /** Authored seconds for a timed phase, or null. */
  phaseTimedSeconds: number | null;
  subPhaseId: string | null;
}>;

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export function phaseProgressOf(
  archetype: EnemyArchetype,
  phaseIndex: number,
  healthFraction: number | null,
  secondsInPhase: number,
): number {
  const phase = archetype.phases[phaseIndex];
  // A timed phase (the Queen's phase 6) cannot be read from HP: she is
  // invulnerable through it and phases 6 and 7 share the 0.25 threshold.
  if (phase.exitAfterSeconds !== null)
    return clampUnit(secondsInPhase / phase.exitAfterSeconds);
  if (healthFraction === null) return 0;
  const end = archetype.phases[phaseIndex + 1]?.enterAtHpFraction ?? 0;
  const span = phase.enterAtHpFraction - end;
  return span <= 0 ? 0 : clampUnit((phase.enterAtHpFraction - healthFraction) / span);
}
```

In `phaseViewOf`, derive the new fields from `primary`, with these rules:

- `bossHealthFraction`: `primary.healthHp / primary.maxHealthHp` when both are non-null, otherwise `null`.
- `secondsInPhase`: `state.elapsedSeconds - primary.phaseEnteredAtSeconds`.
- `phaseEndsAtFraction`: `null` for a timed phase, a missing health value, or the last phase. Otherwise the next phase's `enterAtHpFraction`.
- `phaseTimedSeconds`: `phase.exitAfterSeconds`.
- `subPhaseId`: `phase.subPhases?.[primary.subPhaseIndex]?.id ?? null`.
- When `primary` is undefined: `bossHealthFraction` null, progress 0, others null.

Required test cases, using the real Queen archetype (`primaryArchetype(encounterConfigOf("killer-bee-queen"))`):

| Phase index | Enter | Next enter | Input | Expected progress |
| --- | --- | --- | --- | --- |
| 2 | 0.75 | 0.6 | fraction 0.675 | 0.5 |
| 5 (timed, 29 s) | 0.25 | 0.25 | 14.5 s, fraction 0.25 | 0.5 |
| 6 | 0.25 | 0.125 | fraction 0.1875 | 0.5 |
| 7 (last) | 0.125 | none | fraction 0.0625 | 0.5 |

Also: the Worm gives `bossHealthFraction` null and progress 0, and values clamp to 0 and 1.

Add to `EncounterView` in `encounter.ts`: `conditions: readonly VisibleCondition[]`. In `publishView`, set `conditions: visibleConditions(this.state.player)`. `EncounterView` also gains the new `PhaseView` fields; change its declaration to include them.

Update every place that builds an `EncounterView` by hand:

- The `useState<EncounterView>` initial value in `App.tsx`: `bossHealthFraction: null, phaseProgress: 0, phaseEndsAtFraction: null, phaseTimedSeconds: null, subPhaseId: null, conditions: []`.
- `runningView` in `app/src/App.test.tsx`: the same six fields.

### 3.2 Phase dossier

Create `app/src/game/config/phaseDossier.ts` with `phaseDossier.test.ts`. It imports only from `./encounter` and `../simulation/conditions`' type.

```ts
export type PhaseDossier = Readonly<{
  projectiles: readonly ProjectileSpec[];
  damageRange: Readonly<{ min: number; max: number }> | null;
  armorPiercing: boolean;
  /** One entry per condition key, holding its longest authored duration. */
  conditions: readonly ConditionApplication[];
  /** "linear", "boomerang", "turning", "wavy" or "bomb", unique. */
  motions: readonly string[];
  minions: readonly Readonly<{ archetypeId: string; count: number }>[];
  subPhaseIds: readonly string[];
}>;

export function phaseDossier(config: EncounterConfig, phaseIndex: number): PhaseDossier
```

Algorithm:

1. `const phase = primaryArchetype(config).phases[phaseIndex]`.
2. Collect attacks: `phase.attacks`, plus every `subPhase.attacks` in `phase.subPhases ?? []`.
3. Collect spawns: `phase.spawns ?? []`, plus every `subPhase.spawns ?? []`. Merge counts per `archetypeId` into `minions`.
4. Walk minions with a visited `Set<string>`: for each archetype, take `archetypeOf(config, id).phases`, adding each phase's attacks, sub-phase attacks and spawns. Nests spawn bees, so spawns recurse. Recursively found spawns are walked for attacks but added to `minions` as well.
5. Map each `attack.projectileId` through `projectileOf`, unique by `id`, in first-seen order.
6. `motions`: `projectile.type === "bomb" ? "bomb" : projectile.motion.kind`, unique.
7. `conditions`: for each projectile's `conditions`, keep the longest `seconds` per `key`.

Tests against real data, asserting structure rather than invented numbers:

- Queen index 1: `subPhaseIds` equals `["red", "blue", "yellow"]`, and `projectiles` is non-empty.
- Queen index 5: `minions` contains the three `killer-bee-nest-*` archetypes with count 1 each.
- Worm index 0: `projectiles` is non-empty and contains no duplicates.
- Every returned projectile's id exists in `config.projectiles`.
- For every Queen phase, `damageRange.min <= damageRange.max` when non-null.

### 3.3 Sprite rectangles

In `app/src/game/phaser/appearance-pixels.ts`, which is pure, add and test:

```ts
export type PixelRect = Readonly<{ x: number; y: number; width: number; colour: string }>;

/** One rectangle per horizontal run of one colour, for inline SVG sprites. */
export function appearanceRects(appearance: ProjectileAppearanceSpec): readonly PixelRect[] {
  const rects: PixelRect[] = [];
  appearance.pixels.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const colour = row[x];
      if (colour === null) { x++; continue; }
      let end = x + 1;
      while (end < row.length && row[end] === colour) end++;
      rects.push({ x, y, width: end - x, colour });
      x = end;
    }
  });
  return rects;
}
```

We use SVG rather than canvas because many Playwright tests assert `page.locator("canvas")` has count 0 on Home. **Do not add any `<canvas>` to Home outside Phase 7's motion-gated preview.**

### 3.4 Arena plate geometry

Create `app/src/game/phaser/arena-plate.ts`, pure, importing `octagonStaircaseRows` and types only, with tests.

```ts
/** Half the width of the square that holds the whole arena, in tiles. */
export function arenaExtentTiles(shape: ArenaShape): number {
  if (shape.kind === "circle") return shape.radiusTiles;
  return Math.max(
    ...octagonStaircaseRows(shape).map((row) =>
      Math.max(row.halfWidthTiles, Math.abs(row.rowCenterTiles) + 0.5),
    ),
  );
}

/** The stepped octagon boundary as an SVG path, in tiles from the centre. */
export function octagonBoundaryPath(shape: OctagonArenaShape): string {
  const rows = octagonStaircaseRows(shape);
  const right = rows.flatMap((row) => [
    [row.halfWidthTiles, row.rowCenterTiles - 0.5],
    [row.halfWidthTiles, row.rowCenterTiles + 0.5],
  ]);
  const left = [...rows].reverse().flatMap((row) => [
    [-row.halfWidthTiles, row.rowCenterTiles + 0.5],
    [-row.halfWidthTiles, row.rowCenterTiles - 0.5],
  ]);
  return `M${[...right, ...left].map(([x, y]) => `${x} ${y}`).join("L")}Z`;
}
```

Tests: a circle radius 19.2 gives extent 19.2. For an octagon with `flatHalfWidthTiles: 9.5, cornerSumTiles: 14.25`, the path starts with `M` and ends with `Z`, and the extent is at least 14.25.

### 3.5 History model and the personal best fix

Create `app/src/ui/historyModel.ts` with `historyModel.test.ts`. Node-only, no React.

```ts
import { drillRulesVersion } from "../game/config/drill";
import type { EncounterConfig } from "../game/config/encounter";
import type { DrillSelection } from "../game/models";
import { retainedBestSeconds, type AttemptRecord } from "../storage/attempts";

const DRILL_SUFFIX = /^-drill-p(\d+(?:-\d+)*)(-once)?$/;
export const SPARKLINE_ATTEMPTS = 20;

export function selectedRulesVersion(
  config: EncounterConfig,
  drill: DrillSelection | null,
): string {
  return drillRulesVersion(config.rulesVersion, drill);
}

export type KnownEncounter = Readonly<{ displayName: string; rulesVersion: string }>;

/** The label for one record in the attempts list. */
export function describeRulesVersion(
  rulesVersion: string,
  selected: string,
  encounters: readonly KnownEncounter[],
): string {
  if (rulesVersion === selected) return "This selection";
  for (const encounter of encounters) {
    if (rulesVersion === encounter.rulesVersion)
      return `${encounter.displayName}, full fight`;
    if (!rulesVersion.startsWith(encounter.rulesVersion)) continue;
    const match = DRILL_SUFFIX.exec(rulesVersion.slice(encounter.rulesVersion.length));
    if (!match) continue;
    const phases = match[1].split("-").map((index) => Number(index) + 1);
    const noun = phases.length > 1 ? "phases" : "phase";
    return `${encounter.displayName}, ${noun} ${phases.join(", ")}${match[2] ? " once" : " on loop"}`;
  }
  return "Other rules";
}

export type ResultComparison =
  | Readonly<{ kind: "first" }>
  | Readonly<{ kind: "best" }>
  | Readonly<{ kind: "short"; seconds: number }>;

/** Compares a finished attempt to history that already includes it. */
export function compareResult(
  elapsedSeconds: number,
  records: readonly AttemptRecord[],
  rulesVersion: string,
): ResultComparison {
  const compatible = records.filter((record) => record.rulesVersion === rulesVersion);
  const best = retainedBestSeconds(records, rulesVersion);
  if (best === null || compatible.length <= 1) return { kind: "first" };
  if (elapsedSeconds >= best) return { kind: "best" };
  return { kind: "short", seconds: best - elapsedSeconds };
}

/** Oldest first, at most the last 20 for this identity. Records are stored newest first. */
export function sparklineSeconds(
  records: readonly AttemptRecord[],
  rulesVersion: string,
): readonly number[] {
  return records
    .filter((record) => record.rulesVersion === rulesVersion)
    .slice(0, SPARKLINE_ATTEMPTS)
    .map((record) => record.elapsedSeconds)
    .reverse();
}

/** Polyline points for an SVG of the given size; null below two values. */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
): string | null {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
```

Test cases for `describeRulesVersion`, with base `killer-bee-queen-nest-paladin-v12`:

| Input | Expected |
| --- | --- |
| same as selected | `This selection` |
| base, not selected | `Killer Bee Queen, full fight` |
| base + `-drill-p2` | `Killer Bee Queen, phase 3 on loop` |
| base + `-drill-p2-4-once` | `Killer Bee Queen, phases 3, 5 once` |
| `crystal-worm-child-head-paladin-v1` | `Other rules` |

### 3.6 Apply the fix in `History`

Change `History` to take the identity:

```tsx
function History({ snapshot, rulesVersion }: { snapshot: HistorySnapshot; rulesVersion: string }) {
  const best = retainedBestSeconds(snapshot.records, rulesVersion);
```

Build `KNOWN_ENCOUNTERS` once at module scope from `ENCOUNTER_LIST` and `encounterConfigOf(entry.id).rulesVersion`, and use `describeRulesVersion` for the row's last span, keeping `title={record.rulesVersion}`. The small line becomes `Best for this selection. Keeps your latest {historyLimit} attempts.`

- On Home pass `selectedRulesVersion(encounterConfigOf(selectedEncounterId), drill)`.
- In results pass `selectedRulesVersion(config, view.drill)`, since `view.drill` is what actually ran.

Remove the now-unused `RULES_VERSION` import from `App.tsx` if nothing else uses it.

### 3.7 Update tests pinned to the bug

`App.test.tsx` renders the default Queen encounter but saves records with `RULES_VERSION`, which is the Worm's identity, so these tests encoded the bug. Add this as the first line of each test below:

```ts
window.history.pushState({}, "", "?encounter=crystal-worm");
```

`afterEach` already resets the URL. Apply it to every test that asserts `Retained personal best` has a non-"None" value:

- The test around line 813 and 831 (persists 12.25 s, including across remount).
- `"personal best excludes incompatible rules while recent attempts identify them"`.
- The `test.each(["corrupt", "blocked", "quota"])` storage test.

Then add one new test: with records for the Queen's `encounterConfigOf("killer-bee-queen").rulesVersion` in storage and the default URL, `Retained personal best` shows that record's time. This is the regression test for defect 1. The Playwright history tests use `seededUrl()`, which already sets `encounter=crystal-worm`, so they need no change.

### Phase 3 checks

- All new unit tests, then `npm run verify`.
- In dev: complete a Queen attempt. Personal best is no longer "None".

---

## Phase 4: Split `App.tsx`

Goal: move code only. **No behaviour, class name or DOM change.** This keeps later diffs readable. `App.tsx` is 958 lines.

Create these under `app/src/ui/`, moving each function verbatim and exporting it. All keep using `App.module.css` for now, imported as `styles` from `"../App.module.css"`.

| New file | Moved from `App.tsx` |
| --- | --- |
| `DebugPanel.tsx` | `DebugPanel` |
| `ControlsDialog.tsx` | `ControlsDialog` |
| `History.tsx` | `History`, `KNOWN_ENCOUNTERS` |
| `EncounterScreen.tsx` | `Encounter`, renamed `EncounterScreen`; also `readSeedFromLocation` |
| `Changelog.tsx` | The whole changelog `<section>` |
| `Footer.tsx` | The `<footer>`, with `deployedCommit`, `REPOSITORY_URL`, `SHORT_SHA_LENGTH` |

`App` keeps state, `readEncounterIdFromLocation`, the header and Home markup. `vi.mock("./game/phaser/encounter", ...)` in `App.test.tsx` resolves by module, so it still applies to the moved import.

Check: `npm run verify` passes with zero test edits. If a test needs editing, you changed behaviour; undo it.

---

## Phase 5: Live HUD

Goal: the rail, the phase ladder, and in-play feedback.

### 5.1 Constraints that must hold

These come from existing tests and code. Read them before writing JSX.

| Constraint | Reason |
| --- | --- |
| Keep names: `aria-label="Session HUD"`, `Survival time` with `aria-live="off"`, `role="status" aria-label="Session status"` with the same four values, `Primary stats` containing `42 VIT` style text, `Paused overlay` containing "Paused" | Used across the specs |
| The player meter stays `<meter aria-label="Health">` with `value` set to HP | Tests read its `value` attribute |
| **Name the boss meter "Boss progress", never anything containing "health"** | `getByRole("meter", { name: "Health" })` matches substrings and would hit two elements |
| The text `647 / 775 HP` stays one element's text | `getByText("647 / 775 HP")` |
| Button names Phases, Resume, Retry, Home, Controls stay, with Resume disabled unless paused. Do not add a second Resume, Retry or Home anywhere | Tests use `exact: true` strict locators. The HUD's `.actions` stay mounted during results with `visibility: hidden` and `inert`, as now |
| The rail stays inside `<main>` | `encounter.ts` checks `host.closest("main")?.contains(document.activeElement)` |
| **The Encounter region's size must never change during a session**, including countdown, hits, conditions, debug badge and results, at every width | Tests compare `boundingBox()` before and after, and a resize would disturb the fight |
| Mute checkbox and Debug button stay available in session | Tests use both during live play |
| Do not touch `onKeyDown`, focus or pause logic in the scene | Out of scope |

To keep the size stable below 1100 px, every band row has a fixed height, and text in the phase strip and conditions slot uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. Put the debug badge in the conditions slot rather than a new row.

### 5.2 Structure

In `App.tsx`, render the `<header>` only when `!launched`. Build the Debug button and Mute label once as a `sessionTools` fragment. Pass it to `EncounterScreen` so the same refs and handlers apply. On Home they render in the header.

`EncounterScreen` returns:

```tsx
<div className={styles.sessionGrid}>
  <SessionRail ... />
  <div className={styles.liveLayout}>
    <div className={styles.playfield}>...</div>
    {phaseOpen && <PhaseSelector mode="live" ... />}
  </div>
</div>
```

```css
.sessionGrid {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
}
@media (min-width: 1100px) {
  .sessionGrid {
    grid-template-columns: var(--rail-width) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }
  .rail {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    padding: 16px;
    overflow-y: auto;
    border-right: 1px solid var(--seam);
    background: var(--comb);
  }
  .railConditions { flex: 1; min-height: 44px; overflow-y: auto; }
}
```

The `.liveLayout` has `flex: 1`; change it so it fills its grid cell (`min-height: 0; position: relative; display: flex`). The live phase panel stays absolutely positioned over the right 320 px of it. Set `.debugPanel` to `max-height: 100svh` and remove the `110px` calculation, and the same for `.panel` in `PhaseSelector.module.css`.

The rail has to fit 720 px height at 1280 wide without scrolling: use 24 px phase rows and a 58 px current row. Scrolling is only a fallback.

### 5.3 `app/src/ui/SessionRail.tsx`

Top to bottom:

1. `<h1>` display name in `var(--display)`, 40 px, accent colour, wrapping allowed.
2. Status (`role="status"`) and boss progress, when `view.bossHealthFraction !== null`:
   ```tsx
   <meter aria-label="Boss progress" min={0} max={1} value={view.bossHealthFraction} />
   <span>{Math.ceil(view.bossHealthFraction * 100)}%</span>
   ```
3. `<PhaseLadder>`, when `view.phaseCount > 1`.
4. Health: the existing `<span className={styles.health}>` with meter and text, with the damage trail below.
5. Time and hits: `<output aria-label="Survival time" aria-live="off">` and `{view.hitsTaken} hits`, large.
6. `Primary stats`, small and in Smoke.
7. `<ConditionList>` and the debug badge.
8. Zoom readout: `Zoom {view.zoom.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}x` with `O` and `P` in `<kbd>`.
9. `.actions` buttons, then `sessionTools`.

**Damage trail:** a track with two layers, so hits are readable at a glance.

```tsx
<span className={styles.hpTrack}>
  <span className={styles.hpTrail} style={{ width: `${hpPercent}%` }} aria-hidden="true" />
  <meter aria-label="Health" min={0} max={PALADIN_STATS.healthHp} value={view.healthHp} />
</span>
```

```css
.hpTrack { position: relative; display: block; height: 12px; background: var(--hp-empty); }
.hpTrail { position: absolute; inset: 0 auto 0 0; background: var(--wax); transition: width 450ms 150ms ease-out; }
.hpTrack meter { position: absolute; inset: 0; width: 100%; background: transparent; }
.hpTrack meter::-webkit-meter-bar { background: transparent; }
```

### 5.4 `app/src/ui/PhaseLadder.tsx`

Add `app/src/ui/phaseLadderModel.ts` with tests:

```ts
export type LadderRowState = "done" | "current" | "upcoming" | "excluded";

export function ladderRowState(
  index: number,
  currentIndex: number,
  drill: DrillSelection | null,
): LadderRowState {
  if (index === currentIndex) return "current";
  if (drill && !drill.phaseIndices.includes(index)) return "excluded";
  if (drill?.loop) return "upcoming"; // A looping drill has no "finished" phase.
  return index < currentIndex ? "done" : "upcoming";
}

/** "Phase 3 - Pond Barrage" to its number and name. */
export function splitPhaseLabel(label: string): Readonly<{ number: string; name: string | null }> {
  const match = /^Phase (\d+)(?: - (.+))?$/.exec(label);
  return match ? { number: match[1], name: match[2] ?? null } : { number: "", name: label };
}

export const subPhaseWords = (id: string) =>
  id.split("-").map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ");
```

Markup: an `<ol aria-label="Fight progress">`, with `aria-current="step"` on the current `<li>`. Phases come from the `phases` array `EncounterScreen` already builds; add `telegraphColor: phase.telegraphColor` to it.

| Row state | Appearance |
| --- | --- |
| `done` | Smoke text, small filled tick drawn in CSS |
| `current` | Comb raised background, 3 px left border in `var(--telegraph-<colour>)`, Wax text, 600 weight, and a progress bar below |
| `upcoming` | Smoke text |
| `excluded` | Smoke text at 45% opacity with `text-decoration: line-through` |

Inside the current row:

- A 4 px bar with `width: ${view.phaseProgress * 100}%`, in `var(--accent)`, with no transition, so it reads as data.
- A note: `Ends at {Math.round(view.phaseEndsAtFraction * 100)}%` when non-null, or `Timed, {view.phaseTimedSeconds} s` when timed.
- A sub-phase note when `view.subPhaseId` is set: an 8 px square swatch plus `subPhaseWords(id)`. Swatch colour comes from `SUB_PHASE_SWATCHES`, a small record in `PhaseLadder.tsx` of `{ red: "var(--telegraph-red)", yellow: "var(--telegraph-amber)", blue: "var(--telegraph-cyan)" }`. Other ids get no swatch.
- A loop marker `Looping` when `view.drill?.loop`.

Below 1100 px, render the same `<ol>` as a flex row of equal 6 px segments with visually hidden row text (`clip-path`, not `display: none`), plus one line with the current label. Fixed total height.

### 5.5 `app/src/ui/ConditionList.tsx`

Props: `conditions: readonly VisibleCondition[]`.

Render a `<ul aria-label="Active conditions">`, or an empty reserved slot when there are none. Each row: `CONDITION_LABELS[key]`, `remainingSeconds.toFixed(1)` and, in the rail only, a short hint. Inert ones are in Smoke with `(inert)`.

Add `CONDITION_HINTS` in this file: `paralyzed: "Can't move"`, `slowed: "Base speed only"`, `confused: "Directions swapped"`. For other keys, show no hint rather than inventing behaviour, and do not paraphrase beyond what `CONDITION_DESCRIPTIONS` says. Check that file before writing each hint.

The canvas chips stay as they are, since that is where the player's eyes are.

### 5.6 Playfield feedback

All of these are children of `.playfield`, with `pointer-events: none`, `aria-hidden` unless noted, and must not change layout.

**Phase banner.** When `view.phaseIndex` changes and the attempt is running, show the phase label for 2 seconds at the top edge. Skip it during the opening countdown. Use a `useEffect` on `view.phaseIndex`, with state cleared by `setTimeout`, and clear the timer on cleanup. Name the constant `PHASE_BANNER_SECONDS = 2`, commented as presentation only, matching the 2 s phase telegraph authored in `enemies.json`. Style: a 40 px strip with a Comb background at 85% opacity and a 3 px bottom border in the phase's telegraph colour. Reduced motion: no slide.

**Hit flash.** No state is needed. `key` restarts the animation:

```tsx
{view.status === "running" && view.hitsTaken > 0 && (
  <div key={view.hitsTaken} className={styles.hitFlash} aria-hidden="true" />
)}
```

```css
.hitFlash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 48px 4px var(--warning);
  animation: hitFlash 220ms ease-out forwards;
}
@keyframes hitFlash { from { opacity: 0.55; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .hitFlash { display: none; } }
```

The glow is an inset shadow, so it stays at the screen edge and never covers the centre of play.

**Danger edge.** When `view.healthHp / PALADIN_STATS.healthHp < DANGER_HEALTH_FRACTION` during `running`, render a static `.danger` div with `box-shadow: inset 0 0 72px 8px` of `var(--ember)` at 45% opacity. `DANGER_HEALTH_FRACTION = 0.25` is a named constant in `EncounterScreen.tsx`, commented as presentation only.

**Countdown.** Keep the number; add below it the phase label and `WASD` in a `<kbd>` with `to move`. The block stays `aria-hidden`.

**Paused overlay.** Keep `aria-label="Paused overlay"`. Add the current phase label and `Press Esc to resume`. It contains no buttons. Dim the arena behind it with `background: color-mix(in srgb, var(--night) 55%, transparent)`.

### 5.7 Playwright edits for the rail

Only these. Make them at the same time as the rail.

**a.** `tests/app.spec.ts`, in `renders readable nonblank arena`, replace:

```ts
expect(state.viewport.width).toBe(viewport.width);
```

with:

```ts
const arenaBox = await page
  .getByRole("region", { name: "Encounter", exact: true })
  .boundingBox();
expect(state.viewport.width).toBe(arenaBox!.width);
```

**b.** Same test, replace the `boxes` block, which queries `header`:

```ts
const boxes = await page.evaluate(() => {
  const hud = document
    .querySelector('[aria-label="Session HUD"]')!
    .getBoundingClientRect();
  const arena = document
    .querySelector('[aria-label="Encounter"]')!
    .getBoundingClientRect();
  return {
    overlaps:
      hud.left < arena.right &&
      arena.left < hud.right &&
      hud.top < arena.bottom &&
      arena.top < hud.bottom,
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
});
expect(boxes.overlaps).toBe(false);
expect(boxes.overflow).toBe(false);
```

**c.** In the live Phases panel test, replace:

```ts
expect(layout.arenaWidth).toBe(viewportWidth);
expect(layout.canvasWidth).toBe(viewportWidth);
```

with:

```ts
expect(layout.canvasWidth).toBe(layout.arenaWidth);
expect(layout.arenaRight).toBe(viewportWidth);
```

Leave its other assertions alone.

### Phase 5 checks

- Unit tests for `phaseLadderModel`, then `npm run verify`.
- Add App tests with `runningView` overrides: a boss fraction renders the `Boss progress` meter, null renders none, a condition renders in `Active conditions`.
- `npm run test:e2e -- --grep "renders readable nonblank arena"`.
- `npm run test:e2e -- --grep "live enemy debug sliders"`.
- Run the tests with `boundingBox` checks and the Phases panel: find titles with `grep -nE "^\s*test\(" tests/app.spec.ts` and the line numbers near `originalBox` and `beforeLayout`.
- Screenshot at 1440 x 900, 1280 x 720 and 390 x 844: Queen full fight, drill of phases 3 and 5, Worm, paused, countdown.

---

## Phase 6: Home

Goal: the static version of the hero, the dossier, and the rest of the page.

### 6.1 Inline phase selector

In `ui/PhaseSelector.tsx`:

- Make `onClose` optional, and render the Close button only in `mode === "live"`.
- Add optional `onPreviewPhase?: (index: number | null) => void`. On each phase `<label>`: `onMouseEnter={() => onPreviewPhase?.(phase.index)}`, `onFocus={() => onPreviewPhase?.(phase.index)}`. On the options fieldset: `onMouseLeave={() => onPreviewPhase?.(null)}`.
- Keep `<aside id="phase-selector" aria-label="Phase selection">`, the legend, and the label text exactly. **Do not split or add text inside labels**, because tests find checkboxes by the full name `Phase 3 - Pond Barrage`. A decorative swatch is fine if it is an empty `aria-hidden` span.
- Home mode gets a `.inline` class: no border-left, no width limit, no max-height. Row hover and focus-within use Comb raised.

In `App.tsx`, remove the Home `phaseOpen` state, `phaseButton`, and the Home Phases button. Render `<PhaseSelector mode="home" phases={phases} drill={drill} onChange={setDrill} onPreviewPhase={setPreviewPhase} />` inside the hero. Add `const [previewPhase, setPreviewPhase] = useState<number | null>(null)`.

The phase shown in the hero and dossier is:

```ts
const shownPhaseIndex = previewPhase ?? drill?.phaseIndices[0] ?? 0;
```

### 6.2 Test edits for the inline selector

**The rule:** a click on the `Phases` button **before** `Start` is removed, and one **after** `Start` stays.

`src/App.test.tsx`:

| Line | Edit |
| --- | --- |
| 334, 350, 366, 374, 386, 391, 399 | Remove the Home Phases click |
| 366-378 "changing the encounter resets..." | Remove the assertion that the panel is gone. Keep the assertion that `Full fight` is checked. Rename to "changing the encounter resets the selection to Full fight" |
| 382-395 "the phase panel and the debug panel are mutually exclusive asides" | Rewrite: on Home with the Worm selected, opening Debug shows `Enemy debug tools` and `Phase selection` stays visible. Their exclusivity now applies only live and is still covered by the live tests below it |
| 396-409 "returning Home clears..." | After `Home`, replace the "not in document" line with `expect(screen.getByRole("radio", { name: "Full fight" })).toBeChecked()`. Rename to "returning Home clears the selection" |
| 415, 431, 446 | Live helper and heading: no change |
| 526, 581 | After Start: no change, but read the context first |
| 546 | After `Home`: remove this click, and replace the "complementary not in the document" assertion just above it with the Full fight check |

`tests/app.spec.ts`:

| Line | Edit |
| --- | --- |
| 1654 | Remove the click, since the panel is already visible |
| 2478-2484 | Remove the `phasesButton` variable, its two `aria-expanded` assertions and its click |
| 2609 | After Retry, live: no change |
| 2618 | After `Home`: remove the click |

If `getByLabelText("Phase selection")` in `App.test.tsx` fails because the legend and `aside` both match, keep the existing markup unchanged, since it already passes today, and look for what you added.

### 6.3 `app/src/ui/ArenaPlate.tsx`

SVG for the selected encounter's arena, from `config.arena`. Use a `viewBox` of `-E -E 2E 2E` with `E = arenaExtentTiles(shape) * 1.04`.

- Floor: `<circle>` or `<path d={octagonBoundaryPath(shape)}>`, fill `palette.arena.ground`, stroke `palette.arena.boundary`, `vectorEffect="non-scaling-stroke"`.
- Hazards from `hazardOutlinesOf(config.arena.hazards)`: a diamond is a `<polygon>` with fill `palette.arena.honey` and stroke `palette.arena.honeyRim`; an annulus is a `<circle>` with `fill="none"`, stroke honey, `strokeWidth={outer - inner}`, at the midline radius, plus two thin rim circles.
- `aria-hidden="true"`. Do not use a `<canvas>`.

Hazards are centred on the arena's own centre. Both authored arenas sit at (0, 0), so no offset is needed, but apply `transform="translate(cx cy)"` from `shape.centerTiles` so it stays correct.

Tile-to-screen is not `pixelsPerTile`-dependent here, since the viewBox is in tiles.

### 6.4 `app/src/ui/ProjectileSprite.tsx`

Three branches, in this order:

```tsx
export function ProjectileSprite({ projectile, sizePixels = 36 }: Props) {
  const { appearance } = projectile;
  if (appearance?.bomb) {
    return (
      <svg viewBox="-1 -1 2 2" width={sizePixels} height={sizePixels} aria-hidden="true">
        <circle r="0.8" fill={appearance.bomb.bodyColor} stroke={palette.arena.bombKeyline} strokeWidth="0.08" />
      </svg>
    );
  }
  if (appearance && appearance.nativeWidthPixels > 0) {
    return (
      <svg
        viewBox={`0 0 ${appearance.nativeWidthPixels} ${appearance.nativeHeightPixels}`}
        width={sizePixels}
        height={sizePixels}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {appearanceRects(appearance).map((rect) => (
          <rect key={`${rect.x}-${rect.y}`} x={rect.x} y={rect.y} width={rect.width} height={1} fill={rect.colour} />
        ))}
      </svg>
    );
  }
  // No pixel art (the Crystal Worm shard): its polygon body in the gold fallback.
  const extent = Math.max(...projectile.verticesTiles.flatMap((v) => [Math.abs(v.x), Math.abs(v.y)]));
  const points = projectile.verticesTiles.map((v) => `${v.x},${v.y}`).join(" ");
  return (
    <svg viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`} width={sizePixels} height={sizePixels} aria-hidden="true">
      <polygon points={points} fill={palette.entity.shard} />
    </svg>
  );
}
```

### 6.5 `app/src/ui/PhaseDossier.tsx`

Props: `config`, `phaseIndex`, `label`. Render `phaseDossier(config, phaseIndex)` under the hero. Use `<h3>` for the phase label, so that it is not an `h2` with overflow risk.

- A row of `ProjectileSprite`s, with a `title` of the projectile id.
- `Damage {min} to {max} HP`, or `Damage {min} HP` when equal; `Armor piercing` when true.
- Conditions: `CONDITION_LABELS[key]` with seconds.
- Motion words, capitalised: `Linear`, `Boomerang`, `Turning`, `Wavy`, `Bomb`.
- Sub-phases via `subPhaseWords`.
- Minions, `{count} x {words of archetypeId}`.

Everything comes from config. Do not write descriptive claims about a phase by hand.

### 6.6 Page structure

Replace the Home markup in `App.tsx`:

```tsx
<div className={styles.home}>
  <section className={styles.hero} aria-label="Encounter selection">
    <div className={styles.heroControls}>
      <fieldset className={styles.encounterChoice} aria-label="Encounter">...radios...</fieldset>
      <h1 className={styles.bossName}>{selectedEncounter.displayName}</h1>
      <p>A fixed Paladin, one arena, and another attempt whenever you are ready.</p>
      <PhaseSelector mode="home" ... />
      <button ref={startButton} className={styles.primary} ...>Start</button>
    </div>
    <div className={styles.heroStage}>
      <ArenaPlate arena={config.arena} />
      {/* Phase 7 mounts PhasePreview here */}
      <PhaseDossier ... />
    </div>
  </section>
  <section className={styles.record} aria-labelledby="record-title">...</section>
  <section className={styles.preset} aria-labelledby="preset-title">...</section>
  <Changelog />
  <Footer />
  {homeControlsOpen && <ControlsDialog ... />}
</div>
```

Notes:

- The header keeps `Dodge Hell Training` as a `<span>`, plus Controls, Mute and Debug. Drop the stray `Survival` label. Move the `Controls` button to the header, keeping `onClick={() => setHomeControlsOpen(true)}`, and there must be exactly one on Home.
- Remove `.specimen` and `.crystal`.
- `.bossName`: `font: 700 clamp(44px, 6vw, 88px)/1 var(--display); color: var(--accent); margin: 0; overflow-wrap: anywhere;`. A spec fails if an `h1` has `scrollWidth > clientWidth` at 390 px, so check that width.
- Encounter radios: visually large plates. Keep real `<input type="radio">` inside `<label>` and the accessible names unchanged. Hide the dot with `appearance: none`, and show selection through a 2 px accent border and Comb raised background via `label:has(input:checked)`, with `label:has(input:focus-visible)` showing the focus ring.
- `.hero` is a grid: `grid-template-columns: minmax(340px, 420px) minmax(0, 1fr); min-height: calc(100svh - <header height>)`. Below 900 px it is one column, stage first with `aspect-ratio: 1; max-height: 60svh`.
- Keep `Desktop keyboard required` as it is.
- The `Debug` panel stays a side aside in `.debugLayout`.

### 6.7 Record, Paladin, Changelog

**Practice record.** `<h2 id="record-title">Practice record</h2>`, then `<History>`. Inside `History`, add an inline sparkline above the list, from `sparklineSeconds` and `sparklinePoints`, in an `<svg role="img" aria-label="Survival time over your last N attempts on this selection">` with a `<polyline>` in `var(--accent)` and `fill="none"`. Render nothing below two attempts. If the `dataviz` skill is available in your environment, load it first. Visible text changes from `Retained personal best` to `Personal best`, keeping `aria-label="Retained personal best"` on the `<strong>` unchanged.

Keep `<li aria-label="Completed attempt: ...">`, `<ol aria-label="Recent attempts">`, the `<details open>` and `<summary>`, and the exact formats `N.NN s`, `N hits`, `No completed attempts`, and the warning `role="status"`.

**Paladin.** Keep the `h2` with id `preset-title`. Show `HP`, `VIT`, `SPD`, `DEF`, then derived values from `PALADIN_DERIVED_STATS`: `{speedTilesPerSecond.toFixed(1)} tiles/s` and `{regenerationHpPerSecond.toFixed(1)} HP/s regeneration`. Equipment from a local const: Archon Sword, Vengeance Armor, Seal of the Divine, Ring of Paramount Health, which matches the keys of `PALADIN_EQUIPMENT_BONUSES`.

**Changelog.** Turn the entries in `Changelog.tsx` into a typed array: `{ date: "2026-11-05", label: "5 Nov 2026", items: ReactNode[] }`. Keep the `h2` text `Changelog`. Show the latest entry open, and put older ones in `<details><summary>Earlier changes</summary>...`. Add a new first entry with the implementation date and these items:

- "New dark interface, with a live phase preview on the home screen and the fight's progress beside the arena."
- "Personal best now follows the encounter and phases you selected. The Killer Bee Queen's best was not being shown before."
- "Honey is darker, so attacks stand out against it."

**Footer.** Keep every link name and `href`, the `<footer>` element, `Deployed build` and `Local build`, since specs look these up.

### Phase 6 checks

- `npm run verify`.
- `npm run test:e2e -- --grep "renders readable nonblank arena"` and the production assets test: find its title with `grep -n "production assets" tests/app.spec.ts` and run it with `--grep "repeated practice"`. That test records network requests, and fonts are new requests.
- Both specs check that no `h1, h2, button, a` overflows at 390 px.
- Run the tests you edited in 6.2.
- Screenshots at 1440 x 900 and 390 x 844 for both encounters, with reduced motion.
- Keyboard: Tab through Home. Start has focus on load. Every control shows a focus ring.

---

## Phase 7: Live phase preview

The riskiest piece, and removable: the plate from Phase 6 is the fallback. **Do this after everything else in the UI works.** If the renderer extraction breaks pixel tests and you cannot find why within a reasonable effort, stop and report; the app is still complete without this phase.

### 7.1 Extract the renderer

Create `app/src/game/phaser/presentation.ts`, moving the `presentation` const and `pixelsPerTile` there, exported. Create `app/src/game/phaser/arena-renderer.ts`.

Move **only these** from `EncounterScene` into the class, as methods with their bodies unchanged except for `this.state` becoming `this.getState()`:

| Moves to `ArenaRenderer` | Stays in `EncounterScene` |
| --- | --- |
| Fields `ground`, `bodies`, `projectiles`, `appearanceTextures`, `shardImagePools`, `shardImageUse`, `bombExplosions`, `bombsDetonated`, `bombExplosionFramesDrawn`, `fallbackShardDraws` | `healthBar`, `conditionChips`, `conditionChipTexts`, `hitNumbers`, `finalHitAmounts`, `hitAudio`, input and session fields |
| `drawCircleGround`, `drawOctagonGround`, `drawGround`, `drawHoneycomb`, `drawHazards` | `addHitNumber`, `clearHitNumbers`, `drawConditionChips` |
| `drawShardImage`, `addBombExplosion`, `drawBombExplosions`, `projectileAppearances` | `onKeyDown` and all other input, focus and session methods |
| The first part of `drawEntities`: bodies, shards, bombs, pool cleanup, `drawBombExplosions` | The second part of `drawEntities`: health bar, chips, hit numbers |

```ts
export class ArenaRenderer {
  private readonly scene: Phaser.Scene;
  private readonly getState: () => SimulationState;
  private ground: Phaser.GameObjects.Graphics;
  private bodies: Phaser.GameObjects.Graphics;
  private projectiles: Phaser.GameObjects.Graphics;
  // ...moved fields

  // tsconfig sets erasableSyntaxOnly, so constructor parameter properties
  // such as `private readonly scene` do not compile. Assign fields by hand.
  constructor(scene: Phaser.Scene, getState: () => SimulationState) {
    this.scene = scene;
    this.getState = getState;
    this.ground = scene.add.graphics().setDepth(0);
    this.bodies = scene.add.graphics().setDepth(1);
    this.projectiles = scene.add.graphics().setDepth(2);
    this.appearanceTextures = createAppearanceTextures(
      scene,
      projectileAppearances(getState().config),
    );
  }

  drawGround(): void { /* moved */ }
  /** Draws bodies, projectiles and explosions. Zoom only scales line widths. */
  drawWorld(zoom: number): void { /* moved */ }
  addBombExplosion(event: DetonationEvent): void { /* moved */ }
  advanceExplosions(activeSeconds: number): void { /* the filter from update() */ }
  clearExplosions(): void { this.bombExplosions = []; }
  resetCounters(): void { this.bombsDetonated = 0; this.bombExplosionFramesDrawn = 0; }
  get counters() { return { /* the inspect() fields */ }; }
  destroy(): void { /* pool images, destroyAppearanceTextures */ }
}
```

Changes in `EncounterScene`:

- Add the field `private arenaRenderer!: ArenaRenderer;`. Do not call it `renderer`, because `Phaser.Scene` already has a member with that name.
- `create()`: `this.arenaRenderer = new ArenaRenderer(this, () => this.state);`. Keep the `healthBar` and `conditionChips` creation with depth 3, and call `this.arenaRenderer.drawGround()`.
- `drawEntities()`: `this.arenaRenderer.drawWorld(this.zoom);` then the health bar, chips and hit number code.
- `update()`: explosion filtering becomes `this.arenaRenderer.advanceExplosions(activeSeconds)`; the following lines call `addBombExplosion` and `clearExplosions`.
- `resetAttemptCleanup()`, `dispose()` and `inspect()` go through `arenaRenderer`. **Every field name that `inspect()` returns stays the same.**

`this.state` is a getter that follows retries, which is why the renderer takes a `getState` function.

Before going on: `npm run verify`, plus `npm run test:e2e -- --grep "renders readable nonblank arena"`, and a bomb test (`grep -n "bombsDetonated\|bombExplosionFramesDrawn" tests/app.spec.ts`, then its title). Pixel output must be identical. Take the same seeded screenshot before and after, and compare.

### 7.2 `app/src/game/phaser/phase-preview.ts`

```ts
import Phaser from "phaser";
import { DEFAULT_DEBUG_SETTINGS } from "../config/debug";
import type { EncounterConfig } from "../config/encounter";
import {
  advanceSimulation,
  createSimulation,
  setDebugSettings,
  type SimulationState,
} from "../simulation/simulation";
import { ArenaRenderer } from "./arena-renderer";
import { arenaExtentTiles } from "./arena-plate";
import { pixelsPerTile, presentation } from "./presentation";

/** A fixed seed, so a preview looks the same each visit. Never saved. */
const PREVIEW_SEED = 1;
const IDLE_INPUT = { north: false, south: false, east: false, west: false };
const PREVIEW_MARGIN = 1.04;

export type PhasePreviewHandle = {
  setPhase(phaseIndex: number): void;
  destroy(): void;
};

function createPreviewState(config: EncounterConfig, phaseIndex: number): SimulationState {
  const state = createSimulation(config, PREVIEW_SEED, {
    drill: { phaseIndices: [phaseIndex], loop: true },
  });
  // God mode so the standing Paladin never ends the loop (H04).
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
  return state;
}

class PhasePreviewScene extends Phaser.Scene {
  private readonly encounterConfig: EncounterConfig;
  private phaseIndex: number;
  private previewState: SimulationState;
  private arenaRenderer?: ArenaRenderer;

  constructor(encounterConfig: EncounterConfig, phaseIndex: number) {
    super("PhasePreview");
    this.encounterConfig = encounterConfig;
    this.phaseIndex = phaseIndex;
    this.previewState = createPreviewState(encounterConfig, phaseIndex);
  }

  create(): void {
    this.arenaRenderer = new ArenaRenderer(this, () => this.previewState);
    this.arenaRenderer.drawGround();
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
  }

  setPhase(phaseIndex: number): void {
    if (phaseIndex === this.phaseIndex) return;
    this.phaseIndex = phaseIndex;
    this.previewState = createPreviewState(this.encounterConfig, phaseIndex);
    this.arenaRenderer?.clearExplosions();
  }

  update(_time: number, delta: number): void {
    if (!this.arenaRenderer) return;
    if (this.previewState.phase !== "playing")
      this.previewState = createPreviewState(this.encounterConfig, this.phaseIndex);
    const before = this.previewState.elapsedSeconds;
    const { detonations } = advanceSimulation(
      this.previewState,
      delta / presentation.millisecondsPerSecond,
      IDLE_INPUT,
    );
    this.arenaRenderer.advanceExplosions(this.previewState.elapsedSeconds - before);
    for (const event of detonations) this.arenaRenderer.addBombExplosion(event);
    this.arenaRenderer.drawWorld(this.cameras.main.zoom);
  }

  private fitCamera(): void {
    const { shape } = this.encounterConfig.arena;
    const sizePixels = arenaExtentTiles(shape) * 2 * pixelsPerTile * PREVIEW_MARGIN;
    this.cameras.main
      .setZoom(Math.min(this.scale.width, this.scale.height) / sizePixels)
      .centerOn(shape.centerTiles.x * pixelsPerTile, shape.centerTiles.y * pixelsPerTile);
  }
}

export function createPhasePreview(
  host: HTMLElement,
  config: EncounterConfig,
  phaseIndex: number,
): PhasePreviewHandle {
  let disposed = false;
  let game: Phaser.Game | undefined;
  let scene: PhasePreviewScene | undefined;
  // Same microtask guard as createEncounter, for StrictMode's double effect.
  queueMicrotask(() => {
    if (disposed) return;
    scene = new PhasePreviewScene(config, phaseIndex);
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: presentation.background,
      autoFocus: false,
      render: { antialias: true, roundPixels: false, preserveDrawingBuffer: true },
      scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth, height: host.clientHeight },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      audio: { noAudio: true },
      scene,
      banner: false,
    });
  });
  return {
    setPhase: (index) => scene?.setPhase(index),
    destroy: () => {
      if (disposed) return;
      disposed = true;
      game?.destroy(true);
      game?.canvas?.remove();
    },
  };
}
```

Check while implementing:

- The renderer's constructor runs at `create()`, so `getState()` already returns the scene's state.
- `setPhase` can arrive before `create()`, when `arenaRenderer` is still undefined. The `?.` handles that.
- Worm: `setDebugSettings` swaps `state.config` to a debug-tuned copy. This is the same path `God mode` uses in play, and nothing is saved.
- Do not import `ENCOUNTER_CONFIG` here. Use the given config.
- `tsconfig.app.json` sets `erasableSyntaxOnly`, `verbatimModuleSyntax` and `noUnusedParameters`. Assign fields by hand, use `import type` for types, and prefix unused parameters with `_`.

The e2e below covers this module. Do not import it in jsdom tests. `App.test.tsx` mocks `encounter.ts` rather than loading Phaser there, so assume Phaser cannot load under jsdom.

### 7.3 `app/src/ui/PhasePreview.tsx`

Always use a dynamic import so jsdom tests and the reduced-motion path never load this module.

```tsx
const PREVIEW_DEBOUNCE_MILLISECONDS = 120;

function motionAllowed(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function PhasePreview({ config, phaseIndex }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<PhasePreviewHandle | null>(null);
  const latestPhase = useRef(phaseIndex);
  latestPhase.current = phaseIndex;

  useEffect(() => {
    if (!motionAllowed()) return;
    let cancelled = false;
    void import("../game/phaser/phase-preview").then(({ createPhasePreview }) => {
      if (cancelled || !host.current) return;
      handle.current = createPhasePreview(host.current, config, latestPhase.current);
    });
    return () => {
      cancelled = true;
      handle.current?.destroy();
      handle.current = null;
    };
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => handle.current?.setPhase(phaseIndex),
      PREVIEW_DEBOUNCE_MILLISECONDS,
    );
    return () => window.clearTimeout(timer);
  }, [phaseIndex]);

  return <div ref={host} className={styles.previewHost} data-phase-preview aria-hidden="true" />;
}
```

`import type { PhasePreviewHandle }` is erased at build, so it stays safe in jsdom.

`.previewHost` is `position: absolute; inset: 0`, stacked over `ArenaPlate` in `.heroStage`. Mount `PhasePreview` only in Home, so launching unmounts it and destroys the game before the encounter starts. Under the stage add a small Smoke caption: `Live preview. The Paladin stands still here.` Render it only when `motionAllowed()`.

`encounterConfigOf` returns a stable object per id, so `[config]` only re-runs when the encounter changes.

### 7.4 End-to-end test

Add to `tests/app.spec.ts`. The config sets `reducedMotion: "reduce"` globally, so every existing Home `canvas` count stays at 0.

```ts
test.describe("live phase preview", () => {
  test.use({ reducedMotion: "no-preference" });

  test("draws on Home, follows the phase, and is gone after Start", async ({ page }) => {
    await page.goto(`./?seed=${NORTH_SEED}&encounter=killer-bee-queen`);
    const preview = page.locator("[data-phase-preview] canvas");
    await expect(preview).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeFocused();
    await page.getByRole("checkbox", { name: "Phase 3 - Pond Barrage" }).check();
    await expect
      .poll(async () =>
        preview.evaluate((canvas) => {
          const copy = document.createElement("canvas");
          copy.width = (canvas as HTMLCanvasElement).width;
          copy.height = (canvas as HTMLCanvasElement).height;
          const context = copy.getContext("2d")!;
          context.drawImage(canvas as HTMLCanvasElement, 0, 0);
          const { data } = context.getImageData(0, 0, copy.width, copy.height);
          const colours = new Set<number>();
          for (let offset = 0; offset < data.length; offset += 40)
            colours.add((data[offset]! << 16) | (data[offset + 1]! << 8) | data[offset + 2]!);
          return colours.size;
        }),
      )
      .toBeGreaterThan(3);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("[data-phase-preview]")).toHaveCount(0);
  });
});
```

### Phase 7 checks

- `npm run verify`.
- `npm run test:e2e -- --grep "live phase preview"`.
- `npm run test:e2e -- --grep "renders readable nonblank arena"`.
- In dev: hover phases and watch the preview change. Select a phase and press Start. Press `Home` and the preview returns. Switch encounters and the room changes.
- With Chrome's performance panel, or by watching frame time, check phase 8 stays smooth. If it does not, report it. The fallback is to mount the preview only for hovered or selected phases that perform, or to drop it; do not lower simulation fidelity.
- Confirm `localStorage` attempts do not change after a minute on Home.

---

## Phase 8: Results and Controls

### 8.1 Results

Move the results `<section>` to `app/src/ui/ResultsPanel.tsx`. **Constraints from tests:**

- `aria-labelledby="result-title"`. Heading text stays `Attempt complete` or `Boss defeated`. It takes focus on results.
- **It must be the only heading inside the section**, because `results.getByRole("heading")` is strict.
- `results.locator("dd").nth(0)` is the time and `.nth(1)` is hits.
- `within(results).getByText("12.25 s")` and `getByText("7")` must match exactly one element. **Do not repeat the time as separate text anywhere in the panel, and do not render any other element whose whole text is a bare number.**
- The first `button` in the section is Retry (`querySelector("button")`), so Retry precedes Home.
- `Final hit amounts` group and `-N` spans stay.
- `History` stays inside, with `.results .history` scrolling as now. The results panel is `max-height: calc(100% - 24px); overflow: auto`, as now.

Layout, top to bottom:

1. `displayName` line in Smoke.
2. Heading in `var(--display)`, 44 px, accent colour.
3. Debug badge if applicable.
4. `dl`: Survival time, with its `dd` at 40 px weight 600; Hits taken; then new rows `Reached`, with `view.phaseLabel`, and `Boss progress`, with `Math.ceil(fraction * 100)` plus `% left`, only when `view.bossHealthFraction !== null`. For a Worm result neither row shows.
5. Comparison line below the `dl`, from `compareResult`:
   - `first`: `First attempt on this selection`
   - `best`: `New best`, in the accent colour
   - `short`: `{seconds.toFixed(2)} s short of your best`
   - Hidden for a debug result (`result.rulesVersion === DEBUG_RULES_VERSION`).
6. Final hit amounts.
7. Actions, then `History`.

Background is Comb at 96% opacity, with a 1 px Seam border and a 3 px top border in `var(--accent-deep)`. No large shadow, because there is no surface behind it to lift from.

Note: `onResult` saves history after the ended view publishes, so the comparison can render once with old records and then update in the same tick. That is expected. A `compareResult` result of `first` from an empty snapshot is replaced immediately.

### 8.2 Controls dialog

Split the `<dl>` into two groups, with Keys first. Inside the dialog, keep `aria-labelledby="controls-title"`, the Tab trap and the single Close button, because the trap focuses `querySelector("button")`.

Exact text that `getByText(..., { exact: true })` requires, each as the whole text of one element: `WASD`, `R`, `O / P`, `Escape`, `Mute`, `Resume`, every `CONDITION_LABELS[key]` for active conditions, and `${label} (inert)` for inert ones.

```tsx
<h3>Keys</h3>
<dl>
  <dt><kbd>WASD</kbd></dt><dd>Move</dd>
  <dt><kbd>R</kbd></dt><dd>Immediate retry</dd>
  <dt><kbd>O / P</kbd></dt><dd>Zoom out / in</dd>
  <dt><kbd>Escape</kbd></dt><dd>Pause / resume, or close Controls</dd>
  ...the other rows unchanged, with plain text for Mute and Resume
</dl>
<h3>Status effects</h3>
<dl>...active conditions, then inert ones...</dl>
```

Keep `O / P` as **one** `<kbd>`; splitting it breaks the test. Style `kbd`: `font: inherit; font-weight: 600; padding: 1px 7px; border: 1px solid var(--seam); border-bottom-width: 2px; border-radius: 3px; background: var(--comb-raised);`.

Dialog: Comb background, Seam border, `::backdrop` at Night with 70% opacity.

### 8.3 Debug panel

Restyle only: the tokens already apply. Give `<output>` tabular figures, and check it is readable. No behaviour or label change.

### Phase 8 checks

- Add App tests: `New best` for a second, better attempt; `0.75 s short of your best` for a worse one; no comparison for debug; `Reached` shows `view.phaseLabel` when a boss fraction exists and is hidden for null.
- `npm run verify`.
- Run the results tests: `grep -n "Attempt complete" tests/app.spec.ts` gives lines inside the relevant tests.

---

## Final acceptance

1. `npm run verify` passes.
2. Screenshots for both encounters at 1440 x 900, 1280 x 720 and 390 x 844: Home, countdown, running, paused, results, Controls. Queen phases 2, 5 and 8 at 1440 x 900. Look at them, and fix anything that looks off.
3. Reduced motion in the browser: no preview, no hit flash, plate visible.
4. Contrast: re-check body text pairs from the table above (4.5:1 or better) and sprite pairs if palette values changed.
5. Keyboard only: Home to Start to pause to Phases to Close to Retry to Home.
6. Scenario by hand in `npm run dev`:
   1. Select the Queen. Hover phases. Preview and dossier follow.
   2. Tick phase 3, press Start. The ladder shows phase 3 as current with others excluded.
   3. Die. Results show the phase reached, and a personal best that is not "None".
   4. Reload. The best persists. Select the Worm, and its records still count.
7. `?tagger=1` still works.
8. Run only the Playwright tests named by each phase. CI runs the full suite on push. Because this work moves so much UI, **ask the user to authorise one full `npm run test:e2e` acceptance run** before reporting the work as finished.
9. Report what you ran, what you did not run, every test you edited, and any stopping point. Do not commit or push unless asked.

## What not to do

- Do not add sprite halos, boss art, or a player sprite.
- Do not add a `<canvas>` to Home outside `PhasePreview`.
- Do not add a second button named Resume, Retry, Home, Controls or Phases to a screen where one exists.
- Do not put text inside phase checkbox labels beyond the existing label.
- Do not use the word "health" in the boss meter's accessible name.
- Do not save preview runs to history.
- Do not update React per frame or per projectile. The HUD publishes at 10 Hz through the existing `publishView`.
- Do not use monospace, all caps, or eyebrow labels.
- Do not weaken a test to make it pass, other than the edits this plan lists.

## Execution record

Implemented in one pass (phases 65-72) on 2026-11-06. Deviations: the `ArenaRenderer` extraction (7.1) and the `App.tsx` split (Phase 4) were done together with the phases that use them; `palette.ts` writes out `TelegraphColorName` so the Playwright project can import it; four extra condition hints (Armor Broken, Exposed, Cursed, Sick) restate their authored descriptions; the header-based layout assertions in two Playwright tests were replaced with HUD/arena overlap checks; the mute test re-queries the checkbox because the session rail owns its own. Checks: `npm run verify` passed; full `npm run test:e2e` gave 47 passed, 1 failed. The failure, "held R restarts once...", expects an enemy object without `headingRadians`, a field added in commit fe1fecc; no simulation file was touched, so it predates this work. Not done: screenshots, manual contrast re-check and performance check of phase 8 preview.
