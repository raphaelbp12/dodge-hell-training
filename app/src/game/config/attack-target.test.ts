import { expect, test } from "vitest";
import {
  encounterConfigOf,
  validateAttackSpec,
  type AttackSpec,
} from "./encounter";
import { validateAttack } from "./data";

const queen = encounterConfigOf("killer-bee-queen");
const archetype = queen.archetypes[queen.primaryArchetypeId];
const targeted = archetype.phases[0].attacks.find(
  (attack) => attack.id === "white-bomb-targeted",
)!;

test("a targeted single-shot player-aimed bomb is valid", () => {
  expect(() =>
    validateAttackSpec(queen, { ...targeted, target: "player" }),
  ).not.toThrow();
});

test.each([
  ["a bullet", { projectileId: "red-stinger-small" }],
  [
    "three shots",
    { pattern: { ...(targeted.pattern as object), shots: 3 } },
  ],
  [
    "a fixed aim",
    {
      pattern: {
        ...(targeted.pattern as object),
        aim: "fixed",
        fixedBearingDegrees: 0,
      },
    },
  ],
  [
    "a ring",
    {
      pattern: {
        kind: "ring",
        arms: 1,
        emitterRadiusTiles: 0,
        initialPhaseRadians: 0,
        clockwiseDegreesPerSecond: 0,
      },
    },
  ],
])("validateAttackSpec rejects target on %s", (_name, override) => {
  expect(() =>
    validateAttackSpec(queen, {
      ...targeted,
      target: "player",
      ...override,
    } as AttackSpec),
  ).toThrow(/target|bomb/i);
});

test("the authored attack accepts target player only", () => {
  const authored = {
    id: "a",
    projectile: "p",
    tuningSource: "trainer-authored",
    pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "player", emitterRadiusTiles: 0 },
    cadence: {
      shotsPerBurst: 1,
      shotIntervalSeconds: 0.1,
      cooldownAfterLastShotSeconds: 1,
      initialDelaySeconds: 0,
    },
  };
  const ids = new Set(["p"]);
  expect(validateAttack({ ...authored, target: "player" }, "a", ids, new Set())).toMatchObject({
    target: "player",
  });
  expect(validateAttack(authored, "a", ids, new Set())).not.toHaveProperty("target");
  expect(() =>
    validateAttack({ ...authored, target: "enemy" }, "a", ids, new Set()),
  ).toThrow(RangeError);
});
