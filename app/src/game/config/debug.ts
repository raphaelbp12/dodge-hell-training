import {
  AUTHORED_TUNING,
  buildEncounterConfig,
  SELECTED_ENCOUNTER_VALUES,
  type EncounterConfig,
  validateEncounterConfig,
} from "./encounter";

export const DEBUG_RULES_VERSION = "crystal-worm-child-head-debug";
const minimumTimingGapSeconds = 0.05;

export const DEBUG_PARAMETERS = [
  {
    key: "enemySpeedTilesPerSecond",
    label: "Chase speed",
    unit: "tiles/s",
    group: "Enemy",
    min: 0,
    max: 12,
    step: 0.1,
    defaultValue: AUTHORED_TUNING.enemySpeedTilesPerSecond,
  },
  {
    key: "headWidth",
    label: "Head width",
    unit: "tiles",
    group: "Enemy",
    min: 0.5,
    max: 5,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.headWidth,
  },
  {
    key: "headHeight",
    label: "Head height",
    unit: "tiles",
    group: "Enemy",
    min: 0.5,
    max: 5,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.headHeight,
  },
  {
    key: "firstSpawnSeconds",
    label: "First spawn",
    unit: "s",
    group: "Spawns",
    min: 0,
    max: 60,
    step: 1,
    defaultValue: AUTHORED_TUNING.firstSpawnSeconds,
  },
  {
    key: "spawnEverySeconds",
    label: "Spawn interval",
    unit: "s",
    group: "Spawns",
    min: 1,
    max: 60,
    step: 1,
    defaultValue: AUTHORED_TUNING.spawnEverySeconds,
  },
  {
    key: "maxConcurrentEnemies",
    label: "Max concurrent",
    unit: "",
    group: "Spawns",
    min: 1,
    max: 8,
    step: 1,
    defaultValue: AUTHORED_TUNING.maxConcurrentEnemies,
  },
  {
    key: "spawnRingFraction",
    label: "Spawn ring",
    unit: "of radius",
    group: "Spawns",
    min: 0.1,
    max: 0.95,
    step: 0.00125,
    defaultValue: AUTHORED_TUNING.spawnRingFraction,
  },
  {
    key: "playerWidth",
    label: "Player width",
    unit: "tiles",
    group: "Player",
    min: 0.5,
    max: 5,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.playerWidth,
  },
  {
    key: "playerHeight",
    label: "Player height",
    unit: "tiles",
    group: "Player",
    min: 0.5,
    max: 5,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.playerHeight,
  },
  {
    key: "emitterCount",
    label: "Emitter count",
    unit: "",
    group: "Emitters",
    min: 1,
    max: 8,
    step: 1,
    defaultValue: AUTHORED_TUNING.emitterCount,
  },
  {
    key: "emitterRadiusTiles",
    label: "Emitter offset",
    unit: "tiles",
    group: "Emitters",
    min: 0,
    max: 3,
    step: 0.01,
    defaultValue: AUTHORED_TUNING.emitterRadiusTiles,
  },
  {
    key: "initialPhaseDegrees",
    label: "Emitter phase",
    unit: "deg",
    group: "Emitters",
    min: 0,
    max: 360,
    step: 1,
    defaultValue: AUTHORED_TUNING.initialPhaseDegrees,
  },
  {
    key: "rotationDegreesPerSecond",
    label: "Rotation speed",
    unit: "deg/s",
    group: "Emitters",
    min: -360,
    max: 360,
    step: 1,
    defaultValue: AUTHORED_TUNING.rotationDegreesPerSecond,
  },
  {
    key: "shotsPerEmitter",
    label: "Shots per burst",
    unit: "",
    group: "Burst",
    min: 1,
    max: 24,
    step: 1,
    defaultValue: AUTHORED_TUNING.shotsPerEmitter,
  },
  {
    key: "shotIntervalSeconds",
    label: "Shot interval",
    unit: "s",
    group: "Burst",
    min: 0.05,
    max: 1,
    step: 0.01,
    defaultValue: AUTHORED_TUNING.shotIntervalSeconds,
  },
  {
    key: "cooldownSeconds",
    label: "Burst cooldown",
    unit: "s",
    group: "Burst",
    min: 0.05,
    max: 5,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.cooldownSeconds,
  },
  {
    key: "initialCooldownSeconds",
    label: "Initial cooldown",
    unit: "s",
    group: "Burst",
    min: 0,
    max: 5,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.initialCooldownSeconds,
  },
  {
    key: "projectileDamageHp",
    label: "Projectile damage",
    unit: "HP",
    group: "Projectiles",
    min: 0,
    max: 1000,
    step: 1,
    defaultValue: AUTHORED_TUNING.projectileDamageHp,
  },
  {
    key: "projectileSpeedTilesPerSecond",
    label: "Projectile speed",
    unit: "tiles/s",
    group: "Projectiles",
    min: 0,
    max: 32,
    step: 0.1,
    defaultValue: AUTHORED_TUNING.projectileSpeedTilesPerSecond,
  },
  {
    key: "reversalSeconds",
    label: "Reversal age",
    unit: "s",
    group: "Projectiles",
    min: 0.05,
    max: 11.95,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.reversalSeconds,
  },
  {
    key: "lifetimeSeconds",
    label: "Projectile lifetime",
    unit: "s",
    group: "Projectiles",
    min: 0.1,
    max: 12,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.lifetimeSeconds,
  },
  {
    key: "projectileWidth",
    label: "Projectile width",
    unit: "tiles",
    group: "Projectiles",
    min: 0.1,
    max: 4,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.projectileWidth,
  },
  {
    key: "projectileHeight",
    label: "Projectile height",
    unit: "tiles",
    group: "Projectiles",
    min: 0.1,
    max: 4,
    step: 0.05,
    defaultValue: AUTHORED_TUNING.projectileHeight,
  },
] as const;

