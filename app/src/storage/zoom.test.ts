import { expect, test, vi } from "vitest";
import { ENCOUNTER_CONFIG } from "../game/config/encounter";
import { HISTORY_STORAGE_KEY } from "./attempts";
import { ZoomPreference, ZOOM_STORAGE_KEY } from "./zoom";

function boundary(value: string | null = null) {
  return { getItem: vi.fn(() => value), setItem: vi.fn() };
}

test.each([null, "0.25", "1", "3", "1.337", "0.375"])(
  "reads exact valid zoom %s without writes",
  (text) => {
    const storage = boundary(text);
    const preference = new ZoomPreference(() => storage);
    expect(preference.get()).toBe(text === null ? 1 : Number(text));
    expect(storage.getItem).toHaveBeenCalledWith(ZOOM_STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(ZOOM_STORAGE_KEY).not.toBe(HISTORY_STORAGE_KEY);
  },
);

test.each([
  "{",
  "null",
  "[]",
  "{}",
  '"1"',
  "true",
  "0",
  "0.249",
  "3.001",
  "1e999",
  "NaN",
])(
  "preserves malformed/out-of-range zoom %s and falls back for this visit",
  (text) => {
    const storage = boundary(text);
    const preference = new ZoomPreference(() => storage);
    expect(preference.get()).toBe(1);
    preference.set(1.125);
    expect(preference.get()).toBe(1.125);
    expect(storage.setItem).not.toHaveBeenCalled();
  },
);

test("deduplicates exact changes using JSON-number encoding independently of history", () => {
  const storage = boundary();
  const preference = new ZoomPreference(() => storage);
  preference.set(1);
  preference.set(1.337);
  preference.set(1.337);
  expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(
    ZOOM_STORAGE_KEY,
    "1.337",
  );
  for (const invalid of [NaN, Infinity, -Infinity, 0.2, 3.1])
    expect(() => preference.set(invalid)).toThrow(RangeError);
  expect(preference.get()).toBe(1.337);
});

test.each(["getter", "read", "quota"])(
  "%s failure retains a usable visit-local value",
  (failure) => {
    const storage = boundary();
    if (failure === "read")
      storage.getItem.mockImplementation(() => {
        throw Error("blocked");
      });
    if (failure === "quota")
      storage.setItem.mockImplementation(() => {
        throw Error("quota");
      });
    const preference = new ZoomPreference(() => {
      if (failure === "getter") throw Error("blocked");
      return storage;
    });
    preference.set(2);
    preference.set(2.125);
    expect(preference.get()).toBe(2.125);
    expect(storage.setItem).toHaveBeenCalledTimes(failure === "quota" ? 1 : 0);
  },
);

test("approved camera limits do not change rules identity or world scale", () => {
  expect(ENCOUNTER_CONFIG.camera).toEqual({
    cssPixelsPerTile: 32,
    minZoom: 0.25,
    maxZoom: 3,
    defaultZoom: 1,
    zoomStep: 0.125,
  });
  expect(ENCOUNTER_CONFIG.rulesVersion).toBe(
    "crystal-worm-child-head-paladin-v2",
  );
});
