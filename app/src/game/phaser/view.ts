import { primaryArchetype, type EnemyArchetype } from "../config/encounter";
import { phaseLabel } from "../config/drill";
import type { DrillSelection } from "../models";
import { currentPhaseOf } from "../simulation/phases";
import type { SimulationState } from "../simulation/simulation";

/** The live panel's phase fields, pure and importable without Phaser. */
export type PhaseView = Readonly<{
  phaseIndex: number;
  phaseLabel: string;
  phaseCount: number;
  drill: DrillSelection | null;
  /** 0 to 1, or null when the primary enemy has no health (Crystal Worm). */
  bossHealthFraction: number | null;
  /** 0 to 1 through the current phase. */
  phaseProgress: number;
  /** The HP fraction that ends this phase, or null when it ends another way. */
  phaseEndsAtFraction: number | null;
  /** Authored seconds for a timed phase, or null. */
  phaseTimedSeconds: number | null;
  subPhaseId: string | null;
}>;

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

/** How far through its phase the primary enemy is, from 0 to 1. */
export function phaseProgressOf(
  archetype: EnemyArchetype,
  phaseIndex: number,
  healthFraction: number | null,
  secondsInPhase: number,
): number {
  const phase = archetype.phases[phaseIndex];
  // A timed phase (the Queen's phase 6) cannot be read from HP: she is
  // invulnerable through it and phases 6 and 7 share the 0.25 threshold.
  if (phase.exitAfterSeconds !== null)
    return clampUnit(secondsInPhase / phase.exitAfterSeconds);
  if (healthFraction === null) return 0;
  const end = archetype.phases[phaseIndex + 1]?.enterAtHpFraction ?? 0;
  const span = phase.enterAtHpFraction - end;
  return span <= 0 ? 0 : clampUnit((phase.enterAtHpFraction - healthFraction) / span);
}

/**
 * Derives the live view's phase fields from the simulation alone: the primary
 * enemy's current top-level phase, the shared label helper, the primary
 * archetype's authored phase count and the active drill (R15).
 */
export function phaseViewOf(state: SimulationState): PhaseView {
  const archetype = primaryArchetype(state.config);
  const primary = state.enemies.find(
    (enemy) => enemy.archetypeId === state.config.primaryArchetypeId,
  );
  const phaseIndex = primary?.phaseIndex ?? 0;
  const phase = primary
    ? currentPhaseOf(archetype, primary)
    : archetype.phases[0];
  const bossHealthFraction =
    primary && primary.healthHp !== null && primary.maxHealthHp !== null
      ? primary.healthHp / primary.maxHealthHp
      : null;
  const secondsInPhase = primary
    ? state.elapsedSeconds - primary.phaseEnteredAtSeconds
    : 0;
  const nextPhase = archetype.phases[phaseIndex + 1];
  return {
    phaseIndex,
    phaseLabel: phaseLabel(phase.id, phaseIndex),
    phaseCount: archetype.phases.length,
    drill: state.drill,
    bossHealthFraction,
    phaseProgress: primary
      ? phaseProgressOf(archetype, phaseIndex, bossHealthFraction, secondsInPhase)
      : 0,
    phaseEndsAtFraction:
      phase.exitAfterSeconds !== null ||
      bossHealthFraction === null ||
      !nextPhase
        ? null
        : nextPhase.enterAtHpFraction,
    phaseTimedSeconds: phase.exitAfterSeconds,
    subPhaseId: primary
      ? (phase.subPhases?.[primary.subPhaseIndex]?.id ?? null)
      : null,
  };
}
