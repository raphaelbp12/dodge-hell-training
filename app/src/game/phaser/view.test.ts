import { expect, test } from "vitest";
import { encounterConfigOf, primaryArchetype } from "../config/encounter";
import { createSimulation } from "../simulation/simulation";
import { phaseViewOf } from "./view";

test("phaseViewOf follows the primary enemy's phase and the active drill", () => {
  const config = encounterConfigOf("killer-bee-queen");
  const drill = { phaseIndices: [2], loop: true };
  const state = createSimulation(config, 7, { drill });
  const primary = state.enemies.find(
    (enemy) => enemy.archetypeId === config.primaryArchetypeId,
  )!;
  primary.phaseIndex = 2;

  expect(phaseViewOf(state)).toEqual({
    phaseIndex: 2,
    phaseLabel: "Phase 3 - Pond Barrage",
    phaseCount: 8,
    drill,
  });
});

test("phaseViewOf reports phase 1 when the primary enemy is absent", () => {
  const config = encounterConfigOf("killer-bee-queen");
  const state = createSimulation(config, 7);
  state.enemies = [];

  expect(phaseViewOf(state)).toEqual({
    phaseIndex: 0,
    phaseLabel: "Phase 1 - Honey Pond",
    phaseCount: primaryArchetype(config).phases.length,
    drill: null,
  });
});
