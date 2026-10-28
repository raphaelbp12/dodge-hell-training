export type ConditionKey =
  | "paralyzed"
  | "slowed"
  | "confused"
  | "armorBroken"
  | "exposed"
  | "cursed"
  | "sick"
  | "dazed"
  | "silenced"
  | "quiet"
  | "weak"
  | "unstable"
  | "petStasis";

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
  /** Remaining seconds per condition; 0 means not applied. */
  conditionSeconds: Record<ConditionKey, number>;
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
  /** Per-enemy contact cooldown clock (K17): contact repeats, unlike a shard's once-only hit. */
  nextContactEligibleSeconds: number;
  /** Closed-form orbit angle; unused and left at 0 by every other movement kind. */
  movementPhaseRadians: number;
  /** Only meaningful for the wander kind. */
  wanderTargetTiles: Vector2 | null;
  /** Only meaningful for the wander kind. */
  wanderRetargetAtSeconds: number;
  /** `null` for an archetype with no `health` block, e.g. the Crystal Worm. */
  healthHp: number | null;
  maxHealthHp: number | null;
  /** K08: while `elapsedSeconds` is below this, progression drain is suppressed. */
  invulnerableUntilSeconds: number;
  /** Index into the archetype's `phases`, monotonic outside drill mode (K09). */
  phaseIndex: number;
  phaseEnteredAtSeconds: number;
  /** Index into the active phase's `subPhases`; 0 and unused for a phase with none. */
  subPhaseIndex: number;
  subPhaseEnteredAtSeconds: number;
  /** Non-null for a minion created by a phase/sub-phase's `spawns` entry. */
  spawnedByEnemyId: number | null;
  /** Removed when `spawnedByEnemyId`'s owner leaves the phase or sub-phase that spawned it. */
  despawnOnExit: boolean;
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
