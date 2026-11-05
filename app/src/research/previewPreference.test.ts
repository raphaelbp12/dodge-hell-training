import { describe, expect, test, vi } from "vitest";
import {
  PREVIEW_PREFERENCE_STORAGE_KEY,
  PreviewPreference,
} from "./previewPreference";

const DEFAULT = { shown: true, size: "medium", videoSize: "medium" };

function boundary(value: string | null = null) {
  return { getItem: vi.fn(() => value), setItem: vi.fn() };
}

describe("PreviewPreference", () => {
  test("defaults to shown at medium when nothing is stored", () => {
    const storage = boundary();
    const preference = new PreviewPreference(() => storage);
    expect(preference.get()).toEqual(DEFAULT);
    expect(storage.getItem).toHaveBeenCalledWith(PREVIEW_PREFERENCE_STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("round trips a saved value", () => {
    const stored: Record<string, string> = {};
    const storage = {
      getItem: (key: string) => stored[key] ?? null,
      setItem: (key: string, value: string) => {
        stored[key] = value;
      },
    };
    new PreviewPreference(() => storage).set({ shown: false, size: "large", videoSize: "small" });
    expect(new PreviewPreference(() => storage).get()).toEqual({
      shown: false,
      size: "large",
      videoSize: "small",
    });
  });

  test.each([
    "{",
    "null",
    "[]",
    '{"shown":true,"size":"huge"}',
    '{"shown":"yes","size":"small"}',
    '{"size":"small"}',
    '{"shown":true}',
    '{"shown":true,"size":"small","videoSize":"huge"}',
  ])("falls back to the default for %s", (text) => {
    expect(new PreviewPreference(() => boundary(text)).get()).toEqual(DEFAULT);
  });

  test("a value saved without a video size keeps the default video size", () => {
    expect(
      new PreviewPreference(() => boundary('{"shown":false,"size":"large"}')).get(),
    ).toEqual({ shown: false, size: "large", videoSize: "medium" });
  });

  test("ignores unrelated keys", () => {
    const storage = {
      getItem: vi.fn((key: string) =>
        key === PREVIEW_PREFERENCE_STORAGE_KEY
          ? null
          : '{"shown":false,"size":"small"}',
      ),
      setItem: vi.fn(),
    };
    expect(new PreviewPreference(() => storage).get()).toEqual(DEFAULT);
  });

  test("read and write failures never throw", () => {
    expect(
      new PreviewPreference(() => {
        throw new Error("blocked");
      }).get(),
    ).toEqual(DEFAULT);
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    const preference = new PreviewPreference(() => storage);
    expect(() => preference.set({ shown: false, size: "small", videoSize: "large" })).not.toThrow();
    expect(preference.get()).toEqual({
      shown: false,
      size: "small",
      videoSize: "large",
    });
  });
});
