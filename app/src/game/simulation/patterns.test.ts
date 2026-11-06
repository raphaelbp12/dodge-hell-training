import { expect, test } from "vitest";
import { resolveBearings, scatterDrawCount, type PatternContext } from "./patterns";
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

// --- Plan V15 phase 51: a ring whose arms each fire a pattern. ---

const ARM_RING = (armPattern: RingPattern["armPattern"], arms = 4): RingPattern => ({
  ...RING,
  arms,
  clockwiseDegreesPerSecond: 0,
  armPattern,
});
const ARM_CONTEXT: PatternContext = { ...baseContext, ringPhaseRadians: 0 };
const bearingsOf = (pattern: RingPattern, context = ARM_CONTEXT): number[] =>
  resolveBearings(pattern, context).map((bearing) => bearing.bearingRadians);

test("a ring of 3-shot spreads gives one cluster per arm, centred on the arm", () => {
  const bearings = bearingsOf(
    ARM_RING({ kind: "spread", shots: 3, arcDegrees: 20 }),
  );
  expect(bearings).toHaveLength(12);
  for (let arm = 0; arm < 4; arm++) {
    const centre = arm * (Math.PI / 2);
    expect(bearings[arm * 3]).toBeCloseTo(centre - degrees(10), 12);
    expect(bearings[arm * 3 + 1]).toBeCloseTo(centre, 12);
    expect(bearings[arm * 3 + 2]).toBeCloseTo(centre + degrees(10), 12);
  }
});

test("an absent or single armPattern is exactly the plain ring", () => {
  const plain = bearingsOf(ARM_RING(undefined));
  expect(bearingsOf(ARM_RING({ kind: "single" }))).toEqual(plain);
  expect(plain).toHaveLength(4);
});

test("a 1-shot arm spread equals its arm", () => {
  expect(bearingsOf(ARM_RING({ kind: "spread", shots: 1, arcDegrees: 90 }))).toEqual(
    bearingsOf(ARM_RING(undefined)),
  );
});

test("a ring of rings fires every inner arm around its outer arm", () => {
  const bearings = bearingsOf(ARM_RING({ kind: "ring", arms: 2 }, 2));
  expect(bearings).toHaveLength(4);
  expect(bearings[0]).toBeCloseTo(0, 12);
  expect(bearings[1]).toBeCloseTo(Math.PI, 12);
  expect(bearings[2]).toBeCloseTo(Math.PI, 12);
  expect(bearings[3]).toBeCloseTo(2 * Math.PI, 12);
});

test("an inner ring's phaseOffsetDegrees offsets its arms from the outer arm", () => {
  const bearings = bearingsOf(
    ARM_RING({ kind: "ring", arms: 2, phaseOffsetDegrees: 30 }, 1),
  );
  expect(bearings[0]).toBeCloseTo(degrees(30), 12);
  expect(bearings[1]).toBeCloseTo(degrees(30) + Math.PI, 12);
});

test("three levels of nesting expand depth first", () => {
  const bearings = bearingsOf(
    ARM_RING(
      {
        kind: "ring",
        arms: 2,
        armPattern: { kind: "spread", shots: 3, arcDegrees: 20 },
      },
      2,
    ),
  );
  expect(bearings).toHaveLength(12);
  // First outer arm (0), first inner arm (0): a cluster around 0.
  expect(bearings[1]).toBeCloseTo(0, 12);
  // First outer arm, second inner arm: a cluster around pi.
  expect(bearings[4]).toBeCloseTo(Math.PI, 12);
  // Second outer arm (pi), first inner arm: a cluster around pi again.
  expect(bearings[7]).toBeCloseTo(Math.PI, 12);
});

test("a gap removes a whole arm's shots, not part of its cluster", () => {
  const gapped: RingPattern = {
    ...ARM_RING({ kind: "spread", shots: 3, arcDegrees: 20 }),
    // Covers only arm 1 (90 degrees); the cluster's own shots span 80-100.
    gapSectorsDegrees: [[85, 95]],
  };
  const bearings = bearingsOf(gapped);
  expect(bearings).toHaveLength(9);
  expect(bearings.every((bearing) => Math.abs(bearing - Math.PI / 2) > degrees(5))).toBe(true);
});

test("every shot offsets along its own bearing from the outermost emitter radius", () => {
  const resolved = resolveBearings(
    ARM_RING({ kind: "spread", shots: 3, arcDegrees: 20 }),
    ARM_CONTEXT,
  );
  for (const bearing of resolved) expect(bearing.emitterRadiusTiles).toBe(0.35);
});

test("per-burst advance and ring phase move every cluster together", () => {
  const spread = { kind: "spread", shots: 3, arcDegrees: 20 } as const;
  const at = (phase: number) =>
    bearingsOf(ARM_RING(spread), { ...ARM_CONTEXT, ringPhaseRadians: phase });
  const base = at(0);
  const turned = at(degrees(25));
  base.forEach((bearing, index) =>
    expect(turned[index]).toBeCloseTo(bearing + degrees(25), 12),
  );
  const advancing: RingPattern = { ...ARM_RING(spread), perBurstAdvanceDegrees: 10 };
  bearingsOf(advancing, { ...ARM_CONTEXT, burstsFired: 2 }).forEach((bearing, index) =>
    expect(bearing).toBeCloseTo(base[index] + degrees(20), 12),
  );
});

