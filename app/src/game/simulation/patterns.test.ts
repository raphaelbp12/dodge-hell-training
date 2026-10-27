import { expect, test } from "vitest";
import { resolveBearings, type PatternContext } from "./patterns";
import type {
  RingPattern,
  ScatterPattern,
  SpreadPattern,
} from "../config/encounter";

const RING: RingPattern = {
  kind: "ring",
  arms: 6,
  emitterRadiusTiles: 0.35,
  initialPhaseRadians: 0,
  clockwiseDegreesPerSecond: 45,
};

const baseContext: PatternContext = {
  enemyPositionTiles: { x: 1, y: 2 },
  playerPositionTiles: { x: 0, y: 0 },
  ringPhaseRadians: Math.PI / 6,
  volleyIndexInBurst: 0,
  burstsFired: 0,
};

test("resolveBearings places six ring arms at exactly 60-degree spacing from the ring phase", () => {
  const bearings = resolveBearings(RING, baseContext);
  expect(bearings).toHaveLength(6);
  for (let arm = 0; arm < 6; arm++) {
    expect(bearings[arm].bearingRadians).toBeCloseTo(
      baseContext.ringPhaseRadians + arm * (Math.PI / 3),
      12,
    );
  }
});

test("resolveBearings returns the pattern's emitter radius unchanged for every arm", () => {
  const bearings = resolveBearings(RING, baseContext);
  for (const bearing of bearings) {
    expect(bearing.emitterRadiusTiles).toBe(0.35);
  }
});

test("resolveBearings is pure: it does not mutate its inputs", () => {
  const pattern = { ...RING };
  const context = { ...baseContext };
  resolveBearings(pattern, context);
  expect(pattern).toEqual(RING);
  expect(context).toEqual(baseContext);
});

test("resolveBearings rejects an unknown pattern kind", () => {
  expect(() =>
    resolveBearings(
      { kind: "scatter" } as unknown as RingPattern,
      baseContext,
    ),
  ).toThrow(RangeError);
});

const PLAYER_AIMED_SPREAD: SpreadPattern = {
  kind: "spread",
  shots: 3,
  arcDegrees: 24,
  aim: "player",
  emitterRadiusTiles: 0.6,
};

const movingPlayerContext: PatternContext = {
  ...baseContext,
  enemyPositionTiles: { x: 0, y: 0 },
  playerPositionTiles: { x: 10, y: 0 }, // bearing 0
};

test("a 3-shot 24-degree spread is centred on the aim bearing", () => {
  const bearings = resolveBearings(PLAYER_AIMED_SPREAD, movingPlayerContext);
  expect(bearings).toHaveLength(3);
  const twelveDegreesRadians = (12 * Math.PI) / 180;
  expect(bearings[0].bearingRadians).toBeCloseTo(-twelveDegreesRadians, 9);
  expect(bearings[1].bearingRadians).toBeCloseTo(0, 9);
  expect(bearings[2].bearingRadians).toBeCloseTo(twelveDegreesRadians, 9);
});

test("a 1-shot spread fires exactly on the aim bearing regardless of arcDegrees", () => {
  const bearings = resolveBearings(
    { ...PLAYER_AIMED_SPREAD, shots: 1, arcDegrees: 90 },
    movingPlayerContext,
  );
  expect(bearings).toHaveLength(1);
  expect(bearings[0].bearingRadians).toBeCloseTo(0, 9);
});

test("an even shot count stays symmetric about the centre", () => {
  const bearings = resolveBearings(
    { ...PLAYER_AIMED_SPREAD, shots: 4, arcDegrees: 30 },
    movingPlayerContext,
  );
  expect(bearings).toHaveLength(4);
  const mean =
    bearings.reduce((sum, bearing) => sum + bearing.bearingRadians, 0) / 4;
  expect(mean).toBeCloseTo(0, 9);
  expect(bearings[0].bearingRadians + bearings[3].bearingRadians).toBeCloseTo(
    0,
    9,
  );
  expect(bearings[1].bearingRadians + bearings[2].bearingRadians).toBeCloseTo(
    0,
    9,
  );
});

test("aim: player tracks a moving player across two volleys", () => {
  const first = resolveBearings(PLAYER_AIMED_SPREAD, {
    ...movingPlayerContext,
    enemyPositionTiles: { x: 0, y: 0 },
    playerPositionTiles: { x: 0, y: 10 }, // bearing 90 degrees
  });
  const second = resolveBearings(PLAYER_AIMED_SPREAD, {
    ...movingPlayerContext,
    enemyPositionTiles: { x: 0, y: 0 },
    playerPositionTiles: { x: -10, y: 0 }, // bearing 180 degrees
  });
  expect(first[1].bearingRadians).toBeCloseTo(Math.PI / 2, 9);
  expect(second[1].bearingRadians).toBeCloseTo(Math.PI, 9);
});

