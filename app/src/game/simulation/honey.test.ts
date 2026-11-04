import { expect, test } from "vitest";
import { AUTHORED_ARENAS } from "../config/data";
import {
  ENCOUNTER_CONFIG,
  type EncounterConfig,
} from "../config/encounter";
import { PALADIN_DERIVED_STATS } from "../config/stats";
import type { SimulationInput } from "../models";
import { SLOWED_SPEED_TILES_PER_SECOND } from "./conditions";
import { advanceSimulation, createSimulation } from "./simulation";
import { SessionController } from "../session/session";
import {
  HONEY_DAMAGE_HP,
  HONEY_SPEED_MULTIPLIER_FLOOR,
  honeySpeedMultiplier,
} from "./terrain";

const idle: SimulationInput = {
  north: false,
  south: false,
  east: false,
  west: false,
};
const east: SimulationInput = { north: false, south: false, east: true, west: false };
const stepSeconds = ENCOUNTER_CONFIG.simulation.fixedStepSeconds;
const TEST_SEED = 20261104;

// The Queen's room, with every enemy suppressed (maxConcurrent: 0) so a
// honey test observes only the terrain mechanic, never attacks or contact.
const NEST_BOSS_ROOM: EncounterConfig = {
  ...ENCOUNTER_CONFIG,
  arena: AUTHORED_ARENAS["nest-boss-room"],
  spawns: { ...ENCOUNTER_CONFIG.spawns, maxConcurrent: 0 },
};

function freshState(positionTiles: { x: number; y: number }) {
  const state = createSimulation(NEST_BOSS_ROOM, TEST_SEED);
  state.player.positionTiles = { ...positionTiles };
  return state;
}

function stepTravelTiles(before: { x: number; y: number }, after: { x: number; y: number }) {
  return Math.hypot(after.x - before.x, after.y - before.y);
}

test("standing still in honey accumulates contact at the step rate", () => {
  const state = freshState({ x: 0, y: 0 });
  advanceSimulation(state, stepSeconds, idle);
  expect(state.player.honeyContactSeconds).toBeCloseTo(stepSeconds, 10);
  advanceSimulation(state, stepSeconds, idle);
  expect(state.player.honeyContactSeconds).toBeCloseTo(2 * stepSeconds, 10);
});

test("the honey slow applies starting the step after the player's position first lands in honey (one-step lag)", () => {
  // Spawn just outside the diamond pond (3.5 half-diagonal), moving east into it.
  const state = freshState({ x: -3.6, y: 0 });
  const before1 = { ...state.player.positionTiles };
  advanceSimulation(state, stepSeconds, east);
  const after1 = { ...state.player.positionTiles };
  // The first step's own travel is unaffected: honeyContactSeconds was 0
  // entering this step.
  expect(stepTravelTiles(before1, after1)).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond * stepSeconds,
    5,
  );
  expect(after1.x).toBeGreaterThan(-3.5); // now inside the pond
  expect(state.player.honeyContactSeconds).toBeCloseTo(stepSeconds, 10);

  const before2 = { ...state.player.positionTiles };
  advanceSimulation(state, stepSeconds, east);
  const after2 = { ...state.player.positionTiles };
  // The step AFTER entry is the one that reflects the slow, at the
  // multiplier for the contact accrued BEFORE this step (one step's worth).
  expect(stepTravelTiles(before2, after2)).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond *
      honeySpeedMultiplier(stepSeconds) *
      stepSeconds,
    5,
  );
});

test("after five seconds of unbroken contact the multiplier is floored at 0.50", () => {
  const state = freshState({ x: 0, y: 0 });
  const stepsFor5Seconds = Math.round(5 / stepSeconds);
  for (let tick = 0; tick < stepsFor5Seconds; tick++) {
    advanceSimulation(state, stepSeconds, idle);
  }
  expect(state.player.honeyContactSeconds).toBeCloseTo(5, 5);
  const before = { ...state.player.positionTiles };
  advanceSimulation(state, stepSeconds, east);
  const after = { ...state.player.positionTiles };
  expect(stepTravelTiles(before, after)).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond *
      HONEY_SPEED_MULTIPLIER_FLOOR *
      stepSeconds,
    5,
  );
});

