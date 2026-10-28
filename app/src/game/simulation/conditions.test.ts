import { expect, test } from "vitest";
import { ENCOUNTER_CONFIG } from "../config/encounter";
import { PALADIN_STATS } from "../config/stats";
import { createSimulation, advanceSimulation } from "./simulation";
import { createShard } from "./projectiles";
import {
  ACTIVE_CONDITIONS,
  applyConditions,
  createConditionSeconds,
  effectiveInput,
  hasCondition,
  SLOWED_SPEED_TILES_PER_SECOND,
  tickConditions,
  visibleConditions,
} from "./conditions";
import {
  convexBodyFitsCircle,
  transformBodyVertices,
} from "./geometry";

const idle = { north: false, south: false, east: false, west: false } as const;
const stepSeconds = 1 / 60;

test("a fresh player initialises every condition to zero", () => {
  const player = createSimulation(ENCOUNTER_CONFIG, 123).player;
  expect(player.conditionSeconds).toEqual({
    paralyzed: 0,
    slowed: 0,
    confused: 0,
    armorBroken: 0,
    exposed: 0,
    cursed: 0,
    sick: 0,
    dazed: 0,
    silenced: 0,
    quiet: 0,
    weak: 0,
    unstable: 0,
    petStasis: 0,
  });
});

test("applyConditions refreshes to the longest remaining duration without stacking", () => {
  const player = createSimulation(ENCOUNTER_CONFIG, 123).player;

  applyConditions(player, [{ key: "paralyzed", seconds: 1.4 }]);
  expect(player.conditionSeconds.paralyzed).toBe(1.4);
  applyConditions(player, [{ key: "paralyzed", seconds: 0.8 }]);
  expect(player.conditionSeconds.paralyzed).toBe(1.4);
  applyConditions(player, [{ key: "paralyzed", seconds: 3 }]);
  expect(player.conditionSeconds.paralyzed).toBe(3);
});

test("tickConditions decrements once and clamps at the exact expiry boundary", () => {
  const player = createSimulation(ENCOUNTER_CONFIG, 123).player;
  player.conditionSeconds.slowed = 0.05;

  tickConditions(player, 0.02);
  expect(player.conditionSeconds.slowed).toBeCloseTo(0.03, 12);
  tickConditions(player, 0.03);
  expect(player.conditionSeconds.slowed).toBe(0);
  tickConditions(player, 1);
  expect(player.conditionSeconds.slowed).toBe(0);
});

test("hasCondition is true only while positive seconds remain", () => {
  const player = createSimulation(ENCOUNTER_CONFIG, 123).player;

  expect(hasCondition(player, "cursed")).toBe(false);
  player.conditionSeconds.cursed = 0.001;
  expect(hasCondition(player, "cursed")).toBe(true);
  player.conditionSeconds.cursed = 0;
  expect(hasCondition(player, "cursed")).toBe(false);
});

test("a paralyzed player stays in place and moves again on the expiry step", () => {
  const state = createSimulation(ENCOUNTER_CONFIG, 123);
  state.player.conditionSeconds.paralyzed = 2 * stepSeconds;

  advanceSimulation(state, stepSeconds, { ...idle, east: true });
  expect(state.player.positionTiles).toEqual({ x: 0, y: 0 });
  advanceSimulation(state, stepSeconds, { ...idle, east: true });
  expect(state.player.positionTiles.x).toBeGreaterThan(0);
});

test("Paralyzed blocks every direction and diagonal", () => {
  const inputs = [
    { ...idle, north: true },
    { ...idle, south: true },
    { ...idle, east: true },
    { ...idle, west: true },
    { ...idle, north: true, east: true },
    { ...idle, north: true, west: true },
    { ...idle, south: true, east: true },
    { ...idle, south: true, west: true },
  ];
  for (const input of inputs) {
    const state = createSimulation(ENCOUNTER_CONFIG, 123);
    state.player.conditionSeconds.paralyzed = 1;
    advanceSimulation(state, stepSeconds, input);
    expect(state.player.positionTiles).toEqual({ x: 0, y: 0 });
  }
});

