import { primaryArchetype } from "../config/encounter";
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
}>;

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
  return {
    phaseIndex,
    phaseLabel: phaseLabel(phase.id, phaseIndex),
    phaseCount: archetype.phases.length,
    drill: state.drill,
  };
}
