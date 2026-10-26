import { expect, test } from "vitest";
import {
  DEBUG_GROUPS,
  DEBUG_PARAMETERS,
  DEBUG_RULES_VERSION,
  DEBUG_TOGGLES,
  DEFAULT_DEBUG_SETTINGS,
  debugEncounterConfig,
  updateDebugParameter,
  validateDebugSettings,
  SELECTED_DEBUG_VALUES,
  loadSelectedDebugValues,
  isDefaultDebugSettings,
} from "./debug";
import type { ShardState } from "../models";
import {
  AUTHORED_TUNING,
  bodyExtentTiles,
  buildEncounterConfig,
  ENCOUNTER_CONFIG,
  liveShardBoundPerEnemy,
  primaryArchetype,
  RULES_VERSION,
  validateEncounterConfig,
  validateShippedEncounter,
  type EncounterConfig,
  type EnemyArchetype,
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

const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);

/** ENCOUNTER_CONFIG with the primary archetype partially overridden. */
const withArchetype = (
  overrides: Partial<EnemyArchetype>,
): EncounterConfig => ({
  ...ENCOUNTER_CONFIG,
  archetypes: { [PRIMARY.id]: { ...PRIMARY, ...overrides } },
});

/** ENCOUNTER_CONFIG with one weapon section of the primary archetype overridden. */
const withWeapon = (
  section: "emitters" | "burst" | "shard",
  overrides: Record<string, unknown>,
): EncounterConfig =>
  withArchetype({
    weapon: {
      ...PRIMARY.weapon,
      [section]: { ...PRIMARY.weapon[section], ...overrides },
    } as EnemyArchetype["weapon"],
  });

// Approved shipped geometry, in tiles. The player and head bodies are the same
// beveled octagon at the same 1.25 x 1.25 size, so their vertices are identical.
// Provenance: docs/mechanics.md step 8.2.
const BEVELED_BODY_1_25_TILES = [
  { x: -0.375, y: -0.625 },
  { x: 0.375, y: -0.625 },
  { x: 0.625, y: -0.375 },
  { x: 0.625, y: 0.375 },
  { x: 0.375, y: 0.625 },
  { x: -0.375, y: 0.625 },
  { x: -0.625, y: 0.375 },
  { x: -0.625, y: -0.375 },
];

const SHARD_BODY_TILES = [
  { x: 0.725, y: 0 },
  { x: 0.3625, y: 0.325 },
  { x: -0.3625, y: 0.325 },
  { x: -0.725, y: 0 },
  { x: -0.3625, y: -0.325 },
  { x: 0.3625, y: -0.325 },
];

test("selected values are the normal scoring-eligible defaults", () => {
  expect(RULES_VERSION).toBe("crystal-worm-child-head-paladin-v3");
  expect(DEFAULT_DEBUG_SETTINGS).toMatchObject(SELECTED_DEBUG_VALUES);
  expect(DEFAULT_DEBUG_SETTINGS.matchPlayerToHead).toBe(true);
  expect(
    isDefaultDebugSettings(loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS)),
  ).toBe(true);
  const selected = debugEncounterConfig(
    loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS),
  );
  expect({ ...selected, rulesVersion: RULES_VERSION }).toEqual(
    ENCOUNTER_CONFIG,
  );
});

