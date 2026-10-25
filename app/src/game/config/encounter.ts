import type { CircularArena, Vector2 } from "../models";
import { assertNonnegative, PALADIN_DERIVED_STATS } from "./stats";
import { V2_GEOMETRY_CANDIDATE as geometry } from "./geometry-candidate";
import {
  convexBodyFitsCircle,
  transformBodyVertices,
} from "../simulation/geometry";

export type EncounterConfig = Readonly<{
  rulesVersion: string;
  simulation: Readonly<{
    fixedStepSeconds: number;
    maxStepsPerUpdate: number;
  }>;
  arena: CircularArena;
  player: Readonly<{ spawnTiles: Vector2; verticesTiles: readonly Vector2[] }>;
  enemy: Readonly<{
    spawnTiles: Vector2;
    verticesTiles: readonly Vector2[];
    speedTilesPerSecond: number;
    contactDamageHp: 0;
    blocksPlayer: false;
  }>;
  emitters: Readonly<{
    count: number;
    radiusTiles: number;
    initialPhaseRadians: number;
    clockwiseDegreesPerSecond: number;
    rotateDuringCooldown: true;
  }>;
  burst: Readonly<{
    shotsPerEmitter: number;
    shotIntervalSeconds: number;
    cooldownAfterLastShotSeconds: number;
    initialCooldownSeconds: number;
  }>;
  shard: Readonly<{
    damageHp: number;
    speedTilesPerSecond: number;
    verticesTiles: readonly Vector2[];
    reversalAgeSeconds: number;
    lifetimeSeconds: number;
    expiration: "lifetime-only";
    hitPolicy: "once-per-shard";
  }>;
  camera: Readonly<{
    cssPixelsPerTile: number;
    defaultZoom: number;
    minZoom: number;
    maxZoom: number;
    zoomStep: number;
  }>;
  session: Readonly<{
    startCountdownSeconds: number;
    retryCountdownSeconds: number;
    historyLimit: number;
  }>;
}>;

export const RULES_VERSION = "crystal-worm-child-head-paladin-v3";

export const SELECTED_ENCOUNTER_VALUES = Object.freeze({
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

export function scaleBody(
  vertices: readonly Vector2[],
  width: number,
  height: number,
): readonly Vector2[] {
  const sourceWidth =
    Math.max(...vertices.map((vertex) => vertex.x)) -
    Math.min(...vertices.map((vertex) => vertex.x));
  const sourceHeight =
    Math.max(...vertices.map((vertex) => vertex.y)) -
    Math.min(...vertices.map((vertex) => vertex.y));
  if (sourceWidth === width && sourceHeight === height) return vertices;
  return vertices.map((vertex) => ({
    x: (vertex.x / sourceWidth) * width,
    y: (vertex.y / sourceHeight) * height,
  }));
}

const selected = SELECTED_ENCOUNTER_VALUES;

export const ENCOUNTER_CONFIG = {
  rulesVersion: RULES_VERSION,
  simulation: { fixedStepSeconds: 1 / 60, maxStepsPerUpdate: 8 },
  arena: {
    centerTiles: { x: 0, y: 0 },
    radiusTiles: geometry.arenaRadiusTiles,
  },
  player: {
    spawnTiles: { x: 0, y: 0 },
    verticesTiles: scaleBody(
      geometry.bodies.player.verticesTiles,
      selected.enemyWidth,
      selected.enemyHeight,
    ),
  },
  enemy: {
    spawnTiles: geometry.enemySpawnTiles,
    verticesTiles: scaleBody(
      geometry.bodies.head.verticesTiles,
      selected.enemyWidth,
      selected.enemyHeight,
    ),
    speedTilesPerSecond: 1.5,
    contactDamageHp: 0,
    blocksPlayer: false,
  },
  emitters: {
    count: selected.emitterCount,
    radiusTiles: selected.emitterRadiusTiles,
    initialPhaseRadians: (selected.initialPhaseDegrees * Math.PI) / 180,
    clockwiseDegreesPerSecond: selected.rotationDegreesPerSecond,
    rotateDuringCooldown: true,
  },
  burst: {
    shotsPerEmitter: selected.shotsPerEmitter,
    shotIntervalSeconds: selected.shotIntervalSeconds,
    cooldownAfterLastShotSeconds: selected.cooldownSeconds,
    initialCooldownSeconds: selected.initialCooldownSeconds,
  },
  shard: {
    damageHp: selected.projectileDamageHp,
    speedTilesPerSecond: selected.projectileSpeedTilesPerSecond,
    verticesTiles: scaleBody(
      geometry.bodies.shard.verticesTiles,
      selected.projectileWidth,
      selected.projectileHeight,
    ),
    reversalAgeSeconds: selected.reversalSeconds,
    lifetimeSeconds: selected.lifetimeSeconds,
    expiration: "lifetime-only",
    hitPolicy: "once-per-shard",
  },
  camera: {
    cssPixelsPerTile: 32,
    defaultZoom: 1,
    minZoom: 0.25,
    maxZoom: 3,
    zoomStep: 0.125,
  },
  session: {
    startCountdownSeconds: 3,
    retryCountdownSeconds: 0,
    historyLimit: 100,
  },
} as const satisfies EncounterConfig;

function assertPositive(value: number, name: string): void {
  assertNonnegative(value, name);
  if (value === 0) throw new RangeError(`${name} must be positive`);
}

function validatePoint(point: Vector2): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError("Tile coordinates must be finite");
  }
}

