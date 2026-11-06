import { expect, test } from "vitest";
import { createShard, advanceShard, type ShardCollisionContext } from "./projectiles";
import { ENCOUNTER_CONFIG, type BulletSpec } from "../config/encounter";

const stepSeconds = 1 / 60;

const BOOMERANG_VERTICES = [
  { x: 0.5, y: 0 },
  { x: 0, y: 0.5 },
  { x: -0.5, y: 0 },
  { x: 0, y: -0.5 },
];

const BOOMERANG_PROJECTILE: BulletSpec = {
  type: "bullet",
  id: "test-boomerang",
  damageHp: 160,
  speedTilesPerSecond: 8,
  armorPiercing: false,
  conditions: [],
  verticesTiles: BOOMERANG_VERTICES,
  collisionPartsTiles: [BOOMERANG_VERTICES],
  appearance: null,
  expiration: "lifetime-only",
  hitPolicy: "once-per-shard",
  motion: { kind: "boomerang", reversalAgeSeconds: 1.5, lifetimeSeconds: 3 },
};

// Source row 1: red-stinger-small at speed 8.5, range 9.5 tiles.
const LINEAR_PROJECTILE: BulletSpec = {
  ...BOOMERANG_PROJECTILE,
  id: "test-linear",
  speedTilesPerSecond: 8.5,
  motion: { kind: "linear", rangeTiles: 9.5 },
};

const context: ShardCollisionContext = {
  config: {
    ...ENCOUNTER_CONFIG,
    projectiles: {
      ...ENCOUNTER_CONFIG.projectiles,
      [BOOMERANG_PROJECTILE.id]: BOOMERANG_PROJECTILE,
      [LINEAR_PROJECTILE.id]: LINEAR_PROJECTILE,
    },
  },
  collisionBoundingRadiusTiles: ENCOUNTER_CONFIG.player.verticesTiles.reduce(
    (max, v) => Math.max(max, Math.hypot(v.x, v.y)),
    0,
  ),
};

test("createShard derives a linear shard's lifetime from range over speed, exactly", () => {
  const shard = createShard(LINEAR_PROJECTILE, 1, { x: 0, y: 0 }, 0);
  expect(shard.lifetimeSeconds).toBe(9.5 / 8.5);
  expect(shard.lifetimeSeconds).toBeCloseTo(1.117647, 6);
});

test("a linear shard never reverses", () => {
  const shard = createShard(LINEAR_PROJECTILE, 1, { x: 0, y: 0 }, 0);
  expect(shard.reversalAgeSeconds).toBe(Infinity);
  let current = shard;
  const far = { x: 1000, y: 1000 };
  for (let tick = 0; tick < 200; tick++) {
    const result = advanceShard(context, current, stepSeconds, far, far);
    expect(current.hasReversed).toBe(false);
    if (!result.alive) break;
  }
  expect(current.hasReversed).toBe(false);
});

test("a linear shard expires exactly at its derived lifetime, not a tick early or late", () => {
  const shard = createShard(LINEAR_PROJECTILE, 1, { x: 0, y: 0 }, 0);
  const far = { x: 1000, y: 1000 };
  let ticks = 0;
  let alive = true;
  while (alive) {
    alive = advanceShard(context, shard, stepSeconds, far, far).alive;
    ticks++;
    if (ticks > 1000) throw new Error("shard never expired");
  }
  expect(shard.ageSeconds).toBe(shard.lifetimeSeconds);
});

test("createShard reproduces a boomerang shard's authored lifetime and reversal age unchanged", () => {
  const shard = createShard(BOOMERANG_PROJECTILE, 1, { x: 0, y: 0 }, 0);
  expect(shard.lifetimeSeconds).toBe(3);
  expect(shard.reversalAgeSeconds).toBe(1.5);
  expect(shard.hasReversed).toBe(false);
  expect(shard.damageHp).toBe(160);
  expect(shard.velocityTilesPerSecond).toEqual({ x: 8, y: 0 });
});

// Source's worst-case turn rate (±70 deg/s at 8 tiles/s); range is a modest
// 16 tiles (2s lifetime) so fixed-step accumulation stays well under the
// loader's own boundary tolerance - a 125s lifetime (what a 1000-tile range
// would give) accumulates enough fixed-step floating-point drift at 7500+
// ticks to itself exceed that tolerance, which is a test-authoring pitfall
// rather than anything step 19.4 needs to handle for a trainer-scale range.
const TURNING_PROJECTILE: BulletSpec = {
  ...BOOMERANG_PROJECTILE,
  id: "test-turning",
  speedTilesPerSecond: 8,
  motion: { kind: "turning", rangeTiles: 16, turnRateDegreesPerSecond: 70 },
};

