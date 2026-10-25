import {
  assertNonnegative,
  calculateDamageHp,
  PALADIN_DERIVED_STATS,
  PALADIN_STATS,
} from "../config/stats";
import type { PlayerState } from "../models";

export function applyPlayerHit(
  player: PlayerState,
  rawDamageHp: number,
): number | null {
  const damageHp = calculateDamageHp(rawDamageHp, PALADIN_STATS.defense);
  if (player.healthHp <= 0) return null;
  player.healthHp = Math.max(0, player.healthHp - damageHp);
  if (damageHp >= PALADIN_DERIVED_STATS.combatTriggerHp)
    player.combatRemainingSeconds = PALADIN_DERIVED_STATS.combatDurationSeconds;
  return damageHp;
}

export function regeneratePlayer(
  player: PlayerState,
  elapsedSeconds: number,
): void {
  assertNonnegative(elapsedSeconds, "elapsedSeconds");
  if (player.healthHp <= 0) return;
  const combatSeconds = Math.min(player.combatRemainingSeconds, elapsedSeconds);
  const normalSeconds = elapsedSeconds - combatSeconds;
  player.healthHp = Math.min(
    PALADIN_STATS.healthHp,
    player.healthHp +
      combatSeconds * PALADIN_DERIVED_STATS.inCombatRegenerationHpPerSecond +
      normalSeconds * PALADIN_DERIVED_STATS.regenerationHpPerSecond,
  );
  player.combatRemainingSeconds = Math.max(
    0,
    player.combatRemainingSeconds - elapsedSeconds,
  );
}
