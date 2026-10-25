import { expect, test } from "vitest";
import { V2_GEOMETRY_CANDIDATE } from "./geometry-candidate";
import {
  DEBUG_PARAMETERS,
  DEFAULT_DEBUG_SETTINGS,
  debugEncounterConfig,
  updateDebugParameter,
  validateDebugSettings,
  SELECTED_DEBUG_VALUES,
  loadSelectedDebugValues,
} from "./debug";
import type { SessionSnapshot } from "../models";
import {
  ENCOUNTER_CONFIG,
  RULES_VERSION,
  validateEncounterConfig,
} from "./encounter";
import {
  PALADIN_BASE_STATS,
  PALADIN_EQUIPMENT_BONUSES,
  PALADIN_STATS,
  PALADIN_DERIVED_STATS,
  calculateEquippedStats,
  calculateDamageHp,
  calculateCombatTriggerHp,
  calculateCombatDurationSeconds,
  derivePlayerStats,
} from "./stats";

test("loads all screenshot-selected values without changing omitted settings or the scored preset", () => {
  expect(SELECTED_DEBUG_VALUES).toEqual({
    enemyWidth: 1.25,
    enemyHeight: 1.25,
    emitterCount: 6,
    emitterRadiusTiles: 0.35,
    initialPhaseDegrees: 0,
    rotationDegreesPerSecond: 45,
    shotsPerEmitter: 11,
    shotIntervalSeconds: 0.19,
    cooldownSeconds: 3,
    initialCooldownSeconds: 2,
    projectileDamageHp: 160,
    projectileSpeedTilesPerSecond: 8,
    reversalSeconds: 1.5,
    lifetimeSeconds: 3,
    projectileWidth: 1.45,
    projectileHeight: 0.65,
  });
  const previous = {
    ...DEFAULT_DEBUG_SETTINGS,
    enemySpeedTilesPerSecond: 2,
    spawnX: 3,
    spawnY: -10,
    godMode: true,
    chaseArenaCenter: true,
  };
  const selected = loadSelectedDebugValues(previous);
  expect(selected).toEqual({
    ...previous,
    ...SELECTED_DEBUG_VALUES,
    matchPlayerToHead: true,
  });
  expect(previous.enemyWidth).toBe(DEFAULT_DEBUG_SETTINGS.enemyWidth);
  expect(() => validateDebugSettings(selected)).not.toThrow();
  expect(debugEncounterConfig(selected).emitters.count).toBe(6);
  expect(ENCOUNTER_CONFIG.emitters.count).toBe(4);
  expect(DEFAULT_DEBUG_SETTINGS.cooldownSeconds).toBe(1);
});

test("the selected preset matches the player body to the head, without resizing normal v2", () => {
  const selected = loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS);
  for (const settings of [
    selected,
    updateDebugParameter(selected, "enemyWidth", 2),
  ]) {
    const config = debugEncounterConfig(settings);
    for (const axis of ["x", "y"] as const) {
      const size = (vertices: readonly { x: number; y: number }[]) =>
        Math.max(...vertices.map((vertex) => vertex[axis])) -
        Math.min(...vertices.map((vertex) => vertex[axis]));
      expect(size(config.player.verticesTiles)).toBeCloseTo(
        size(config.enemy.verticesTiles),
        12,
      );
      expect(size(config.player.verticesTiles)).toBeCloseTo(
        axis === "x" ? settings.enemyWidth : 1.25,
        12,
      );
    }
  }
  expect(
    debugEncounterConfig(DEFAULT_DEBUG_SETTINGS).player.verticesTiles,
  ).toEqual(ENCOUNTER_CONFIG.player.verticesTiles);
});