export const DEBUG_TOGGLES = [
  { key: "godMode", label: "God mode" },
  { key: "chaseArenaCenter", label: "Chase arena center" },
  { key: "matchPlayerToHead", label: "Match player to head" },
] as const satisfies readonly { key: string; label: string }[];

export type DebugToggleKey = (typeof DEBUG_TOGGLES)[number]["key"];

/** Parameter groups, in registry order, so a new group renders itself. */
export const DEBUG_GROUPS: readonly string[] = [
  ...new Set(DEBUG_PARAMETERS.map((parameter) => parameter.group)),
];

export type DebugParameterKey = (typeof DEBUG_PARAMETERS)[number]["key"];
export const SELECTED_DEBUG_VALUES =
  SELECTED_ENCOUNTER_VALUES satisfies Partial<
    Record<DebugParameterKey, number>
  >;

export type DebugSettings = Readonly<
  Record<DebugParameterKey, number> & Record<DebugToggleKey, boolean>
>;
export const DEFAULT_DEBUG_SETTINGS: DebugSettings = Object.freeze({
  ...Object.fromEntries(
    DEBUG_PARAMETERS.map((parameter) => [
      parameter.key,
      parameter.defaultValue,
    ]),
  ),
  godMode: false,
  chaseArenaCenter: false,
  matchPlayerToHead: true,
}) as DebugSettings;

export function isDefaultDebugSettings(settings: DebugSettings): boolean {
  return (
    !settings.godMode &&
    !settings.chaseArenaCenter &&
    settings.matchPlayerToHead === DEFAULT_DEBUG_SETTINGS.matchPlayerToHead &&
    DEBUG_PARAMETERS.every(
      (parameter) => settings[parameter.key] === parameter.defaultValue,
    )
  );
}

export function loadSelectedDebugValues(
  settings: DebugSettings,
): DebugSettings {
  const selected = {
    ...settings,
    ...SELECTED_DEBUG_VALUES,
    matchPlayerToHead: true,
  };
  validateDebugSettings(selected);
  return selected;
}

export function validateDebugSettings(settings: DebugSettings): void {
  for (const parameter of DEBUG_PARAMETERS) {
    const value = settings[parameter.key];
    if (
      !Number.isFinite(value) ||
      value < parameter.min ||
      value > parameter.max ||
      (parameter.step === 1 && !Number.isInteger(value))
    )
      throw new RangeError(`Invalid debug parameter: ${parameter.key}`);
  }
  if (
    typeof settings.godMode !== "boolean" ||
    typeof settings.chaseArenaCenter !== "boolean" ||
    typeof settings.matchPlayerToHead !== "boolean" ||
    settings.reversalSeconds >= settings.lifetimeSeconds
  )
    throw new RangeError("Invalid debug flags or projectile timing");
}

export function updateDebugParameter(
  settings: DebugSettings,
  key: DebugParameterKey,
  value: number,
): DebugSettings {
  const next = { ...settings, [key]: value };
  if (key === "reversalSeconds" && next.reversalSeconds >= next.lifetimeSeconds)
    next.lifetimeSeconds = next.reversalSeconds + minimumTimingGapSeconds;
  if (key === "lifetimeSeconds" && next.reversalSeconds >= next.lifetimeSeconds)
    next.reversalSeconds = next.lifetimeSeconds / 2;
  validateDebugSettings(next);
  return next;
}

export function debugEncounterConfig(settings: DebugSettings): EncounterConfig {
  validateDebugSettings(settings);
  const config = buildEncounterConfig(
    { spawnX: AUTHORED_TUNING.spawnX, spawnY: AUTHORED_TUNING.spawnY, ...settings },
    {
      rulesVersion: DEBUG_RULES_VERSION,
      matchPlayerToHead: settings.matchPlayerToHead,
    },
  );
  // The shipped path validates at module load; the debug path must too, so a
  // slider cannot reach the simulation in a state the config forbids (G: F3).
  validateEncounterConfig(config);
  return config;
}
