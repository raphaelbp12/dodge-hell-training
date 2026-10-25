import { expect, test } from "vitest";
import { ENCOUNTER_CONFIG } from "../config/encounter";
import { createSimulation } from "../simulation/simulation";
import type { SimulationInput } from "../models";
import { SessionController } from "./session";

const idle: SimulationInput = {
  north: false,
  south: false,
  east: false,
  west: false,
};
const east: SimulationInput = { ...idle, east: true };
const tick = ENCOUNTER_CONFIG.simulation.fixedStepSeconds;

test("session delivers accepted hits once before lethal result, never while paused or after Retry/Home", () => {
  const session = running();
  session.simulation.player.healthHp = 1;
  session.simulation.shards.push({ id: 1, orientationRadians: 0, positionTiles: { x: 0, y: 0 }, velocityTilesPerSecond: { x: 0, y: 0 }, ageSeconds: 0, reversalAgeSeconds: 1, lifetimeSeconds: 2, hasReversed: false, hasHitPlayer: false });
  const delivered: number[] = [];
  const receive = (hit: { damageHp: number }) => {
    expect(session.result).toBeNull();
    delivered.push(hit.damageHp);
  };
  session.pause();
  session.advance(tick, idle, receive);
  expect(delivered).toEqual([]);
  session.resume();
  expect(session.advance(tick, idle, receive)?.outcome).toBe("death");
  expect(delivered).toEqual([128]);
  session.advance(tick, idle, receive);
  session.retry();
  session.advance(0, idle, receive);
  session.home();
  session.advance(10, idle, receive);
  expect(delivered).toEqual([128]);
});

function running(): SessionController {
  const session = new SessionController();
  session.start();
  session.retry();
  return session;
}

function kill(session: SessionController) {
  session.simulation.player.healthHp = 1;
  session.simulation.shards.push({
    id: 100,
    orientationRadians: 0,
    positionTiles: { ...session.simulation.player.positionTiles },
    velocityTilesPerSecond: { x: 0, y: 0 },
    ageSeconds: 0,
    reversalAgeSeconds: 1.2,
    lifetimeSeconds: 2.4,
    hasReversed: false,
    hasHitPlayer: false,
  });
  return session.advance(tick, idle);
}

test("home ignores retry, pause and elapsed time until Start", () => {
  const session = new SessionController();
  expect(session.phase).toBe("home");
  expect(session.retry()).toBe(false);
  session.pause();
  session.resume();
  expect(session.advance(100, east)).toBeNull();
  expect(session.attemptId).toBe(0);
  expect(session.phase).toBe("home");
  expect(session.simulation).toEqual(createSimulation());
});

test("Start counts down for three active seconds without advancing gameplay", () => {
  const session = new SessionController();
  expect(session.start()).toBe(true);
  expect(session.start()).toBe(false);
  expect(session.phase).toBe("countdown");
  expect(session.countdownRemainingSeconds).toBe(3);
  const initial = structuredClone(session.simulation);
  session.advance(2.5, east);
  expect(session.countdownRemainingSeconds).toBe(0.5);
  expect(session.simulation).toEqual(initial);
  session.advance(0.5, east);
  expect(session.phase).toBe("playing");
  expect(session.simulation).toEqual(initial);
  session.advance(tick, east);
  expect(session.simulation.elapsedSeconds).toBe(tick);
  expect(session.simulation.player.positionTiles.x).toBeGreaterThan(0);
});

test("only time beyond a countdown boundary can advance gameplay", () => {
  const session = new SessionController();
  session.start();
  session.advance(3 + tick, east);
  expect(session.phase).toBe("playing");
  expect(session.simulation.ticksElapsed).toBe(1);
});

test("normal frame-sized countdown updates finish without a floating-point extra frame", () => {
  const session = new SessionController();
  session.start();
  for (let frame = 0; frame < 180; frame++) session.advance(tick, idle);
  expect(session.phase).toBe("playing");
  expect(session.countdownRemainingSeconds).toBe(0);
  expect(session.simulation.elapsedSeconds).toBe(0);
});

test.each(["countdown", "playing", "paused", "ended"] as const)(
  "retry from %s immediately uses the shared fresh initialization",
  (phase) => {
    const session = new SessionController();
    session.start();
    if (phase !== "countdown") session.advance(3, idle);
    if (phase === "paused") session.pause();
    if (phase === "ended") kill(session);
    expect(session.phase).toBe(phase);
    const old = session.simulation;
    old.player.healthHp = 10;
    old.player.combatRemainingSeconds = 5;
    old.enemy.emitterPhaseRadians = 1;
    old.volleysFired = 20;
    old.hitsTaken = 4;
    old.accumulatorSeconds = tick / 2;
    expect(session.retry()).toBe(true);
    expect(session.attemptId).toBe(2);
    expect(session.phase).toBe("playing");
    expect(session.countdownRemainingSeconds).toBe(0);
    expect(session.result).toBeNull();
    expect(session.simulation).not.toBe(old);
    expect(session.simulation).toEqual(createSimulation());
  },
);

test.each(["countdown", "playing"] as const)(
  "focus pause preserves %s until explicit resume without crediting paused time",
  (phase) => {
    const session = new SessionController();
    session.start();
    session.advance(phase === "playing" ? 3 : 1, idle);
    const remaining = session.countdownRemainingSeconds;
    const initial = structuredClone(session.simulation);
    session.pause();
    session.pause();
    expect(session.phase).toBe("paused");
    session.advance(100, east);
    expect(session.simulation).toEqual(initial);
    expect(session.countdownRemainingSeconds).toBe(remaining);
    session.resume();
    expect(session.phase).toBe(phase);
    session.resume();
    expect(session.phase).toBe(phase);
  },
);

test("death returns one immutable result and retry cannot emit it again", () => {
  const session = running();
  const attemptId = session.attemptId;
  const result = kill(session);
  expect(session.phase).toBe("ended");
  expect(result).toEqual({
    attemptId,
    rulesVersion: ENCOUNTER_CONFIG.rulesVersion,
    elapsedSeconds: tick,
    hitsTaken: 1,
    outcome: "death",
  });
  expect(Object.isFrozen(result)).toBe(true);
  expect(session.result).toBe(result);
  expect(session.advance(100, east)).toBeNull();
  session.pause();
  session.resume();
  expect(session.phase).toBe("ended");
  const oldSimulation = session.simulation;
  session.retry();
  oldSimulation.player.healthHp = 0;
  expect(session.advance(tick, idle)).toBeNull();
  expect(session.result).toBeNull();
  expect(session.simulation.player.healthHp).toBe(775);
  expect(session.attemptId).toBe(attemptId + 1);
});

test("Home discards unfinished attempts and a later Start uses countdown again", () => {
  const session = running();
  session.advance(tick, east);
  session.home();
  expect(session.phase).toBe("home");
  expect(session.result).toBeNull();
  expect(session.advance(10, east)).toBeNull();
  expect(session.retry()).toBe(false);
  session.start();
  expect(session.phase).toBe("countdown");
  expect(session.simulation).toEqual(createSimulation());
});

test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects invalid active elapsed time %s without changing state",
  (elapsedSeconds) => {
    const session = running();
    const before = structuredClone(session);
    expect(() => session.advance(elapsedSeconds, idle)).toThrow(RangeError);
    expect(structuredClone(session)).toEqual(before);
  },
);

test("the controller imports and runs without browser globals", () => {
  expect(typeof document).toBe("undefined");
  expect(typeof window).toBe("undefined");
  expect(typeof localStorage).toBe("undefined");
});