test.each(DEBUG_PARAMETERS)(
  "debug slider $key has valid bounded endpoints and retains an independent preset",
  (parameter) => {
    for (const value of [parameter.min, parameter.max]) {
      const settings = updateDebugParameter(
        DEFAULT_DEBUG_SETTINGS,
        parameter.key,
        value,
      );
      expect(settings[parameter.key]).toBe(value);
      expect(() => validateDebugSettings(settings)).not.toThrow();
      expect(() => debugEncounterConfig(settings)).not.toThrow();
    }
    expect(() =>
      updateDebugParameter(DEFAULT_DEBUG_SETTINGS, parameter.key, Number.NaN),
    ).toThrow(RangeError);
    expect(() =>
      updateDebugParameter(
        DEFAULT_DEBUG_SETTINGS,
        parameter.key,
        parameter.max + 1,
      ),
    ).toThrow(RangeError);
  },
);

test("debug timing remains ordered while lifetime and reversal sliders cross", () => {
  const longer = updateDebugParameter(
    DEFAULT_DEBUG_SETTINGS,
    "reversalSeconds",
    8,
  );
  expect(longer.lifetimeSeconds).toBeGreaterThan(8);
  const shorter = updateDebugParameter(longer, "lifetimeSeconds", 0.1);
  expect(shorter.reversalSeconds).toBe(0.05);
  expect(ENCOUNTER_CONFIG.shard.lifetimeSeconds).toBe(
    DEFAULT_DEBUG_SETTINGS.lifetimeSeconds,
  );
  expect(() =>
    validateDebugSettings({ ...DEFAULT_DEBUG_SETTINGS, emitterCount: 1.5 }),
  ).toThrow(RangeError);
});

test("keeps published base stats, passive bonuses, and equipped totals separate", () => {
  expect(PALADIN_BASE_STATS).toEqual({
    healthHp: 675,
    defense: 10,
    speed: 41,
    vitality: 42,
  });
  expect(PALADIN_EQUIPMENT_BONUSES.vengeanceArmor.defense).toBe(22);
  expect(PALADIN_EQUIPMENT_BONUSES.ringOfParamountHealth.healthHp).toBe(100);
  expect(PALADIN_EQUIPMENT_BONUSES.archonSword).toEqual({
    healthHp: 0,
    defense: 0,
    speed: 0,
    vitality: 0,
  });
  expect(PALADIN_EQUIPMENT_BONUSES.sealOfTheDivine).toEqual({
    healthHp: 0,
    defense: 0,
    speed: 0,
    vitality: 0,
  });
  expect(PALADIN_STATS).toEqual({
    healthHp: 775,
    defense: 32,
    speed: 41,
    vitality: 42,
  });
  expect(
    calculateEquippedStats(
      PALADIN_BASE_STATS,
      Object.values(PALADIN_EQUIPMENT_BONUSES),
    ),
  ).toEqual(PALADIN_STATS);
  expect(PALADIN_BASE_STATS.healthHp).toBe(675);
});

test("derives the approved speed, fractional regeneration, combat duration and trigger", () => {
  expect(PALADIN_DERIVED_STATS.speedTilesPerSecond).toBeCloseTo(
    7.061333333333333,
  );
  expect(PALADIN_DERIVED_STATS.regenerationHpPerSecond).toBeCloseTo(12.1094);
  expect(PALADIN_DERIVED_STATS.inCombatRegenerationHpPerSecond).toBeCloseTo(
    6.0547,
  );
  expect(PALADIN_DERIVED_STATS.combatDurationSeconds).toBeCloseTo(5.32);
  expect(PALADIN_DERIVED_STATS.combatTriggerHp).toBe(27);
  expect(
    calculateDamageHp(ENCOUNTER_CONFIG.shard.damageHp, PALADIN_STATS.defense),
  ).toBe(128);
});

test("uses the source formulas at zero stats and at the speed formula denominator", () => {
  const atZero = derivePlayerStats({
    healthHp: 1,
    defense: 0,
    speed: 0,
    vitality: 0,
  });
  expect(atZero).toEqual({
    speedTilesPerSecond: 4,
    regenerationHpPerSecond: 2,
    inCombatRegenerationHpPerSecond: 1,
    combatDurationSeconds: 7,
    combatTriggerHp: 1,
  });
  expect(
    derivePlayerStats({ ...PALADIN_STATS, speed: 75 }).speedTilesPerSecond,
  ).toBeCloseTo(9.6);
});