export function validateEncounterConfig(config: EncounterConfig): void {
  if (config.rulesVersion.trim().length === 0)
    throw new RangeError("rulesVersion must not be empty");
  const positiveValues = {
    fixedStepSeconds: config.simulation.fixedStepSeconds,
    maxStepsPerUpdate: config.simulation.maxStepsPerUpdate,
    arenaRadiusTiles: config.arena.radiusTiles,
    enemySpeedTilesPerSecond: config.enemy.speedTilesPerSecond,
    emitterCount: config.emitters.count,
    clockwiseDegreesPerSecond: config.emitters.clockwiseDegreesPerSecond,
    shotsPerEmitter: config.burst.shotsPerEmitter,
    shotIntervalSeconds: config.burst.shotIntervalSeconds,
    cooldownAfterLastShotSeconds: config.burst.cooldownAfterLastShotSeconds,
    initialCooldownSeconds: config.burst.initialCooldownSeconds,
    shardDamageHp: config.shard.damageHp,
    shardSpeedTilesPerSecond: config.shard.speedTilesPerSecond,
    reversalAgeSeconds: config.shard.reversalAgeSeconds,
    lifetimeSeconds: config.shard.lifetimeSeconds,
    cssPixelsPerTile: config.camera.cssPixelsPerTile,
    minZoom: config.camera.minZoom,
    maxZoom: config.camera.maxZoom,
    defaultZoom: config.camera.defaultZoom,
    zoomStep: config.camera.zoomStep,
    historyLimit: config.session.historyLimit,
  };
  for (const [name, value] of Object.entries(positiveValues))
    assertPositive(value, name);
  assertNonnegative(config.emitters.radiusTiles, "emitterRadiusTiles");
  transformBodyVertices(config.shard.verticesTiles, { x: 0, y: 0 });
  for (const count of [
    config.simulation.maxStepsPerUpdate,
    config.emitters.count,
    config.burst.shotsPerEmitter,
    config.session.historyLimit,
  ]) {
    if (!Number.isSafeInteger(count))
      throw new RangeError("Counts must be safe integers");
  }
  assertNonnegative(
    config.session.startCountdownSeconds,
    "startCountdownSeconds",
  );
  assertNonnegative(
    config.session.retryCountdownSeconds,
    "retryCountdownSeconds",
  );
  if (!Number.isFinite(config.emitters.initialPhaseRadians))
    throw new RangeError("initialPhaseRadians must be finite");
  if (config.shard.reversalAgeSeconds >= config.shard.lifetimeSeconds) {
    throw new RangeError("Shard reversal must be strictly within its lifetime");
  }
  if (
    config.enemy.speedTilesPerSecond >=
    PALADIN_DERIVED_STATS.speedTilesPerSecond
  ) {
    throw new RangeError("Enemy pursuit must be slower than the Paladin");
  }
  if (
    config.camera.minZoom > config.camera.maxZoom ||
    config.camera.defaultZoom < config.camera.minZoom ||
    config.camera.defaultZoom > config.camera.maxZoom
  ) {
    throw new RangeError("Default zoom must be within ordered zoom bounds");
  }
  validatePoint(config.arena.centerTiles);
  for (const entity of [config.player, config.enemy]) {
    validatePoint(entity.spawnTiles);
    if (
      !convexBodyFitsCircle(
        transformBodyVertices(entity.verticesTiles, entity.spawnTiles),
        config.arena,
      )
    ) {
      throw new RangeError(
        "Entity collision extent must spawn inside the arena",
      );
    }
  }
}

validateEncounterConfig(ENCOUNTER_CONFIG);
