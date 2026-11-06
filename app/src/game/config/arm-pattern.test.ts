import { expect, test } from "vitest";
import { validateAttack } from "./data";
import { encounterConfigOf } from "./encounter";

const queen = encounterConfigOf("killer-bee-queen");

const IDS = new Set(["p"]);
const RING = {
  kind: "ring",
  arms: 4,
  emitterRadiusTiles: 0.5,
  initialPhaseDegrees: 0,
  clockwiseDegreesPerSecond: 10,
};
const CADENCE = {
  shotsPerBurst: 1,
  shotIntervalSeconds: 0.1,
  cooldownAfterLastShotSeconds: 1,
  initialDelaySeconds: 0,
};
const attackWith = (pattern: object) => ({
  id: "a",
  projectile: "p",
  tuningSource: "trainer-authored",
  pattern,
  cadence: CADENCE,
});
const validate = (pattern: object) =>
  validateAttack(attackWith(pattern), "a", IDS, new Set());
const ring = (armPattern: unknown) => ({ ...RING, armPattern });

test("a ring without armPattern loads with no armPattern key", () => {
  expect(validate(RING).pattern).not.toHaveProperty("armPattern");
});

test("every arm pattern kind is accepted", () => {
  for (const armPattern of [
    { kind: "single" },
    { kind: "spread", shots: 3, arcDegrees: 40 },
    { kind: "scatter", shots: 2, coneDegrees: 30 },
    { kind: "ring", arms: 3 },
    { kind: "ring", arms: 3, phaseOffsetDegrees: 15 },
  ])
    expect(validate(ring(armPattern)).pattern).toMatchObject({ armPattern });
});

test("three levels of nesting are accepted, with no depth limit (N10)", () => {
  const nested = {
    kind: "ring",
    arms: 2,
    armPattern: {
      kind: "ring",
      arms: 2,
      phaseOffsetDegrees: 10,
      armPattern: { kind: "spread", shots: 3, arcDegrees: 20 },
    },
  };
  expect(validate(ring(nested)).pattern).toMatchObject({ armPattern: nested });
});

test.each([
  ["an unknown kind", { kind: "star" }],
  ["a single with extra fields", { kind: "single", shots: 2 }],
  ["a spread with zero shots", { kind: "spread", shots: 0, arcDegrees: 10 }],
  ["a fractional spread count", { kind: "spread", shots: 1.5, arcDegrees: 10 }],
  ["a negative arc", { kind: "spread", shots: 2, arcDegrees: -1 }],
  ["a full-circle arc", { kind: "spread", shots: 2, arcDegrees: 360 }],
  ["a spread aim", { kind: "spread", shots: 2, arcDegrees: 10, aim: "player" }],
  ["a spread fixedBearingDegrees", { kind: "spread", shots: 2, arcDegrees: 10, fixedBearingDegrees: 0 }],
  ["a spread emitterRadiusTiles", { kind: "spread", shots: 2, arcDegrees: 10, emitterRadiusTiles: 1 }],
  ["a spread armPattern", { kind: "spread", shots: 2, arcDegrees: 10, armPattern: { kind: "single" } }],
  ["a scatter with a zero cone", { kind: "scatter", shots: 2, coneDegrees: 0 }],
  ["a scatter cone over 360", { kind: "scatter", shots: 2, coneDegrees: 361 }],
  ["a scatter aim", { kind: "scatter", shots: 2, coneDegrees: 10, aim: "fixed" }],
  ["a scatter emitterRadiusTiles", { kind: "scatter", shots: 2, coneDegrees: 10, emitterRadiusTiles: 1 }],
  ["an inner ring with zero arms", { kind: "ring", arms: 0 }],
  ["an inner ring phaseOffsetDegrees NaN", { kind: "ring", arms: 2, phaseOffsetDegrees: Number.NaN }],
  ["an inner ring emitterRadiusTiles", { kind: "ring", arms: 2, emitterRadiusTiles: 1 }],
  ["an inner ring clockwiseDegreesPerSecond", { kind: "ring", arms: 2, clockwiseDegreesPerSecond: 5 }],
  ["an inner ring initialPhaseDegrees", { kind: "ring", arms: 2, initialPhaseDegrees: 5 }],
  ["an inner ring perBurstAdvanceDegrees", { kind: "ring", arms: 2, perBurstAdvanceDegrees: 5 }],
  ["an inner ring gapSectorsDegrees", { kind: "ring", arms: 2, gapSectorsDegrees: [[0, 10]] }],
  ["an inner ring armSpreadDegreesPerSecond", { kind: "ring", arms: 2, armSpreadDegreesPerSecond: 1 }],
  ["an inner ring maxArmSpreadDegrees", { kind: "ring", arms: 2, maxArmSpreadDegrees: 1 }],
  ["a bad deeply nested pattern", { kind: "ring", arms: 2, armPattern: { kind: "spread", shots: 0, arcDegrees: 1 } }],
])("validateAttack rejects %s in armPattern", (_name, armPattern) => {
  expect(() => validate(ring(armPattern))).toThrow(RangeError);
});

test.each([
  [
    "a spread",
    { kind: "spread", shots: 2, arcDegrees: 10, aim: "player", emitterRadiusTiles: 0 },
  ],
  [
    "a scatter",
    { kind: "scatter", shots: 2, coneDegrees: 10, aim: "player", emitterRadiusTiles: 0 },
  ],
])("validateAttack rejects armPattern on %s (N04)", (_name, pattern) => {
  expect(() =>
    validate({ ...pattern, armPattern: { kind: "single" } }),
  ).toThrow(/armPattern/);
});

test("shipped rings load without an armPattern", () => {
  for (const phase of queen.archetypes[queen.primaryArchetypeId].phases)
    for (const attack of phase.attacks)
      expect(attack.pattern).not.toHaveProperty("armPattern");
});

test("a composite multiplies the worst-case live-shard bound by its shots per arm", async () => {
  const { attackShardBound } = await import("./encounter");
  const queenArchetype = queen.archetypes[queen.primaryArchetypeId];
  const base = queenArchetype.phases[0].attacks.find((attack) => attack.pattern.kind === "ring")!;
  const ringPattern = base.pattern as Extract<typeof base.pattern, { kind: "ring" }>;
  const plain = attackShardBound(queen, base);
  const composite = attackShardBound(queen, {
    ...base,
    pattern: {
      ...ringPattern,
      armPattern: { kind: "ring", arms: 2, armPattern: { kind: "spread", shots: 3, arcDegrees: 10 } },
    },
  });
  expect(composite).toBe(plain * 6);
});
