import { expect, test } from "vitest";
import {
  advanceShard,
  createShard,
  curvedShardOrientationAtAge,
  curvedShardPositionAtAge,
  interpolatePosition,
  shardOverlapsPlayer,
  type CurvedProjectileMotion,
  type ShardCollisionContext,
} from "./projectiles";
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

// Survivor-driven tests (plan V22 step 94.2). A spawn away from the origin and
// a heading off the axes make every sign and operator in the closed forms matter.
const SPAWN = { x: 2, y: 3 };
const SPAWN_HEADING = Math.PI / 6;

test("a turning shard leaves along its spawn heading and, after half a turn, sits one diameter to its +90 degree side", () => {
  const motion: CurvedProjectileMotion = { kind: "turning", rangeTiles: 16, turnRateDegreesPerSecond: 70 };
  const turnRate = (70 * Math.PI) / 180;
  const diameterTiles = (2 * 8) / turnRate;
  const halfTurnSeconds = Math.PI / turnRate;
  const end = curvedShardPositionAtAge(motion, 8, SPAWN, SPAWN_HEADING, halfTurnSeconds);
  expect(end.x).toBeCloseTo(SPAWN.x - diameterTiles * Math.sin(SPAWN_HEADING), 9);
  expect(end.y).toBeCloseTo(SPAWN.y + diameterTiles * Math.cos(SPAWN_HEADING), 9);
  const dt = 1e-6;
  const early = curvedShardPositionAtAge(motion, 8, SPAWN, SPAWN_HEADING, dt);
  expect((early.x - SPAWN.x) / dt).toBeCloseTo(8 * Math.cos(SPAWN_HEADING), 4);
  expect((early.y - SPAWN.y) / dt).toBeCloseTo(8 * Math.sin(SPAWN_HEADING), 4);
  expect(curvedShardOrientationAtAge(motion, 8, SPAWN_HEADING, halfTurnSeconds)).toBeCloseTo(
    SPAWN_HEADING + Math.PI,
    9,
  );
});

// 2 Hz, so a frequency that divides instead of multiplies shows.
const WAVY_2HZ: CurvedProjectileMotion = { kind: "wavy", rangeTiles: 16, amplitudeTiles: 0.8, frequencyHz: 2 };
const QUARTER_PERIOD_SECONDS = 1 / 8;

test("at a quarter period a wavy shard is speed times age ahead and one amplitude to its left", () => {
  const position = curvedShardPositionAtAge(WAVY_2HZ, 8, SPAWN, SPAWN_HEADING, QUARTER_PERIOD_SECONDS);
  const forwardTiles = 8 * QUARTER_PERIOD_SECONDS;
  expect(position.x).toBeCloseTo(SPAWN.x + forwardTiles * Math.cos(SPAWN_HEADING) - 0.8 * Math.sin(SPAWN_HEADING), 9);
  expect(position.y).toBeCloseTo(SPAWN.y + forwardTiles * Math.sin(SPAWN_HEADING) + 0.8 * Math.cos(SPAWN_HEADING), 9);
});

test("a wavy shard faces along its velocity: tilted left at spawn, along the spawn heading at a quarter period", () => {
  const angularFrequency = 2 * Math.PI * 2;
  const tiltAt = (ageSeconds: number) =>
    Math.atan2(0.8 * angularFrequency * Math.cos(angularFrequency * ageSeconds), 8);
  for (const ageSeconds of [0, QUARTER_PERIOD_SECONDS / 2, QUARTER_PERIOD_SECONDS])
    expect(curvedShardOrientationAtAge(WAVY_2HZ, 8, SPAWN_HEADING, ageSeconds)).toBeCloseTo(
      SPAWN_HEADING + tiltAt(ageSeconds),
      9,
    );
  // At a quarter period the lateral velocity is zero, so the shard faces its spawn heading.
  expect(curvedShardOrientationAtAge(WAVY_2HZ, 8, SPAWN_HEADING, QUARTER_PERIOD_SECONDS)).toBeCloseTo(SPAWN_HEADING, 9);
});

test("interpolatePosition moves the given fraction of the way from start to end", () => {
  expect(interpolatePosition({ x: 2, y: 3 }, { x: 6, y: 11 }, 0.25)).toEqual({ x: 3, y: 5 });
});

test.each([
  ["x", (value: number) => ({ x: value, y: 0 })],
  ["y", (value: number) => ({ x: 0, y: value })],
] as const)(
  "a shard that passes through a moving player along %s hits it, judged by relative motion",
  (_axis, along) => {
    // The player runs from -50 to 50 while the shard runs from -45 to 45, so the
    // shard starts 5 tiles ahead and ends 5 tiles behind: it passes through.
    const shard = createShard(LINEAR_PROJECTILE, 1, along(-45), 0);
    expect(shardOverlapsPlayer(context, along(-45), along(45), along(-50), along(50), shard)).toBe(true);
    // Moving together, never meeting.
    expect(shardOverlapsPlayer(context, along(-45), along(55), along(-50), along(50), shard)).toBe(false);
  },
);

test("a boomerang reversing mid-step still hits a player crossing its path during that step", () => {
  // Reversal at 1.5 s, 12 tiles out. The player crosses the shard's path at
  // x = 12 exactly halfway through a 0.2 s step that spans the reversal.
  const shard = createShard(BOOMERANG_PROJECTILE, 1, { x: 0, y: 0 }, 0);
  advanceShard(context, shard, 1.4, far, far);
  const result = advanceShard(context, shard, 0.2, { x: 12, y: 10 }, { x: 12, y: -10 });
  expect(result.hitPlayer).toBe(true);
  expect(shard.hasReversed).toBe(true);
});
