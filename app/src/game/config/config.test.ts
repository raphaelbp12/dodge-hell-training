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
  archetypeOf,
  attackShardBound,
  AUTHORED_TUNING,
  bodyExtentTiles,
  buildEncounterConfig,
  ENCOUNTER_CONFIG,
  liveShardBoundForEncounter,
  liveShardBoundPerEnemy,
  primaryArchetype,
  projectileOf,
  RULES_VERSION,
  validateEncounterConfig,
  validateShippedEncounter,
  DEBUG_TUNABLE_ENCOUNTER_ID,
  DEFAULT_ENCOUNTER_ID,
  ENCOUNTER_CONFIGS,
  ENCOUNTER_LIST,
  encounterConfigOf,
  type EncounterConfig,
  type EnemyArchetype,
} from "./encounter";
import { advanceSimulation, createSimulation } from "../simulation/simulation";
import { resolveBearings, type PatternContext } from "../simulation/patterns";
import { applyPlayerHit } from "../simulation/health";
import {
  applyConditions,
  effectiveDefenseFor,
  hasCondition,
} from "../simulation/conditions";
import { retainedBestSeconds } from "../../storage/attempts";
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
const PRIMARY_PHASE = PRIMARY.phases[0];
const PRIMARY_ATTACK = PRIMARY_PHASE.attacks[0];
const PRIMARY_PROJECTILE = projectileOf(
  ENCOUNTER_CONFIG,
  PRIMARY_ATTACK.projectileId,
);
if (PRIMARY_PROJECTILE.motion.kind !== "boomerang")
  throw new Error("test fixture assumes the shipped shard is boomerang-kind");
const PRIMARY_MOTION = PRIMARY_PROJECTILE.motion;
if (PRIMARY_ATTACK.pattern.kind !== "ring")
  throw new Error("test fixture assumes the shipped attack is ring-kind");
const PRIMARY_PATTERN = PRIMARY_ATTACK.pattern;
if (PRIMARY_PHASE.movement.kind !== "chase")
  throw new Error("test fixture assumes the shipped archetype is chase-kind");
const PRIMARY_MOVEMENT = PRIMARY_PHASE.movement;
/** Narrows a debug-built config's pattern, which is always ring-kind. */
function asRingPattern(
  pattern: EnemyArchetype["phases"][number]["attacks"][number]["pattern"],
) {
  if (pattern.kind !== "ring")
    throw new Error("debug-built configs only ever produce a ring pattern");
  return pattern;
}

/** ENCOUNTER_CONFIG with the primary archetype partially overridden. */
const withArchetype = (
  overrides: Partial<EnemyArchetype>,
): EncounterConfig => ({
  ...ENCOUNTER_CONFIG,
  archetypes: { [PRIMARY.id]: { ...PRIMARY, ...overrides } },
});

/** ENCOUNTER_CONFIG with the primary archetype's sole phase partially overridden. */
const withPhase = (overrides: Partial<EnemyArchetype["phases"][number]>) =>
  withArchetype({ phases: [{ ...PRIMARY_PHASE, ...overrides }] });

/** ENCOUNTER_CONFIG with one section of the primary attack overridden. */
const withAttackSection = (
  section: "pattern" | "cadence",
  overrides: Record<string, unknown>,
): EncounterConfig =>
  withPhase({
    attacks: [
      {
        ...PRIMARY_ATTACK,
        [section]: { ...PRIMARY_ATTACK[section], ...overrides },
      },
    ],
  });

/** ENCOUNTER_CONFIG with the primary projectile's motion overridden. */
const withProjectileMotion = (
  overrides: Record<string, unknown>,
): EncounterConfig => ({
  ...ENCOUNTER_CONFIG,
  projectiles: {
    [PRIMARY_PROJECTILE.id]: {
      ...PRIMARY_PROJECTILE,
      motion: { ...PRIMARY_PROJECTILE.motion, ...overrides },
    },
  },
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
  expect(RULES_VERSION).toBe("crystal-worm-child-swarm-paladin-v4");
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
    asRingPattern(
      primaryArchetype(debugEncounterConfig(selected)).phases[0].attacks[0]
        .pattern,
    ).arms,
  ).toBe(6);
  expect(PRIMARY_PATTERN.arms).toBe(6);
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
  expect(PRIMARY_MOTION.lifetimeSeconds).toBe(
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
    calculateDamageHp(PRIMARY_PROJECTILE.damageHp, PALADIN_STATS.defense),
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
  ["none", 32, false, 68],
  ["armour-piercing", 0, false, 100],
  ["Armor Broken", 0, false, 100],
  ["Exposed", 12, false, 88],
  ["armour-piercing + Exposed", -20, false, 120],
  ["Armor Broken + Exposed", -20, false, 120],
  ["Curse only", 32, true, 85],
])(
  "the %s condition case for a raw 100-damage shot deals the expected HP",
  (_label, defense, cursed, expected) => {
    expect(calculateDamageHp(100, defense, cursed)).toBe(expected);
  },
);

test("accepts a negative defense and the minimum-damage floor still applies to a high-defense low-damage shot", () => {
  expect(calculateDamageHp(100, -20)).toBe(120);
  expect(calculateDamageHp(7, 100)).toBe(1);
});