test("a scatter arm reads one draw per final shot in depth-first arm order", () => {
  const pattern = ARM_RING({ kind: "scatter", shots: 2, coneDegrees: 40 }, 2);
  expect(scatterDrawCount(pattern)).toBe(4);
  const draws = [0, 0.25, 0.75, 1];
  const bearings = bearingsOf(pattern, { ...ARM_CONTEXT, drawnUnitRandoms: draws });
  const cone = degrees(40);
  const expected = [
    0 + (0 - 0.5) * cone,
    0 + (0.25 - 0.5) * cone,
    Math.PI + (0.75 - 0.5) * cone,
    Math.PI + (1 - 0.5) * cone,
  ];
  bearings.forEach((bearing, index) => expect(bearing).toBeCloseTo(expected[index], 12));
});

test("a gap-removed scatter arm still consumes its draws, so later arms are unchanged", () => {
  const scatter = { kind: "scatter", shots: 2, coneDegrees: 40 } as const;
  const draws = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  const ungapped = bearingsOf(ARM_RING(scatter), { ...ARM_CONTEXT, drawnUnitRandoms: draws });
  const gapped = bearingsOf(
    { ...ARM_RING(scatter), gapSectorsDegrees: [[85, 95]] },
    { ...ARM_CONTEXT, drawnUnitRandoms: draws },
  );
  expect(scatterDrawCount(ARM_RING(scatter))).toBe(8);
  expect(gapped).toEqual([...ungapped.slice(0, 2), ...ungapped.slice(4)]);
});

test("scatterDrawCount is zero without a scatter and the shot count for a top-level scatter", () => {
  expect(scatterDrawCount(RING)).toBe(0);
  expect(scatterDrawCount(ARM_RING({ kind: "spread", shots: 5, arcDegrees: 10 }))).toBe(0);
  expect(
    scatterDrawCount({
      kind: "scatter",
      shots: 7,
      coneDegrees: 10,
      aim: "fixed",
      fixedBearingDegrees: 0,
      emitterRadiusTiles: 0,
    }),
  ).toBe(7);
  expect(
    scatterDrawCount(ARM_RING({ kind: "ring", arms: 3, armPattern: { kind: "scatter", shots: 2, coneDegrees: 5 } }, 2)),
  ).toBe(12);
});

test("a composite ring requires enough drawn values for its scatter shots", () => {
  expect(() =>
    bearingsOf(ARM_RING({ kind: "scatter", shots: 2, coneDegrees: 40 }), {
      ...ARM_CONTEXT,
      drawnUnitRandoms: [0.5],
    }),
  ).toThrow(RangeError);
});

// --- Plan V15 phase 52: front-relative aim. ---

const FRONT_SPREAD = (offsetDegrees: number, shots = 3): SpreadPattern => ({
  kind: "spread",
  shots,
  arcDegrees: 20,
  aim: "front",
  offsetDegrees,
  emitterRadiusTiles: 0.5,
});
const withHeading = (headingRadians: number): PatternContext => ({
  ...baseContext,
  enemyHeadingRadians: headingRadians,
});

test.each([
  [0, 0],
  [180, Math.PI],
  [-90, -Math.PI / 2],
  [37.5, degrees(37.5)],
])("a front-aimed spread at offset %s centres on heading + offset", (offset, offsetRadians) => {
  const heading = degrees(25);
  const bearings = resolveBearings(FRONT_SPREAD(offset), withHeading(heading));
  expect(bearings[1].bearingRadians).toBeCloseTo(heading + offsetRadians, 12);
  expect(bearings[0].bearingRadians).toBeCloseTo(heading + offsetRadians - degrees(10), 12);
});

test("a front-aimed scatter centres its cone on heading + offset", () => {
  const scatter: ScatterPattern = {
    kind: "scatter",
    shots: 2,
    coneDegrees: 40,
    aim: "front",
    offsetDegrees: 180,
    emitterRadiusTiles: 0,
  };
  const bearings = resolveBearings(scatter, {
    ...withHeading(degrees(10)),
    drawnUnitRandoms: [0.5, 1],
  });
  expect(bearings[0].bearingRadians).toBeCloseTo(degrees(10) + Math.PI, 12);
  expect(bearings[1].bearingRadians).toBeCloseTo(degrees(10) + Math.PI + degrees(20), 12);
});

test("a front-aimed bearing follows the heading and ignores the player", () => {
  const spread = FRONT_SPREAD(0, 1);
  const at = (heading: number, player: { x: number; y: number }) =>
    resolveBearings(spread, { ...withHeading(heading), playerPositionTiles: player })[0]
      .bearingRadians;
  expect(at(1, { x: 0, y: 0 })).toBe(at(1, { x: 50, y: -3 }));
  expect(at(2, { x: 0, y: 0 })).toBeCloseTo(at(1, { x: 0, y: 0 }) + 1, 12);
});

test("a front-aimed pattern without a heading in the context uses 0", () => {
  expect(resolveBearings(FRONT_SPREAD(90, 1), baseContext)[0].bearingRadians).toBeCloseTo(
    Math.PI / 2,
    12,
  );
});
