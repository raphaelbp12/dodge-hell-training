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

const degrees = (value: number): number => (value * Math.PI) / 180;

const baseContext: PatternContext = {
  enemyPositionTiles: { x: 1, y: 2 },
  playerPositionTiles: { x: 0, y: 0 },
  ringPhaseRadians: Math.PI / 6,
  volleyIndexInBurst: 0,
  burstsFired: 0,
  secondsSinceEpoch: 0,
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

test("a ring advances by perBurstAdvanceDegrees per completed burst, not per shot", () => {
  const advancing = {
    ...RING,
    clockwiseDegreesPerSecond: 0,
    perBurstAdvanceDegrees: 15,
  } as RingPattern;
  const context: PatternContext = {
    ...baseContext,
    ringPhaseRadians: 0,
    burstsFired: 0,
  };
  const firstBurst = resolveBearings(advancing, {
    ...context,
    volleyIndexInBurst: 0,
  });
  const sameBurstLaterShot = resolveBearings(advancing, {
    ...context,
    volleyIndexInBurst: 7,
  });
  const thirdBurst = resolveBearings(advancing, {
    ...context,
    burstsFired: 2,
  });

  expect(sameBurstLaterShot).toEqual(firstBurst);
  const advanceRadians = (2 * 15 * Math.PI) / 180;
  thirdBurst.forEach((bearing, arm) => {
    expect(bearing.bearingRadians).toBeCloseTo(
      firstBurst[arm].bearingRadians + advanceRadians,
      12,
    );
  });
});

test("a gap sector suppresses exactly the arms inside it and no others", () => {
  const gapped = {
    ...RING,
    arms: 4,
    clockwiseDegreesPerSecond: 0,
    gapSectorsDegrees: [[0, 200]],
  } as RingPattern;
  const bearings = resolveBearings(gapped, {
    ...baseContext,
    ringPhaseRadians: 0,
  });
  expect(bearings).toHaveLength(1);
  expect(bearings[0].bearingRadians).toBeCloseTo((3 * Math.PI) / 2, 12);
});

test("the same arm is suppressed and then fires as the ring phase sweeps it past a gap", () => {
  const gapped = {
    ...RING,
    arms: 2,
    initialPhaseRadians: 0,
    clockwiseDegreesPerSecond: 0,
    gapSectorsDegrees: [[0, 90]],
  } as RingPattern;
  const atEpoch = resolveBearings(gapped, {
    ...baseContext,
    ringPhaseRadians: 0,
  });
  // Arm 0 points into the gap at 0 degrees; arm 1 at 180 degrees fires.
  expect(atEpoch).toHaveLength(1);
  expect(atEpoch[0].bearingRadians).toBeCloseTo(Math.PI, 12);
  const halfTurnLater = resolveBearings(gapped, {
    ...baseContext,
    ringPhaseRadians: Math.PI,
  });
  // The same arm 0 has swept to 180 degrees and now fires; arm 1 is in the
  // gap at 360 degrees (the same bearing as 0). The gap itself did not move
  // with the live phase, which is what makes the opening a survivable place.
  expect(halfTurnLater).toHaveLength(1);
  expect(halfTurnLater[0].bearingRadians).toBeCloseTo(Math.PI, 12);
});

test("a gap sector travels with the pattern's authored initial phase", () => {
  const gaps = [[0, 10]] as const;
  const rotated = {
    ...RING,
    arms: 2,
    initialPhaseRadians: degrees(90),
    clockwiseDegreesPerSecond: 0,
    gapSectorsDegrees: gaps,
  } as RingPattern;
  const unrotated = {
    ...rotated,
    initialPhaseRadians: 0,
  } as RingPattern;
  const context: PatternContext = {
    ...baseContext,
    ringPhaseRadians: degrees(90),
  };
  // The ring's first arm starts at the pattern's 90-degree initial phase and
  // is therefore inside the sector, which is also measured from that phase.
  const rotatedBearings = resolveBearings(rotated, context);
  expect(rotatedBearings).toHaveLength(1);
  expect(rotatedBearings[0].bearingRadians).toBeCloseTo(degrees(270), 12);
  // With no authored rotation of the pattern's frame the same phase puts the
  // first arm at 90 degrees, outside the 0-10 degree sector, so both fire.
  expect(resolveBearings(unrotated, context)).toHaveLength(2);
});

test("a gap sector wraps across zero degrees", () => {
  const gapped = {
    ...RING,
    arms: 4,
    initialPhaseRadians: 0,
    clockwiseDegreesPerSecond: 0,
    gapSectorsDegrees: [[350, 10]],
  } as RingPattern;
  const bearings = resolveBearings(gapped, {
    ...baseContext,
    ringPhaseRadians: 0,
  });
  expect(bearings).toHaveLength(3);
  [90, 180, 270].forEach((degreesFromEast, index) => {
    expect(bearings[index].bearingRadians).toBeCloseTo(
      degrees(degreesFromEast),
      12,
    );
  });
});

test("arm spread grows linearly from zero with the attack clock's elapsed seconds and clamps at the maximum", () => {
  const spreading = {
    ...RING,
    arms: 2,
    initialPhaseRadians: 0,
    clockwiseDegreesPerSecond: 0,
    armSpreadDegreesPerSecond: 10,
    maxArmSpreadDegrees: 45,
  } as RingPattern;
  const at = (secondsSinceEpoch: number) =>
    resolveBearings(spreading, {
      ...baseContext,
      ringPhaseRadians: 0,
      secondsSinceEpoch,
    });
  const extraOffset = (secondsSinceEpoch: number): number =>
    at(secondsSinceEpoch)[1].bearingRadians - Math.PI;

  // At the clock epoch the spread is exactly zero: the 20.1 ring remains.
  const plainTwoArm = {
    ...RING,
    arms: 2,
    initialPhaseRadians: 0,
    clockwiseDegreesPerSecond: 0,
  };
  expect(at(0)).toEqual(
    resolveBearings(plainTwoArm, {
      ...baseContext,
      ringPhaseRadians: 0,
    }),
  );

  expect(extraOffset(1)).toBeCloseTo(degrees(10), 12);
  expect(extraOffset(2)).toBeCloseTo(degrees(20), 12);
  expect(extraOffset(3)).toBeCloseTo(degrees(30), 12);
  expect(extraOffset(4.5)).toBeCloseTo(degrees(45), 12);
  expect(extraOffset(5)).toBeCloseTo(degrees(45), 12);
  expect(extraOffset(60)).toBeCloseTo(degrees(45), 12);
  for (const bearing of at(60)) {
    expect(bearing.emitterRadiusTiles).toBe(0.35);
  }
});

test("a ring with all three options absent is byte-identical to step 20.1", () => {
  const phases = [0, Math.PI / 6, 1.234, -2.5, 7];
  for (const ringPhaseRadians of phases) {
    const context: PatternContext = {
      ...baseContext,
      ringPhaseRadians,
      secondsSinceEpoch: 12,
    };
    const reference = Array.from({ length: RING.arms }, (_, arm) => ({
      bearingRadians: ringPhaseRadians + (arm * 2 * Math.PI) / RING.arms,
      emitterRadiusTiles: RING.emitterRadiusTiles,
    }));
    expect(resolveBearings(RING, context)).toEqual(reference);
  }

  const explicitlyZeroed = {
    ...RING,
    perBurstAdvanceDegrees: 0,
    gapSectorsDegrees: [],
    armSpreadDegreesPerSecond: 0,
    maxArmSpreadDegrees: 0,
  } as RingPattern;
  expect(
    resolveBearings(explicitlyZeroed, {
      ...baseContext,
      ringPhaseRadians: Math.PI / 6,
      secondsSinceEpoch: 12,
    }),
  ).toEqual(resolveBearings(RING, baseContext));
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