test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  "rejects a nonfinite defense %s",
  (invalid) => {
    expect(() => calculateDamageHp(1, invalid)).toThrow(RangeError);
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
  expect(RULES_VERSION).toBe("crystal-worm-child-swarm-paladin-v4");
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
    contactDamageHp: 0,
    contactConditions: [],
    contactArmorPiercing: false,
    contactCooldownSeconds: 0,
    blocksPlayer: false,
    phases: [
      {
        id: "sole",
        enterAtHpFraction: 1,
        exitAfterSeconds: null,
        telegraphSeconds: 0,
        invulnerableOnEnterSeconds: 0,
        telegraphColor: "amber",
        movement: { kind: "chase", speedTilesPerSecond: 1.5 },
        progression: null,
        subPhases: null,
        spawns: null,
        attacks: [
          {
            id: "spiral-shards",
            projectileId: "crystal-worm-child-shard",
            tuningSource: "approved-v3",
            pattern: {
              kind: "ring",
              arms: 6,
              emitterRadiusTiles: 0.35,
              initialPhaseRadians: 0,
              clockwiseDegreesPerSecond: 45,
            },
            cadence: {
              shotsPerBurst: 11,
              shotIntervalSeconds: 0.19,
              cooldownAfterLastShotSeconds: 3,
              initialDelaySeconds: 2,
            },
          },
        ],
      },
    ],
  });
  expect(ENCOUNTER_CONFIG.projectiles).toEqual({
    "crystal-worm-child-shard": {
      id: "crystal-worm-child-shard",
      damageHp: 160,
      speedTilesPerSecond: 8,
      armorPiercing: false,
      conditions: [],
      verticesTiles: SHARD_BODY_TILES,
      expiration: "lifetime-only",
      hitPolicy: "once-per-shard",
      motion: {
        kind: "boomerang",
        reversalAgeSeconds: 1.5,
        lifetimeSeconds: 3,
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

test("the lob telegraph duration is authored configuration, not a renderer literal", () => {
  expect(ENCOUNTER_CONFIG.presentation).toEqual({ lobTelegraphSeconds: 0.3 });
  expect(() =>
    validateEncounterConfig({
      ...ENCOUNTER_CONFIG,
      presentation: { lobTelegraphSeconds: 0 },
    }),
  ).toThrow(RangeError);
});

test("the shipped encounter requires pursuit slower than the Paladin", () => {
  // Structural validity alone permits a faster enemy, because the debug panel
  // deliberately exposes speeds above the Paladin's; only the shipped
  // encounter is held to the approved rule.
  const faster = withPhase({
    movement: {
      kind: "chase",
      speedTilesPerSecond: PALADIN_DERIVED_STATS.speedTilesPerSecond,
    },
  });
  expect(() => validateEncounterConfig(faster)).not.toThrow();
  expect(() => validateShippedEncounter(faster)).toThrow(RangeError);
  expect(PRIMARY_MOVEMENT.speedTilesPerSecond).toBeLessThan(
    PALADIN_DERIVED_STATS.speedTilesPerSecond,
  );
});

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects invalid shard lifetime %s",
  (lifetimeSeconds) => {
    expect(() =>
      validateEncounterConfig(withProjectileMotion({ lifetimeSeconds })),
    ).toThrow(RangeError);
  },
);

test.each([
  0,
  -1,
  PRIMARY_MOTION.lifetimeSeconds,
  5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
])("rejects reversal outside the lifetime: %s", (reversalAgeSeconds) => {
  expect(() =>
    validateEncounterConfig(withProjectileMotion({ reversalAgeSeconds })),
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
    withAttackSection("pattern", { arms: 0 }),
    withAttackSection("pattern", { arms: 1.5 }),
    withAttackSection("cadence", { shotsPerBurst: 1.5 }),
    withAttackSection("cadence", { shotIntervalSeconds: 0 }),
    withAttackSection("cadence", { cooldownAfterLastShotSeconds: -1 }),
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
    projectileId: "crystal-worm-child-shard",
    damageHp: 160,
    orientationRadians: 0,
    positionTiles: { x: 0, y: 0 },
    velocityTilesPerSecond: { x: 8, y: 0 },
    ageSeconds: 0,
    reversalAgeSeconds: 1.2,
    lifetimeSeconds: 2.4,
    hasReversed: false,
    hasHitPlayer: false,
    spawnPositionTiles: { x: 0, y: 0 },
    spawnOrientationRadians: 0,
    detonationTargetTiles: null,
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
  expect(
    projectileOf(config, archetype.phases[0].attacks[0].projectileId)
      .damageHp,
  ).toBe(7);
  expect(archetype.spawnTiles.x).toBeCloseTo(1, 12);
  expect(config.rulesVersion).toBe("probe");
});

test("the live shard bound derives from configuration, not a literal", () => {
  // 6 emitters x 11 shots x ceil(3 / 4.9) = 66 for the shipped v3 cadence.
  expect(liveShardBoundPerEnemy(ENCOUNTER_CONFIG, PRIMARY)).toBe(66);
  const fasterConfig = buildEncounterConfig(
    { ...AUTHORED_TUNING, lifetimeSeconds: 11, reversalSeconds: 1.5 },
    { rulesVersion: "probe", matchPlayerToHead: false },
  );
  const faster = primaryArchetype(fasterConfig);
  expect(liveShardBoundPerEnemy(fasterConfig, faster)).toBe(6 * 11 * 3);
});

test("the live shard bound sums a phase's concurrent attacks and maxes across sub-phases", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const queen = primaryArchetype(queenConfig);
  const expected = Math.max(
    ...queen.phases.map((phase) => {
      const attacksTotal = phase.attacks.reduce(
        (total, attack) => total + attackShardBound(queenConfig, attack),
        0,
      );
      const subPhaseMax = phase.subPhases?.length
        ? Math.max(
            ...phase.subPhases.map((subPhase) =>
              subPhase.attacks.reduce(
                (total, attack) => total + attackShardBound(queenConfig, attack),
                0,
              ),
            ),
          )
        : 0;
      return attacksTotal + subPhaseMax;
    }),
  );
  expect(liveShardBoundPerEnemy(queenConfig, queen)).toBe(expected);
});

test("the encounter-wide live shard bound includes the primary archetype and every minion", () => {
  const config = ENCOUNTER_CONFIG;
  const expected =
    liveShardBoundPerEnemy(config, PRIMARY) * config.spawns.maxConcurrent;
  expect(liveShardBoundForEncounter(config)).toBe(expected);

  const queenConfig = encounterConfigOf("killer-bee-queen");
  const queen = primaryArchetype(queenConfig);
  const minionBound = Object.entries(queenConfig.archetypes)
    .filter(([id]) => id !== queenConfig.primaryArchetypeId)
    .reduce(
      (total, [, archetype]) =>
        total + liveShardBoundPerEnemy(queenConfig, archetype),
      0,
    );
  expect(liveShardBoundForEncounter(queenConfig)).toBe(
    liveShardBoundPerEnemy(queenConfig, queen) *
      queenConfig.spawns.maxConcurrent +
      minionBound * queenConfig.maxConcurrentMinions,
  );
});

test("debug parameter groups and toggles are derived from the registry", () => {
  expect(DEBUG_GROUPS).toEqual([
    "Enemy",
    "Spawns",
    "Player",
    "Emitters",
    "Burst",
    "Projectiles",
  ]);
  expect(DEBUG_TOGGLES.map((toggle) => toggle.key)).toEqual([
    "godMode",
    "chaseArenaCenter",
    "pauseProgression",
    "matchPlayerToHead",
  ]);
  for (const group of DEBUG_GROUPS)
    expect(
      DEBUG_PARAMETERS.some((parameter) => parameter.group === group),
    ).toBe(true);
});

test("the Spawns group exposes the rule and replaces the spawn-point sliders", () => {
  expect(DEBUG_GROUPS).toContain("Spawns");
  const spawnKeys = DEBUG_PARAMETERS.filter(
    (parameter) => parameter.group === "Spawns",
  ).map((parameter) => parameter.key);
  expect(spawnKeys).toEqual([
    "firstSpawnSeconds",
    "spawnEverySeconds",
    "maxConcurrentEnemies",
    "spawnRingFraction",
  ]);
  // Rule-driven placement means there is no single spawn point to edit (G05).
  const keys = DEBUG_PARAMETERS.map((parameter) => parameter.key);
  expect(keys).not.toContain("spawnX");
  expect(keys).not.toContain("spawnY");
});

test("spawn sliders reach the config and stay inside the arena at both ends", () => {
  for (const parameter of DEBUG_PARAMETERS.filter((p) => p.group === "Spawns")) {
    for (const value of [parameter.min, parameter.max]) {
      const settings = updateDebugParameter(
        DEFAULT_DEBUG_SETTINGS,
        parameter.key,
        value,
      );
      const config = debugEncounterConfig(settings);
      expect(config.spawns.ringRadiusTiles).toBeLessThan(
        config.arena.radiusTiles,
      );
      if (parameter.key === "maxConcurrentEnemies")
        expect(config.spawns.maxConcurrent).toBe(value);
      if (parameter.key === "spawnEverySeconds")
        expect(config.spawns.everySeconds).toBe(value);
      if (parameter.key === "firstSpawnSeconds")
        expect(config.spawns.firstSpawnSeconds).toBe(value);
    }
  }
});

test("validateEncounterConfig accepts every optional ring field", () => {
  expect(() =>
    validateEncounterConfig(
      withAttackSection("pattern", {
        perBurstAdvanceDegrees: 15,
        gapSectorsDegrees: [
          [350, 10],
          [100, 150],
        ],
        armSpreadDegreesPerSecond: 1,
        maxArmSpreadDegrees: 10,
      }),
    ),
  ).not.toThrow();
});

test.each([
  ["a nonfinite perBurstAdvanceDegrees", { perBurstAdvanceDegrees: Number.NaN }],
  ["a non-array gapSectorsDegrees", { gapSectorsDegrees: 5 }],
  ["a malformed gap sector", { gapSectorsDegrees: [[0]] }],
  ["a nonfinite gap bound", { gapSectorsDegrees: [[0, Number.NaN]] }],
  ["a 360-degree gap sector", { gapSectorsDegrees: [[0, 360]] }],
  ["total gap coverage of 360 degrees", { gapSectorsDegrees: [[0, 180], [180, 360]] }],
  ["an arm spread rate without a maximum", { armSpreadDegreesPerSecond: 10 }],
  ["a nonfinite arm spread rate", { armSpreadDegreesPerSecond: Number.POSITIVE_INFINITY, maxArmSpreadDegrees: 45 }],
  ["a negative maximum arm spread", { armSpreadDegreesPerSecond: 10, maxArmSpreadDegrees: -1 }],
  ["a nonfinite maximum arm spread", { armSpreadDegreesPerSecond: 10, maxArmSpreadDegrees: Number.NaN }],
  ["an arm spread that collides two arms", { arms: 6, armSpreadDegreesPerSecond: 10, maxArmSpreadDegrees: 12 }],
] as const)("validateEncounterConfig rejects %s", (_name, overrides) => {
  expect(() =>
    validateEncounterConfig(withAttackSection("pattern", overrides)),
  ).toThrow(RangeError);
});

// Step 23.1: encounters are a keyed collection (K14).
test("every authored encounter has its own runtime config, and the Crystal Worm is byte-identical to before", () => {
  expect(ENCOUNTER_LIST.map((entry) => entry.id).sort()).toEqual(
    ["crystal-worm", "killer-bee-queen"].sort(),
  );
  expect(ENCOUNTER_CONFIGS[DEBUG_TUNABLE_ENCOUNTER_ID]).toBe(ENCOUNTER_CONFIG);
  expect(encounterConfigOf(DEBUG_TUNABLE_ENCOUNTER_ID)).toBe(ENCOUNTER_CONFIG);
  expect(() => encounterConfigOf("unknown-encounter")).toThrow(RangeError);
});

test("the Killer Bee Queen is the default selection and spawns exactly one enemy, never repeated", () => {
  expect(DEFAULT_ENCOUNTER_ID).toBe("killer-bee-queen");
  const queenConfig = encounterConfigOf("killer-bee-queen");
  expect(queenConfig.spawns.maxConcurrent).toBe(1);
  expect(queenConfig.spawns.everySeconds).toBeNull();
  expect(queenConfig.rulesVersion).toBe("killer-bee-queen-nest-paladin-v6");
  const state = createSimulation(queenConfig, 1);
  expect(state.enemies).toHaveLength(1);
  const idle = { north: false, south: false, east: false, west: false };
  for (let tick = 0; tick < 600; tick++)
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
  expect(state.enemies).toHaveLength(1);
});

// Step 24.2 (G19-style): the Queen's rules version advanced from v5 to v6
// because tuning changed gameplay enough to invalidate comparison with
// pre-24.2 attempts. A v5 record must be retained in storage but excluded
// from the new rules version's best, exactly as G19 excluded v1-v3 records
// when the Crystal Worm moved to v4.
test("a pre-24.2 Killer Bee Queen attempt record is retained but excluded from the v6 best", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  expect(queenConfig.rulesVersion).toBe("killer-bee-queen-nest-paladin-v6");
  const records = [
    {
      id: "a",
      rulesVersion: "killer-bee-queen-nest-paladin-v5",
      elapsedSeconds: 500,
      hitsTaken: 2,
      outcome: "death" as const,
    },
    {
      id: "b",
      rulesVersion: queenConfig.rulesVersion,
      elapsedSeconds: 120,
      hitsTaken: 5,
      outcome: "death" as const,
    },
  ];
  expect(retainedBestSeconds(records, queenConfig.rulesVersion)).toBe(120);
  expect(
    retainedBestSeconds(records, "killer-bee-queen-nest-paladin-v5"),
  ).toBe(500);
});

// Step 23.2/23.3: the harmless eight-phase skeleton loads with no attacks
// except phase 1 (authored in 23.3), and drains at K15's 375 HP/second,
// matching the plan's Worked Progression Timeline (the plan's own line 91:
// "plus every telegraph and inter-sub-phase invulnerability window"). Step
// 23.4 gave phase 2's three colour sub-phases their own nonzero
// invulnerableOnEnterSeconds (K08), adding ~4.9167s of paused drain across
// five sub-phase entries before phase 3; step 23.7 gave phase 5's three
// colour sub-phases a 1s invulnerableOnEnterSeconds each, pausing drain a
// further ~4.9167s across its own three sub-phase entries before phase 6;
// every later threshold shifts by these same constants, on top of phase 6's
// separately-scripted 29s.
test("the Killer Bee Queen's eight phases carry phases 1, 3, 4, 6 and 8's attacks and drain on the approved timeline", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  expect(archetype.phases).toHaveLength(8);
  expect(archetype.phases[0].attacks.length).toBeGreaterThan(0);
  expect(archetype.phases[2].attacks.length).toBeGreaterThan(0);
  expect(archetype.phases[3].attacks.length).toBeGreaterThan(0);
  expect(archetype.phases[5].attacks.length).toBeGreaterThan(0);
  expect(archetype.phases[7].attacks.length).toBeGreaterThan(0);
  for (const phase of archetype.phases.filter(
    (_, index) =>
      index !== 0 &&
      index !== 2 &&
      index !== 3 &&
      index !== 5 &&
      index !== 7,
  ))
    expect(phase.attacks).toHaveLength(0);
  expect(archetype.health?.maxHealthHp).toBe(112_500);
  expect(archetype.health?.progression).toEqual({
    kind: "simulated-dps",
    hpPerSecond: 375,
  });
  expect(archetype.phases[5].exitAfterSeconds).toBe(29);
  expect(archetype.phases[5].enterAtHpFraction).toBe(0.25);
  expect(archetype.phases[6].enterAtHpFraction).toBe(0.25);

  const state = createSimulation(queenConfig, 1);
  // Step 23.3/23.5 gave phases 1 and 3 real attacks; this test is about the
  // enemy phase machine's timing, not player survival, so god mode replaces
  // the per-tick health top-up (23.5's denser barrage can exceed a full
  // heal's worth of damage within one fixed step, which would otherwise end
  // the run before every phase transition is observed).
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const enemy = state.enemies[0];
  const idle = { north: false, south: false, east: false, west: false };
  // Step 23.9 gave phase 7 a progression override of 195 HP/s (375 minus
  // the three Beehemoths' 180 HP/s of healing, K15/phase 7's own cited
  // numbers) instead of the encounter's default 375, so phase 8's entry
  // time shifts later: draining from 25% to 12.5% of 112,500 HP (14,062.5
  // HP) now takes ~72.1s instead of ~37.5s.
  const expectedPhaseEntrySeconds = [
    0, 30, 79.916667, 124.916667, 169.916667, 234.833333, 263.85, 335.933333,
  ];
  const observedPhaseEntrySeconds: number[] = [0];
  let previousPhaseIndex = 0;
  for (let tick = 0; tick < 23000 && state.phase === "playing"; tick++) {
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    if (enemy.phaseIndex !== previousPhaseIndex) {
      observedPhaseEntrySeconds.push(state.elapsedSeconds);
      previousPhaseIndex = enemy.phaseIndex;
    }
  }
  for (const [index, expectedSeconds] of expectedPhaseEntrySeconds.entries())
    expect(observedPhaseEntrySeconds[index]).toBeCloseTo(expectedSeconds, 1);
  expect(state.phase).toBe("cleared");
});

// Step 23.3: phase 1 fires its five sourced projectiles - a radial blue-bomb
// ring, a player-targeted white bomb, and three stacked stinger spreads that
// together produce nine shards from one tick of all three attacks.
test("the Killer Bee Queen's phase 1 fires its five sourced projectiles", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase1Attacks = archetype.phases[0].attacks;
  expect(phase1Attacks.map((attack) => attack.projectileId).sort()).toEqual(
    [
      "blue-bomb",
      "white-bomb-v1",
      "red-stinger-large-v1",
      "blue-stinger-large",
      "yellow-stinger-small-v1",
    ].sort(),
  );
  for (const attack of phase1Attacks) expect(attack.tuningSource).toBeTruthy();

  const state = createSimulation(queenConfig, 1);
  const idle = { north: false, south: false, east: false, west: false };
  const observedProjectileIds = new Set<string>();
  for (let tick = 0; tick < 600; tick++) {
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    for (const shard of state.shards) observedProjectileIds.add(shard.projectileId);
  }
  for (const attack of phase1Attacks)
    expect(observedProjectileIds.has(attack.projectileId)).toBe(true);

  const stingerShards = (() => {
    const fresh = createSimulation(queenConfig, 1);
    let countAtFirstTick = 0;
    for (let tick = 0; tick < 600; tick++) {
      const before = fresh.shards.length;
      advanceSimulation(fresh, queenConfig.simulation.fixedStepSeconds, idle);
      const fired = fresh.shards.filter(
        (shard) =>
          shard.projectileId === "red-stinger-large-v1" ||
          shard.projectileId === "blue-stinger-large" ||
          shard.projectileId === "yellow-stinger-small-v1",
      );
      if (fired.length >= 9 && countAtFirstTick === 0) countAtFirstTick = fired.length;
      void before;
    }
    return countAtFirstTick;
  })();
  expect(stingerShards).toBeGreaterThanOrEqual(9);
});