test("Slowed derives a 4 tiles/second speed below the Paladin's normal speed", () => {
  expect(SLOWED_SPEED_TILES_PER_SECOND).toBe(4);
  expect(SLOWED_SPEED_TILES_PER_SECOND).toBeLessThan(7.0613);
});

test("a slowed player travels exactly 4 tiles/second", () => {
  const state = createSimulation(ENCOUNTER_CONFIG, 123);
  state.player.conditionSeconds.slowed = 1;

  advanceSimulation(state, stepSeconds, { ...idle, east: true });
  expect(state.player.positionTiles.x).toBeCloseTo(4 * stepSeconds, 12);
});

test("Paralyzed takes priority over Slowed", () => {
  const state = createSimulation(ENCOUNTER_CONFIG, 123);
  state.player.conditionSeconds.paralyzed = 1;
  state.player.conditionSeconds.slowed = 1;

  advanceSimulation(state, stepSeconds, { ...idle, east: true });
  expect(state.player.positionTiles).toEqual({ x: 0, y: 0 });
});

test("Confused maps each direction and diagonal correctly and is self-inverse", () => {
  const player = createSimulation(ENCOUNTER_CONFIG, 123).player;
  player.conditionSeconds.confused = 1;
  const cases = [
    [{ ...idle, west: true }, { ...idle, south: true }],
    [{ ...idle, south: true }, { ...idle, west: true }],
    [{ ...idle, east: true }, { ...idle, north: true }],
    [{ ...idle, north: true }, { ...idle, east: true }],
    [
      { ...idle, north: true, west: true },
      { ...idle, east: true, south: true },
    ],
  ] as const;

  for (const [input, expected] of cases) {
    expect(effectiveInput(player, input)).toEqual(expected);
    expect(effectiveInput(player, effectiveInput(player, input))).toEqual(input);
  }
});

test("a confused diagonal keeps the published mapping and normal speed", () => {
  const state = createSimulation(ENCOUNTER_CONFIG, 123);
  state.player.conditionSeconds.confused = 1;

  advanceSimulation(state, stepSeconds, { ...idle, north: true, west: true });
  const expectedAxis = 7.061333333333333 * stepSeconds / Math.sqrt(2);
  expect(state.player.positionTiles.x).toBeCloseTo(expectedAxis, 10);
  expect(state.player.positionTiles.y).toBeCloseTo(expectedAxis, 10);
  expect(Math.hypot(
    state.player.positionTiles.x,
    state.player.positionTiles.y,
  )).toBeCloseTo(7.061333333333333 * stepSeconds, 10);
});

test("arena containment holds for every movement-condition combination", () => {
  for (const paralyzed of [false, true]) {
    for (const slowed of [false, true]) {
      for (const confused of [false, true]) {
        const state = createSimulation(ENCOUNTER_CONFIG, 123);
        Object.assign(state.player.conditionSeconds, {
          paralyzed: paralyzed ? 10 : 0,
          slowed: slowed ? 10 : 0,
          confused: confused ? 10 : 0,
        });
        state.player.positionTiles = { x: 18, y: 0 };
        for (let tick = 0; tick < 120; tick++) {
          advanceSimulation(state, stepSeconds, {
            ...idle,
            east: true,
            south: true,
          });
          expect(
            convexBodyFitsCircle(
              transformBodyVertices(
                state.config.player.verticesTiles,
                state.player.positionTiles,
              ),
              state.config.arena,
            ),
          ).toBe(true);
        }
      }
    }
  }
});

test("an accepted hit applies full duration without same-step decay, then ticks once next step", () => {
  const projectileId = "crystal-worm-child-shard";
  const projectile = ENCOUNTER_CONFIG.projectiles[projectileId];
  const config = {
    ...ENCOUNTER_CONFIG,
    projectiles: {
      ...ENCOUNTER_CONFIG.projectiles,
      [projectileId]: {
        ...projectile,
        conditions: [{ key: "paralyzed", seconds: 1.4 }],
      },
    },
  } as const;
  const state = createSimulation(config, 123);
  state.shards.push(
    createShard(config.projectiles[projectileId], 999, { x: 0, y: 0 }, 0),
  );

  const hit = advanceSimulation(state, stepSeconds, idle);
  expect(hit.acceptedHits).toHaveLength(1);
  expect(state.player.conditionSeconds.paralyzed).toBe(1.4);

  state.shards = [];
  advanceSimulation(state, stepSeconds, idle);
  expect(state.player.conditionSeconds.paralyzed).toBeCloseTo(
    1.4 - stepSeconds,
    12,
  );
});