test.each([
  [160, 32, 128],
  [160, 144, 16],
  [160, 145, 16],
  [7, 100, 1],
  [0.1, 100, 1],
  [10.1, 0, 11],
  [0, 0, 0],
  [0, 100, 0],
])(
  "damage for raw %s HP and DEF %s rounds up to %s HP",
  (rawDamageHp, defense, expected) => {
    expect(calculateDamageHp(rawDamageHp, defense)).toBe(expected);
  },
);

test.each([
  [0, 1],
  [12, 12],
  [15, 15],
  [25, 22],
  [32, 27],
  [35, 30],
  [45, 35],
  [65, 45],
  [77, 48],
  [125, 60],
  [126, 60],
  [1_000, 60],
  [25.5, 22],
])(
  "DEF %s produces the floored, bounded combat trigger %s HP",
  (defense, expected) => {
    expect(calculateCombatTriggerHp(defense)).toBe(expected);
  },
);

test.each([
  [0, 7],
  [42, 5.32],
  [150, 1],
  [151, 1],
  [1_000, 1],
])("VIT %s gives a combat duration of %s seconds", (vitality, expected) => {
  expect(calculateCombatDurationSeconds(vitality)).toBeCloseTo(expected);
});

test.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  "rejects invalid rule input %s instead of propagating it",
  (invalid) => {
    expect(() => calculateDamageHp(invalid, 0)).toThrow(RangeError);
    expect(() => calculateDamageHp(1, invalid)).toThrow(RangeError);
    expect(() => calculateCombatTriggerHp(invalid)).toThrow(RangeError);
    expect(() => calculateCombatDurationSeconds(invalid)).toThrow(RangeError);
    for (const stat of ["healthHp", "defense", "speed", "vitality"] as const) {
      expect(() =>
        derivePlayerStats({ ...PALADIN_STATS, [stat]: invalid }),
      ).toThrow(RangeError);
      expect(() =>
        calculateEquippedStats(PALADIN_BASE_STATS, [
          { ...PALADIN_STATS, [stat]: invalid },
        ]),
      ).toThrow(RangeError);
    }
  },
);

test("encodes approved tuning and independent reversal/lifetime values with explicit units", () => {
  expect(RULES_VERSION).toBe("crystal-worm-child-head-paladin-v2");
  expect(ENCOUNTER_CONFIG.rulesVersion).toBe(RULES_VERSION);
  expect(ENCOUNTER_CONFIG.arena).toEqual({
    centerTiles: { x: 0, y: 0 },
    radiusTiles: 19.2,
  });
  expect(ENCOUNTER_CONFIG.player).toEqual({
    spawnTiles: { x: 0, y: 0 },
    verticesTiles: V2_GEOMETRY_CANDIDATE.bodies.player.verticesTiles,
  });
  expect(ENCOUNTER_CONFIG.enemy).toEqual({
    spawnTiles: { x: 0, y: -16.2 },
    verticesTiles: V2_GEOMETRY_CANDIDATE.bodies.head.verticesTiles,
    speedTilesPerSecond: 1.5,
    contactDamageHp: 0,
    blocksPlayer: false,
  });
  expect(ENCOUNTER_CONFIG.emitters).toEqual({
    count: 4,
    radiusTiles: V2_GEOMETRY_CANDIDATE.emitterOffsetTiles,
    initialPhaseRadians: 0,
    clockwiseDegreesPerSecond: 45,
    rotateDuringCooldown: true,
  });
  expect(ENCOUNTER_CONFIG.burst).toEqual({
    shotsPerEmitter: 11,
    shotIntervalSeconds: 0.15,
    cooldownAfterLastShotSeconds: 1,
    initialCooldownSeconds: 2,
  });
  expect(ENCOUNTER_CONFIG.shard).toEqual({
    damageHp: 160,
    speedTilesPerSecond: 8,
    verticesTiles: V2_GEOMETRY_CANDIDATE.bodies.shard.verticesTiles,
    reversalAgeSeconds: V2_GEOMETRY_CANDIDATE.reversalAgeSeconds,
    lifetimeSeconds: V2_GEOMETRY_CANDIDATE.lifetimeSeconds,
    expiration: "lifetime-only",
    hitPolicy: "once-per-shard",
  });
  expect(ENCOUNTER_CONFIG.camera).toEqual({
    cssPixelsPerTile: 32,
    defaultZoom: 1,
    minZoom: 0.25,
    maxZoom: 3,
    zoomStep: 0.125,
  });
  expect(ENCOUNTER_CONFIG.session).toEqual({
    startCountdownSeconds: 3,
    retryCountdownSeconds: 0,
    historyLimit: 100,
  });
  expect(() => validateEncounterConfig(ENCOUNTER_CONFIG)).not.toThrow();
});

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects invalid shard lifetime %s",
  (lifetimeSeconds) => {
    expect(() =>
      validateEncounterConfig({
        ...ENCOUNTER_CONFIG,
        shard: { ...ENCOUNTER_CONFIG.shard, lifetimeSeconds },
      }),
    ).toThrow(RangeError);
  },
);