// Step 23.4: phase 2's red sub-phase fires its three sourced projectiles and
// spawns despawn-on-exit Red Killer Bees on entry, invulnerable the whole time.
test("the Killer Bee Queen's phase 2 red sub-phase fires first with its own minions", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase2 = archetype.phases[1];
  expect(phase2.subPhases).toHaveLength(3);
  const redSubPhase = phase2.subPhases![0];
  expect(redSubPhase.invulnerableOnEnterSeconds).toBeGreaterThan(0);
  expect(redSubPhase.attacks.map((attack) => attack.projectileId).sort()).toEqual(
    ["red-bomb-v1", "red-stinger-large-v1", "red-stinger-small"].sort(),
  );
  expect(redSubPhase.spawns).toHaveLength(1);
  expect(redSubPhase.spawns![0].archetypeId).toBe("red-killer-bee");
  expect(redSubPhase.spawns![0].despawnOnExit).toBe(true);

  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 1 });
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  expect(queen.invulnerableUntilSeconds).toBeGreaterThan(state.elapsedSeconds);
  const minions = state.enemies.filter((enemy) => enemy.spawnedByEnemyId === queen.id);
  expect(minions.length).toBe(redSubPhase.spawns![0].count);
  for (const minion of minions) expect(minion.archetypeId).toBe("red-killer-bee");

  const idle = { north: false, south: false, east: false, west: false };
  const observedProjectileIds = new Set<string>();
  for (let tick = 0; tick < 600; tick++) {
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    for (const shard of state.shards) observedProjectileIds.add(shard.projectileId);
  }
  for (const attack of redSubPhase.attacks)
    expect(observedProjectileIds.has(attack.projectileId)).toBe(true);
  expect(observedProjectileIds.has("red-killer-bee-stinger")).toBe(true);
});

// Step 23.4: phase 2's three colour sub-phases cycle red -> blue -> yellow ->
// red on their authored 10-second durations, each with its own attack set,
// minions, and despawn-on-exit of the previous colour's minions.
test("the Killer Bee Queen's phase 2 cycles its three colour sub-phases with their own minions", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  expect(archetype.phases[1].subPhases).toHaveLength(3);

  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 1 });
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  const idle = { north: false, south: false, east: false, west: false };
  const observedSubPhaseIndices: number[] = [queen.subPhaseIndex];
  const minionArchetypesBySubPhase = new Map<number, Set<string>>();
  const record = () => {
    const archetypesPresent = new Set(
      state.enemies
        .filter((enemy) => enemy.spawnedByEnemyId === queen.id)
        .map((enemy) => enemy.archetypeId),
    );
    minionArchetypesBySubPhase.set(queen.subPhaseIndex, archetypesPresent);
  };
  record();
  let previousSubPhaseIndex = queen.subPhaseIndex;
  for (let tick = 0; tick < 2000 && observedSubPhaseIndices.length < 4; tick++) {
    state.player.healthHp = PALADIN_STATS.healthHp;
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    if (queen.subPhaseIndex !== previousSubPhaseIndex) {
      observedSubPhaseIndices.push(queen.subPhaseIndex);
      previousSubPhaseIndex = queen.subPhaseIndex;
      record();
    }
  }
  expect(observedSubPhaseIndices).toEqual([0, 1, 2, 0]);
  expect(minionArchetypesBySubPhase.get(0)).toEqual(new Set(["red-killer-bee"]));
  expect(minionArchetypesBySubPhase.get(1)).toEqual(new Set(["blue-killer-bee"]));
  expect(minionArchetypesBySubPhase.get(2)).toEqual(new Set(["yellow-killer-bee"]));

  // The Killer Bees' own stinger rows differ from the Queen's same-named
  // stinger projectiles (step 23.4), not reused from her catalog entries.
  const redBee = projectileOf(queenConfig, "red-killer-bee-stinger");
  const queenRedStinger = projectileOf(queenConfig, "red-stinger-small");
  expect(redBee.damageHp).toBe(80);
  expect(redBee.speedTilesPerSecond).toBe(7);
  expect(queenRedStinger.damageHp).toBe(100);
  expect(queenRedStinger.speedTilesPerSecond).toBe(8.5);
});

// Step 23.5: phase 3's two blue ring attacks must counter-rotate (opposite
// clockwiseDegreesPerSecond signs), the first thing the step's prompt asks
// to prove.
test("the Killer Bee Queen's phase 3 fires two counter-rotating blue spirals", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase3 = archetype.phases[2];
  const blueRings = phase3.attacks.filter(
    (attack) => attack.projectileId === "blue-ball-v2",
  );
  expect(blueRings).toHaveLength(2);
  const rates = blueRings.map((attack) => {
    if (attack.pattern.kind !== "ring") throw new Error("expected ring");
    return attack.pattern.clockwiseDegreesPerSecond;
  });
  expect(rates[0]).toBeGreaterThan(0);
  expect(rates[1]).toBeLessThan(0);
  expect(Math.abs(rates[0])).toBe(Math.abs(rates[1]));
});

