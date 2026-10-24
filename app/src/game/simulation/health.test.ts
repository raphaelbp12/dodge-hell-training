import { expect, test } from "vitest";
import { PALADIN_STATS } from "../config/stats";
import type { PlayerState } from "../models";
import { applyPlayerHit, regeneratePlayer } from "./health.ts";

function player(): PlayerState {
  return {
    positionTiles: { x: 0, y: 0 },
    healthHp: 700,
    combatRemainingSeconds: 0,
  };
}

test.each([
  [0, 0],
  [0.1, 1],
  [1, 1],
  [32, 4],
  [35, 4],
  [36, 4],
  [37, 5],
  [160, 128],
] as const)(
  "applies raw damage %s through the approved defense/minimum/ceiling rules",
  (rawDamageHp, expectedDamageHp) => {
    const state = player();
    applyPlayerHit(state, rawDamageHp);
    expect(state.healthHp).toBe(700 - expectedDamageHp);
  },
);

test.each([
  [58, 0],
  [59, 5.32],
  [60, 5.32],
] as const)(
  "raw damage %s enters combat only at the inclusive 27 HP trigger",
  (rawDamageHp, expectedCombatSeconds) => {
    const state = player();
    applyPlayerHit(state, rawDamageHp);
    expect(state.combatRemainingSeconds).toBe(expectedCombatSeconds);
  },
);

test("subthreshold damage does not clear or refresh existing combat", () => {
  const state = player();
  state.combatRemainingSeconds = 1;
  applyPlayerHit(state, 58);
  expect(state.combatRemainingSeconds).toBe(1);
  applyPlayerHit(state, 59);
  expect(state.combatRemainingSeconds).toBe(5.32);
});

test("uses half-rate regeneration until combat expires and the full rate afterwards", () => {
  const state = player();
  state.combatRemainingSeconds = 0.25;
  regeneratePlayer(state, 1);
  expect(state.healthHp).toBeCloseTo(700 + 6.0547 * 0.25 + 12.1094 * 0.75, 10);
  expect(state.combatRemainingSeconds).toBe(0);
});

test("combat expires exactly at the boundary and never becomes negative", () => {
  const state = player();
  state.combatRemainingSeconds = 0.25;
  regeneratePlayer(state, 0.25);
  expect(state.healthHp).toBeCloseTo(700 + 6.0547 * 0.25, 10);
  expect(state.combatRemainingSeconds).toBe(0);
  regeneratePlayer(state, 0.25);
  expect(state.healthHp).toBeCloseTo(700 + 6.0547 * 0.25 + 12.1094 * 0.25, 10);
});

test("caps fractional regeneration without rounding internal HP", () => {
  const state = player();
  regeneratePlayer(state, 1 / 60);
  expect(state.healthHp).toBeCloseTo(700 + 12.1094 / 60, 10);
  regeneratePlayer(state, 100);
  expect(state.healthHp).toBe(PALADIN_STATS.healthHp);
});

test("clamps lethal damage to zero and never damages or regenerates a dead player", () => {
  const state = player();
  state.healthHp = 1;
  applyPlayerHit(state, 160);
  expect(state.healthHp).toBe(0);
  const dead = structuredClone(state);
  regeneratePlayer(state, 100);
  applyPlayerHit(state, 160);
  expect(state).toEqual(dead);
});