test.each([
  0,
  -1,
  ENCOUNTER_CONFIG.shard.lifetimeSeconds,
  5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
])("rejects reversal outside the lifetime: %s", (reversalAgeSeconds) => {
  expect(() =>
    validateEncounterConfig({
      ...ENCOUNTER_CONFIG,
      shard: { ...ENCOUNTER_CONFIG.shard, reversalAgeSeconds },
    }),
  ).toThrow(RangeError);
});

test("rejects invalid geometry, counts, timings, zoom bounds, version, and pursuit speed", () => {
  const invalidConfigs = [
    { ...ENCOUNTER_CONFIG, rulesVersion: " " },
    {
      ...ENCOUNTER_CONFIG,
      arena: { ...ENCOUNTER_CONFIG.arena, radiusTiles: 0 },
    },
    {
      ...ENCOUNTER_CONFIG,
      player: { ...ENCOUNTER_CONFIG.player, verticesTiles: [] },
    },
    {
      ...ENCOUNTER_CONFIG,
      player: { ...ENCOUNTER_CONFIG.player, spawnTiles: { x: 19.2, y: 0 } },
    },
    {
      ...ENCOUNTER_CONFIG,
      enemy: { ...ENCOUNTER_CONFIG.enemy, spawnTiles: { x: Number.NaN, y: 0 } },
    },
    {
      ...ENCOUNTER_CONFIG,
      enemy: { ...ENCOUNTER_CONFIG.enemy, spawnTiles: { x: 19.2, y: 0 } },
    },
    {
      ...ENCOUNTER_CONFIG,
      enemy: {
        ...ENCOUNTER_CONFIG.enemy,
        speedTilesPerSecond: PALADIN_DERIVED_STATS.speedTilesPerSecond,
      },
    },
    {
      ...ENCOUNTER_CONFIG,
      emitters: { ...ENCOUNTER_CONFIG.emitters, count: 0 },
    },
    {
      ...ENCOUNTER_CONFIG,
      emitters: { ...ENCOUNTER_CONFIG.emitters, count: 1.5 },
    },
    {
      ...ENCOUNTER_CONFIG,
      burst: { ...ENCOUNTER_CONFIG.burst, shotsPerEmitter: 1.5 },
    },
    {
      ...ENCOUNTER_CONFIG,
      burst: { ...ENCOUNTER_CONFIG.burst, shotIntervalSeconds: 0 },
    },
    {
      ...ENCOUNTER_CONFIG,
      burst: { ...ENCOUNTER_CONFIG.burst, cooldownAfterLastShotSeconds: -1 },
    },
    { ...ENCOUNTER_CONFIG, camera: { ...ENCOUNTER_CONFIG.camera, minZoom: 2 } },
    {
      ...ENCOUNTER_CONFIG,
      camera: { ...ENCOUNTER_CONFIG.camera, defaultZoom: 4 },
    },
    {
      ...ENCOUNTER_CONFIG,
      session: { ...ENCOUNTER_CONFIG.session, historyLimit: 0 },
    },
  ];
  for (const config of invalidConfigs) {
    expect(() => validateEncounterConfig(config)).toThrow(RangeError);
  }
});