// Step 23.5: the red ring has exactly two arms and rotates clockwise; the
// glaive wave fires at entry and then every 7 seconds exactly (the one
// sourced cadence this phase states); the eight-arm bomb ring lands on the
// eight compass bearings; phase 2's minions are gone on entry; the Queen
// arrives at the centre and stops; a 0-damage glaive still registers a hit
// and applies Armor Broken, which then changes a later hit's damage.
test("the Killer Bee Queen's phase 3 reproduces the source's six-attack barrage", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase3 = archetype.phases[2];
  expect(phase3.movement).toEqual({
    kind: "move-to-point",
    target: "arena-center",
    speedTilesPerSecond: 3,
  });

  const redRing = phase3.attacks.find(
    (attack) => attack.projectileId === "red-ball",
  )!;
  if (redRing.pattern.kind !== "ring") throw new Error("expected ring");
  expect(redRing.pattern.arms).toBe(2);
  expect(redRing.pattern.clockwiseDegreesPerSecond).toBeGreaterThan(0);

  const yellowRing = phase3.attacks.find(
    (attack) => attack.projectileId === "yellow-ball-v1",
  )!;
  expect(yellowRing.cadence.cooldownAfterLastShotSeconds).toBeLessThan(2);

  const beeRing = phase3.attacks.find(
    (attack) => attack.projectileId === "bee-shot",
  )!;
  if (beeRing.pattern.kind !== "ring") throw new Error("expected ring");
  expect(beeRing.pattern.arms).toBe(4);
  expect(beeRing.cadence.cooldownAfterLastShotSeconds).toBeGreaterThan(4);

  const bombRing = phase3.attacks.find(
    (attack) => attack.projectileId === "white-bomb-v1",
  )!;
  if (bombRing.pattern.kind !== "ring") throw new Error("expected ring");
  expect(bombRing.pattern.arms).toBe(8);

  const glaiveRing = phase3.attacks.find(
    (attack) => attack.projectileId === "red-glaive-v1",
  )!;
  if (glaiveRing.pattern.kind !== "ring") throw new Error("expected ring");
  expect(glaiveRing.cadence.cooldownAfterLastShotSeconds).toBe(7);
  expect(glaiveRing.cadence.initialDelaySeconds).toBe(0);
  expect(glaiveRing.tuningSource).toBe("wiki-prose");
  const glaiveProjectile = projectileOf(queenConfig, "red-glaive-v1");
  expect(glaiveProjectile.damageHp).toBe(0);
  expect(glaiveProjectile.conditions).toEqual([
    { key: "armorBroken", seconds: 7 },
  ]);

  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 2 });
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  expect(
    state.enemies.some((enemy) => enemy.spawnedByEnemyId === queen.id),
  ).toBe(false);

  state.debugSettings = { ...state.debugSettings, godMode: true };
  const idle = { north: false, south: false, east: false, west: false };
  for (let tick = 0; tick < 600; tick++)
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
  expect(queen.positionTiles.x).toBeCloseTo(0, 0);
  expect(queen.positionTiles.y).toBeCloseTo(0, 0);
  state.debugSettings = { ...state.debugSettings, godMode: false };
  state.player.healthHp = PALADIN_STATS.healthHp;

  const defenseBefore = effectiveDefenseFor(state.player, false);
  expect(defenseBefore).toBeGreaterThan(0);
  const glaiveHitDamageHp = applyPlayerHit(
    state.player,
    glaiveProjectile.damageHp,
    defenseBefore,
    false,
  );
  expect(glaiveHitDamageHp).toBe(0);
  applyConditions(state.player, glaiveProjectile.conditions);
  expect(hasCondition(state.player, "armorBroken")).toBe(true);
  const damageHp = applyPlayerHit(
    state.player,
    100,
    effectiveDefenseFor(state.player, false),
    false,
  );
  expect(damageHp).toBe(100);
});

// Step 23.6: phase 4's three glaive rings fire at different phases and must
// never realign - the step's own first check.
test("the Killer Bee Queen's phase 4 fires three non-realigning glaive rings", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase4 = archetype.phases[3];
  const rings = ["yellow-glaive-v1", "red-glaive-v2", "blue-glaive-v1"].map(
    (projectileId) =>
      phase4.attacks.find((attack) => attack.projectileId === projectileId)!,
  );
  for (const ring of rings) {
    expect(ring.pattern.kind).toBe("ring");
    if (ring.pattern.kind !== "ring") throw new Error("expected ring");
    expect(ring.pattern.arms).toBe(4);
    expect(ring.pattern.perBurstAdvanceDegrees).toBeGreaterThan(0);
  }
  const initialPhases = rings.map((ring) => {
    if (ring.pattern.kind !== "ring") throw new Error("expected ring");
    return ring.pattern.initialPhaseRadians;
  });
  expect(new Set(initialPhases).size).toBe(3);

  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 3 });
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const idle = { north: false, south: false, east: false, west: false };
  const bearingSetsByProjectile = new Map<string, Set<number>[]>();
  for (const ring of rings) bearingSetsByProjectile.set(ring.projectileId, []);
  for (let tick = 0; tick < 12000; tick++) {
    const before = state.shards.length;
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    if (state.shards.length <= before) continue;
    for (const ring of rings) {
      const bearings = new Set(
        state.shards
          .filter((shard) => shard.projectileId === ring.projectileId)
          .map((shard) => Math.round(shard.orientationRadians * 1000)),
      );
      if (bearings.size > 0)
        bearingSetsByProjectile.get(ring.projectileId)!.push(bearings);
    }
  }
  for (const [, bearingSets] of bearingSetsByProjectile) {
    expect(bearingSets.length).toBeGreaterThanOrEqual(50);
    const distinctBearingSets = new Set(
      bearingSets.map((set) => [...set].sort().join(",")),
    );
    expect(distinctBearingSets.size).toBeGreaterThan(1);
  }
});

// Step 23.6: each glaive projectile matches its cited row; the Tips-sourced
// hive-shot shotgun deals exactly 600 against the Paladin's defence through
// the armour-piercing path; a paralysing yellow glaive immobilises for 0.8s.
test("the Killer Bee Queen's phase 4 reproduces its glaives and the Tips-sourced hive shotgun", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase4 = archetype.phases[3];

  const yellowGlaive = projectileOf(queenConfig, "yellow-glaive-v1");
  expect(yellowGlaive.damageHp).toBe(70);
  expect(yellowGlaive.conditions).toEqual([
    { key: "paralyzed", seconds: 0.8 },
    { key: "dazed", seconds: 3 },
  ]);

  const redGlaive = projectileOf(queenConfig, "red-glaive-v2");
  expect(redGlaive.damageHp).toBe(90);
  expect(redGlaive.armorPiercing).toBe(true);
  expect(redGlaive.conditions).toEqual([{ key: "armorBroken", seconds: 3 }]);

  const blueGlaive = projectileOf(queenConfig, "blue-glaive-v1");
  expect(blueGlaive.damageHp).toBe(80);
  expect(blueGlaive.conditions).toEqual([
    { key: "quiet", seconds: 2 },
    { key: "petStasis", seconds: 6 },
  ]);

  const hiveSpiralShot = projectileOf(queenConfig, "hive-spiral-shot-v1");
  expect(hiveSpiralShot.damageHp).toBe(200);
  expect(hiveSpiralShot.armorPiercing).toBe(true);
  const shotgun = phase4.attacks.find(
    (attack) => attack.projectileId === "hive-spiral-shot-v1",
  )!;
  if (shotgun.pattern.kind !== "spread") throw new Error("expected spread");
  expect(shotgun.pattern.shots).toBe(3);
  expect(shotgun.pattern.aim).toBe("player");

  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 3 });
  const defense = effectiveDefenseFor(state.player, hiveSpiralShot.armorPiercing);
  const totalDamageHp =
    applyPlayerHit(state.player, hiveSpiralShot.damageHp, defense, false)! *
    shotgun.pattern.shots;
  expect(totalDamageHp).toBe(600);

  state.player.healthHp = PALADIN_STATS.healthHp;
  applyConditions(state.player, yellowGlaive.conditions);
  expect(hasCondition(state.player, "paralyzed")).toBe(true);

  expect(phase4.movement).toEqual({
    kind: "orbit",
    radiusTiles: 5,
    degreesPerSecond: 15,
    direction: "ccw",
    approachSpeedTilesPerSecond: 3,
  });
});

// Step 23.6: a player who holds range beyond every phase-4 projectile's
// lifetime - the Queen orbits radius 5 at the centre, every glaive and the
// hive-shot shotgun has a range under 11 tiles - survives the whole phase.
// A stationary player at the centre, by contrast, takes real damage.
test("the Killer Bee Queen's phase 4 is survivable at range and damaging up close", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const idle = { north: false, south: false, east: false, west: false };

  const distantState = createSimulation(queenConfig, 1, { startPhaseIndex: 3 });
  distantState.player.positionTiles = { x: 18, y: 0 };
  for (let tick = 0; tick < 2700; tick++) {
    advanceSimulation(distantState, queenConfig.simulation.fixedStepSeconds, idle);
    if (distantState.enemies[0]?.phaseIndex !== 3) break;
  }
  expect(distantState.player.healthHp).toBe(PALADIN_STATS.healthHp);

  const closeState = createSimulation(queenConfig, 1, { startPhaseIndex: 3 });
  for (let tick = 0; tick < 600; tick++)
    advanceSimulation(closeState, queenConfig.simulation.fixedStepSeconds, idle);
  expect(closeState.player.healthHp).toBeLessThan(PALADIN_STATS.healthHp);
});

// Step 23.7: the red sub-phase's hive shotgun is the step's own first check -
// a three-shot player-aimed spread of hive-spiral-shot-v1, reused from 23.6.
test("the Killer Bee Queen's phase 5 red sub-phase fires the hive spiral shotgun", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase5 = archetype.phases[4];
  const redSubPhase = phase5.subPhases![0];
  expect(redSubPhase.id).toBe("red");
  const shotgun = redSubPhase.attacks.find(
    (attack) => attack.projectileId === "hive-spiral-shot-v1",
  )!;
  if (shotgun.pattern.kind !== "spread") throw new Error("expected spread");
  expect(shotgun.pattern.shots).toBe(3);
  expect(shotgun.pattern.aim).toBe("player");
});

