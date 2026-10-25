import {
  ENCOUNTER_CONFIG,
  SELECTED_ENCOUNTER_VALUES,
  scaleBody,
  type EncounterConfig,
} from "./encounter";
import type { Vector2 } from "../models";

export const DEBUG_RULES_VERSION = "crystal-worm-child-head-debug";
const minimumTimingGapSeconds = 0.05;

function extent(vertices: readonly Vector2[], axis: "x" | "y"): number {
  return (
    Math.max(...vertices.map((vertex) => vertex[axis])) -
    Math.min(...vertices.map((vertex) => vertex[axis]))
  );
}

export const DEBUG_PARAMETERS = [
  {
    key: "enemySpeedTilesPerSecond",
    label: "Chase speed",
    unit: "tiles/s",
    group: "Enemy",
    min: 0,
    max: 12,
    step: 0.1,
    defaultValue: ENCOUNTER_CONFIG.enemy.speedTilesPerSecond,
  },
  {
    key: "spawnX",
    label: "Spawn X",
    unit: "tiles",
    group: "Enemy",
    min: -18,
    max: 18,
    step: 0.1,
    defaultValue: ENCOUNTER_CONFIG.enemy.spawnTiles.x,
  },
  {
    key: "spawnY",
    label: "Spawn Y",
    unit: "tiles",
    group: "Enemy",
    min: -18,
    max: 18,
    step: 0.1,
    defaultValue: ENCOUNTER_CONFIG.enemy.spawnTiles.y,
  },
  {
    key: "enemyWidth",
    label: "Head width",
    unit: "tiles",
    group: "Enemy",
    min: 0.5,
    max: 5,
    step: 0.05,
    defaultValue: extent(ENCOUNTER_CONFIG.enemy.verticesTiles, "x"),
  },
  {
    key: "enemyHeight",
    label: "Head height",
    unit: "tiles",
    group: "Enemy",
    min: 0.5,
    max: 5,
    step: 0.05,
    defaultValue: extent(ENCOUNTER_CONFIG.enemy.verticesTiles, "y"),
  },
  {
    key: "emitterCount",
    label: "Emitter count",
    unit: "",
    group: "Emitters",
    min: 1,
    max: 8,
    step: 1,
    defaultValue: ENCOUNTER_CONFIG.emitters.count,
  },
  {
    key: "emitterRadiusTiles",
    label: "Emitter offset",
    unit: "tiles",
    group: "Emitters",
    min: 0,
    max: 3,
    step: 0.01,
    defaultValue: ENCOUNTER_CONFIG.emitters.radiusTiles,
  },
  {
    key: "initialPhaseDegrees",
    label: "Emitter phase",
    unit: "deg",
    group: "Emitters",
    min: 0,
    max: 360,
    step: 1,
    defaultValue:
      (ENCOUNTER_CONFIG.emitters.initialPhaseRadians * 180) / Math.PI,
  },
  {
    key: "rotationDegreesPerSecond",
    label: "Rotation speed",
    unit: "deg/s",
    group: "Emitters",
    min: -360,
    max: 360,
    step: 1,
    defaultValue: ENCOUNTER_CONFIG.emitters.clockwiseDegreesPerSecond,
  },
  {
    key: "shotsPerEmitter",
    label: "Shots per burst",
    unit: "",
    group: "Burst",
    min: 1,
    max: 24,
    step: 1,
    defaultValue: ENCOUNTER_CONFIG.burst.shotsPerEmitter,
  },
  {
    key: "shotIntervalSeconds",
    label: "Shot interval",
    unit: "s",
    group: "Burst",
    min: 0.05,
    max: 1,
    step: 0.01,
    defaultValue: ENCOUNTER_CONFIG.burst.shotIntervalSeconds,
  },
  {
    key: "cooldownSeconds",
    label: "Burst cooldown",
    unit: "s",
    group: "Burst",
    min: 0.05,
    max: 5,
    step: 0.05,
    defaultValue: ENCOUNTER_CONFIG.burst.cooldownAfterLastShotSeconds,
  },
  {
    key: "initialCooldownSeconds",
    label: "Initial cooldown",
    unit: "s",
    group: "Burst",
    min: 0,
    max: 5,
    step: 0.05,
    defaultValue: ENCOUNTER_CONFIG.burst.initialCooldownSeconds,
  },
  {
    key: "projectileDamageHp",
    label: "Projectile damage",
    unit: "HP",
    group: "Projectiles",
    min: 0,
    max: 1000,
    step: 1,
    defaultValue: ENCOUNTER_CONFIG.shard.damageHp,
  },
  {
    key: "projectileSpeedTilesPerSecond",
    label: "Projectile speed",
    unit: "tiles/s",
    group: "Projectiles",
    min: 0,
    max: 32,
    step: 0.1,
    defaultValue: ENCOUNTER_CONFIG.shard.speedTilesPerSecond,
  },
  {
    key: "reversalSeconds",
    label: "Reversal age",
    unit: "s",
    group: "Projectiles",
    min: 0.05,
    max: 11.95,
    step: 0.05,
    defaultValue: ENCOUNTER_CONFIG.shard.reversalAgeSeconds,
  },
  {
    key: "lifetimeSeconds",
    label: "Projectile lifetime",
    unit: "s",
    group: "Projectiles",
    min: 0.1,
    max: 12,
    step: 0.05,
    defaultValue: ENCOUNTER_CONFIG.shard.lifetimeSeconds,
  },
  {
    key: "projectileWidth",
    label: "Projectile width",
    unit: "tiles",
    group: "Projectiles",
    min: 0.1,
    max: 4,
    step: 0.05,
    defaultValue: extent(ENCOUNTER_CONFIG.shard.verticesTiles, "x"),
  },
  {
    key: "projectileHeight",
    label: "Projectile height",
    unit: "tiles",
    group: "Projectiles",
    min: 0.1,
    max: 4,
    step: 0.05,
    defaultValue: extent(ENCOUNTER_CONFIG.shard.verticesTiles, "y"),
  },
] as const;

