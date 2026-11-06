import {
  degreesToRadians,
  type ArmPattern,
  type AttackPattern,
} from "../config/encounter";
import { sectorWidthDegrees } from "../config/sectors";
import type { Vector2 } from "../models";

/** What a pattern may read when resolving one volley's bearings. */
export type PatternContext = Readonly<{
  enemyPositionTiles: Vector2;
  playerPositionTiles: Vector2;
  /**
   * The enemy's movement heading (N17), read only by `aim: "front"`. Absent is
   * treated as 0.
   */
  enemyHeadingRadians?: number;
  /** The attack clock's current rotating-ring phase, already advanced by elapsed time. */
  ringPhaseRadians: number;
  /** Index of this volley within its burst, zero-based. */
  volleyIndexInBurst: number;
  /** Number of bursts already completed by this attack clock. */
  burstsFired: number;
  /**
   * Seconds since this attack clock's epoch. Arm spread grows from zero over
   * this interval, so a re-entered phase starts its spread over rather than
   * inheriting the simulation's age.
   */
  secondsSinceEpoch: number;
  /**
   * Values in [0, 1) already drawn from the injected seeded generator, one
   * per final scatter shot (`scatterDrawCount`), in depth-first arm order,
   * including the shots of an arm a gap removes (N12). `resolveBearings`
   * only ever reads from this array - it never draws itself, which is what
   * keeps it pure. The caller (`updateAttackClock`) is the only place that
   * advances the generator, in authored attack order and then shot order
   * (K11).
   */
  drawnUnitRandoms?: readonly number[];
}>;

export type ResolvedBearing = Readonly<{
  bearingRadians: number;
  emitterRadiusTiles: number;
}>;

const fullTurnRadians = 2 * Math.PI;

/** Scatter draws one arm pattern consumes per volley (N12). */
function armDrawCount(armPattern: ArmPattern | undefined): number {
  if (!armPattern) return 0;
  switch (armPattern.kind) {
    case "scatter":
      return armPattern.shots;
    case "ring":
      return armPattern.arms * armDrawCount(armPattern.armPattern);
    default:
      return 0;
  }
}

/**
 * How many unit-random draws one volley of `pattern` needs. A constant of the
 * pattern: a shot a gap removes still consumes its draw, so the generator's
 * stream never depends on rotation (N12).
 */
export function scatterDrawCount(pattern: AttackPattern): number {
  if (pattern.kind === "scatter") return pattern.shots;
  if (pattern.kind === "ring")
    return pattern.arms * armDrawCount(pattern.armPattern);
  return 0;
}

/** Evenly spaced spread bearings centred on `centreRadians`; one shot is the centre. */
function spreadBearingsRadians(
  centreRadians: number,
  shots: number,
  arcDegrees: number,
): number[] {
  if (shots === 1) return [centreRadians];
  const arcRadians = degreesToRadians(arcDegrees);
  const stepRadians = arcRadians / (shots - 1);
  const startRadians = centreRadians - arcRadians / 2;
  return Array.from({ length: shots }, (_, shot) => startRadians + shot * stepRadians);
}

const scatterBearingRadians = (
  centreRadians: number,
  coneDegrees: number,
  draw: number,
): number => centreRadians + (draw - 0.5) * degreesToRadians(coneDegrees);

/** Reads scatter draws in order; the cursor is shared across a whole volley. */
type DrawCursor = { readonly values: readonly number[]; next: number };

/**
 * Expands one arm's bearing through its pattern, depth first. An inner pattern
 * has no aim: it centres on the arm's bearing (N06).
 */
function expandArm(
  armPattern: ArmPattern | undefined,
  armBearingRadians: number,
  cursor: DrawCursor,
  out: number[],
): void {
  if (!armPattern || armPattern.kind === "single") {
    out.push(armBearingRadians);
    return;
  }
  if (armPattern.kind === "spread") {
    out.push(
      ...spreadBearingsRadians(armBearingRadians, armPattern.shots, armPattern.arcDegrees),
    );
    return;
  }
  if (armPattern.kind === "scatter") {
    for (let shot = 0; shot < armPattern.shots; shot++)
      out.push(
        scatterBearingRadians(armBearingRadians, armPattern.coneDegrees, cursor.values[cursor.next++]),
      );
    return;
  }
  const offsetRadians = degreesToRadians(armPattern.phaseOffsetDegrees ?? 0);
  for (let inner = 0; inner < armPattern.arms; inner++)
    expandArm(
      armPattern.armPattern,
      armBearingRadians + offsetRadians + (inner * fullTurnRadians) / armPattern.arms,
      cursor,
      out,
    );
}

/** Whether an arm offset lies inside any authored gap sector. */
function insideGapSector(
  offsetDegrees: number,
  gaps: readonly (readonly [number, number])[],
): boolean {
  const normalizedOffset = ((offsetDegrees % 360) + 360) % 360;
  return gaps.some(([fromDegrees, toDegrees]) => {
    const width = sectorWidthDegrees(fromDegrees, toDegrees);
    if (width === 0) return false;
    const fromOffset =
      ((normalizedOffset - fromDegrees) % 360 + 360) % 360;
    return fromOffset < width;
  });
}