// Step 23.7: each new projectile matches its cited row.
test("the Killer Bee Queen's phase 5 new projectiles match their cited rows", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const hiveRangeShot = projectileOf(queenConfig, "hive-range-shot-v1");
  expect(hiveRangeShot.damageHp).toBe(120);
  expect(hiveRangeShot.conditions).toEqual([
    { key: "petStasis", seconds: 5 },
    { key: "weak", seconds: 3 },
  ]);

  const hiveShot = projectileOf(queenConfig, "hive-shot-v1");
  expect(hiveShot.damageHp).toBe(150);
  expect(hiveShot.conditions).toEqual([{ key: "dazed", seconds: 3 }]);

  const blueStingerSmallV2 = projectileOf(queenConfig, "blue-stinger-small-v2");
  expect(blueStingerSmallV2.damageHp).toBe(100);
  expect(blueStingerSmallV2.conditions).toEqual([
    { key: "silenced", seconds: 4 },
  ]);

  const blueBallV3 = projectileOf(queenConfig, "blue-ball-v3");
  expect(blueBallV3.damageHp).toBe(90);
  expect(blueBallV3.armorPiercing).toBe(true);
  expect(blueBallV3.conditions).toEqual([{ key: "petStasis", seconds: 4 }]);

  const redStingerLargeV2 = projectileOf(queenConfig, "red-stinger-large-v2");
  expect(redStingerLargeV2.damageHp).toBe(130);
  expect(redStingerLargeV2.armorPiercing).toBe(true);
  expect(redStingerLargeV2.conditions).toEqual([
    { key: "exposed", seconds: 4 },
  ]);
});

// Step 23.7: all three sub-phases cycle with their own movement - orbit,
// chase and wander - and their own attack sets; Killer Bees spawn per
// sub-phase; the blue 360-degree scatter covers the circle; the wander
// movement stays inside its radius and is seed-reproducible.
test("the Killer Bee Queen's phase 5 cycles three sub-phases with movement, attacks and minions", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase5 = archetype.phases[4];
  const [red, blue, yellow] = phase5.subPhases!;

  expect(red.movement).toEqual({
    kind: "orbit",
    radiusTiles: 3,
    degreesPerSecond: 30,
    direction: "cw",
    approachSpeedTilesPerSecond: 3,
  });
  expect(blue.movement).toEqual({ kind: "chase", speedTilesPerSecond: 3 });
  expect(yellow.movement).toEqual({
    kind: "wander",
    speedTilesPerSecond: 2,
    retargetSeconds: 3,
    radiusTiles: 4,
  });
  expect(red.attacks.length).toBeGreaterThan(0);
  expect(blue.attacks.length).toBeGreaterThan(0);
  expect(yellow.attacks.length).toBeGreaterThan(0);
  expect(red.spawns![0].archetypeId).toBe("red-killer-bee");
  expect(blue.spawns![0].archetypeId).toBe("blue-killer-bee");
  expect(yellow.spawns![0].archetypeId).toBe("yellow-killer-bee");

  const idle = { north: false, south: false, east: false, west: false };
  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 4 });
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  expect(queen.subPhaseIndex).toBe(0);
  expect(
    state.enemies.some((enemy) => enemy.spawnedByEnemyId === queen.id),
  ).toBe(true);

  for (let tick = 0; tick < 960; tick++)
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
  expect(queen.subPhaseIndex).toBe(1);

  const bearings = new Set<number>();
  for (let tick = 0; tick < 300; tick++) {
    const before = state.shards.length;
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    if (state.shards.length <= before) continue;
    for (const shard of state.shards)
      if (shard.projectileId === "blue-ball-v3")
        bearings.add(Math.round((shard.orientationRadians * 180) / Math.PI));
  }
  expect(bearings.size).toBeGreaterThan(8);

  for (let tick = 0; tick < 900; tick++)
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
  expect(queen.subPhaseIndex).toBe(2);
  expect(
    state.enemies.some((enemy) => enemy.spawnedByEnemyId === queen.id),
  ).toBe(true);

  const seedA = createSimulation(queenConfig, 7, {
    startPhaseIndex: 4,
    loopPhase: true,
  });
  const seedB = createSimulation(queenConfig, 7, {
    startPhaseIndex: 4,
    loopPhase: true,
  });
  for (let tick = 0; tick < 1900; tick++) {
    advanceSimulation(seedA, queenConfig.simulation.fixedStepSeconds, idle);
    advanceSimulation(seedB, queenConfig.simulation.fixedStepSeconds, idle);
  }
  const enemyA = seedA.enemies.find((e) => e.spawnedByEnemyId === null)!;
  const enemyB = seedB.enemies.find((e) => e.spawnedByEnemyId === null)!;
  expect(enemyA.wanderTargetTiles).toEqual(enemyB.wanderTargetTiles);
  if (enemyA.wanderTargetTiles) {
    const dx = enemyA.wanderTargetTiles.x;
    const dy = enemyA.wanderTargetTiles.y;
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(4 + 1e-6);
  }
});

// Step 23.7: a scripted dodge run survives all three sub-phases. The blue
// sub-phase chases, so standing at range is not enough (unlike phase 4's
// orbiting one); the player must keep running away from the Queen's current
// position every tick, which the player's base speed (above every chase
// speed authored in this phase) always permits.
test("the Killer Bee Queen's phase 5 is survivable with correct play", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 4 });
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  state.player.positionTiles = { x: 17.5, y: 0 };
  // Strafe tangentially around the arena interior, well clear of its wall,
  // rather than fleeing straight away from the nearest threat: running
  // outward pins the player against the wall, where a chasing minion's
  // pursuit path is shorter than the player's along the boundary and can
  // catch up despite its lower top speed. The player's base speed exceeds
  // every chase speed authored in this phase, so circling at a fixed radius
  // keeps every threat at that same safe distance indefinitely.
  for (let tick = 0; tick < 2700; tick++) {
    if (queen.phaseIndex !== 4) break;
    const { x, y } = state.player.positionTiles;
    const tangentX = -y;
    const tangentY = x;
    const input = {
      north: tangentY < 0,
      south: tangentY > 0,
      east: tangentX > 0,
      west: tangentX < 0,
    };
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, input);
  }
  // Survives comfortably: the blue sub-phase's chase can land one graze
  // while closing in before the player's orbit stabilizes clear of its
  // range, but nothing close to lethal.
  expect(state.player.healthHp).toBeGreaterThan(PALADIN_STATS.healthHp * 0.9);
});

// Step 23.8: the machinegun's two arms start vertical (180 degrees apart,
// aimed at the room's top and bottom per the source) and the authored
// spread grows arm 1 away from arm 0 up to the 45-degree maximum over the
// first few seconds, then holds there.
test("the Killer Bee Queen's phase 6 machinegun starts vertical and spreads to 45 degrees then holds", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase6 = archetype.phases[5];
  const machinegun = phase6.attacks.find(
    (attack) => attack.projectileId === "red-stinger-small",
  )!;
  if (machinegun.pattern.kind !== "ring") throw new Error("expected ring");
  expect(machinegun.pattern.arms).toBe(2);
  expect(machinegun.pattern.gapSectorsDegrees).toHaveLength(2);
  expect(machinegun.pattern.maxArmSpreadDegrees).toBe(45);

  const baseContext: PatternContext = {
    enemyPositionTiles: { x: 0, y: 0 },
    playerPositionTiles: { x: 0, y: 0 },
    ringPhaseRadians: machinegun.pattern.initialPhaseRadians,
    volleyIndexInBurst: 0,
    burstsFired: 0,
    secondsSinceEpoch: 0,
  };
  const degreesBetweenArms = (context: PatternContext): number => {
    const bearings = resolveBearings(machinegun.pattern, context);
    const [arm0, arm1] = bearings.map((b) => (b.bearingRadians * 180) / Math.PI);
    return Math.abs(arm1 - arm0);
  };
  expect(degreesBetweenArms(baseContext)).toBeCloseTo(180, 5);
  expect(
    degreesBetweenArms({ ...baseContext, secondsSinceEpoch: 3 }),
  ).toBeCloseTo(225, 5);
  expect(
    degreesBetweenArms({ ...baseContext, secondsSinceEpoch: 60 }),
  ).toBeCloseTo(225, 5);
});

// Step 23.8: a player standing inside one of the two authored gap sectors
// for the whole 29 seconds takes no hits from the machinegun, while a
// player standing in the swept beam path is hit hard and quickly. Isolated
// from the phase's three Nests and their chasing Worker Bees, which are
// covered by their own dedicated tests below - this test is about the ring
// pattern itself.
test("the Killer Bee Queen's phase 6 machinegun is survivable in a gap and lethal in the beam", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const idle = { north: false, south: false, east: false, west: false };

  const safe = createSimulation(queenConfig, 1, { startPhaseIndex: 5 });
  const safeQueen = safe.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  // The Queen's move-to-point takes a few seconds to reach the centre from
  // her spawn point; place her there directly so the fixed safe bearing
  // below holds from the very first shot.
  safeQueen.positionTiles = { x: 0, y: 0 };
  safe.enemies = safe.enemies.filter((enemy) => enemy.spawnedByEnemyId === null);
  // Gap sector [90, 180] in the pattern's own frame (anchored at the 90
  // degree initial phase) covers world bearing [180, 270] - the room's
  // north-west quadrant, matching the source's "top-left" safe corner.
  safe.player.positionTiles = { x: -7, y: -7 };
  // Step 23.9 gave phase 7 real attacks, so this run must stop at the
  // phase 6/7 boundary rather than overshoot into it, unlike before.
  for (
    let tick = 0;
    tick < 2900 && safe.phase === "playing" && safeQueen.phaseIndex === 5;
    tick++
  )
    advanceSimulation(safe, queenConfig.simulation.fixedStepSeconds, idle);
  expect(safe.hitsTaken).toBe(0);
  expect(safe.player.healthHp).toBe(PALADIN_STATS.healthHp);

  const exposed = createSimulation(queenConfig, 1, { startPhaseIndex: 5 });
  const exposedQueen = exposed.enemies.find(
    (enemy) => enemy.spawnedByEnemyId === null,
  )!;
  exposedQueen.positionTiles = { x: 0, y: 0 };
  exposed.enemies = exposed.enemies.filter(
    (enemy) => enemy.spawnedByEnemyId === null,
  );
  // Due south of the Queen, well inside the beam's range and outside both
  // gaps - the arm fixed at the 90 degree initial phase sweeps straight
  // through it at t = 0.
  exposed.player.positionTiles = { x: 0, y: 8 };
  for (let tick = 0; tick < 300 && exposed.phase === "playing"; tick++)
    advanceSimulation(exposed, queenConfig.simulation.fixedStepSeconds, idle);
  expect(exposed.hitsTaken).toBeGreaterThan(0);
  expect(exposed.player.healthHp).toBeLessThan(PALADIN_STATS.healthHp * 0.5);
});

