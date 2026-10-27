import type {
  ConditionKey,
  PlayerState,
  SimulationInput,
} from "../models";
import {
  derivePlayerStats,
  PALADIN_DERIVED_STATS,
  PALADIN_STATS,
} from "../config/stats";

export type { ConditionKey } from "../models";

export const SLOWED_SPEED_TILES_PER_SECOND = derivePlayerStats({
  ...PALADIN_STATS,
  speed: 0,
}).speedTilesPerSecond;

export const ACTIVE_CONDITIONS = [
  "paralyzed",
  "slowed",
  "confused",
  "armorBroken",
  "exposed",
  "cursed",
  "sick",
] as const satisfies readonly ConditionKey[];

export const INERT_CONDITIONS = [
  "dazed",
  "silenced",
  "quiet",
  "weak",
  "unstable",
  "petStasis",
] as const satisfies readonly ConditionKey[];

export const CONDITION_KEYS = [
  ...ACTIVE_CONDITIONS,
  ...INERT_CONDITIONS,
] as const;

export type ConditionApplication = Readonly<{
  key: ConditionKey;
  seconds: number;
}>;

// The inert six are deliberately tracked: authored data remains faithful, the
// HUD can report what the live game would inflict, and promoting one later is
// a data change rather than a model change. They never change a trainer rule.
export function createConditionSeconds(): Record<ConditionKey, number> {
  return Object.fromEntries(
    CONDITION_KEYS.map((key) => [key, 0]),
  ) as Record<ConditionKey, number>;
}

export function applyConditions(
  player: PlayerState,
  conditions: readonly ConditionApplication[],
): void {
  for (const condition of conditions) {
    player.conditionSeconds[condition.key] = Math.max(
      player.conditionSeconds[condition.key],
      condition.seconds,
    );
  }
}

export function tickConditions(player: PlayerState, stepSeconds: number): void {
  for (const key of CONDITION_KEYS) {
    const remaining = player.conditionSeconds[key];
    const next = remaining - stepSeconds;
    // Treat only machine-precision residue as the exact expiry boundary; a
    // zero-second tick still leaves every positive duration untouched.
    const tolerance = Math.max(remaining, stepSeconds) * Number.EPSILON * 16;
    player.conditionSeconds[key] = next <= tolerance ? 0 : next;
  }
}

export function hasCondition(player: PlayerState, key: ConditionKey): boolean {
  return player.conditionSeconds[key] > 0;
}

export function effectiveInput(
  player: PlayerState,
  input: SimulationInput,
): SimulationInput {
  if (!hasCondition(player, "confused")) return input;
  return {
    north: input.east,
    east: input.north,
    south: input.west,
    west: input.south,
  };
}

export function playerTravelTiles(
  player: PlayerState,
  stepSeconds: number,
): number {
  const speedTilesPerSecond = hasCondition(player, "paralyzed")
    ? 0
    : hasCondition(player, "slowed")
      ? SLOWED_SPEED_TILES_PER_SECOND
      : PALADIN_DERIVED_STATS.speedTilesPerSecond;
  return speedTilesPerSecond * stepSeconds;
}
