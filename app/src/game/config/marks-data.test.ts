import { expect, test } from "vitest";
import { validateAttack } from "./data";
import { attackSpecFromAuthored } from "./encounter";

/** Plan V23 Q10: an authored attack carries exactly one of `marks` and `cadence`. */
const cadence = {
  shotsPerBurst: 1,
  shotIntervalSeconds: 0.1,
  cooldownAfterLastShotSeconds: 1,
  initialDelaySeconds: 0,
};
const base = {
  id: "gun",
  projectile: "p",
  tuningSource: "video-observation",
  pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "player", emitterRadiusTiles: 0 },
};
const ids = new Set(["p"]);
const validate = (value: unknown) => validateAttack(value, "attacks[0]", ids, new Set());

test("a marked attack is accepted and carried into the attack spec", () => {
  const marks = { bursts: [[4.867], [5.067, 5.067]], periodSeconds: 4, stopAfterSeconds: 20 };
  const attack = validate({ ...base, marks });
  expect(attack.marks).toEqual(marks);
  expect(attack).not.toHaveProperty("cadence");
  const spec = attackSpecFromAuthored(attack);
  expect(spec.marks).toEqual(marks);
  expect(spec).not.toHaveProperty("cadence");
});

test("a cadence attack is accepted unchanged", () => {
  expect(validate({ ...base, cadence })).toMatchObject({ cadence });
});

test.each([
  ["both keys", { cadence, marks: { bursts: [[0]] } }, /attacks\[0\].*exactly one of marks and cadence/],
  ["neither key", {}, /attacks\[0\].*exactly one of marks and cadence/],
  ["empty bursts", { marks: { bursts: [] } }, /attacks\[0\]\.marks\.bursts/],
  ["bursts not an array", { marks: { bursts: 3 } }, /attacks\[0\]\.marks\.bursts/],
  ["an empty burst", { marks: { bursts: [[0], []] } }, /attacks\[0\]\.marks\.bursts\[1\]/],
  ["a negative offset", { marks: { bursts: [[-0.1]] } }, /attacks\[0\]\.marks\.bursts\[0\]\[0\]/],
  ["a non-finite offset", { marks: { bursts: [[Infinity]] } }, /attacks\[0\]\.marks\.bursts\[0\]\[0\]/],
  ["a decreasing offset", { marks: { bursts: [[1, 2], [1.5]] } }, /attacks\[0\]\.marks\.bursts\[1\]\[0\]/],
  ["a zero period", { marks: { bursts: [[0]], periodSeconds: 0 } }, /attacks\[0\]\.marks\.periodSeconds/],
  ["a stop without a period", { marks: { bursts: [[0]], stopAfterSeconds: 1 } }, /attacks\[0\]\.marks\.stopAfterSeconds/],
  ["a negative stop", { marks: { bursts: [[0]], periodSeconds: 1, stopAfterSeconds: -1 } }, /attacks\[0\]\.marks\.stopAfterSeconds/],
])("validateAttack rejects %s", (_name, timing, message) => {
  expect(() => validate({ ...base, ...timing })).toThrow(message);
});