// Step 23.8: phase 6 runs exactly its authored 29 seconds at no health cost
// (K08's invulnerability pauses the drain) and spawns the three Nests, one
// per colour, placed on the arena ring.
test("the Killer Bee Queen's phase 6 runs 29 seconds at no health cost and spawns three Nests", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 5 });
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  const healthBeforePhase = queen.healthHp;
  const nests = state.enemies.filter(
    (enemy) => enemy.spawnedByEnemyId === queen.id,
  );
  expect(nests).toHaveLength(3);
  expect(
    new Set(nests.map((nest) => nest.archetypeId)),
  ).toEqual(
    new Set(["killer-bee-nest-red", "killer-bee-nest-blue", "killer-bee-nest-yellow"]),
  );

  const idle = { north: false, south: false, east: false, west: false };
  state.debugSettings = { ...state.debugSettings, godMode: true };
  let secondsAtPhaseExit = 0;
  for (let tick = 0; tick < 3200; tick++) {
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    if (queen.phaseIndex !== 5) {
      secondsAtPhaseExit = state.elapsedSeconds;
      break;
    }
  }
  expect(secondsAtPhaseExit).toBeCloseTo(29, 1);
  expect(queen.phaseIndex).toBe(6);
  // K08: invulnerability pauses the drain for the phase's own 29 seconds;
  // only the single fixed step straddling the exact exit boundary can drain,
  // negligible next to the Queen's total health pool.
  expect((healthBeforePhase ?? 0) - (queen.healthHp ?? 0)).toBeLessThanOrEqual(
    375 * queenConfig.simulation.fixedStepSeconds + 1e-6,
  );
  // The Nests despawnOnExit is false (K06): they survive the phase change.
  // Filtered to the Nest archetypes specifically, since step 23.9 gave
  // phase 7 its own direct spawns (the three Beehemoths) that now also
  // carry spawnedByEnemyId === queen.id from this same transition.
  expect(
    state.enemies.filter((enemy) =>
      enemy.archetypeId.startsWith("killer-bee-nest-"),
    ),
  ).toHaveLength(3);
});

// Step 23.8 (K18): each Nest starts in its "alive" phase firing its colour's
// Hive Shot and spawning Small Worker Bees, then transitions to its
// "corpse" phase on its own 29-second duration, firing its colour's ball
// instead - an entirely different, non-Queen attack row.
test("each Killer Bee Nest transitions from its alive phase to its corpse phase with its own attack rows", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 5 });
  const redNest = state.enemies.find(
    (enemy) => enemy.archetypeId === "killer-bee-nest-red",
  )!;
  expect(redNest.phaseIndex).toBe(0);

  const redHiveShot = projectileOf(queenConfig, "nest-hive-spiral-shot-red");
  expect(redHiveShot.damageHp).toBe(100);
  expect(redHiveShot.armorPiercing).toBe(true);
  const redBall = projectileOf(queenConfig, "nest-red-ball");
  expect(redBall.damageHp).toBe(45);
  expect(redBall.conditions).toEqual([{ key: "cursed", seconds: 2 }]);
  // Not the Queen's own same-named rows.
  const queenHiveSpiralShot = projectileOf(queenConfig, "hive-spiral-shot-v1");
  expect(queenHiveSpiralShot.damageHp).not.toBe(redHiveShot.damageHp);

  const idle = { north: false, south: false, east: false, west: false };
  state.debugSettings = { ...state.debugSettings, godMode: true };
  for (let tick = 0; tick < 2900 && redNest.phaseIndex === 0; tick++)
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
  expect(redNest.phaseIndex).toBe(1);

  // Worker Bees spawned from the alive Nest, chase, and only ever deal
  // damage by contact (step 21.5/K17), never through a projectile.
  const workerBees = state.enemies.filter(
    (enemy) => enemy.spawnedByEnemyId === redNest.id,
  );
  expect(workerBees.length).toBeGreaterThan(0);
  const workerArchetype = archetypeOf(queenConfig, "small-worker-bee");
  expect(workerArchetype.phases[0].attacks).toHaveLength(0);
  expect(workerArchetype.contactDamageHp).toBe(40);
  expect(workerArchetype.contactArmorPiercing).toBe(true);
  expect(workerArchetype.contactConditions).toEqual([
    { key: "slowed", seconds: 1.6 },
  ]);
  expect(workerArchetype.phases[0].movement).toEqual({
    kind: "chase",
    speedTilesPerSecond: 4,
  });

  // The minion cap holds: it was raised from 8 to 12 in step 23.9 because
  // phase 7's three Beehemoths spawn on top of the three Nests and up to
  // six still-living Worker Bees (K06/no player attacks mean nothing here
  // ever dies to free a slot), which would otherwise permanently suppress
  // the Beehemoths. The cap still suppresses rather than queues or crashes.
  const totalMinions = state.enemies.filter(
    (enemy) => enemy.spawnedByEnemyId !== null,
  ).length;
  expect(totalMinions).toBeLessThanOrEqual(queenConfig.maxConcurrentMinions);
  expect(totalMinions).toBeGreaterThanOrEqual(1 + 3 + workerBees.length);
});

// Step 23.9: the yellow sub-phase's "4 White Bombs... at a 15
// degree-increasing angle each time" is the sourced number in this phase,
// expressed with step 20.5's perBurstAdvanceDegrees - the advance
// accumulates per burst (4 shots in one burst), not per shot.
test("the Killer Bee Queen's phase 7 yellow sub-phase advances its bomb ring 15 degrees per burst", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase7 = archetype.phases[6];
  const yellowSubPhase = phase7.subPhases!.find(
    (subPhase) => subPhase.id === "yellow",
  )!;
  const bombAttack = yellowSubPhase.attacks.find(
    (attack) => attack.projectileId === "white-bomb-v2",
  )!;
  expect(bombAttack.tuningSource).toBe("wiki-prose");
  if (bombAttack.pattern.kind !== "ring") throw new Error("expected ring");
  expect(bombAttack.pattern.arms).toBe(4);
  expect(bombAttack.pattern.perBurstAdvanceDegrees).toBe(15);

  const baseContext: PatternContext = {
    enemyPositionTiles: { x: 0, y: 0 },
    playerPositionTiles: { x: 0, y: 0 },
    ringPhaseRadians: bombAttack.pattern.initialPhaseRadians,
    volleyIndexInBurst: 0,
    burstsFired: 0,
    secondsSinceEpoch: 0,
  };
  const firstBearing = resolveBearings(bombAttack.pattern, baseContext)[0]
    .bearingRadians;
  const afterOneBurst = resolveBearings(bombAttack.pattern, {
    ...baseContext,
    burstsFired: 1,
  })[0].bearingRadians;
  const afterOneBurstTwoVolleys = resolveBearings(bombAttack.pattern, {
    ...baseContext,
    burstsFired: 1,
    volleyIndexInBurst: 3,
  })[0].bearingRadians;
  const degreesAdvanced =
    (((afterOneBurst - firstBearing) * 180) / Math.PI + 360) % 360;
  expect(degreesAdvanced).toBeCloseTo(15, 5);
  // Advancing within the same burst's four shots (volleyIndexInBurst) must
  // not add a second advance on top of the per-burst one.
  expect(afterOneBurstTwoVolleys).toBeCloseTo(afterOneBurst, 10);

  // The two yellow spirals rotate in opposite directions.
  const beeSpiral = yellowSubPhase.attacks.find(
    (attack) => attack.projectileId === "bee-shot",
  )!;
  const ballSpiral = yellowSubPhase.attacks.find(
    (attack) => attack.projectileId === "yellow-ball-v2",
  )!;
  if (beeSpiral.pattern.kind !== "ring" || ballSpiral.pattern.kind !== "ring")
    throw new Error("expected rings");
  expect(Math.sign(beeSpiral.pattern.clockwiseDegreesPerSecond)).not.toBe(
    Math.sign(ballSpiral.pattern.clockwiseDegreesPerSecond),
  );
});

// Step 23.9: the new projectiles match their cited rows, and the six new
// Beehemoth rows are distinct from the Queen's own same-named rows.
test("the Killer Bee Queen's phase 7 new projectiles match their cited rows", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  expect(projectileOf(queenConfig, "yellow-ball-v2").damageHp).toBe(90);
  expect(projectileOf(queenConfig, "yellow-ball-v2").conditions).toEqual([
    { key: "paralyzed", seconds: 0.6 },
  ]);
  const whiteBombV2 = projectileOf(queenConfig, "white-bomb-v2");
  expect(whiteBombV2.damageHp).toBe(120);
  expect(whiteBombV2.motion).toMatchObject({
    kind: "lob",
    detonationRadiusTiles: 3,
  });
  expect(projectileOf(queenConfig, "red-stinger-large-v3").damageHp).toBe(
    100,
  );
  const redBombV2 = projectileOf(queenConfig, "red-bomb-v2");
  expect(redBombV2.conditions).toEqual([
    { key: "armorBroken", seconds: 3 },
  ]);
  const blueBallV1 = projectileOf(queenConfig, "blue-ball-v1");
  expect(blueBallV1.damageHp).toBe(0);
  expect(blueBallV1.conditions).toEqual([
    { key: "petStasis", seconds: 3 },
  ]);

  const beehemothRedStinger = projectileOf(
    queenConfig,
    "beehemoth-red-stinger-large",
  );
  expect(beehemothRedStinger.damageHp).toBe(100);
  const queenRedStingerLargeV1 = projectileOf(queenConfig, "red-stinger-large-v1");
  expect(beehemothRedStinger.damageHp).not.toBe(queenRedStingerLargeV1.damageHp);
  expect(projectileOf(queenConfig, "beehemoth-yellow-glaive").conditions).toEqual(
    [{ key: "paralyzed", seconds: 0.8 }],
  );
});