test("imports in Node and carries the comparison version in plain session snapshots", () => {
  expect(typeof document).toBe("undefined");
  expect(typeof window).toBe("undefined");
  expect(typeof localStorage).toBe("undefined");
  const snapshot: SessionSnapshot = {
    rulesVersion: RULES_VERSION,
    phase: "playing",
    elapsedSeconds: 0,
    hitsTaken: 0,
    player: {
      positionTiles: ENCOUNTER_CONFIG.player.spawnTiles,
      healthHp: PALADIN_STATS.healthHp,
      combatRemainingSeconds: 0,
    },
    enemy: {
      positionTiles: ENCOUNTER_CONFIG.enemy.spawnTiles,
      emitterPhaseRadians: ENCOUNTER_CONFIG.emitters.initialPhaseRadians,
    },
    shards: [
      {
        id: 0,
        orientationRadians: 0,
        positionTiles: { x: 0, y: 0 },
        velocityTilesPerSecond: { x: 8, y: 0 },
        ageSeconds: 0,
        reversalAgeSeconds: 1.2,
        lifetimeSeconds: 2.4,
        hasReversed: false,
        hasHitPlayer: false,
      },
    ],
  };
  expect(snapshot.rulesVersion).toBe(ENCOUNTER_CONFIG.rulesVersion);
  expect(snapshot.shards[0]).not.toHaveProperty("origin");
  expect(snapshot.shards[0].hasHitPlayer).toBe(false);
});

test("v2 geometry candidate keeps finite ordered convex bodies at the measured common scale", () => {
  const candidate = V2_GEOMETRY_CANDIDATE;
  expect(candidate.approval).toBe("approved");
  expect(candidate.sourcePixelsPerTile).toBeCloseTo(435.118 / 19.2, 12);
  for (const body of Object.values(candidate.bodies)) {
    const vertices = body.verticesTiles;
    expect(vertices.length).toBeGreaterThanOrEqual(3);
    expect(vertices.length).toBeLessThanOrEqual(8);
    const turns = vertices.map((vertex, index) => {
      expect(Number.isFinite(vertex.x) && Number.isFinite(vertex.y)).toBe(true);
      const next = vertices[(index + 1) % vertices.length];
      const after = vertices[(index + 2) % vertices.length];
      return (
        (next.x - vertex.x) * (after.y - next.y) -
        (next.y - vertex.y) * (after.x - next.x)
      );
    });
    expect(turns.every((turn) => turn > 0)).toBe(true);
    const twiceArea = vertices.reduce((area, vertex, index) => {
      const next = vertices[(index + 1) % vertices.length];
      return area + vertex.x * next.y - next.x * vertex.y;
    }, 0);
    expect(twiceArea).toBeGreaterThan(0);
    const width =
      Math.max(...vertices.map((vertex) => vertex.x)) -
      Math.min(...vertices.map((vertex) => vertex.x));
    const height =
      Math.max(...vertices.map((vertex) => vertex.y)) -
      Math.min(...vertices.map((vertex) => vertex.y));
    expect(width * candidate.sourcePixelsPerTile).toBeCloseTo(
      body.sourceWidthPixels,
      10,
    );
    expect(height * candidate.sourcePixelsPerTile).toBeCloseTo(
      body.sourceHeightPixels,
      10,
    );
    expect(width / height).toBeCloseTo(
      body.sourceWidthPixels / body.sourceHeightPixels,
      10,
    );
    expect(body.anchor).toBe("body-center");
    expect(body.dimensionToleranceSourcePixels.width).toBeGreaterThan(0);
    expect(body.dimensionToleranceSourcePixels.height).toBeGreaterThan(0);
  }
});