test("leaving honey for one step resets contact to zero, and the next step is full speed", () => {
  // (0,0) is honey (diamond); (5,0) clears both the diamond and the annulus
  // hole, so moving straight out leaves honey after a few steps.
  const state = freshState({ x: 3, y: 0 });
  // Accrue some contact first.
  advanceSimulation(state, stepSeconds, idle);
  advanceSimulation(state, stepSeconds, idle);
  expect(state.player.honeyContactSeconds).toBeGreaterThan(0);

  // Jump straight to clean ground and take one step: occupancy resets.
  state.player.positionTiles = { x: 5, y: 0 };
  advanceSimulation(state, stepSeconds, idle);
  expect(state.player.honeyContactSeconds).toBe(0);

  const before = { ...state.player.positionTiles };
  advanceSimulation(state, stepSeconds, east);
  const after = { ...state.player.positionTiles };
  expect(stepTravelTiles(before, after)).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond * stepSeconds,
    5,
  );
});

test("re-entering honey restarts the ramp from the flat multiplier", () => {
  const state = freshState({ x: 0, y: 0 });
  for (let tick = 0; tick < 60; tick++) advanceSimulation(state, stepSeconds, idle);
  expect(state.player.honeyContactSeconds).toBeGreaterThan(0);
  state.player.positionTiles = { x: 5, y: 0 };
  advanceSimulation(state, stepSeconds, idle);
  expect(state.player.honeyContactSeconds).toBe(0);
  state.player.positionTiles = { x: 0, y: 0 };
  advanceSimulation(state, stepSeconds, idle);
  expect(state.player.honeyContactSeconds).toBeCloseTo(stepSeconds, 10);
  const before = { ...state.player.positionTiles };
  advanceSimulation(state, stepSeconds, east);
  const after = { ...state.player.positionTiles };
  expect(stepTravelTiles(before, after)).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond *
      honeySpeedMultiplier(stepSeconds) *
      stepSeconds,
    5,
  );
});

test("honey stacks on top of slowed: the reduced speed is further reduced", () => {
  const state = freshState({ x: 0, y: 0 });
  state.player.conditionSeconds.slowed = 10;
  advanceSimulation(state, stepSeconds, idle); // accrue one step of contact
  const before = { ...state.player.positionTiles };
  advanceSimulation(state, stepSeconds, east);
  const after = { ...state.player.positionTiles };
  expect(stepTravelTiles(before, after)).toBeCloseTo(
    SLOWED_SPEED_TILES_PER_SECOND * honeySpeedMultiplier(stepSeconds) * stepSeconds,
    5,
  );
});

test("paralyzed stays zero travel in honey", () => {
  const state = freshState({ x: 0, y: 0 });
  state.player.conditionSeconds.paralyzed = 10;
  advanceSimulation(state, stepSeconds, idle);
  const before = { ...state.player.positionTiles };
  advanceSimulation(state, stepSeconds, east);
  const after = { ...state.player.positionTiles };
  expect(stepTravelTiles(before, after)).toBe(0);
});

test("honey never sets a visible condition or appears in the HUD condition list", () => {
  const state = freshState({ x: 0, y: 0 });
  for (let tick = 0; tick < 10; tick++) advanceSimulation(state, stepSeconds, idle);
  expect(state.player.conditionSeconds.slowed).toBe(0);
  expect(state.player.conditionSeconds.paralyzed).toBe(0);
});

test("enemy positions over a fixed seed and input sequence are unchanged by honey", () => {
  const withHoney = createSimulation(NEST_BOSS_ROOM, TEST_SEED);
  const plainConfig: EncounterConfig = {
    ...NEST_BOSS_ROOM,
    arena: { ...NEST_BOSS_ROOM.arena, hazards: [] },
  };
  const withoutHoney = createSimulation(plainConfig, TEST_SEED);
  for (let tick = 0; tick < 30; tick++) {
    advanceSimulation(withHoney, stepSeconds, east);
    advanceSimulation(withoutHoney, stepSeconds, east);
  }
  expect(withHoney.enemies).toEqual(withoutHoney.enemies);
});

test("a player placed in the pond at t=0 takes 60 armor-piercing damage on the first playing step", () => {
  const state = freshState({ x: 0, y: 0 });
  const result = advanceSimulation(state, stepSeconds, idle);
  expect(result.acceptedHits).toHaveLength(1);
  // Full armor-piercing damage, unreduced by defense (a tiny same-step
  // regen tick separately nudges health back up, so this asserts on the
  // hit's own recorded damage rather than the before/after health delta).
  expect(result.acceptedHits[0]!.damageHp).toBe(HONEY_DAMAGE_HP);
});