export type DebugParameterKey = (typeof DEBUG_PARAMETERS)[number]["key"];
export const SELECTED_DEBUG_VALUES =
  SELECTED_ENCOUNTER_VALUES satisfies Partial<
    Record<DebugParameterKey, number>
  >;

export type DebugSettings = Readonly<
  Record<DebugParameterKey, number> & {
    godMode: boolean;
    chaseArenaCenter: boolean;
    matchPlayerToHead: boolean;
  }
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
  return {
    ...ENCOUNTER_CONFIG,
    rulesVersion: DEBUG_RULES_VERSION,
    player: {
      ...ENCOUNTER_CONFIG.player,
      verticesTiles: settings.matchPlayerToHead
        ? scaleBody(
            ENCOUNTER_CONFIG.player.verticesTiles,
            settings.enemyWidth,
            settings.enemyHeight,
          )
        : ENCOUNTER_CONFIG.player.verticesTiles,
    },
    enemy: {
      ...ENCOUNTER_CONFIG.enemy,
      speedTilesPerSecond: settings.enemySpeedTilesPerSecond,
      spawnTiles: { x: settings.spawnX, y: settings.spawnY },
      verticesTiles: scaleBody(
        ENCOUNTER_CONFIG.enemy.verticesTiles,
        settings.enemyWidth,
        settings.enemyHeight,
      ),
    },
    emitters: {
      ...ENCOUNTER_CONFIG.emitters,
      count: settings.emitterCount,
      radiusTiles: settings.emitterRadiusTiles,
      initialPhaseRadians: (settings.initialPhaseDegrees * Math.PI) / 180,
      clockwiseDegreesPerSecond: settings.rotationDegreesPerSecond,
    },
    burst: {
      shotsPerEmitter: settings.shotsPerEmitter,
      shotIntervalSeconds: settings.shotIntervalSeconds,
      cooldownAfterLastShotSeconds: settings.cooldownSeconds,
      initialCooldownSeconds: settings.initialCooldownSeconds,
    },
    shard: {
      ...ENCOUNTER_CONFIG.shard,
      damageHp: settings.projectileDamageHp,
      speedTilesPerSecond: settings.projectileSpeedTilesPerSecond,
      reversalAgeSeconds: settings.reversalSeconds,
      lifetimeSeconds: settings.lifetimeSeconds,
      verticesTiles: scaleBody(
        ENCOUNTER_CONFIG.shard.verticesTiles,
        settings.projectileWidth,
        settings.projectileHeight,
      ),
    },
  };
}
