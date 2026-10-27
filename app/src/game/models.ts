export type Vector2 = Readonly<{ x: number; y: number }>;

export type CircularArena = Readonly<{
  centerTiles: Vector2;
  radiusTiles: number;
}>;

export type PrimaryStats = Readonly<{
  healthHp: number;
  defense: number;
  speed: number;
  vitality: number;
}>;

export type DerivedPlayerStats = Readonly<{
  speedTilesPerSecond: number;
  regenerationHpPerSecond: number;
  inCombatRegenerationHpPerSecond: number;
  combatDurationSeconds: number;
  combatTriggerHp: number;
}>;

export type SimulationInput = Readonly<{
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}>;

export type PlayerState = {
  positionTiles: Vector2;
  healthHp: number;
  combatRemainingSeconds: number;
};

/**
 * Clock state for one attack of one enemy. These were global `SimulationState`
 * fields while there was only ever one enemy with one attack; they have
 * always been per-enemy, and are now per-attack within that enemy, state.
 */
export type AttackClockState = {
  attackId: string;
  epochSeconds: number;
  volleysAtEpoch: number;
  initialDelaySeconds: number;
  rotationEpochSeconds: number;
  rotationPhaseAtEpoch: number;
  ringPhaseRadians: number;
  volleysFired: number;
};

export type EnemyState = {
  /** Instance identity, distinct from the archetype it was built from. */
  id: number;
  archetypeId: string;
  positionTiles: Vector2;
  spawnedAtSeconds: number;
  /** One per authored attack of the archetype, in authored order. */
  attackClocks: AttackClockState[];
};

export type AcceptedHit = Readonly<{
  shardId: number;
  damageHp: number;
  positionTiles: Vector2;
}>;

export type ShardState = {
  id: number;
  /** Catalog projectile that fired it; resolves its body for drawing and broadphase. */
  projectileId: string;
  orientationRadians: number;
  positionTiles: Vector2;
  /** Only meaningful for the boomerang and linear kinds; turning and wavy derive position from the spawn pose instead. */
  velocityTilesPerSecond: Vector2;
  ageSeconds: number;
  /** Captured at fire time, with reversal age and lifetime (G09). */
  damageHp: number;
  reversalAgeSeconds: number;
  lifetimeSeconds: number;
  hasReversed: boolean;
  hasHitPlayer: boolean;
  /** Only meaningful for the turning and wavy kinds. */
  spawnPositionTiles: Vector2;
  spawnOrientationRadians: number;
  /** Only meaningful for the lob kind. */
  detonationTargetTiles: Vector2 | null;
};

export type SessionPhase =
  "home" | "countdown" | "playing" | "paused" | "ended";
