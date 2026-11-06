import { expect, test } from "vitest";
import { advanceBomb, createBomb, resolveBombDestination, type BombCollisionContext } from "./bombs";
import { ENCOUNTER_CONFIG, ENCOUNTER_CONFIGS, type BombSpec } from "../config/encounter";
import { advanceSimulation, createSimulation } from "./simulation";

const ENCOUNTER_CONFIG_QUEEN = ENCOUNTER_CONFIGS["killer-bee-queen"];

const SQUARE = [
  { x: 0.5, y: 0.5 },
  { x: -0.5, y: 0.5 },
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
];

// Range 10 tiles in 2 s, 1.5-tile detonation radius.
const BOMB: BombSpec = {
  type: "bomb",
  id: "test-bomb",
  damageHp: 100,
  armorPiercing: false,
  conditions: [],
  verticesTiles: SQUARE,
  collisionPartsTiles: [SQUARE],
  appearance: null,
  expiration: "lifetime-only",
  hitPolicy: "once-per-shard",
  rangeTiles: 10,
  travelSeconds: 2,
  detonationRadiusTiles: 1.5,
};

const context: BombCollisionContext = {
  config: {
    ...ENCOUNTER_CONFIG,
    projectiles: { ...ENCOUNTER_CONFIG.projectiles, [BOMB.id]: BOMB },
  },
};
const far = { x: 1000, y: 1000 };

test("a bomb lands at its authored range along the firing direction", () => {
  expect(resolveBombDestination(BOMB, { x: 1, y: 2 }, Math.PI / 2).y).toBeCloseTo(12, 12);
  const bomb = createBomb(BOMB, 7, { x: 0, y: 0 }, 0);
  expect(bomb.detonationTargetTiles).toEqual({ x: 10, y: 0 });
  expect(bomb.id).toBe(7);
});

test("a bomb's velocity is the distance over its travel time, never a stored speed", () => {
  const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0);
  expect(bomb.velocityTilesPerSecond).toEqual({ x: 5, y: 0 });
  expect(bomb.lifetimeSeconds).toBe(2);
});

test("a bomb reaches its destination exactly at travelSeconds", () => {
  const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0);
  const result = advanceBomb(context, bomb, 2, far, far);
  expect(bomb.positionTiles).toEqual({ x: 10, y: 0 });
  expect(bomb.ageSeconds).toBe(2);
  expect(result.detonated).toBe(true);
  expect(result.alive).toBe(false);
});

test("a bomb passing through the player in flight registers no hit", () => {
  const bomb = createBomb(BOMB, 1, { x: 0, y: -5 }, Math.PI / 2);
  const result = advanceBomb(context, bomb, 1, { x: 0, y: 0 }, { x: 0, y: 0 });
  expect(result.hitPlayer).toBe(false);
  expect(result.detonated).toBe(false);
  expect(result.alive).toBe(true);
});

test("a detonation whose circle reaches the player hits once and the bomb expires", () => {
  const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0);
  const player = { x: 11, y: 0 };
  const result = advanceBomb(context, bomb, 2, player, player);
  expect(result.hitPlayer).toBe(true);
  expect(result.detonated).toBe(true);
  expect(result.alive).toBe(false);
});

test("a hit bomb cannot hit again", () => {
  const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0);
  bomb.hasHitPlayer = true;
  const player = { x: 11, y: 0 };
  expect(advanceBomb(context, bomb, 2, player, player).hitPlayer).toBe(false);
});

test("a detonation that misses still reports the explosion", () => {
  const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0);
  const player = { x: 20, y: 0 };
  const result = advanceBomb(context, bomb, 2, player, player);
  expect(result.hitPlayer).toBe(false);
  expect(result.detonated).toBe(true);
});

test("a bomb does not detonate before travelSeconds even beside the player", () => {
  const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0);
  const player = { x: 5, y: 0 };
  const result = advanceBomb(context, bomb, 1, player, player);
  expect(result.hitPlayer).toBe(false);
  expect(result.detonated).toBe(false);
  expect(result.alive).toBe(true);
});

test("a bomb detonates in the same fixed step when its age sums to travelSeconds", () => {
  const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0);
  const player = { x: 10, y: 0 };
  const stepSeconds = 1 / 60;
  let detonations = 0;
  for (let step = 0; step < 130; step++) {
    const result = advanceBomb(context, bomb, stepSeconds, player, player);
    if (result.detonated) detonations++;
    if (!result.alive) break;
  }
  expect(detonations).toBe(1);
  expect(bomb.ageSeconds).toBe(2);
});

