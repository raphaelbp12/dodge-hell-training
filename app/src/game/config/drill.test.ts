import { expect, test } from "vitest";
import type { DrillSelection } from "../models";
import { retainedBestSeconds } from "../../storage/attempts";
import {
  drillRulesVersion,
  nextDrillPhaseIndex,
  normalizeDrillSelection,
  parseDrillFromLocation,
  phaseLabel,
} from "./drill";
import { encounterConfigOf } from "./encounter";

const PHASE_COUNT = 8;
const BASE_RULES_VERSION = "base-v1";

test("a drill normalizes to sorted, unique phase indices", () => {
  expect(
    normalizeDrillSelection({ phaseIndices: [3, 1, 3], loop: true }, PHASE_COUNT),
  ).toEqual({ phaseIndices: [1, 3], loop: true });
});

test("an empty, absent or null drill is the full fight", () => {
  expect(normalizeDrillSelection(null, PHASE_COUNT)).toBeNull();
  expect(normalizeDrillSelection(undefined, PHASE_COUNT)).toBeNull();
  expect(
    normalizeDrillSelection({ phaseIndices: [], loop: true }, PHASE_COUNT),
  ).toBeNull();
});

test.each([-1, PHASE_COUNT, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects an invalid drill phase index %s",
  (index) => {
    expect(() =>
      normalizeDrillSelection({ phaseIndices: [index], loop: false }, PHASE_COUNT),
    ).toThrow(RangeError);
  },
);

test("nextDrillPhaseIndex follows authored order and wraps only when looping", () => {
  const drill: DrillSelection = { phaseIndices: [1, 3, 5], loop: true };
  expect(nextDrillPhaseIndex(drill, 1)).toBe(3);
  expect(nextDrillPhaseIndex(drill, 3)).toBe(5);
  expect(nextDrillPhaseIndex(drill, 5)).toBe(1);
  expect(nextDrillPhaseIndex({ ...drill, loop: false }, 5)).toBeNull();
});

test("drillRulesVersion separates base, loop, one-shot and phase sets", () => {
  expect(drillRulesVersion(BASE_RULES_VERSION, null)).toBe(BASE_RULES_VERSION);
  expect(
    drillRulesVersion(BASE_RULES_VERSION, { phaseIndices: [2], loop: true }),
  ).toBe("base-v1-drill-p2");
  expect(
    drillRulesVersion(BASE_RULES_VERSION, { phaseIndices: [2], loop: false }),
  ).toBe("base-v1-drill-p2-once");
  expect(
    drillRulesVersion(BASE_RULES_VERSION, { phaseIndices: [1, 3], loop: true }),
  ).toBe("base-v1-drill-p1-3");
  expect(
    drillRulesVersion(BASE_RULES_VERSION, { phaseIndices: [1, 3], loop: false }),
  ).toBe("base-v1-drill-p1-3-once");
});

test("the same selection with a different loop flag or phase set has a different identity", () => {
  const loop = drillRulesVersion(BASE_RULES_VERSION, {
    phaseIndices: [1, 3],
    loop: true,
  });
  const once = drillRulesVersion(BASE_RULES_VERSION, {
    phaseIndices: [1, 3],
    loop: false,
  });
  const other = drillRulesVersion(BASE_RULES_VERSION, {
    phaseIndices: [1, 4],
    loop: true,
  });
  expect(new Set([loop, once, other]).size).toBe(3);
});

test("retainedBestSeconds keeps loop, one-shot and different groups separate", () => {
  const loop = drillRulesVersion(BASE_RULES_VERSION, {
    phaseIndices: [1, 3],
    loop: true,
  });
  const once = drillRulesVersion(BASE_RULES_VERSION, {
    phaseIndices: [1, 3],
    loop: false,
  });
  const other = drillRulesVersion(BASE_RULES_VERSION, {
    phaseIndices: [2],
    loop: true,
  });
  const records = [
    {
      id: "a",
      rulesVersion: loop,
      elapsedSeconds: 100,
      hitsTaken: 0,
      outcome: "death" as const,
    },
    {
      id: "b",
      rulesVersion: once,
      elapsedSeconds: 50,
      hitsTaken: 0,
      outcome: "cleared" as const,
    },
    {
      id: "c",
      rulesVersion: other,
      elapsedSeconds: 25,
      hitsTaken: 0,
      outcome: "death" as const,
    },
  ];
  expect(retainedBestSeconds(records, loop)).toBe(100);
  expect(retainedBestSeconds(records, once)).toBe(50);
  expect(retainedBestSeconds(records, other)).toBe(25);
  expect(retainedBestSeconds(records, BASE_RULES_VERSION)).toBeNull();
});

test("the old single-loop identity is unchanged", () => {
  expect(
    drillRulesVersion(BASE_RULES_VERSION, { phaseIndices: [4], loop: true }),
  ).toBe("base-v1-drill-p4");
});

test("phase labels derive from the authored id", () => {
  expect(phaseLabel("phase-3-pond-barrage", 2)).toBe("Phase 3 - Pond Barrage");
  expect(phaseLabel("phase-2-color-chase", 1)).toBe("Phase 2 - Color Chase");
  expect(phaseLabel("phase-8-final", 7)).toBe("Phase 8 - Final");
  // The id's own number wins over the array position.
  expect(phaseLabel("phase-7-beehemoths", 0)).toBe("Phase 7 - Beehemoths");
});

test("a phase id without a numeric prefix falls back to its position", () => {
  expect(phaseLabel("sole", 0)).toBe("Phase 1");
  expect(phaseLabel("opening", 4)).toBe("Phase 5");
});

test("a trailing hyphen in a numeric id keeps the number", () => {
  expect(phaseLabel("phase-3-", 2)).toBe("Phase 3");
});

const QUEEN = encounterConfigOf("killer-bee-queen");
const WORM = encounterConfigOf("crystal-worm");

test("?phase= parses a comma-separated looped selection", () => {
  expect(parseDrillFromLocation(QUEEN, "?phase=1,3,5&loop=1")).toEqual({
    phaseIndices: [1, 3, 5],
    loop: true,
  });
});

test("?phase= without loop is a one-shot selection", () => {
  expect(parseDrillFromLocation(QUEEN, "?phase=1,3,5")).toEqual({
    phaseIndices: [1, 3, 5],
    loop: false,
  });
});

test("the single ?phase= form stays valid", () => {
  expect(parseDrillFromLocation(QUEEN, "?phase=3")).toEqual({
    phaseIndices: [3],
    loop: false,
  });
  expect(parseDrillFromLocation(QUEEN, "?phase=3&loop=1")).toEqual({
    phaseIndices: [3],
    loop: true,
  });
});

test("duplicate and unsorted phase values normalize", () => {
  expect(parseDrillFromLocation(QUEEN, "?phase=5,1,3,5")).toEqual({
    phaseIndices: [1, 3, 5],
    loop: false,
  });
});

test.each([
  "",
  "?phase=",
  "?phase=abc",
  "?phase=1.5",
  "?phase=8",
  "?phase=-1",
  "?phase=1,,3",
  "?phase=1,99",
])("an invalid phase list %s falls back to Full fight", (search) => {
  expect(parseDrillFromLocation(QUEEN, search)).toBeNull();
});

test("the phase range follows the selected encounter", () => {
  expect(parseDrillFromLocation(WORM, "?phase=0")).toEqual({
    phaseIndices: [0],
    loop: false,
  });
  expect(parseDrillFromLocation(WORM, "?phase=1")).toBeNull();
});

test("loop values other than 1 mean one-shot", () => {
  expect(parseDrillFromLocation(QUEEN, "?phase=2&loop=0")).toEqual({
    phaseIndices: [2],
    loop: false,
  });
  expect(parseDrillFromLocation(QUEEN, "?phase=2&loop=true")).toEqual({
    phaseIndices: [2],
    loop: false,
  });
});

test("repeated phase parameters fall back to Full fight", () => {
  expect(parseDrillFromLocation(QUEEN, "?phase=1&phase=2")).toBeNull();
  expect(parseDrillFromLocation(QUEEN, "?phase=1,3&phase=2")).toBeNull();
});

test("repeated loop parameters fall back to Full fight", () => {
  expect(parseDrillFromLocation(QUEEN, "?phase=2&loop=1&loop=0")).toBeNull();
});
