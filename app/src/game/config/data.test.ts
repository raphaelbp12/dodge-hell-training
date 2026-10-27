import { expect, test } from "vitest";
import {
  AUTHORED_ARCHETYPES,
  AUTHORED_ARENA,
  AUTHORED_PROJECTILES,
  AUTHORED_SHAPES,
  turningDeviationTiles,
  validateArchetypes,
  validateOutline,
  validateArena,
  validateProjectile,
  validateProjectiles,
  wavyDeviationTiles,
  loadOutline,
} from "./data";

const TEST_STEP_SECONDS = 1 / 60;

const VALID_PROJECTILE = {
  source: "docs/mechanics.md approved v3 tuning",
  damageHp: 160,
  speedTilesPerSecond: 8,
  armorPiercing: false,
  conditions: [],
  body: { shape: "shard-hexagon", widthTiles: 1.45, heightTiles: 0.65 },
  expiration: "lifetime-only",
  hitPolicy: "once-per-shard",
  motion: { kind: "boomerang", reversalAgeSeconds: 1.5, lifetimeSeconds: 3 },
};

test("authored arena matches the approved circular arena in tiles", () => {
  expect(AUTHORED_ARENA).toEqual({
    centerTiles: { x: 0, y: 0 },
    radiusTiles: 19.2,
  });
});

test("authored outlines are normalized to a 1x1 tile box", () => {
  expect(Object.keys(AUTHORED_SHAPES).sort()).toEqual([
    "beveled-octagon",
    "shard-hexagon",
  ]);
  for (const outline of Object.values(AUTHORED_SHAPES)) {
    const span = (axis: "x" | "y") =>
      Math.max(...outline.map((v) => v[axis])) -
      Math.min(...outline.map((v) => v[axis]));
    expect(span("x")).toBe(1);
    expect(span("y")).toBe(1);
  }
});

test("loadOutline resolves a named outline and rejects an unknown name", () => {
  expect(loadOutline("beveled-octagon")).toHaveLength(8);
  expect(loadOutline("shard-hexagon")).toHaveLength(6);
  expect(() => loadOutline("no-such-shape")).toThrow(RangeError);
});

test("validateArena rejects malformed authored arenas", () => {
  expect(() => validateArena({ centerTiles: { x: 0, y: 0 }, radiusTiles: 1 }))
    .not.toThrow();
  for (const bad of [
    undefined,
    null,
    42,
    {},
    { centerTiles: { x: 0, y: 0 } },
    { radiusTiles: 1 },
    { centerTiles: { x: 0 }, radiusTiles: 1 },
    { centerTiles: { x: 0, y: 0 }, radiusTiles: 0 },
    { centerTiles: { x: 0, y: 0 }, radiusTiles: -1 },
    { centerTiles: { x: 0, y: 0 }, radiusTiles: Number.NaN },
    { centerTiles: { x: Number.POSITIVE_INFINITY, y: 0 }, radiusTiles: 1 },
    { centerTiles: { x: "0", y: 0 }, radiusTiles: 1 },
  ]) {
    expect(() => validateArena(bad), `arena ${JSON.stringify(bad)}`).toThrow(
      RangeError,
    );
  }
});

test("validateOutline enforces the 3-to-8 vertex 1x1 contract", () => {
  const unit = [
    { x: -0.5, y: -0.5 },
    { x: 0.5, y: -0.5 },
    { x: 0.5, y: 0.5 },
    { x: -0.5, y: 0.5 },
  ];
  expect(() => validateOutline(unit, "unit")).not.toThrow();
  for (const bad of [
    undefined,
    {},
    [],
    unit.slice(0, 2),
    [...unit, ...unit, { x: 0, y: 0 }],
    unit.map((v) => ({ x: v.x * 2, y: v.y })),
    unit.map((v) => ({ x: v.x, y: v.y * 3 })),
    unit.map((v) => ({ x: v.x, y: Number.NaN })),
    [{ x: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }],
  ]) {
    expect(() => validateOutline(bad, "bad"), JSON.stringify(bad)).toThrow(
      RangeError,
    );
  }
});

test("authored data names the offending path when it rejects", () => {
  expect(() => validateArena({ centerTiles: { x: 0, y: 0 }, radiusTiles: 0 }))
    .toThrow(/radiusTiles/);
  expect(() => loadOutline("missing")).toThrow(/missing/);
});

test("the projectile catalog contains the shipped crystal worm shard", () => {
  expect(AUTHORED_PROJECTILES["crystal-worm-child-shard"]).toBeDefined();
  expect(
    AUTHORED_ARCHETYPES["crystal-worm-child-head"].weapon.projectile,
  ).toBe("crystal-worm-child-shard");
});

test("validateProjectile accepts a valid boomerang entry", () => {
  expect(() =>
    validateProjectile(VALID_PROJECTILE, "shard", TEST_STEP_SECONDS),
  ).not.toThrow();
});

