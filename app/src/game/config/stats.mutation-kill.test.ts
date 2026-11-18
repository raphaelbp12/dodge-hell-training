import { expect, test } from "vitest";
import { calculateEquippedStats } from "./stats";

const zero = { healthHp: 0, defense: 0, speed: 0, vitality: 0 };

test("a negative base stat is rejected even when a bonus would offset it", () => {
  expect(() =>
    calculateEquippedStats({ ...zero, defense: -5 }, [{ ...zero, defense: 10 }]),
  ).toThrow(RangeError);
});

test("a total that overflows to infinity is rejected", () => {
  expect(() =>
    calculateEquippedStats({ ...zero, healthHp: 1e308 }, [
      { ...zero, healthHp: 1e308 },
      { ...zero, healthHp: 1e308 },
    ]),
  ).toThrow(RangeError);
});
