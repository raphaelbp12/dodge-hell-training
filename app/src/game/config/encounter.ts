import type { CircularArena, Vector2 } from '../models'
import { assertNonnegative, PALADIN_DERIVED_STATS } from './stats'

export type EncounterConfig = Readonly<{
  rulesVersion: string
  arena: CircularArena
  player: Readonly<{ spawnTiles: Vector2; colliderRadiusTiles: number }>
  enemy: Readonly<{
    spawnTiles: Vector2
    colliderRadiusTiles: number
    speedTilesPerSecond: number
    stopDistanceTiles: number
    contactDamageHp: 0
    blocksPlayer: false
  }>
  emitters: Readonly<{
    count: number
    radiusTiles: number
    initialPhaseRadians: number
    clockwiseDegreesPerSecond: number
    rotateDuringCooldown: true
  }>
  burst: Readonly<{
    shotsPerEmitter: number
    shotIntervalSeconds: number
    cooldownAfterLastShotSeconds: number
    initialCooldownSeconds: number
  }>
  shard: Readonly<{
    damageHp: number
    speedTilesPerSecond: number
    colliderRadiusTiles: number
    reversalAgeSeconds: number
    lifetimeSeconds: number
    expiration: 'lifetime-only'
    hitPolicy: 'once-per-shard'
  }>
  camera: Readonly<{
    cssPixelsPerTile: number
    defaultZoom: number
    minZoom: number
    maxZoom: number
    zoomStep: number
  }>
  session: Readonly<{
    startCountdownSeconds: number
    retryCountdownSeconds: number
    historyLimit: number
  }>
}>

export const RULES_VERSION = 'crystal-worm-child-head-paladin-v1'

export const ENCOUNTER_CONFIG = {
  rulesVersion: RULES_VERSION,
  arena: { centerTiles: { x: 0, y: 0 }, radiusTiles: 16 },
  player: { spawnTiles: { x: 0, y: 0 }, colliderRadiusTiles: 0.25 },
  enemy: {
    spawnTiles: { x: 0, y: -13 }, colliderRadiusTiles: 0.6,
    speedTilesPerSecond: 1.5, stopDistanceTiles: 1,
    contactDamageHp: 0, blocksPlayer: false,
  },
  emitters: {
    count: 4, radiusTiles: 0.75, initialPhaseRadians: 0,
    clockwiseDegreesPerSecond: 45, rotateDuringCooldown: true,
  },
  burst: {
    shotsPerEmitter: 4, shotIntervalSeconds: 0.15,
    cooldownAfterLastShotSeconds: 2, initialCooldownSeconds: 2,
  },
  shard: {
    damageHp: 160, speedTilesPerSecond: 8, colliderRadiusTiles: 0.15,
    reversalAgeSeconds: 1.2, lifetimeSeconds: 2.4,
    expiration: 'lifetime-only', hitPolicy: 'once-per-shard',
  },
  camera: { cssPixelsPerTile: 32, defaultZoom: 1, minZoom: 0.75, maxZoom: 1.5, zoomStep: 0.125 },
  session: { startCountdownSeconds: 3, retryCountdownSeconds: 0, historyLimit: 100 },
} as const satisfies EncounterConfig

function assertPositive(value: number, name: string): void {
  assertNonnegative(value, name)
  if (value === 0) throw new RangeError(`${name} must be positive`)
}

function validatePoint(point: Vector2): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError('Tile coordinates must be finite')
  }
}

export function validateEncounterConfig(config: EncounterConfig): void {
  if (config.rulesVersion.trim().length === 0) throw new RangeError('rulesVersion must not be empty')
  const positiveValues = {
    arenaRadiusTiles: config.arena.radiusTiles,
    playerColliderRadiusTiles: config.player.colliderRadiusTiles,
    enemyColliderRadiusTiles: config.enemy.colliderRadiusTiles,
    enemySpeedTilesPerSecond: config.enemy.speedTilesPerSecond,
    enemyStopDistanceTiles: config.enemy.stopDistanceTiles,
    emitterCount: config.emitters.count,
    emitterRadiusTiles: config.emitters.radiusTiles,
    clockwiseDegreesPerSecond: config.emitters.clockwiseDegreesPerSecond,
    shotsPerEmitter: config.burst.shotsPerEmitter,
    shotIntervalSeconds: config.burst.shotIntervalSeconds,
    cooldownAfterLastShotSeconds: config.burst.cooldownAfterLastShotSeconds,
    initialCooldownSeconds: config.burst.initialCooldownSeconds,
    shardDamageHp: config.shard.damageHp,
    shardSpeedTilesPerSecond: config.shard.speedTilesPerSecond,
    shardColliderRadiusTiles: config.shard.colliderRadiusTiles,
    reversalAgeSeconds: config.shard.reversalAgeSeconds,
    lifetimeSeconds: config.shard.lifetimeSeconds,
    cssPixelsPerTile: config.camera.cssPixelsPerTile,
    minZoom: config.camera.minZoom,
    maxZoom: config.camera.maxZoom,
    defaultZoom: config.camera.defaultZoom,
    zoomStep: config.camera.zoomStep,
    historyLimit: config.session.historyLimit,
  }
  for (const [name, value] of Object.entries(positiveValues)) assertPositive(value, name)
  for (const count of [config.emitters.count, config.burst.shotsPerEmitter, config.session.historyLimit]) {
    if (!Number.isSafeInteger(count)) throw new RangeError('Counts must be safe integers')
  }
  assertNonnegative(config.session.startCountdownSeconds, 'startCountdownSeconds')
  assertNonnegative(config.session.retryCountdownSeconds, 'retryCountdownSeconds')
  if (!Number.isFinite(config.emitters.initialPhaseRadians)) throw new RangeError('initialPhaseRadians must be finite')
  if (config.shard.reversalAgeSeconds >= config.shard.lifetimeSeconds) {
    throw new RangeError('Shard reversal must be strictly within its lifetime')
  }
  if (config.enemy.speedTilesPerSecond >= PALADIN_DERIVED_STATS.speedTilesPerSecond) {
    throw new RangeError('Enemy pursuit must be slower than the Paladin')
  }
  if (config.camera.minZoom > config.camera.maxZoom
    || config.camera.defaultZoom < config.camera.minZoom || config.camera.defaultZoom > config.camera.maxZoom) {
    throw new RangeError('Default zoom must be within ordered zoom bounds')
  }
  validatePoint(config.arena.centerTiles)
  for (const entity of [config.player, config.enemy]) {
    validatePoint(entity.spawnTiles)
    const distanceTiles = Math.hypot(entity.spawnTiles.x - config.arena.centerTiles.x,
      entity.spawnTiles.y - config.arena.centerTiles.y)
    if (distanceTiles + entity.colliderRadiusTiles > config.arena.radiusTiles) {
      throw new RangeError('Entity collision extent must spawn inside the arena')
    }
  }
}

validateEncounterConfig(ENCOUNTER_CONFIG)