// Step 23.9: phase 7's progression override is the encounter's own 375 HP/s
// minus the three Beehemoths healing the Queen 600 HP each every 10
// seconds (180 HP/s total), cited to the source's phase 7 Quantitative
// Facts row - a progression override, not new machinery.
test("the Killer Bee Queen's phase 7 drains at 195 HP per second, not 375", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase7 = archetype.phases[6];
  expect(phase7.progression).toEqual({
    kind: "simulated-dps",
    hpPerSecond: 195,
  });

  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 6 });
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  const healthBefore = queen.healthHp!;
  const idle = { north: false, south: false, east: false, west: false };
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const stepSeconds = queenConfig.simulation.fixedStepSeconds;
  const ticksForOneSecond = Math.round(1 / stepSeconds);
  for (let tick = 0; tick < ticksForOneSecond; tick++)
    advanceSimulation(state, stepSeconds, idle);
  expect(healthBefore - queen.healthHp!).toBeCloseTo(195, 0);
});

// Step 23.9: the three Beehemoths spawn at phase index 0 (the aimed-pairs
// behaviour; step 23.10 re-spawns them at index 1), fire their own
// transcribed stinger rows rather than the Queen's, and a yellow glaive -
// the only Beehemoth shot that paralyses - paralyses on hit. The
// broken-open Nests from phase 6 keep firing their corpse attack.
test("the Killer Bee Queen's phase 7 spawns the three Beehemoths firing aimed pairs, and the Nests persist", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 5 });
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const idle = { north: false, south: false, east: false, west: false };
  for (let tick = 0; tick < 3200 && queen.phaseIndex === 5; tick++)
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
  expect(queen.phaseIndex).toBe(6);
  const beehemoths = state.enemies.filter(
    (enemy) =>
      enemy.spawnedByEnemyId === queen.id &&
      enemy.archetypeId.startsWith("adolescent-"),
  );
  expect(
    new Set(beehemoths.map((beehemoth) => beehemoth.archetypeId)),
  ).toEqual(
    new Set([
      "adolescent-red-beehemoth",
      "adolescent-blue-beehemoth",
      "adolescent-yellow-beehemoth",
    ]),
  );
  for (const beehemoth of beehemoths) expect(beehemoth.phaseIndex).toBe(0);

  const redBeehemothArchetype = archetypeOf(
    queenConfig,
    "adolescent-red-beehemoth",
  );
  const pairedAttack = redBeehemothArchetype.phases[0].attacks[0];
  expect(pairedAttack.projectileId).toBe("beehemoth-red-stinger-large");
  if (pairedAttack.pattern.kind !== "spread")
    throw new Error("expected spread");
  expect(pairedAttack.pattern.shots).toBeGreaterThanOrEqual(2);

  const yellowGlaive = projectileOf(queenConfig, "beehemoth-yellow-glaive");
  applyConditions(state.player, yellowGlaive.conditions);
  expect(state.player.conditionSeconds.paralyzed).toBeCloseTo(0.8, 5);

  const nests = state.enemies.filter((enemy) =>
    enemy.archetypeId.startsWith("killer-bee-nest-"),
  );
  expect(nests).toHaveLength(3);
  for (let tick = 0; tick < 20; tick++)
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
  for (const nest of nests) expect(nest.phaseIndex).toBe(1);
});

// Step 23.10: phase 8 authors the one new projectile (row 22) and fires all
// seven listed/reused rows in no-rotation radial bursts; it uses the
// encounter's full drain rate (no progression override, unlike phase 7),
// implementing "cease healing the boss if her HP decreases further".
test("the Killer Bee Queen's phase 8 fires its seven radial bursts at the full drain rate", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase8 = archetype.phases[7];
  expect(phase8.progression).toBeNull();
  expect(
    phase8.attacks.map((attack) => attack.projectileId).sort(),
  ).toEqual(
    [
      "red-stinger-large-v2",
      "yellow-stinger-small-v2",
      "blue-ball-v2",
      "hive-range-shot-v1",
      "yellow-glaive-v1",
      "red-glaive-v2",
      "blue-glaive-v1",
    ].sort(),
  );
  for (const attack of phase8.attacks) {
    if (attack.pattern.kind !== "ring") throw new Error("expected ring");
    expect(attack.pattern.clockwiseDegreesPerSecond).toBe(0);
  }

  const newProjectile = projectileOf(queenConfig, "yellow-stinger-small-v2");
  expect(newProjectile.damageHp).toBe(100);
  expect(newProjectile.conditions).toEqual([
    { key: "paralyzed", seconds: 1.4 },
  ]);

  const state = createSimulation(queenConfig, 1, { startPhaseIndex: 7 });
  const queen = state.enemies.find((enemy) => enemy.spawnedByEnemyId === null)!;
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const idle = { north: false, south: false, east: false, west: false };
  const healthBefore = queen.healthHp!;
  const stepSeconds = queenConfig.simulation.fixedStepSeconds;
  const ticksForOneSecond = Math.round(1 / stepSeconds);
  for (let tick = 0; tick < ticksForOneSecond; tick++)
    advanceSimulation(state, stepSeconds, idle);
  expect(healthBefore - queen.healthHp!).toBeCloseTo(375, 0);

  const beehemoths = state.enemies.filter(
    (enemy) =>
      enemy.spawnedByEnemyId === queen.id &&
      enemy.archetypeId.startsWith("adolescent-"),
  );
  expect(beehemoths).toHaveLength(3);
  for (const beehemoth of beehemoths) expect(beehemoth.phaseIndex).toBe(1);
  const redBeehemothArchetype = archetypeOf(
    queenConfig,
    "adolescent-red-beehemoth",
  );
  const finalPhaseAttacks = redBeehemothArchetype.phases[1].attacks;
  expect(
    finalPhaseAttacks.some((attack) => attack.pattern.kind === "ring"),
  ).toBe(true);
  expect(
    finalPhaseAttacks.some((attack) => attack.pattern.kind === "spread"),
  ).toBe(true);
});

// Step 23.10: a full seeded run passes through all eight phases in order and
// reaches "cleared", with timings matching the derived timeline.
test("the Killer Bee Queen's full fight clears through all eight phases", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const state = createSimulation(queenConfig, 1);
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const enemy = state.enemies[0];
  const idle = { north: false, south: false, east: false, west: false };
  const observedPhaseIndices = new Set<number>([0]);
  for (let tick = 0; tick < 23000 && state.phase === "playing"; tick++) {
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    observedPhaseIndices.add(enemy.phaseIndex);
  }
  expect(state.phase).toBe("cleared");
  expect(observedPhaseIndices).toEqual(
    new Set([0, 1, 2, 3, 4, 5, 6, 7]),
  );
});

// Step 24.1: the derived encounter bound must never be exceeded by a real run.
test("the Killer Bee Queen's full fight never exceeds the derived live-shard bound", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const bound = liveShardBoundForEncounter(queenConfig);
  const state = createSimulation(queenConfig, 1);
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const idle = { north: false, south: false, east: false, west: false };
  let peakShards = 0;
  let peakEnemies = 0;
  for (let tick = 0; tick < 23000 && state.phase === "playing"; tick++) {
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
    peakShards = Math.max(peakShards, state.shards.length);
    peakEnemies = Math.max(peakEnemies, state.enemies.length);
  }
  expect(state.phase).toBe("cleared");
  expect(peakShards).toBeLessThanOrEqual(bound);
  expect(peakShards).toBeGreaterThan(0);
  console.log(
    `Queen full fight: peak shards ${peakShards} (bound ${bound}), peak enemies ${peakEnemies}, cleared at ${state.elapsedSeconds.toFixed(2)}s`,
  );
});

// Step 24.3: the same seed and input reproduce a full Queen fight
// identically (every scatter bearing, wander target and spawn placement)
// regardless of frame rate or whether frames arrive one fixed step at a
// time or batched up to `maxStepsPerUpdate`, mirroring the Crystal Worm's
// own cross-rate equivalence test in simulation.test.ts.
test("the Killer Bee Queen's full fight is deterministic across frame rates and step batching", () => {
  // Four full fights (~373s of simulated time each) run here sequentially.
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const idle = { north: false, south: false, east: false, west: false };
  const runToCleared = (
    advance: (state: ReturnType<typeof createSimulation>) => void,
  ) => {
    const state = createSimulation(queenConfig, 1);
    state.debugSettings = { ...state.debugSettings, godMode: true };
    for (let frame = 0; frame < 200_000 && state.phase === "playing"; frame++) {
      advance(state);
    }
    expect(state.phase).toBe("cleared");
    return state;
  };
  const stepSeconds = queenConfig.simulation.fixedStepSeconds;
  const reference = runToCleared((state) =>
    advanceSimulation(state, stepSeconds, idle),
  );
  for (const frameRate of [30, 120]) {
    const state = runToCleared((state) =>
      advanceSimulation(state, 1 / frameRate, idle),
    );
    expect(state).toEqual(reference);
  }
  const burstSeconds = queenConfig.simulation.maxStepsPerUpdate * stepSeconds;
  const burstState = runToCleared((state) =>
    advanceSimulation(state, burstSeconds, idle),
  );
  expect(burstState).toEqual(reference);
}, 30_000);

// Step 24.1: every fixed step advances alone here, so this cannot exercise
// the catch-up path; it only proves the densest phases never discard a
// step's worth of time when driven one `maxStepsPerUpdate`-sized burst at a
// time, which is the shape a slow frame produces in the browser.
test("a stalled frame during the densest phases catches up within maxStepsPerUpdate without discarding time", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  for (const startPhaseIndex of [2, 5]) {
    const state = createSimulation(queenConfig, 1, {
      startPhaseIndex,
      loopPhase: true,
    });
    state.debugSettings = { ...state.debugSettings, godMode: true };
    const idle = { north: false, south: false, east: false, west: false };
    const stepSeconds = queenConfig.simulation.fixedStepSeconds;
    const stalledFrameSeconds =
      queenConfig.simulation.maxStepsPerUpdate * stepSeconds;
    for (let frame = 0; frame < Math.round(60 / stalledFrameSeconds); frame++) {
      const result = advanceSimulation(state, stalledFrameSeconds, idle);
      expect(result.discardedSeconds).toBe(0);
    }
  }
});