test("an armor-piercing projectile ignores defense end-to-end", () => {
  const projectileId = "crystal-worm-child-shard";
  const projectile = ENCOUNTER_CONFIG.projectiles[projectileId];
  const config = {
    ...ENCOUNTER_CONFIG,
    projectiles: {
      ...ENCOUNTER_CONFIG.projectiles,
      [projectileId]: { ...projectile, damageHp: 100, armorPiercing: true },
    },
  } as const;
  const state = createSimulation(config, 123);
  state.shards.push(
    createShard(config.projectiles[projectileId], 999, { x: 0, y: 0 }, 0),
  );

  const hit = advanceSimulation(state, stepSeconds, idle);
  expect(hit.acceptedHits[0]!.damageHp).toBe(100);
});

test("an active Curse multiplies a subsequent hit's damage end-to-end", () => {
  const projectileId = "crystal-worm-child-shard";
  const projectile = ENCOUNTER_CONFIG.projectiles[projectileId];
  const config = {
    ...ENCOUNTER_CONFIG,
    projectiles: {
      ...ENCOUNTER_CONFIG.projectiles,
      [projectileId]: { ...projectile, damageHp: 100 },
    },
  } as const;
  const state = createSimulation(config, 123);
  state.player.conditionSeconds.cursed = 10;
  state.shards.push(
    createShard(config.projectiles[projectileId], 999, { x: 0, y: 0 }, 0),
  );

  const hit = advanceSimulation(state, stepSeconds, idle);
  expect(hit.acceptedHits[0]!.damageHp).toBe(85);
});

test("a 0-damage condition-only projectile still registers a hit and applies its condition", () => {
  const projectileId = "crystal-worm-child-shard";
  const projectile = ENCOUNTER_CONFIG.projectiles[projectileId];
  const config = {
    ...ENCOUNTER_CONFIG,
    projectiles: {
      ...ENCOUNTER_CONFIG.projectiles,
      [projectileId]: {
        ...projectile,
        damageHp: 0,
        conditions: [{ key: "armorBroken", seconds: 7 }],
      },
    },
  } as const;
  const state = createSimulation(config, 123);
  state.shards.push(
    createShard(config.projectiles[projectileId], 999, { x: 0, y: 0 }, 0),
  );

  const hit = advanceSimulation(state, stepSeconds, idle);
  expect(hit.acceptedHits).toHaveLength(1);
  expect(hit.acceptedHits[0]!.damageHp).toBe(0);
  expect(state.player.conditionSeconds.armorBroken).toBe(7);
  expect(state.player.healthHp).toBe(PALADIN_STATS.healthHp);
});

test("visibleConditions is empty for a fresh player", () => {
  const player = {
    positionTiles: { x: 0, y: 0 },
    healthHp: 1,
    combatRemainingSeconds: 0,
    conditionSeconds: createConditionSeconds(),
  };
  expect(visibleConditions(player)).toEqual([]);
});

test("visibleConditions orders active before inert, matching declaration order, and omits expired ones", () => {
  const player = {
    positionTiles: { x: 0, y: 0 },
    healthHp: 1,
    combatRemainingSeconds: 0,
    conditionSeconds: createConditionSeconds(),
  };
  player.conditionSeconds.sick = 2.34;
  player.conditionSeconds.paralyzed = 1.0;
  player.conditionSeconds.dazed = 5.0;
  player.conditionSeconds.confused = 0;

  expect(visibleConditions(player)).toEqual([
    { key: "paralyzed", remainingSeconds: 1.0, inert: false },
    { key: "sick", remainingSeconds: 2.34, inert: false },
    { key: "dazed", remainingSeconds: 5.0, inert: true },
  ]);
  expect(ACTIVE_CONDITIONS.includes("paralyzed")).toBe(true);
});
