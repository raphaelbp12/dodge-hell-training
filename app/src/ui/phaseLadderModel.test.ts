import { expect, test } from "vitest";
import { ladderRowState, splitPhaseLabel, subPhaseWords } from "./phaseLadderModel";

test("ladder rows follow the current phase in a full fight", () => {
  expect(ladderRowState(0, 2, null)).toBe("done");
  expect(ladderRowState(2, 2, null)).toBe("current");
  expect(ladderRowState(3, 2, null)).toBe("upcoming");
});

test("a drill excludes unselected phases and a loop has no finished phase", () => {
  const once = { phaseIndices: [2, 4], loop: false };
  expect(ladderRowState(0, 2, once)).toBe("excluded");
  expect(ladderRowState(4, 2, once)).toBe("upcoming");
  expect(ladderRowState(2, 4, once)).toBe("done");
  const loop = { phaseIndices: [2, 4], loop: true };
  expect(ladderRowState(2, 4, loop)).toBe("upcoming");
});

test("splits a phase label into number and name", () => {
  expect(splitPhaseLabel("Phase 3 - Pond Barrage")).toEqual({
    number: "3",
    name: "Pond Barrage",
  });
  expect(splitPhaseLabel("Phase 1")).toEqual({ number: "1", name: null });
  expect(splitPhaseLabel("Odd")).toEqual({ number: "", name: "Odd" });
});

test("capitalises sub-phase ids", () => {
  expect(subPhaseWords("circle-room")).toBe("Circle Room");
  expect(subPhaseWords("red")).toBe("Red");
});
