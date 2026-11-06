import { expect, test } from "vitest";
import { validateAttack } from "./data";
import {
  ENCOUNTER_CONFIG,
  primaryArchetype,
  validateEncounterConfig,
  type AttackSpec,
  type EncounterConfig,
  type SubPhaseSpec,
} from "./encounter";

const IDS = new Set(["p"]);
const CADENCE = {
  shotsPerBurst: 1,
  shotIntervalSeconds: 0.1,
  cooldownAfterLastShotSeconds: 1,
  initialDelaySeconds: 0,
};
const authored = (pattern: object) => ({
  id: "a",
  projectile: "p",
  tuningSource: "trainer-authored",
  pattern,
  cadence: CADENCE,
});
const validate = (pattern: object) =>
  validateAttack(authored(pattern), "a", IDS, new Set());
const SPREAD = { kind: "spread", shots: 3, arcDegrees: 20, emitterRadiusTiles: 0 };
const SCATTER = { kind: "scatter", shots: 3, coneDegrees: 20, emitterRadiusTiles: 0 };

test.each([
  ["spread", SPREAD],
  ["scatter", SCATTER],
])("an authored %s accepts aim front with a finite offsetDegrees", (_name, base) => {
  for (const offsetDegrees of [0, 180, -45.5])
    expect(validate({ ...base, aim: "front", offsetDegrees }).pattern).toMatchObject({
      aim: "front",
      offsetDegrees,
    });
});

test.each([
  ["a missing offsetDegrees", { ...SPREAD, aim: "front" }],
  ["a nonfinite offsetDegrees", { ...SPREAD, aim: "front", offsetDegrees: Number.NaN }],
  ["a fixedBearingDegrees", { ...SPREAD, aim: "front", offsetDegrees: 0, fixedBearingDegrees: 0 }],
  ["an offsetDegrees with aim player", { ...SPREAD, aim: "player", offsetDegrees: 0 }],
  ["an offsetDegrees with aim fixed", { ...SPREAD, aim: "fixed", fixedBearingDegrees: 0, offsetDegrees: 0 }],
  ["a front aim on a ring", { kind: "ring", arms: 3, emitterRadiusTiles: 0, initialPhaseDegrees: 0, clockwiseDegreesPerSecond: 0, aim: "front", offsetDegrees: 0 }],
  ["a front aim on an inner spread", { kind: "ring", arms: 3, emitterRadiusTiles: 0, initialPhaseDegrees: 0, clockwiseDegreesPerSecond: 0, armPattern: { kind: "spread", shots: 2, arcDegrees: 10, aim: "front", offsetDegrees: 0 } }],
])("validateAttack rejects %s", (_name, pattern) => {
  expect(() => validate(pattern)).toThrow(RangeError);
});

const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const FRONT_ATTACK: AttackSpec = {
  ...PRIMARY.phases[0].attacks[0],
  id: "front-shot",
  pattern: {
    kind: "spread",
    shots: 1,
    arcDegrees: 0,
    aim: "front",
    offsetDegrees: 180,
    emitterRadiusTiles: 0,
  },
};

function configWith(
  attack: AttackSpec,
  where: "phase" | "sub-phase",
  initialHeadingDegrees?: number,
): EncounterConfig {
  const phase = PRIMARY.phases[0];
  const subPhase: SubPhaseSpec = {
    id: "sub",
    durationSeconds: 5,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    movement: null,
    attacks: [attack],
    spawns: null,
  };
  const patched =
    where === "phase"
      ? { ...phase, attacks: [attack] }
      : { ...phase, subPhases: [subPhase] };
  return {
    ...ENCOUNTER_CONFIG,
    archetypes: {
      [PRIMARY.id]: {
        ...PRIMARY,
        ...(initialHeadingDegrees === undefined ? {} : { initialHeadingDegrees }),
        phases: [patched],
      },
    },
  };
}

test.each(["phase", "sub-phase"] as const)(
  "a front-aimed attack in a %s requires the archetype's initialHeadingDegrees (N17)",
  (where) => {
    expect(() => validateEncounterConfig(configWith(FRONT_ATTACK, where))).toThrow(
      /initialHeadingDegrees/,
    );
    expect(() => validateEncounterConfig(configWith(FRONT_ATTACK, where, 0))).not.toThrow();
  },
);

test("a runtime spread with a nonfinite front offset is rejected", () => {
  const bad = {
    ...FRONT_ATTACK,
    pattern: { ...FRONT_ATTACK.pattern, offsetDegrees: Number.NaN },
  } as AttackSpec;
  expect(() => validateEncounterConfig(configWith(bad, "phase", 0))).toThrow(RangeError);
});

test("an archetype's initialHeadingDegrees must be finite", () => {
  expect(() =>
    validateEncounterConfig(configWith(FRONT_ATTACK, "phase", Number.NaN)),
  ).toThrow(/initialHeadingDegrees/);
});
