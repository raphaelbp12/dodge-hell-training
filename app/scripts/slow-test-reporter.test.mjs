import { describe, expect, test } from "vitest";
import { findSlowTests } from "./slow-test-reporter.mjs";

describe("findSlowTests", () => {
  test("flags only tests above half their timeout", () => {
    const tests = [
      { name: "fast", duration: 100, timeout: 60000 },
      { name: "edge", duration: 30000, timeout: 60000 },
      { name: "slow", duration: 30001, timeout: 60000 },
      { name: "own", duration: 6000, timeout: 10000 },
    ];
    expect(findSlowTests(tests).map((t) => t.name)).toEqual(["slow", "own"]);
  });

  test("honours a custom fraction and ignores zero timeouts", () => {
    expect(findSlowTests([{ name: "a", duration: 3, timeout: 10 }], 0.25)).toHaveLength(1);
    expect(findSlowTests([{ name: "z", duration: 3, timeout: 0 }])).toHaveLength(0);
  });
});
