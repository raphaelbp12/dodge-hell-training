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
  positionTiles: Vector2;
  emitterPhaseRadians: number;
};

export type ShardState = {
  id: number;
  orientationRadians: number;
  positionTiles: Vector2;
  velocityTilesPerSecond: Vector2;
  ageSeconds: number;
  reversalAgeSeconds: number;
  lifetimeSeconds: number;
  hasReversed: boolean;
  hasHitPlayer: boolean;
};

export type SessionPhase =
  "home" | "countdown" | "playing" | "paused" | "ended";

export type SessionSnapshot = Readonly<{
  rulesVersion: string;
  phase: SessionPhase;
  elapsedSeconds: number;
  hitsTaken: number;
  player: Readonly<PlayerState>;
  enemy: Readonly<EnemyState>;
  shards: readonly Readonly<ShardState>[];
}>;
