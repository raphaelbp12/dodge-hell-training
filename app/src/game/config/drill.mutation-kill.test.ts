import { expect, test } from "vitest";
import {
  drillRulesVersion,
  normalizeDrillSelection,
  parseDrillFromLocation,
  phaseLabel,
} from "./drill";
import { encounterConfigOf, primaryArchetype } from "./encounter";

const QUEEN = encounterConfigOf("killer-bee-queen");

test("a selection with no phase indices is the full fight", () => {
  expect(
    normalizeDrillSelection({ phaseIndices: [], loop: false }, 8),
  ).toBeNull();
  expect(normalizeDrillSelection(null, 8)).toBeNull();
});

test("an empty selection keeps the base rules version", () => {
  expect(drillRulesVersion("base", { phaseIndices: [], loop: true })).toBe(
    "base",
  );
  expect(drillRulesVersion("base", { phaseIndices: [], loop: false })).toBe(
    "base",
  );
});

test("a phase id with no suffix keeps its own number", () => {
  expect(phaseLabel("phase-3", 0)).toBe("Phase 3");
});

test("a hyphen-only suffix keeps the number", () => {
  expect(phaseLabel("phase-3--", 0)).toBe("Phase 3");
});

test("empty words between hyphens are dropped from the label", () => {
  expect(phaseLabel("phase-3-a--b", 0)).toBe("Phase 3 - A B");
});

test("whitespace around a phase value is ignored", () => {
  expect(parseDrillFromLocation(QUEEN, "?phase=1, 3")).toEqual({
    phaseIndices: [1, 3],
    loop: false,
  });
});

test("multi-digit phase indices parse for a long encounter", () => {
  const archetype = primaryArchetype(QUEEN);
  const phases = Array.from({ length: 12 }, () => archetype.phases[0]);
  const long = {
    ...QUEEN,
    archetypes: {
      ...QUEEN.archetypes,
      [QUEEN.primaryArchetypeId]: { ...archetype, phases },
    },
  };
  expect(parseDrillFromLocation(long, "?phase=10")).toEqual({
    phaseIndices: [10],
    loop: false,
  });
  expect(parseDrillFromLocation(long, "?phase=12")).toBeNull();
});