test.each([
  ["missing motion kind", { ...VALID_PROJECTILE, motion: { ...VALID_PROJECTILE.motion, kind: "nonsense" } }],
  ["nonpositive reversalAgeSeconds", { ...VALID_PROJECTILE, motion: { ...VALID_PROJECTILE.motion, reversalAgeSeconds: 0 } }],
  ["nonpositive lifetimeSeconds", { ...VALID_PROJECTILE, motion: { ...VALID_PROJECTILE.motion, lifetimeSeconds: 0 } }],
  ["reversal at or beyond lifetime", { ...VALID_PROJECTILE, motion: { ...VALID_PROJECTILE.motion, reversalAgeSeconds: 3, lifetimeSeconds: 3 } }],
  ["negative damageHp", { ...VALID_PROJECTILE, damageHp: -1 }],
  ["nonpositive speedTilesPerSecond", { ...VALID_PROJECTILE, speedTilesPerSecond: 0 }],
  ["non-boolean armorPiercing", { ...VALID_PROJECTILE, armorPiercing: "no" }],
  ["non-array conditions", { ...VALID_PROJECTILE, conditions: {} }],
  ["missing body", { ...VALID_PROJECTILE, body: undefined }],
  ["empty expiration", { ...VALID_PROJECTILE, expiration: "" }],
  ["empty hitPolicy", { ...VALID_PROJECTILE, hitPolicy: "" }],
  ["missing source", { ...VALID_PROJECTILE, source: "" }],
] as const)("validateProjectile rejects %s", (_name, bad) => {
  expect(() => validateProjectile(bad, "shard", TEST_STEP_SECONDS)).toThrow(
    RangeError,
  );
});

test("validateProjectiles rejects an empty catalog", () => {
  expect(() =>
    validateProjectiles({ projectiles: {} }, TEST_STEP_SECONDS),
  ).toThrow(RangeError);
});

const VALID_LINEAR_PROJECTILE = {
  ...VALID_PROJECTILE,
  motion: { kind: "linear", rangeTiles: 9.5 },
};

test("validateProjectile accepts a valid linear entry", () => {
  expect(() =>
    validateProjectile(VALID_LINEAR_PROJECTILE, "linear-shard", TEST_STEP_SECONDS),
  ).not.toThrow();
});

test.each([
  ["nonpositive rangeTiles", { ...VALID_LINEAR_PROJECTILE, motion: { kind: "linear", rangeTiles: 0 } }],
  ["missing rangeTiles", { ...VALID_LINEAR_PROJECTILE, motion: { kind: "linear" } }],
  ["authored lifetimeSeconds on linear", { ...VALID_LINEAR_PROJECTILE, motion: { kind: "linear", rangeTiles: 9.5, lifetimeSeconds: 3 } }],
  ["authored reversalAgeSeconds on linear", { ...VALID_LINEAR_PROJECTILE, motion: { kind: "linear", rangeTiles: 9.5, reversalAgeSeconds: 1.5 } }],
  ["unknown motion kind", { ...VALID_PROJECTILE, motion: { kind: "spiral" } }],
] as const)("validateProjectile rejects %s", (_name, bad) => {
  expect(() =>
    validateProjectile(bad, "linear-shard", TEST_STEP_SECONDS),
  ).toThrow(RangeError);
});

const VALID_TURNING_PROJECTILE = {
  ...VALID_PROJECTILE,
  motion: { kind: "turning", rangeTiles: 9.5, turnRateDegreesPerSecond: 70 },
};

const VALID_WAVY_PROJECTILE = {
  ...VALID_PROJECTILE,
  motion: { kind: "wavy", rangeTiles: 9.5, amplitudeTiles: 0.8, frequencyHz: 1 },
};

test("the derived path deviation matches the source's worst-case figures", () => {
  // Source's most extreme authored values: speed 8, turn rate 70 deg/s.
  expect(turningDeviationTiles(8, 70, TEST_STEP_SECONDS)).toBeCloseTo(
    0.00034,
    5,
  );
  // Source's values: amplitude 0.8 tiles, frequency 1 Hz.
  expect(wavyDeviationTiles(0.8, 1, TEST_STEP_SECONDS)).toBeCloseTo(0.0044, 4);
});

test("validateProjectile accepts the source's most extreme authored turning and wavy values", () => {
  expect(() =>
    validateProjectile(VALID_TURNING_PROJECTILE, "turning-shard", TEST_STEP_SECONDS),
  ).not.toThrow();
  expect(() =>
    validateProjectile(VALID_WAVY_PROJECTILE, "wavy-shard", TEST_STEP_SECONDS),
  ).not.toThrow();
});