test("v2 geometry candidate shard is centrally symmetric and keeps its firing-axis orientation on reversal", () => {
  const shard = V2_GEOMETRY_CANDIDATE.bodies.shard;
  expect(shard.orientation).toBe("initial-firing-axis");
  expect(shard.verticesTiles.length % 2).toBe(0);
  shard.verticesTiles.forEach((vertex, index, vertices) => {
    const opposite = vertices[(index + vertices.length / 2) % vertices.length];
    expect(vertex.x + opposite.x).toBeCloseTo(0, 12);
    expect(vertex.y + opposite.y).toBeCloseTo(0, 12);
  });
});

test("v2 geometry candidate derives exact leading-vertex reversal and rejects just-beyond reach across firing phases", () => {
  const candidate = V2_GEOMETRY_CANDIDATE;
  const {
    emitterOffsetTiles,
    maximumShardCenterDistanceTiles,
    reversalAgeSeconds,
    lifetimeSeconds,
  } = candidate;
  expect(emitterOffsetTiles).toBeCloseTo(
    (candidate.bodies.head.sourceWidthPixels / candidate.sourcePixelsPerTile) *
      0.1,
    12,
  );
  expect(reversalAgeSeconds).toBeGreaterThan(0);
  expect(lifetimeSeconds).toBeCloseTo(2 * reversalAgeSeconds, 12);
  expect(reversalAgeSeconds).toBeLessThan(lifetimeSeconds);
  expect(
    emitterOffsetTiles +
      reversalAgeSeconds * candidate.shardSpeedTilesPerSecond,
  ).toBeCloseTo(maximumShardCenterDistanceTiles, 12);
  for (const phase of [0, Math.PI / 7, Math.PI / 2, Math.PI, Math.PI * 1.75]) {
    const farthest = (distance: number) =>
      Math.max(
        ...candidate.bodies.shard.verticesTiles.map((vertex) => {
          const localX = distance + vertex.x;
          return Math.hypot(
            localX * Math.cos(phase) - vertex.y * Math.sin(phase),
            localX * Math.sin(phase) + vertex.y * Math.cos(phase),
          );
        }),
      );
    expect(farthest(emitterOffsetTiles)).toBeLessThan(
      candidate.arenaRadiusTiles,
    );
    expect(farthest(maximumShardCenterDistanceTiles)).toBeCloseTo(
      candidate.arenaRadiusTiles,
      11,
    );
    expect(
      farthest(maximumShardCenterDistanceTiles + 0.000001),
    ).toBeGreaterThan(candidate.arenaRadiusTiles);
  }
  expect(candidate.conservativeLiveShardBound).toBe(
    44 * Math.ceil(lifetimeSeconds / 2.5),
  );
});

test("v2 geometry fits the approved spawn and supplies playable v2", () => {
  const candidate = V2_GEOMETRY_CANDIDATE;
  expect(candidate.enemySpawnTiles).toEqual({ x: 0, y: -16.2 });
  for (const vertex of candidate.bodies.head.verticesTiles) {
    expect(
      Math.hypot(vertex.x, vertex.y + candidate.enemySpawnTiles.y),
    ).toBeLessThan(candidate.arenaRadiusTiles);
  }
  for (const vertex of candidate.bodies.player.verticesTiles) {
    expect(Math.hypot(vertex.x, vertex.y)).toBeLessThan(
      candidate.arenaRadiusTiles,
    );
  }
  expect(candidate.pursuit.extraGapTiles).toBe(0);
  expect(candidate.pursuit.eastSeparationTiles).toBeCloseTo(
    (36 + 42) / (2 * candidate.sourcePixelsPerTile),
    12,
  );
  expect(candidate.pursuit.southSeparationTiles).toBeCloseTo(
    (33 + 55) / (2 * candidate.sourcePixelsPerTile),
    12,
  );
  expect(candidate.bodies.player.orientation).toBe("upright");
  expect(candidate.bodies.head.orientation).toBe("upright");
  expect(RULES_VERSION).toBe("crystal-worm-child-head-paladin-v2");
  expect(ENCOUNTER_CONFIG.burst.shotsPerEmitter).toBe(11);
  expect(ENCOUNTER_CONFIG.shard.reversalAgeSeconds).toBe(
    candidate.reversalAgeSeconds,
  );
});
