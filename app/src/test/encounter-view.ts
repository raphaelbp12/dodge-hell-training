// Test support: an `EncounterView` with every field filled, for component tests.
import { PALADIN_STATS } from "../game/config/stats";
import type { EncounterView } from "../game/phaser/encounter";

export function encounterView(overrides: Partial<EncounterView> = {}): EncounterView {
  return {
    healthHp: PALADIN_STATS.healthHp,
    elapsedSeconds: 0,
    hitsTaken: 0,
    status: "running",
    countdownRemainingSeconds: 0,
    zoom: 1,
    result: null,
    phaseIndex: 0,
    phaseLabel: "Phase 1",
    phaseCount: 1,
    drill: null,
    bossHealthFraction: null,
    phaseProgress: 0,
    phaseEndsAtFraction: null,
    phaseTimedSeconds: null,
    subPhaseId: null,
    conditions: [],
    ...overrides,
  };
}