test.each([
  ["nonzero sign flip still valid", -70],
])("validateProjectile accepts a signed turnRateDegreesPerSecond of %s", (_label, turnRateDegreesPerSecond) => {
  expect(() =>
    validateProjectile(
      { ...VALID_TURNING_PROJECTILE, motion: { ...VALID_TURNING_PROJECTILE.motion, turnRateDegreesPerSecond } },
      "turning-shard",
      TEST_STEP_SECONDS,
    ),
  ).not.toThrow();
});

test.each([
  ["zero turnRateDegreesPerSecond", { ...VALID_TURNING_PROJECTILE, motion: { ...VALID_TURNING_PROJECTILE.motion, turnRateDegreesPerSecond: 0 } }],
  ["nonfinite turnRateDegreesPerSecond", { ...VALID_TURNING_PROJECTILE, motion: { ...VALID_TURNING_PROJECTILE.motion, turnRateDegreesPerSecond: Number.NaN } }],
  ["a turn rate exceeding the path-deviation tolerance", { ...VALID_TURNING_PROJECTILE, speedTilesPerSecond: 8, motion: { ...VALID_TURNING_PROJECTILE.motion, turnRateDegreesPerSecond: 7000 } }],
  ["nonpositive amplitudeTiles", { ...VALID_WAVY_PROJECTILE, motion: { ...VALID_WAVY_PROJECTILE.motion, amplitudeTiles: 0 } }],
  ["nonpositive frequencyHz", { ...VALID_WAVY_PROJECTILE, motion: { ...VALID_WAVY_PROJECTILE.motion, frequencyHz: 0 } }],
  ["a wave exceeding the path-deviation tolerance", { ...VALID_WAVY_PROJECTILE, motion: { ...VALID_WAVY_PROJECTILE.motion, amplitudeTiles: 50 } }],
] as const)("validateProjectile rejects %s", (_name, bad) => {
  expect(() =>
    validateProjectile(bad, "curved-shard", TEST_STEP_SECONDS),
  ).toThrow(RangeError);
});

const VALID_LOB_PROJECTILE = {
  ...VALID_PROJECTILE,
  motion: { kind: "lob", travelSeconds: 1.2, detonationRadiusTiles: 2 },
};

test("validateProjectile accepts a valid lob entry", () => {
  expect(() =>
    validateProjectile(VALID_LOB_PROJECTILE, "lob-shard", TEST_STEP_SECONDS),
  ).not.toThrow();
});

test.each([
  ["nonpositive travelSeconds", { ...VALID_LOB_PROJECTILE, motion: { ...VALID_LOB_PROJECTILE.motion, travelSeconds: 0 } }],
  ["missing travelSeconds", { ...VALID_LOB_PROJECTILE, motion: { kind: "lob", detonationRadiusTiles: 2 } }],
  ["nonpositive detonationRadiusTiles", { ...VALID_LOB_PROJECTILE, motion: { ...VALID_LOB_PROJECTILE.motion, detonationRadiusTiles: 0 } }],
  ["authored lifetimeSeconds on lob", { ...VALID_LOB_PROJECTILE, motion: { ...VALID_LOB_PROJECTILE.motion, lifetimeSeconds: 3 } }],
  ["authored reversalAgeSeconds on lob", { ...VALID_LOB_PROJECTILE, motion: { ...VALID_LOB_PROJECTILE.motion, reversalAgeSeconds: 1.5 } }],
  ["authored rangeTiles on lob", { ...VALID_LOB_PROJECTILE, motion: { ...VALID_LOB_PROJECTILE.motion, rangeTiles: 9.5 } }],
] as const)("validateProjectile rejects %s", (_name, bad) => {
  expect(() =>
    validateProjectile(bad, "lob-shard", TEST_STEP_SECONDS),
  ).toThrow(RangeError);
});

test("validateArchetypes rejects a weapon naming a projectile absent from the catalog", () => {
  const catalogIds = new Set(["crystal-worm-child-shard"]);
  expect(() =>
    validateArchetypes(
      {
        archetypes: {
          "crystal-worm-child-head": {
            spawnTiles: { x: 0, y: 0 },
            body: { shape: "beveled-octagon", widthTiles: 1.25, heightTiles: 1.25 },
            speedTilesPerSecond: 1.5,
            contactDamageHp: 0,
            blocksPlayer: false,
            weapon: {
              emitters: {
                count: 6,
                radiusTiles: 0.35,
                initialPhaseDegrees: 0,
                clockwiseDegreesPerSecond: 45,
                rotateDuringCooldown: true,
              },
              burst: {
                shotsPerEmitter: 11,
                shotIntervalSeconds: 0.19,
                cooldownAfterLastShotSeconds: 3,
                initialCooldownSeconds: 2,
              },
              projectile: "no-such-projectile",
            },
          },
        },
      },
      catalogIds,
    ),
  ).toThrow(RangeError);
});