test("the next honey tick lands exactly 1.0 second later, not sooner", () => {
  const state = freshState({ x: 0, y: 0 });
  const stepsPerSecond = Math.round(1 / stepSeconds);
  let ticksSeen = 0;
  let tickStepIndex = -1;
  for (let tick = 0; tick < stepsPerSecond + 2; tick++) {
    const result = advanceSimulation(state, stepSeconds, idle);
    if (result.acceptedHits.length > 0) {
      ticksSeen++;
      if (ticksSeen === 2) tickStepIndex = tick;
    }
  }
  // Tick 1 is due immediately (step 0); tick 2 is due at elapsedSeconds >= 1.0,
  // which is the step at index `stepsPerSecond` (0-indexed).
  expect(tickStepIndex).toBe(stepsPerSecond);
});

test("standing 3.05 seconds in honey ticks for damage exactly 4 times", () => {
  const state = freshState({ x: 0, y: 0 });
  const steps = Math.round(3.05 / stepSeconds);
  let hits = 0;
  for (let tick = 0; tick < steps; tick++) {
    hits += advanceSimulation(state, stepSeconds, idle).acceptedHits.length;
  }
  expect(hits).toBe(4);
});

test("stepping out and back in damages again immediately and restarts the damage clock", () => {
  const state = freshState({ x: 0, y: 0 });
  // First tick, immediate.
  expect(advanceSimulation(state, stepSeconds, idle).acceptedHits).toHaveLength(1);
  // Step out onto clean ground.
  state.player.positionTiles = { x: 5, y: 0 };
  expect(advanceSimulation(state, stepSeconds, idle).acceptedHits).toHaveLength(0);
  expect(state.player.nextHoneyDamageAtSeconds).toBe(0);
  // Step back in: due-immediately, so this ticks again right away.
  state.player.positionTiles = { x: 0, y: 0 };
  expect(advanceSimulation(state, stepSeconds, idle).acceptedHits).toHaveLength(1);
});

test("armor-piercing: an Armor Broken player takes the same 60 as an unbroken one", () => {
  const broken = freshState({ x: 0, y: 0 });
  broken.player.conditionSeconds.armorBroken = 10;
  const unbroken = freshState({ x: 0, y: 0 });
  const brokenResult = advanceSimulation(broken, stepSeconds, idle);
  const unbrokenResult = advanceSimulation(unbroken, stepSeconds, idle);
  expect(brokenResult.acceptedHits[0]!.damageHp).toBe(
    unbrokenResult.acceptedHits[0]!.damageHp,
  );
  expect(brokenResult.acceptedHits[0]!.damageHp).toBe(HONEY_DAMAGE_HP);
});

test("each honey tick increments hitsTaken by one and appears in the hit log with the player's position", () => {
  const state = freshState({ x: 0, y: 0 });
  const result = advanceSimulation(state, stepSeconds, idle);
  expect(state.hitsTaken).toBe(1);
  expect(result.acceptedHits[0]!.positionTiles).toEqual(state.player.positionTiles);
});

test("honey damage can reduce health to zero and ends the attempt through the normal path", () => {
  const state = freshState({ x: 0, y: 0 });
  state.player.healthHp = HONEY_DAMAGE_HP;
  advanceSimulation(state, stepSeconds, idle);
  expect(state.player.healthHp).toBe(0);
  expect(state.phase).toBe("ended");
});

test("no honey contact or damage during countdown; the player travels at full speed", () => {
  const session = new SessionController(() => TEST_SEED, {}, NEST_BOSS_ROOM);
  session.start();
  session.simulation.player.positionTiles = { x: 0, y: 0 };
  const hits: unknown[] = [];
  const before = { ...session.simulation.player.positionTiles };
  // A step well inside the authored countdown.
  session.advance(stepSeconds, idle, (hit) => hits.push(hit));
  expect(session.phase).toBe("countdown");
  expect(hits).toHaveLength(0);
  expect(session.simulation.player.honeyContactSeconds).toBe(0);
  expect(session.simulation.player.positionTiles).toEqual(before);
});

test("no honey damage while paused", () => {
  const state = freshState({ x: 0, y: 0 });
  state.phase = "ended"; // simulate a non-playing phase at this layer
  const result = advanceSimulation(state, stepSeconds, idle);
  expect(result.acceptedHits).toHaveLength(0);
  expect(state.player.honeyContactSeconds).toBe(0);
});