// Source's values: amplitude 0.8 tiles, frequency 1 Hz; range picked the same way.
const WAVY_PROJECTILE: BulletSpec = {
  ...BOOMERANG_PROJECTILE,
  id: "test-wavy",
  speedTilesPerSecond: 8,
  motion: { kind: "wavy", rangeTiles: 16, amplitudeTiles: 0.8, frequencyHz: 1 },
};

const curvedContext: ShardCollisionContext = {
  config: {
    ...ENCOUNTER_CONFIG,
    projectiles: {
      ...ENCOUNTER_CONFIG.projectiles,
      [TURNING_PROJECTILE.id]: TURNING_PROJECTILE,
      [WAVY_PROJECTILE.id]: WAVY_PROJECTILE,
    },
  },
  collisionBoundingRadiusTiles: 0.001,
};

function advanceSteps(
  shard: ReturnType<typeof createShard>,
  totalSeconds: number,
  hz: number,
): void {
  const far = { x: 1000, y: 1000 };
  const step = 1 / hz;
  let remaining = totalSeconds;
  while (remaining > 1e-9) {
    advanceShard(curvedContext, shard, step, far, far);
    remaining -= step;
  }
}

const far = { x: 1000, y: 1000 };

test("a turning shard at 70 deg/s completes a quarter turn in exactly 90/70 seconds", () => {
  // A single call evaluates the closed form directly at this exact age.
  const shard = createShard(TURNING_PROJECTILE, 1, { x: 0, y: 0 }, 0);
  advanceShard(curvedContext, shard, 90 / 70, far, far);
  expect(shard.orientationRadians).toBeCloseTo(Math.PI / 2, 9);
});

test("a turning shard's instantaneous speed stays constant, so its path length over any elapsed time equals speed times that time", () => {
  const dt = 1e-5;
  for (const ageSeconds of [0, 0.3, 0.9, 1.5]) {
    const before = createShard(TURNING_PROJECTILE, 1, { x: 0, y: 0 }, 0);
    if (ageSeconds > 0) advanceShard(curvedContext, before, ageSeconds, far, far);
    const after = createShard(TURNING_PROJECTILE, 1, { x: 0, y: 0 }, 0);
    advanceShard(curvedContext, after, ageSeconds + dt, far, far);
    const instantaneousSpeedTilesPerSecond =
      Math.hypot(
        after.positionTiles.x - before.positionTiles.x,
        after.positionTiles.y - before.positionTiles.y,
      ) / dt;
    expect(instantaneousSpeedTilesPerSecond).toBeCloseTo(8, 2);
  }
});

test.each([30, 60, 120])(
  "a turning shard expires exactly at its derived lifetime at %s Hz",
  (hz) => {
    const shard = createShard(TURNING_PROJECTILE, 1, { x: 0, y: 0 }, 0);
    advanceSteps(shard, shard.lifetimeSeconds, hz);
    expect(shard.ageSeconds).toBe(shard.lifetimeSeconds);
  },
);

test("a wavy shard's lateral offset is zero at age 0 and every whole period, and peaks at a quarter period", () => {
  const shard = createShard(WAVY_PROJECTILE, 1, { x: 0, y: 0 }, 0);
  const lateralOffsetAt = (ageSeconds: number): number => {
    const probe = createShard(WAVY_PROJECTILE, 1, { x: 0, y: 0 }, 0);
    advanceSteps(probe, ageSeconds, 600);
    return probe.positionTiles.y;
  };
  expect(lateralOffsetAt(1e-9)).toBeCloseTo(0, 6);
  expect(lateralOffsetAt(1)).toBeCloseTo(0, 3);
  expect(lateralOffsetAt(2)).toBeCloseTo(0, 3);
  expect(lateralOffsetAt(0.25)).toBeCloseTo(0.8, 3);
  expect(shard.positionTiles.y).toBe(0);
});

test.each([30, 60, 120])(
  "a wavy shard expires exactly at its derived lifetime at %s Hz",
  (hz) => {
    const shard = createShard(WAVY_PROJECTILE, 1, { x: 0, y: 0 }, 0);
    advanceSteps(shard, shard.lifetimeSeconds, hz);
    expect(shard.ageSeconds).toBe(shard.lifetimeSeconds);
  },
);

test("turning and wavy shards agree at shared step boundaries across 30/60/120 Hz", () => {
  const elapsedSeconds = 0.5;
  for (const projectile of [TURNING_PROJECTILE, WAVY_PROJECTILE]) {
    const positions = [30, 60, 120].map((hz) => {
      const shard = createShard(projectile, 1, { x: 0, y: 0 }, 0);
      advanceSteps(shard, elapsedSeconds, hz);
      return shard.positionTiles;
    });
    for (const position of positions.slice(1)) {
      expect(position.x).toBeCloseTo(positions[0].x, 9);
      expect(position.y).toBeCloseTo(positions[0].y, 9);
    }
  }
});