// Step 24.1: the two densest phases drilled in isolation for 60s.
for (const [phase, label] of [[2, "phase 3"], [5, "phase 6"]] as const) {
  test(`drilling ${label} for 60s never exceeds the derived live-shard bound`, () => {
    const queenConfig = encounterConfigOf("killer-bee-queen");
    const bound = liveShardBoundForEncounter(queenConfig);
    const state = createSimulation(queenConfig, 1, {
      startPhaseIndex: phase,
      loopPhase: true,
    });
    state.debugSettings = { ...state.debugSettings, godMode: true };
    const idle = { north: false, south: false, east: false, west: false };
    const ticks = Math.round(60 / queenConfig.simulation.fixedStepSeconds);
    let peakShards = 0;
    for (let tick = 0; tick < ticks; tick++) {
      advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
      peakShards = Math.max(peakShards, state.shards.length);
    }
    expect(peakShards).toBeLessThanOrEqual(bound);
    console.log(`Drilling ${label} for 60s: peak shards ${peakShards} (bound ${bound})`);
  });
}

// Step 24.2: a player who flees the nearest threat, sliding tangentially
// along the wall once pushed near it (the same shape phase 5's own 23.7
// survivability test uses, with hysteresis so the two modes do not cancel
// each other out tick to tick), survives a phase whose Queen orbits or
// holds at distance; one who stands still does not.
function fleeNearestThreat(
  state: ReturnType<typeof createSimulation>,
  stepSeconds: number,
  ticks: number,
  phaseIndex: number,
) {
  const enemy = state.enemies.find((e) => e.spawnedByEnemyId === null)!;
  let tangentMode = false;
  for (let tick = 0; tick < ticks; tick++) {
    if (state.phase !== "playing" || enemy.phaseIndex !== phaseIndex) break;
    const { x, y } = state.player.positionTiles;
    const r = Math.hypot(x, y);
    if (r > 18) tangentMode = true;
    else if (r < 15) tangentMode = false;
    let dx: number;
    let dy: number;
    if (tangentMode) {
      dx = -y;
      dy = x;
    } else {
      let nearestDistance = Infinity;
      let nearestX = 0;
      let nearestY = 0;
      for (const other of state.enemies) {
        const distance = Math.hypot(
          other.positionTiles.x - x,
          other.positionTiles.y - y,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestX = other.positionTiles.x;
          nearestY = other.positionTiles.y;
        }
      }
      dx = x - nearestX;
      dy = y - nearestY;
    }
    const input = {
      north: dy < 0,
      south: dy > 0,
      east: dx > 0,
      west: dx < 0,
    };
    advanceSimulation(state, stepSeconds, input);
  }
}

test("the Killer Bee Queen's phase 1 is survivable with correct movement and damaging when stationary", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const idle = { north: false, south: false, east: false, west: false };

  const moving = createSimulation(queenConfig, 1);
  moving.player.positionTiles = { x: 16, y: 0 };
  fleeNearestThreat(moving, queenConfig.simulation.fixedStepSeconds, 2700, 0);
  expect(moving.player.healthHp).toBeGreaterThan(PALADIN_STATS.healthHp * 0.5);

  const stationary = createSimulation(queenConfig, 1);
  for (let tick = 0; tick < 600; tick++)
    advanceSimulation(stationary, queenConfig.simulation.fixedStepSeconds, idle);
  expect(stationary.player.healthHp).toBeLessThan(PALADIN_STATS.healthHp);
});

test("the Killer Bee Queen's phase 3 is survivable at range and damaging up close", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const idle = { north: false, south: false, east: false, west: false };

  const distantState = createSimulation(queenConfig, 1, { startPhaseIndex: 2 });
  distantState.player.positionTiles = { x: 18, y: 0 };
  for (let tick = 0; tick < 2700; tick++) {
    advanceSimulation(distantState, queenConfig.simulation.fixedStepSeconds, idle);
    if (distantState.enemies[0]?.phaseIndex !== 2) break;
  }
  expect(distantState.player.healthHp).toBe(PALADIN_STATS.healthHp);

  const closeState = createSimulation(queenConfig, 1, { startPhaseIndex: 2 });
  for (let tick = 0; tick < 600; tick++)
    advanceSimulation(closeState, queenConfig.simulation.fixedStepSeconds, idle);
  expect(closeState.player.healthHp).toBeLessThan(PALADIN_STATS.healthHp);
});

// Step 24.2 finding (not a feature, reported rather than fixed per the
// step's own prompt): phases 2, 7 and 8 stack several simultaneously-active
// attacks per sub-phase (up to four, each up to a 6-shot burst) on top of a
// chasing Queen and/or chasing minions. Every generic scripted dodge tried
// this step - tangential strafing at several radii, fleeing the nearest
// threat with wall hysteresis, fleeing the enemy centroid - dies to a
// stacked volley within 6-16 seconds, including at cadences close to their
// original (pre-24.2) values, so this is not a regression this step
// introduced. Demonstrating survivability for these three phases needs a
// bearing-aware dodge (reading each attack's actual angular gap, the way
// the phase 6 machinegun test already does) rather than a positional
// heuristic, which this step did not have the budget to build. Only the
// "damaging when stationary" half of each is asserted below; the
// "survivable with correct movement" half is left for a follow-up.
test("the Killer Bee Queen's phase 2 is damaging when stationary", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const idle = { north: false, south: false, east: false, west: false };
  const stationary = createSimulation(queenConfig, 1, { startPhaseIndex: 1 });
  for (let tick = 0; tick < 600; tick++)
    advanceSimulation(stationary, queenConfig.simulation.fixedStepSeconds, idle);
  expect(stationary.player.healthHp).toBeLessThan(PALADIN_STATS.healthHp);
});

test("the Killer Bee Queen's phase 7 is damaging when stationary", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const idle = { north: false, south: false, east: false, west: false };
  const stationary = createSimulation(queenConfig, 1, { startPhaseIndex: 6 });
  for (let tick = 0; tick < 900; tick++)
    advanceSimulation(stationary, queenConfig.simulation.fixedStepSeconds, idle);
  expect(stationary.player.healthHp).toBeLessThan(PALADIN_STATS.healthHp);
});

test("the Killer Bee Queen's phase 8 is damaging when stationary", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const idle = { north: false, south: false, east: false, west: false };
  const stationary = createSimulation(queenConfig, 1, { startPhaseIndex: 7 });
  for (let tick = 0; tick < 900; tick++)
    advanceSimulation(stationary, queenConfig.simulation.fixedStepSeconds, idle);
  expect(stationary.player.healthHp).toBeLessThan(PALADIN_STATS.healthHp);
});

// Step 24.2: the phase 6 machinegun's gap-survivability assertion (step 23.8)
// must still hold after tightening cadences elsewhere in the fight. Not a
// new test - a guard that the existing one above still exists and passes
// is enough, since this file runs it unmodified; this test instead checks
// that tightening did not change the gap geometry itself, which is what
// that assertion actually depends on.
test("the Killer Bee Queen's phase 6 machinegun gap geometry is unchanged by the 24.2 tuning pass", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);
  const phase6 = archetype.phases[5];
  const machinegun = phase6.attacks.find(
    (attack) => attack.projectileId === "red-stinger-small",
  )!;
  if (machinegun.pattern.kind !== "ring") throw new Error("expected ring");
  expect(machinegun.pattern.gapSectorsDegrees).toEqual([
    [90, 180],
    [270, 0],
  ]);
  expect(machinegun.pattern.maxArmSpreadDegrees).toBe(45);
});

// Step 24.2: every value whose provenance is "wiki-prose" or "approved-v3"
// must be untouched by this tuning pass. Checked against the source
// extract's own "Quantitative Facts Present In The Prose" table
// (docs/killer-bee-queen-source.md) for the two Queen attacks that carry a
// real sourced number, plus a spot check of sourced projectile stats that
// tuning never touches regardless of tuningSource.
test("the 24.2 tuning pass changed no wiki-prose or approved-v3 value", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const archetype = primaryArchetype(queenConfig);

  const phase3 = archetype.phases[2];
  const glaiveWave = phase3.attacks.find(
    (attack) => attack.projectileId === "red-glaive-v1",
  )!;
  expect(glaiveWave.tuningSource).toBe("wiki-prose");
  expect(glaiveWave.cadence.cooldownAfterLastShotSeconds).toBe(7);
  expect(glaiveWave.cadence.initialDelaySeconds).toBe(0);

  const phase7 = archetype.phases[6];
  const yellowSub = phase7.subPhases!.find((sub) => sub.id === "yellow")!;
  const bombAdvance = yellowSub.attacks.find(
    (attack) => attack.projectileId === "white-bomb-v2",
  )!;
  expect(bombAdvance.tuningSource).toBe("wiki-prose");
  if (bombAdvance.pattern.kind !== "ring") throw new Error("expected ring");
  expect(bombAdvance.pattern.perBurstAdvanceDegrees).toBe(15);

  // Sourced projectile stats this tuning pass never touches (23.6/23.7
  // assertions, repeated here as a regression guard specific to this step).
  const yellowGlaive = projectileOf(queenConfig, "yellow-glaive-v1");
  expect(yellowGlaive.damageHp).toBe(70);
  const hiveSpiralShot = projectileOf(queenConfig, "hive-spiral-shot-v1");
  expect(hiveSpiralShot.damageHp).toBe(200);
  expect(hiveSpiralShot.armorPiercing).toBe(true);
});

// Step 24.2 (K13/K04): the full fight's length is governed entirely by the
// HP-threshold progression and telegraph/invulnerability overhead, never by
// attack cadence - so tightening trainer-authored cadences must leave the
// measured full-fight length unchanged from step 24.1's reported 373.43s,
// confirming the length still lands where K15's 375 HP/second implies.
test("the Killer Bee Queen's full fight length is unchanged by the 24.2 cadence tuning", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const state = createSimulation(queenConfig, 1);
  state.debugSettings = { ...state.debugSettings, godMode: true };
  const idle = { north: false, south: false, east: false, west: false };
  for (let tick = 0; tick < 23000 && state.phase === "playing"; tick++)
    advanceSimulation(state, queenConfig.simulation.fixedStepSeconds, idle);
  expect(state.phase).toBe("cleared");
  expect(state.elapsedSeconds).toBeCloseTo(373.43, 0);
  console.log(
    `Queen full fight after 24.2 tuning: cleared at ${state.elapsedSeconds.toFixed(2)}s (24.1 baseline: 373.43s)`,
  );
});