test("the Queen's bombs live in state.bombs, never state.shards, and share one id sequence", () => {
  const queen = ENCOUNTER_CONFIG_QUEEN;
  const state = createSimulation(queen, 11);
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const idle = { north: false, south: false, east: false, west: false };
  let sawBomb = false;
  for (let step = 0; step < 600; step++) {
    advanceSimulation(state, queen.simulation.fixedStepSeconds, idle);
    for (const shard of state.shards)
      expect(queen.projectiles[shard.projectileId].type).toBe("bullet");
    for (const bomb of state.bombs) {
      sawBomb = true;
      expect(queen.projectiles[bomb.projectileId].type).toBe("bomb");
    }
    const ids = [...state.shards, ...state.bombs].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  }
  expect(sawBomb).toBe(true);
});

test("a targeted bomb lands exactly on the target at any distance, ignoring its range", () => {
  for (const target of [{ x: 3, y: 4 }, { x: -40, y: 30 }]) {
    const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0.3, target);
    expect(bomb.detonationTargetTiles).toEqual(target);
    expect(bomb.velocityTilesPerSecond).toEqual({
      x: target.x / BOMB.travelSeconds,
      y: target.y / BOMB.travelSeconds,
    });
    expect(bomb.lifetimeSeconds).toBe(BOMB.travelSeconds);
    advanceBomb(context, bomb, BOMB.travelSeconds, far, far);
    expect(bomb.positionTiles.x).toBeCloseTo(target.x, 12);
    expect(bomb.positionTiles.y).toBeCloseTo(target.y, 12);
  }
});

test("a targeted bomb's landing is captured by value, so a moving player cannot move it", () => {
  const player = { x: 6, y: 1 };
  const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0, player);
  player.x = 99;
  expect(bomb.detonationTargetTiles).toEqual({ x: 6, y: 1 });
});

test("a target on the spawn point gives a stationary bomb and no error", () => {
  const bomb = createBomb(BOMB, 1, { x: 2, y: 3 }, 0, { x: 2, y: 3 });
  expect(bomb.velocityTilesPerSecond).toEqual({ x: 0, y: 0 });
  const result = advanceBomb(context, bomb, BOMB.travelSeconds, { x: 2, y: 3 }, { x: 2, y: 3 });
  expect(result.hitPlayer).toBe(true);
  expect(result.detonated).toBe(true);
});

test("a targeted bomb lands on the same point at 30, 60 and 120 Hz", () => {
  const landings = [30, 60, 120].map((hz) => {
    const bomb = createBomb(BOMB, 1, { x: 0, y: 0 }, 0, { x: 7.3, y: -2.9 });
    const stepSeconds = 1 / hz;
    for (let step = 0; step < hz * 2 + 5; step++)
      if (!advanceBomb(context, bomb, stepSeconds, far, far).alive) break;
    return bomb.positionTiles;
  });
  for (const landing of landings) {
    expect(landing.x).toBeCloseTo(7.3, 9);
    expect(landing.y).toBeCloseTo(-2.9, 9);
  }
});

/** Runs the Queen's opening until her targeted white bomb is in flight. */
function fireTargetedWhiteBomb() {
  const queen = ENCOUNTER_CONFIG_QUEEN;
  const state = createSimulation(queen, 5);
  const idle = { north: false, south: false, east: false, west: false };
  for (let step = 0; step < 600; step++) {
    advanceSimulation(state, queen.simulation.fixedStepSeconds, idle);
    const bomb = state.bombs.find((entry) => entry.projectileId === "white-bomb-v1");
    if (bomb) return { state, bombId: bomb.id, queen, idle };
  }
  throw new Error("the targeted white bomb never fired");
}

test("the shipped targeted white bomb lands on a standing player and hits them once", () => {
  const { state, bombId, queen, idle } = fireTargetedWhiteBomb();
  const bomb = state.bombs.find((entry) => entry.id === bombId)!;
  expect(bomb.detonationTargetTiles).toEqual(state.player.positionTiles);
  const hits = [];
  for (let step = 0; step < 60; step++)
    hits.push(...advanceSimulation(state, queen.simulation.fixedStepSeconds, idle).acceptedHits);
  expect(hits.filter((hit) => hit.shardId === bombId)).toHaveLength(1);
});

test("the shipped targeted white bomb can be dodged by moving for its travel time", () => {
  const { state, bombId, queen } = fireTargetedWhiteBomb();
  const east = { north: false, south: false, east: true, west: false };
  const hits = [];
  for (let step = 0; step < 60; step++)
    hits.push(...advanceSimulation(state, queen.simulation.fixedStepSeconds, east).acceptedHits);
  expect(hits.filter((hit) => hit.shardId === bombId)).toHaveLength(0);
});
