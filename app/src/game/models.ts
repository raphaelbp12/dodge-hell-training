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

export type EnemyState = {
  /** Instance identity, distinct from the archetype it was built from. */
  id: number;
  archetypeId: string;
  positionTiles: Vector2;
  emitterPhaseRadians: number;
  spawnedAtSeconds: number;
  // Attack and rotation clock. These were global SimulationState fields while
  // there was only ever one enemy; they have always been per-enemy state.
  attackEpochSeconds: number;
  volleysAtEpoch: number;
  attackInitialDelaySeconds: number;
  rotationEpochSeconds: number;
  rotationPhaseAtEpoch: number;
  volleysFired: number;
};

export type AcceptedHit = Readonly<{
  shardId: number;
  damageHp: number;
  positionTiles: Vector2;
}>;

export type ShardState = {
  id: number;
  /** Archetype that fired it; resolves its body for drawing and broadphase. */
  archetypeId: string;
  orientationRadians: number;
  positionTiles: Vector2;
  velocityTilesPerSecond: Vector2;
  ageSeconds: number;
  /** Captured at fire time, with reversal age and lifetime (G09). */
  damageHp: number;
  reversalAgeSeconds: number;
  lifetimeSeconds: number;
  hasReversed: boolean;
  hasHitPlayer: boolean;
};

export type SessionPhase =
  "home" | "countdown" | "playing" | "paused" | "ended";
