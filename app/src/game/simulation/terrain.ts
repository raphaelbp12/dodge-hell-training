import type { Arena, Vector2 } from "../models";

/**
 * Pure terrain facts: functions of (arena, position) only. No React, no
 * Phaser, no DOM, no clock of its own — callers own the simulation clock and
 * feed this module whatever instant they need evaluated.
 */

/** Killer Honey wiki fact: flat speed multiplier while standing in honey. */
export const HONEY_SPEED_MULTIPLIER = 0.75;
/** Trainer-authored: the wiki gives no ramp curve, so the drill ramps the
 * penalty linearly per second of unbroken contact. */
export const HONEY_RAMP_PER_SECOND = 0.05;
/** Trainer-authored: the drill's floor on the ramp, so honey never fully
 * immobilises on its own. */
export const HONEY_SPEED_MULTIPLIER_FLOOR = 0.5;
/** Killer Honey wiki fact: armor-piercing damage per tick. */
export const HONEY_DAMAGE_HP = 60;
/**
 * Inferred, NOT a Killer Honey wiki fact: the Killer Honey page gives no tick
 * rate, so this borrows Evil Water's documented cadence ("55 armor piercing
 * damage per every second you are in Evil Water").
 */
export const HONEY_DAMAGE_INTERVAL_SECONDS = 1;

/**
 * True when `positionTiles` lies in any of the arena's hazard regions.
 *
 * Deliberately a CENTRE-point test, not a body/outline overlap: this is the
 * opposite choice from arena containment (`constrainBodyToArena` in
 * `geometry.ts`), which tests the player's whole body against the wall. Do
 * not "unify" the two — occupancy inside a hazard is authored as a point
 * test, containment against a wall is authored as a body test, and they stay
 * separate on purpose.
 */
export function honeyAt(arena: Arena, positionTiles: Vector2): boolean {
  const dx = positionTiles.x - arena.shape.centerTiles.x;
  const dy = positionTiles.y - arena.shape.centerTiles.y;
  return arena.hazards.some(({ region }) => {
    if (region.shape === "diamond") {
      return Math.abs(dx) + Math.abs(dy) <= region.halfDiagonalTiles;
    }
    const distanceTiles = Math.hypot(dx, dy);
    return (
      distanceTiles >= region.innerRadiusTiles &&
      distanceTiles <= region.outerRadiusTiles
    );
  });
}

/**
 * 0.75 at zero contact, ramping down 0.05 per second of unbroken contact,
 * floored at 0.50.
 */
export function honeySpeedMultiplier(contactSeconds: number): number {
  if (!Number.isFinite(contactSeconds) || contactSeconds < 0) {
    throw new RangeError("Honey contact seconds must be finite and nonnegative");
  }
  return Math.max(
    HONEY_SPEED_MULTIPLIER_FLOOR,
    HONEY_SPEED_MULTIPLIER - HONEY_RAMP_PER_SECOND * contactSeconds,
  );
}
