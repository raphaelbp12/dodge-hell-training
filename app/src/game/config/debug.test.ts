import { describe, expect, test } from "vitest";
import { unsafeFixture } from "../../test/fixture";
import {
  DEBUG_GROUPS,
  DEBUG_PARAMETERS,
  DEBUG_RULES_VERSION,
  DEBUG_TOGGLES,
  DEFAULT_DEBUG_SETTINGS,
  debugEncounterConfig,
  isDefaultDebugSettings,
  loadSelectedDebugValues,
  SELECTED_DEBUG_VALUES,
  updateDebugParameter,
  validateDebugSettings,
  type DebugSettings,
} from "./debug";
import { ENCOUNTER_CONFIG } from "./encounter";

describe("the catalogue", () => {
  test("every parameter belongs to a listed group, with ordered bounds and a default inside them", () => {
    for (const parameter of DEBUG_PARAMETERS) {
      expect(DEBUG_GROUPS).toContain(parameter.group);
      expect(parameter.min).toBeLessThan(parameter.max);
      expect(parameter.defaultValue).toBeGreaterThanOrEqual(parameter.min);
      expect(parameter.defaultValue).toBeLessThanOrEqual(parameter.max);
    }
  });

  test("parameter keys are unique and every toggle is a boolean default", () => {
    const keys = DEBUG_PARAMETERS.map((parameter) => parameter.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const toggle of DEBUG_TOGGLES) expect(typeof DEFAULT_DEBUG_SETTINGS[toggle.key]).toBe("boolean");
  });

  test("the defaults are valid and count as default", () => {
    expect(() => validateDebugSettings(DEFAULT_DEBUG_SETTINGS)).not.toThrow();
    expect(isDefaultDebugSettings(DEFAULT_DEBUG_SETTINGS)).toBe(true);
  });
});

describe("isDefaultDebugSettings", () => {
  test.each(["godMode", "chaseArenaCenter", "pauseProgression"] as const)("%s turned on is not default", (key) => {
    expect(isDefaultDebugSettings({ ...DEFAULT_DEBUG_SETTINGS, [key]: true })).toBe(false);
  });

  test("matchPlayerToHead turned off is not default", () => {
    expect(isDefaultDebugSettings({ ...DEFAULT_DEBUG_SETTINGS, matchPlayerToHead: false })).toBe(false);
  });

  test("any changed parameter is not default", () => {
    const parameter = DEBUG_PARAMETERS[0];
    const changed = { ...DEFAULT_DEBUG_SETTINGS, [parameter.key]: parameter.defaultValue === parameter.max ? parameter.min : parameter.max };
    expect(isDefaultDebugSettings(changed as DebugSettings)).toBe(false);
  });
});

describe("validateDebugSettings", () => {
  test("rejects a parameter outside its bounds, with the key in the message", () => {
    const parameter = DEBUG_PARAMETERS[0];
    expect(() =>
      validateDebugSettings(unsafeFixture<DebugSettings>({ ...DEFAULT_DEBUG_SETTINGS, [parameter.key]: parameter.max + 1 })),
    ).toThrow(new RegExp(parameter.key));
    expect(() =>
      validateDebugSettings(unsafeFixture<DebugSettings>({ ...DEFAULT_DEBUG_SETTINGS, [parameter.key]: parameter.min - 1 })),
    ).toThrow(RangeError);
  });

  test("rejects a non-finite parameter", () => {
    const parameter = DEBUG_PARAMETERS[0];
    expect(() =>
      validateDebugSettings(unsafeFixture<DebugSettings>({ ...DEFAULT_DEBUG_SETTINGS, [parameter.key]: Number.NaN })),
    ).toThrow(RangeError);
  });

  test("rejects a fractional value for a whole-number parameter", () => {
    const whole = DEBUG_PARAMETERS.find((parameter) => parameter.step === 1);
    if (!whole) return;
    expect(() =>
      validateDebugSettings(unsafeFixture<DebugSettings>({ ...DEFAULT_DEBUG_SETTINGS, [whole.key]: whole.min + 0.5 })),
    ).toThrow(RangeError);
  });

  test("rejects a non-boolean flag", () => {
    expect(() =>
      validateDebugSettings({ ...DEFAULT_DEBUG_SETTINGS, godMode: 1 as unknown as boolean }),
    ).toThrow(/flags/);
  });

  test("rejects a reversal at or after the lifetime", () => {
    expect(() =>
      validateDebugSettings({ ...DEFAULT_DEBUG_SETTINGS, reversalSeconds: 2, lifetimeSeconds: 2 }),
    ).toThrow(/timing/);
  });
});

describe("updateDebugParameter", () => {
  test("sets one parameter and leaves the others", () => {
    const next = updateDebugParameter(DEFAULT_DEBUG_SETTINGS, "reversalSeconds", 1);
    expect(next.reversalSeconds).toBe(1);
    expect(next.lifetimeSeconds).toBe(DEFAULT_DEBUG_SETTINGS.lifetimeSeconds);
  });

  test("raising the reversal past the lifetime lifts the lifetime above it", () => {
    const base = { ...DEFAULT_DEBUG_SETTINGS, reversalSeconds: 1, lifetimeSeconds: 2 };
    const next = updateDebugParameter(base, "reversalSeconds", 2);
    expect(next.lifetimeSeconds).toBeGreaterThan(next.reversalSeconds);
  });

  test("lowering the lifetime to the reversal halves the reversal", () => {
    const base = { ...DEFAULT_DEBUG_SETTINGS, reversalSeconds: 1.5, lifetimeSeconds: 3 };
    const next = updateDebugParameter(base, "lifetimeSeconds", 1);
    expect(next.reversalSeconds).toBe(0.5);
  });

  test("rejects a value outside the bounds", () => {
    const parameter = DEBUG_PARAMETERS[0];
    expect(() => updateDebugParameter(DEFAULT_DEBUG_SETTINGS, parameter.key, parameter.max + 1)).toThrow(RangeError);
  });
});

describe("loadSelectedDebugValues", () => {
  test("applies the selected encounter's values and matches the player to the head", () => {
    const loaded = loadSelectedDebugValues({ ...DEFAULT_DEBUG_SETTINGS, matchPlayerToHead: false });
    for (const [key, value] of Object.entries(SELECTED_DEBUG_VALUES))
      expect(loaded[key as keyof DebugSettings]).toBe(value);
    expect(loaded.matchPlayerToHead).toBe(true);
  });

  test("keeps the flags it does not own", () => {
    expect(loadSelectedDebugValues({ ...DEFAULT_DEBUG_SETTINGS, godMode: true }).godMode).toBe(true);
  });
});

describe("debugEncounterConfig", () => {
  test("builds a configuration under the debug rules version", () => {
    const config = debugEncounterConfig(DEFAULT_DEBUG_SETTINGS);
    expect(config.rulesVersion).toBe(DEBUG_RULES_VERSION);
    expect(config.arena.shape.kind).toBe(ENCOUNTER_CONFIG.arena.shape.kind);
  });

  test("refuses invalid settings", () => {
    expect(() =>
      debugEncounterConfig({ ...DEFAULT_DEBUG_SETTINGS, reversalSeconds: 5, lifetimeSeconds: 1 }),
    ).toThrow(RangeError);
  });
});