test("aim: fixed ignores the player entirely", () => {
  const fixed: SpreadPattern = {
    kind: "spread",
    shots: 3,
    arcDegrees: 24,
    aim: "fixed",
    fixedBearingDegrees: 90,
    emitterRadiusTiles: 0.6,
  };
  const withPlayerHere = resolveBearings(fixed, {
    ...movingPlayerContext,
    playerPositionTiles: { x: 10, y: 0 },
  });
  const withPlayerThere = resolveBearings(fixed, {
    ...movingPlayerContext,
    playerPositionTiles: { x: -500, y: 300 },
  });
  expect(withPlayerHere).toEqual(withPlayerThere);
  expect(withPlayerHere[1].bearingRadians).toBeCloseTo(Math.PI / 2, 9);
});

test("the degenerate player-on-emitter case falls back to the ring phase and is deterministic", () => {
  const context: PatternContext = {
    ...movingPlayerContext,
    enemyPositionTiles: { x: 5, y: 5 },
    playerPositionTiles: { x: 5, y: 5 },
    ringPhaseRadians: 1.2345,
  };
  const first = resolveBearings(
    { ...PLAYER_AIMED_SPREAD, shots: 1 },
    context,
  );
  const second = resolveBearings(
    { ...PLAYER_AIMED_SPREAD, shots: 1 },
    context,
  );
  expect(first[0].bearingRadians).toBe(1.2345);
  expect(second[0].bearingRadians).toBe(first[0].bearingRadians);
});

const SCATTER: ScatterPattern = {
  kind: "scatter",
  shots: 200,
  coneDegrees: 60,
  aim: "fixed",
  fixedBearingDegrees: 0,
  emitterRadiusTiles: 0.4,
};

function evenDraws(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index / count);
}

test("every scatter bearing lies within the cone", () => {
  const bearings = resolveBearings(SCATTER, {
    ...baseContext,
    drawnUnitRandoms: evenDraws(SCATTER.shots),
  });
  const halfConeRadians = (30 * Math.PI) / 180;
  for (const bearing of bearings) {
    expect(Math.abs(bearing.bearingRadians)).toBeLessThanOrEqual(
      halfConeRadians + 1e-9,
    );
  }
});

test("a 360-degree cone covers the full circle over enough draws", () => {
  const omnidirectional: ScatterPattern = {
    ...SCATTER,
    shots: 360,
    coneDegrees: 360,
  };
  const bearings = resolveBearings(omnidirectional, {
    ...baseContext,
    drawnUnitRandoms: evenDraws(360),
  });
  const normalized = bearings
    .map(
      (bearing) =>
        ((bearing.bearingRadians % (2 * Math.PI)) + 2 * Math.PI) %
        (2 * Math.PI),
    )
    .sort((a, b) => a - b);
  // No gap between consecutive (sorted, wrapped) bearings exceeds a couple
  // of degrees, so 360 evenly spread draws cover the whole circle.
  const maxGapRadians = Math.max(
    ...normalized.map((radians, index) =>
      index === 0
        ? radians + (2 * Math.PI - normalized[normalized.length - 1])
        : radians - normalized[index - 1],
    ),
  );
  expect(maxGapRadians).toBeLessThan((2 * Math.PI) / 180);
});

test("the same drawn values reproduce bearings exactly; different draws do not", () => {
  const draws = evenDraws(SCATTER.shots);
  const first = resolveBearings(SCATTER, {
    ...baseContext,
    drawnUnitRandoms: draws,
  });
  const second = resolveBearings(SCATTER, {
    ...baseContext,
    drawnUnitRandoms: draws,
  });
  expect(first).toEqual(second);
  const differentDraws = draws.map((value) => (value + 0.37) % 1);
  const third = resolveBearings(SCATTER, {
    ...baseContext,
    drawnUnitRandoms: differentDraws,
  });
  expect(third).not.toEqual(first);
});

test("resolveBearings rejects a scatter call missing enough drawn values", () => {
  expect(() =>
    resolveBearings(SCATTER, {
      ...baseContext,
      drawnUnitRandoms: [0.5],
    }),
  ).toThrow(RangeError);
  expect(() => resolveBearings(SCATTER, baseContext)).toThrow(RangeError);
});

test("scatter's aim: fixed and aim: player resolve the centre the same way spread does", () => {
  const aimedAtPlayer: ScatterPattern = {
    kind: "scatter",
    shots: 1,
    coneDegrees: 1,
    aim: "player",
    emitterRadiusTiles: 0.4,
  };
  const bearings = resolveBearings(aimedAtPlayer, {
    ...baseContext,
    enemyPositionTiles: { x: 0, y: 0 },
    playerPositionTiles: { x: 10, y: 0 },
    drawnUnitRandoms: [0.5],
  });
  // A single shot with drawnUnitRandoms 0.5 lands exactly at the centre.
  expect(bearings[0].bearingRadians).toBeCloseTo(0, 9);
});
