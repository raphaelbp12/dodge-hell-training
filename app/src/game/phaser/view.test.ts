import { expect, test } from "vitest";
import { encounterConfigOf, primaryArchetype } from "../config/encounter";
import { createSimulation } from "../simulation/simulation";
import { phaseProgressOf, phaseViewOf } from "./view";

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
    bossHealthFraction: expect.any(Number),
    phaseProgress: expect.any(Number),
    phaseEndsAtFraction: 0.6,
    phaseTimedSeconds: null,
    subPhaseId: null,
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
    bossHealthFraction: null,
    phaseProgress: 0,
    phaseEndsAtFraction: null,
    phaseTimedSeconds: null,
    subPhaseId: null,
  });
});

const queen = primaryArchetype(encounterConfigOf("killer-bee-queen"));

test.each([
  [2, 0.675, 0, 0.5],
  [5, 0.25, 14.5, 0.5],
  [6, 0.1875, 0, 0.5],
  [7, 0.0625, 0, 0.5],
])("phaseProgressOf phase index %i", (index, fraction, seconds, expected) => {
  expect(phaseProgressOf(queen, index, fraction, seconds)).toBeCloseTo(expected);
});

test("phaseProgressOf clamps and handles a boss without health", () => {
  expect(phaseProgressOf(queen, 2, 0.9, 0)).toBe(0);
  expect(phaseProgressOf(queen, 2, 0.1, 0)).toBe(1);
  expect(phaseProgressOf(queen, 5, 0.25, 999)).toBe(1);
  const worm = primaryArchetype(encounterConfigOf("crystal-worm"));
  expect(phaseProgressOf(worm, 0, null, 3)).toBe(0);
});

test("the Crystal Worm view has no boss health fraction and zero progress", () => {
  const state = createSimulation(encounterConfigOf("crystal-worm"), 7);
  const view = phaseViewOf(state);
  expect(view.bossHealthFraction).toBeNull();
  expect(view.phaseProgress).toBe(0);
});
