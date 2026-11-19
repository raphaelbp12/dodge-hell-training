import { describe, expect, test } from "vitest";
import { decideSlowTestReport, findSlowTests } from "./slow-test-reporter.mjs";

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

describe("decideSlowTestReport", () => {
  const slow = [{ name: "a > b", duration: 40000, timeout: 60000 }];

  test("on GitHub Actions warns per slow test and does not fail", () => {
    const r = decideSlowTestReport(slow, true);
    expect(r.fail).toBe(false);
    expect(r.text).toContain("::warning title=Slow test::40000 ms of 60000 ms: a > b");
  });

  test("elsewhere reports and fails without workflow commands", () => {
    const r = decideSlowTestReport(slow, false);
    expect(r.fail).toBe(true);
    expect(r.text).toContain("Slow tests: 1");
    expect(r.text).not.toContain("::warning");
  });

  test("no slow test gives no output and no failure", () => {
    for (const ci of [true, false]) {
      expect(decideSlowTestReport([], ci)).toEqual({ text: "", fail: false });
    }
  });
});
