import { describe, expect, test } from "vitest";
import type { AttemptRecord } from "../storage/attempts";
import {
  compareResult,
  describeRulesVersion,
  sparklinePoints,
  sparklineSeconds,
} from "./historyModel";

const BASE = "killer-bee-queen-nest-paladin-v12";
const encounters = [
  { displayName: "Killer Bee Queen", rulesVersion: BASE },
  { displayName: "Crystal Worm", rulesVersion: "crystal-worm-child-head-paladin-v1" },
];
const record = (id: string, seconds: number, rulesVersion = BASE): AttemptRecord => ({
  id,
  rulesVersion,
  elapsedSeconds: seconds,
  hitsTaken: 1,
  outcome: "death",
});

describe("describeRulesVersion", () => {
  test.each([
    [BASE, BASE, "This selection"],
    [BASE, "other", "Killer Bee Queen, full fight"],
    [`${BASE}-drill-p2`, "other", "Killer Bee Queen, phase 3 on loop"],
    [`${BASE}-drill-p2-4-once`, "other", "Killer Bee Queen, phases 3, 5 once"],
    ["crystal-worm-child-head-paladin-v1x", "other", "Other rules"],
  ])("%s", (version, selected, expected) => {
    expect(describeRulesVersion(version, selected, encounters)).toBe(expected);
  });
});

describe("compareResult", () => {
  test("first attempt, new best and short", () => {
    expect(compareResult(5, [record("a", 5)], BASE)).toEqual({ kind: "first" });
    expect(compareResult(8, [record("b", 8), record("a", 5)], BASE)).toEqual({
      kind: "best",
    });
    expect(compareResult(4.25, [record("b", 4.25), record("a", 5)], BASE)).toEqual({
      kind: "short",
      seconds: 0.75,
    });
  });
});

describe("sparkline", () => {
  test("is oldest first and limited to this identity", () => {
    const records = [record("c", 3), record("x", 9, "other"), record("b", 2), record("a", 1)];
    expect(sparklineSeconds(records, BASE)).toEqual([1, 2, 3]);
  });

  test("needs two points", () => {
    expect(sparklinePoints([1], 100, 10)).toBeNull();
    expect(sparklinePoints([1, 3], 100, 10)).toBe("0.0,10.0 100.0,0.0");
  });
});
