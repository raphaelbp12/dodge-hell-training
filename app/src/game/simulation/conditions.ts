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

export type VisibleCondition = Readonly<{
  key: ConditionKey;
  remainingSeconds: number;
  inert: boolean;
}>;

const INERT_CONDITION_SET = new Set<ConditionKey>(INERT_CONDITIONS);

/** Active-then-inert declaration order, so the HUD never jitters as durations change. */
export function visibleConditions(player: PlayerState): readonly VisibleCondition[] {
  return CONDITION_KEYS.filter((key) => hasCondition(player, key)).map((key) => ({
    key,
    remainingSeconds: player.conditionSeconds[key],
    inert: INERT_CONDITION_SET.has(key),
  }));
}

/** Short chip labels, shared by the HUD chip and the Controls dialog. */
export const CONDITION_LABELS: Record<ConditionKey, string> = {
  paralyzed: "Paralyzed",
  slowed: "Slowed",
  confused: "Confused",
  armorBroken: "Armor Broken",
  exposed: "Exposed",
  cursed: "Cursed",
  sick: "Sick",
  dazed: "Dazed",
  silenced: "Silenced",
  quiet: "Quiet",
  weak: "Weak",
  unstable: "Unstable",
  petStasis: "Pet Stasis",
};

/**
 * Published wording for the seven active conditions (realmeye.com/wiki/status-effects,
 * retrieved 2026-10-27); the inert six get a trainer note since they inflict no rule here.
 */
export const CONDITION_DESCRIPTIONS: Record<ConditionKey, string> = {
  paralyzed: "Renders entity completely immobile.",
  slowed:
    "Reduces player SPD to 0 during movement speed calculation, resulting in a base speed of 4 tiles/second.",
  confused:
    "Changes controls by swapping directional controls. Left > Down, Down > Left, Right > Up, Up > Right.",
  armorBroken:
    "Reduces affected entity's DEF stat to 0 during damage calculations.",
  exposed: "Reduces affected entity's DEF by 20 during damage calculations.",
  cursed:
    "Affected targets receive 25% more damage, calculated after defense and defense modifiers.",
  sick: "Stops natural HP regeneration and causes all forms of HP recovery to stop functioning.",
  dazed: "No effect in this trainer, because the player does not attack.",
  silenced: "No effect in this trainer, because the player does not attack.",
  quiet: "No effect in this trainer, because the player does not attack.",
  weak: "No effect in this trainer, because the player does not attack.",
  unstable: "No effect in this trainer, because the player does not attack.",
  petStasis: "No effect in this trainer, because the player does not attack.",
};

/** Sourced from the status-effects wiki page (Exposed: "+20 damage taken per hit"). */
export const EXPOSED_DEFENSE_PENALTY = 20;

export function effectiveDefenseFor(
  player: PlayerState,
  armorPiercing: boolean,
): number {
  let defense =
    armorPiercing || hasCondition(player, "armorBroken")
      ? 0
      : PALADIN_STATS.defense;
  if (hasCondition(player, "exposed")) defense -= EXPOSED_DEFENSE_PENALTY;
  return defense;
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