/**
 * Resolves the aim bearing for `spread` (and later `scatter`): the player's
 * bearing from the firing point when aimed, or a fixed authored bearing
 * otherwise. Where the player stands exactly on the firing point the aim
 * bearing is undefined, so this falls back to the attack clock's current
 * ring phase rather than drawing a random value - deterministic, and no new
 * source of randomness (G12 in spirit; K11 stays the only randomness path).
 */
function resolveAimBearingRadians(
  pattern: Extract<AttackPattern, { aim: "player" | "fixed" | "front" }>,
  context: PatternContext,
): number {
  if (pattern.aim === "fixed") return degreesToRadians(pattern.fixedBearingDegrees);
  if (pattern.aim === "front")
    return (context.enemyHeadingRadians ?? 0) + degreesToRadians(pattern.offsetDegrees);
  const deltaX = context.playerPositionTiles.x - context.enemyPositionTiles.x;
  const deltaY = context.playerPositionTiles.y - context.enemyPositionTiles.y;
  if (deltaX === 0 && deltaY === 0) return context.ringPhaseRadians;
  return Math.atan2(deltaY, deltaX);
}

/**
 * Resolves the bearings for one volley of an attack's pattern. Pure: no
 * mutation, no clock reading and no randomness - callers advance the clock
 * and compute `context.ringPhaseRadians` themselves, and `scatter`'s draws
 * arrive pre-drawn through `context.drawnUnitRandoms` rather than this
 * function reaching into simulation state itself (K11).
 */
export function resolveBearings(
  pattern: AttackPattern,
  context: PatternContext,
): readonly ResolvedBearing[] {
  if (pattern.kind === "ring") {
    const burstAdvanceRadians =
      degreesToRadians(pattern.perBurstAdvanceDegrees ?? 0) *
      context.burstsFired;
    // The extra separation between consecutive arms grows linearly from zero
    // at the clock epoch, then holds at the authored maximum. `arm * spread`
    // keeps arm 0 on the 20.1 bearing while every later arm lags.
    const spreadDegrees =
      pattern.maxArmSpreadDegrees === undefined
        ? 0
        : Math.max(
            0,
            Math.min(
              pattern.maxArmSpreadDegrees,
              (pattern.armSpreadDegreesPerSecond ?? 0) *
                Math.max(0, context.secondsSinceEpoch),
            ),
          );
    const spreadRadians = degreesToRadians(spreadDegrees);
    const gaps = pattern.gapSectorsDegrees ?? [];
    const drawsPerArm = armDrawCount(pattern.armPattern);
    const draws = context.drawnUnitRandoms ?? [];
    if (draws.length < pattern.arms * drawsPerArm)
      throw new RangeError(
        "a ring with a scatter armPattern requires one drawnUnitRandoms entry per final shot",
      );
    const cursor: DrawCursor = { values: draws, next: 0 };
    const bearings: ResolvedBearing[] = [];
    for (let arm = 0; arm < pattern.arms; arm++) {
      const bearingRadians =
        context.ringPhaseRadians +
        burstAdvanceRadians +
        (arm * fullTurnRadians) / pattern.arms +
        arm * spreadRadians;
      // Gap sectors are measured in the pattern's own frame, anchored at its
      // authored initial phase, and tested against the arm's current bearing:
      // the ring's rotation sweeps arms through a stationary opening.
      const gapFrameDegrees =
        ((bearingRadians - pattern.initialPhaseRadians) * 180) / Math.PI;
      if (insideGapSector(gapFrameDegrees, gaps)) {
        // A removed arm still consumes its draws (N12).
        cursor.next += drawsPerArm;
        continue;
      }
      // Gap sectors, per-burst advance and arm spread act on the arm's own
      // bearing above (N08); only then is the arm expanded.
      const shotBearings: number[] = [];
      expandArm(pattern.armPattern, bearingRadians, cursor, shotBearings);
      for (const shotBearing of shotBearings)
        bearings.push({
          bearingRadians: shotBearing,
          emitterRadiusTiles: pattern.emitterRadiusTiles,
        });
    }
    return bearings;
  }
  if (pattern.kind === "spread") {
    const centreRadians = resolveAimBearingRadians(pattern, context);
    return spreadBearingsRadians(centreRadians, pattern.shots, pattern.arcDegrees).map(
      (bearingRadians) => ({
        bearingRadians,
        emitterRadiusTiles: pattern.emitterRadiusTiles,
      }),
    );
  }
  if (pattern.kind === "scatter") {
    const centreRadians = resolveAimBearingRadians(pattern, context);
    const draws = context.drawnUnitRandoms;
    if (!draws || draws.length < pattern.shots)
      throw new RangeError(
        "a scatter pattern requires one drawnUnitRandoms entry per shot",
      );
    const bearings: ResolvedBearing[] = [];
    for (let shot = 0; shot < pattern.shots; shot++) {
      bearings.push({
        bearingRadians: scatterBearingRadians(centreRadians, pattern.coneDegrees, draws[shot]),
        emitterRadiusTiles: pattern.emitterRadiusTiles,
      });
    }
    return bearings;
  }
  throw new RangeError(`Unknown pattern kind: ${(pattern as { kind: string }).kind}`);
}
