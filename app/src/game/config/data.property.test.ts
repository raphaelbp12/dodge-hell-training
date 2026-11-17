import fc from "fast-check";
import { expect, test } from "vitest";
import encounterData from "../data/encounter.json";
import projectilesData from "../data/projectiles.json";
import { propertyParameters } from "../../test/property";
import {
  AUTHORED_APPEARANCES,
  AUTHORED_ENCOUNTER_DATA,
  AUTHORED_MONSTER_FILES,
  AUTHORED_PROJECTILES,
  validateAppearances,
  validateArchetypes,
  validateArenaMap,
  validateEncounterData,
  validateProjectiles,
} from "./data";

/**
 * Every validator documents one failure type: `RangeError` through `reject`.
 * A `TypeError`, `ReferenceError` or stack overflow means untrusted input
 * reached code that assumed its shape.
 */
function expectReturnsOrRangeError(call: () => unknown): void {
  try {
    call();
  } catch (error) {
    expect(error).toBeInstanceOf(RangeError);
  }
}

const anyJson = fc.oneof(fc.jsonValue(), fc.anything());

/** Replaces one node of a JSON document, picked by index, with any value. */
function withReplacedNode(
  document: unknown,
  nodeIndex: number,
  replacement: unknown,
): unknown {
  let counter = 0;
  const walk = (node: unknown): unknown => {
    if (counter++ === nodeIndex) return replacement;
    if (Array.isArray(node)) return node.map(walk);
    if (typeof node === "object" && node !== null)
      return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [key, walk(child)]),
      );
    return node;
  };
  return walk(document);
}

function nodeCount(document: unknown): number {
  if (Array.isArray(document))
    return 1 + document.reduce((sum: number, child) => sum + nodeCount(child), 0);
  if (typeof document === "object" && document !== null)
    return 1 + Object.values(document).reduce((sum, child) => sum + nodeCount(child), 0);
  return 1;
}

const STEP_SECONDS = AUTHORED_ENCOUNTER_DATA.simulation.fixedStepSeconds;
const APPEARANCE_IDS = new Set(Object.keys(AUTHORED_APPEARANCES.appearances));
const PROJECTILE_IDS = new Set(Object.keys(AUTHORED_PROJECTILES));
const MONSTER_FILES = { archetypes: AUTHORED_MONSTER_FILES };

test("loaders fail with RangeError, or return, for any JSON value", () => {
  fc.assert(
    fc.property(anyJson, (value) => {
      expectReturnsOrRangeError(() => validateEncounterData(value));
      expectReturnsOrRangeError(() => validateArenaMap(value));
      expectReturnsOrRangeError(() => validateAppearances(value));
      expectReturnsOrRangeError(() => validateProjectiles(value, STEP_SECONDS, APPEARANCE_IDS));
      expectReturnsOrRangeError(() =>
        validateArchetypes({ archetypes: { anything: value } }, PROJECTILE_IDS, 12),
      );
    }),
    propertyParameters(),
  );
});

function mutatedDocumentTest(
  name: string,
  document: unknown,
  validate: (value: unknown) => unknown,
): void {
  const nodes = nodeCount(document);
  test(name, () => {
    fc.assert(
      fc.property(fc.nat({ max: nodes - 1 }), anyJson, (index, replacement) => {
        expectReturnsOrRangeError(() =>
          validate(withReplacedNode(document, index, replacement)),
        );
      }),
      propertyParameters(),
    );
  });
}

mutatedDocumentTest("encounter data with one node replaced fails with RangeError or loads", encounterData, validateEncounterData);
mutatedDocumentTest("projectile data with one node replaced fails with RangeError or loads", projectilesData, (value) =>
  validateProjectiles(value, STEP_SECONDS, APPEARANCE_IDS),
);
mutatedDocumentTest("monster data with one node replaced fails with RangeError or loads", MONSTER_FILES, (value) =>
  validateArchetypes(value, PROJECTILE_IDS, 12),
);
