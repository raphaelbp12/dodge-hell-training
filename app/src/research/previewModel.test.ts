import { describe, expect, test } from "vitest";
import {
  ENCOUNTER_CONFIGS,
  primaryArchetype,
  type EncounterConfig,
} from "../game/config/encounter";
import { emitterTilesOf, initialHeadingSliderDegrees } from "./previewModel";

const ENCOUNTER_CONFIG = ENCOUNTER_CONFIGS["killer-bee-queen"]!;
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);

describe("emitterTilesOf", () => {
  test("uses the arena centre under the arena-center spawn rule", () => {
    expect(ENCOUNTER_CONFIG.spawns.placement.rule).toBe("arena-center");
    expect(emitterTilesOf(ENCOUNTER_CONFIG)).toEqual(
      ENCOUNTER_CONFIG.arena.shape.centerTiles,
    );
  });
  test("falls back to the authored spawn for other rules", () => {
    const config = ENCOUNTER_CONFIGS["crystal-worm"]!;
    expect(emitterTilesOf(config)).toEqual(primaryArchetype(config).spawnTiles);
  });
});

describe("initialHeadingSliderDegrees (N20)", () => {
  test("is 0 when the archetype authors no heading", () => {
    expect(initialHeadingSliderDegrees(ENCOUNTER_CONFIG)).toBe(0);
  });

  test("starts at the primary archetype's initialHeadingDegrees, normalised into 0-360", () => {
    const withHeading = (degrees: number): EncounterConfig => ({
      ...ENCOUNTER_CONFIG,
      archetypes: {
        ...ENCOUNTER_CONFIG.archetypes,
        [PRIMARY.id]: { ...PRIMARY, initialHeadingDegrees: degrees },
      },
    });
    expect(initialHeadingSliderDegrees(withHeading(90))).toBe(90);
    expect(initialHeadingSliderDegrees(withHeading(-90))).toBe(270);
    expect(initialHeadingSliderDegrees(withHeading(450))).toBe(90);
  });
});