test("loads all screenshot-selected values without changing omitted settings", () => {
  expect(SELECTED_DEBUG_VALUES).toEqual({
    headWidth: 1.25,
    headHeight: 1.25,
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
  expect(previous.headWidth).toBe(DEFAULT_DEBUG_SETTINGS.headWidth);
  expect(() => validateDebugSettings(selected)).not.toThrow();
  expect(
    primaryArchetype(debugEncounterConfig(selected)).weapon.emitters.count,
  ).toBe(6);
  expect(PRIMARY.weapon.emitters.count).toBe(6);
  expect(DEFAULT_DEBUG_SETTINGS.cooldownSeconds).toBe(3);
});

test("the selected preset matches the player body to the head and follows live size edits", () => {
  const selected = loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS);
  for (const settings of [
    selected,
    updateDebugParameter(selected, "headWidth", 2),
  ]) {
    const config = debugEncounterConfig(settings);
    for (const axis of ["x", "y"] as const) {
      const size = (vertices: readonly { x: number; y: number }[]) =>
        Math.max(...vertices.map((vertex) => vertex[axis])) -
        Math.min(...vertices.map((vertex) => vertex[axis]));
      expect(size(config.player.verticesTiles)).toBeCloseTo(
        size(primaryArchetype(config).verticesTiles),
        12,
      );
      expect(size(config.player.verticesTiles)).toBeCloseTo(
        axis === "x" ? settings.headWidth : 1.25,
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
  expect(PRIMARY.weapon.shard.lifetimeSeconds).toBe(
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
    calculateDamageHp(PRIMARY.weapon.shard.damageHp, PALADIN_STATS.defense),
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
  expect(RULES_VERSION).toBe("crystal-worm-child-head-paladin-v3");
  expect(ENCOUNTER_CONFIG.rulesVersion).toBe(RULES_VERSION);
  expect(ENCOUNTER_CONFIG.arena).toEqual({
    centerTiles: { x: 0, y: 0 },
    radiusTiles: 19.2,
  });
  expect(ENCOUNTER_CONFIG.player).toEqual({
    spawnTiles: { x: 0, y: 0 },
    verticesTiles: BEVELED_BODY_1_25_TILES,
  });
  expect(Object.keys(ENCOUNTER_CONFIG.archetypes)).toEqual([
    "crystal-worm-child-head",
  ]);
  expect(ENCOUNTER_CONFIG.primaryArchetypeId).toBe("crystal-worm-child-head");
  expect(PRIMARY).toEqual({
    id: "crystal-worm-child-head",
    spawnTiles: { x: 0, y: -16.2 },
    verticesTiles: BEVELED_BODY_1_25_TILES,
    speedTilesPerSecond: 1.5,
    contactDamageHp: 0,
    blocksPlayer: false,
    weapon: {
      emitters: {
        count: 6,
        radiusTiles: 0.35,
        initialPhaseRadians: 0,
        clockwiseDegreesPerSecond: 45,
        rotateDuringCooldown: true,
      },
      burst: {
        shotsPerEmitter: 11,
        shotIntervalSeconds: 0.19,
        cooldownAfterLastShotSeconds: 3,
        initialCooldownSeconds: 2,
      },
      shard: {
        damageHp: 160,
        speedTilesPerSecond: 8,
        verticesTiles: SHARD_BODY_TILES,
        reversalAgeSeconds: 1.5,
        lifetimeSeconds: 3,
        expiration: "lifetime-only",
        hitPolicy: "once-per-shard",
      },
    },
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
  expect(() => validateShippedEncounter(ENCOUNTER_CONFIG)).not.toThrow();
});

test("the shipped encounter requires pursuit slower than the Paladin", () => {
  // Structural validity alone permits a faster enemy, because the debug panel
  // deliberately exposes speeds above the Paladin's; only the shipped
  // encounter is held to the approved rule.
  const faster = withArchetype({
    speedTilesPerSecond: PALADIN_DERIVED_STATS.speedTilesPerSecond,
  });
  expect(() => validateEncounterConfig(faster)).not.toThrow();
  expect(() => validateShippedEncounter(faster)).toThrow(RangeError);
  expect(PRIMARY.speedTilesPerSecond).toBeLessThan(
    PALADIN_DERIVED_STATS.speedTilesPerSecond,
  );
});

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects invalid shard lifetime %s",
  (lifetimeSeconds) => {
    expect(() =>
      validateEncounterConfig(withWeapon("shard", { lifetimeSeconds })),
    ).toThrow(RangeError);
  },
);

test.each([
  0,
  -1,
  PRIMARY.weapon.shard.lifetimeSeconds,
  5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
])("rejects reversal outside the lifetime: %s", (reversalAgeSeconds) => {
  expect(() =>
    validateEncounterConfig(withWeapon("shard", { reversalAgeSeconds })),
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
    withArchetype({ spawnTiles: { x: Number.NaN, y: 0 } }),
    withArchetype({ spawnTiles: { x: 19.2, y: 0 } }),
    withWeapon("emitters", { count: 0 }),
    withWeapon("emitters", { count: 1.5 }),
    withWeapon("burst", { shotsPerEmitter: 1.5 }),
    withWeapon("burst", { shotIntervalSeconds: 0 }),
    withWeapon("burst", { cooldownAfterLastShotSeconds: -1 }),
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
  expect(RULES_VERSION).toBe(ENCOUNTER_CONFIG.rulesVersion);
  const shard: ShardState = {
    id: 0,
    archetypeId: "crystal-worm-child-head",
    damageHp: 160,
    orientationRadians: 0,
    positionTiles: { x: 0, y: 0 },
    velocityTilesPerSecond: { x: 8, y: 0 },
    ageSeconds: 0,
    reversalAgeSeconds: 1.2,
    lifetimeSeconds: 2.4,
    hasReversed: false,
    hasHitPlayer: false,
  };
  expect(shard).not.toHaveProperty("origin");
  expect(shard.hasHitPlayer).toBe(false);
});

test("one builder drives both the shipped and the debug config", () => {
  // The debug path at default settings must reproduce the shipped config
  // field for field, apart from the rules version and the player-size
  // override that matchPlayerToHead applies.
  const fromDebug = debugEncounterConfig({
    ...DEFAULT_DEBUG_SETTINGS,
    matchPlayerToHead: false,
  });
  expect(fromDebug.archetypes).toEqual(ENCOUNTER_CONFIG.archetypes);
  expect(fromDebug.player).toEqual(ENCOUNTER_CONFIG.player);
  expect(fromDebug.arena).toEqual(ENCOUNTER_CONFIG.arena);
  expect(fromDebug.simulation).toEqual(ENCOUNTER_CONFIG.simulation);
  expect(fromDebug.camera).toEqual(ENCOUNTER_CONFIG.camera);
  expect(fromDebug.session).toEqual(ENCOUNTER_CONFIG.session);
  expect(fromDebug.rulesVersion).toBe(DEBUG_RULES_VERSION);
});

test("buildEncounterConfig maps every tuning value into the config", () => {
  const config = buildEncounterConfig(
    { ...AUTHORED_TUNING, headWidth: 2, projectileDamageHp: 7, spawnX: 1 },
    { rulesVersion: "probe", matchPlayerToHead: false },
  );
  const archetype = primaryArchetype(config);
  expect(bodyExtentTiles(archetype.verticesTiles, "x")).toBeCloseTo(2, 12);
  expect(archetype.weapon.shard.damageHp).toBe(7);
  expect(archetype.spawnTiles.x).toBeCloseTo(1, 12);
  expect(config.rulesVersion).toBe("probe");
});

test("the live shard bound derives from configuration, not a literal", () => {
  // 6 emitters x 11 shots x ceil(3 / 4.9) = 66 for the shipped v3 cadence.
  expect(liveShardBoundPerEnemy(PRIMARY)).toBe(66);
  const faster = primaryArchetype(
    buildEncounterConfig(
      { ...AUTHORED_TUNING, lifetimeSeconds: 11, reversalSeconds: 1.5 },
      { rulesVersion: "probe", matchPlayerToHead: false },
    ),
  );
  expect(liveShardBoundPerEnemy(faster)).toBe(6 * 11 * 3);
});

test("debug parameter groups and toggles are derived from the registry", () => {
  expect(DEBUG_GROUPS).toEqual([
    "Enemy",
    "Player",
    "Emitters",
    "Burst",
    "Projectiles",
  ]);
  expect(DEBUG_TOGGLES.map((toggle) => toggle.key)).toEqual([
    "godMode",
    "chaseArenaCenter",
    "matchPlayerToHead",
  ]);
  for (const group of DEBUG_GROUPS)
    expect(
      DEBUG_PARAMETERS.some((parameter) => parameter.group === group),
    ).toBe(true);
});
