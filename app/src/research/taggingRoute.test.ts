import { describe, expect, test } from "vitest";
import { validateObservationExport } from "./tagging";
import {
  actionForKey,
  buildProvenance,
  frameStepSeconds,
  isActivationTarget,
  isEditableTarget,
  isTaggerRequested,
} from "./taggingRoute";

describe("isTaggerRequested", () => {
  test("accepts the explicit opt-in only", () => {
    expect(isTaggerRequested("?tagger=1")).toBe(true);
    expect(isTaggerRequested("?encounter=killer-bee-queen&tagger=1")).toBe(true);
    expect(isTaggerRequested("?tagger")).toBe(false);
    expect(isTaggerRequested("?tagger=0")).toBe(false);
    expect(isTaggerRequested("?tagger=yes")).toBe(false);
    expect(isTaggerRequested("")).toBe(false);
  });
});

describe("frameStepSeconds", () => {
  test("is one frame at the given rate", () => {
    expect(frameStepSeconds(30)).toBeCloseTo(1 / 30, 12);
    expect(frameStepSeconds(60)).toBeCloseTo(1 / 60, 12);
  });

  test.each([0, -30, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects a non-positive or non-finite rate: %s",
    (rate) => {
      expect(() => frameStepSeconds(rate)).toThrow(/positive finite/);
    },
  );
});

describe("actionForKey", () => {
  test("maps transport and tagging keys", () => {
    expect(actionForKey("ArrowLeft", 60)).toEqual({
      kind: "frame-step",
      direction: -1,
      deltaSeconds: 1 / 60,
    });
    expect(actionForKey("ArrowRight", 30)).toEqual({
      kind: "frame-step",
      direction: 1,
      deltaSeconds: 1 / 30,
    });
    expect(actionForKey(" ", 60)).toEqual({ kind: "play-pause" });
    expect(actionForKey("Enter", 60)).toEqual({ kind: "record" });
    expect(actionForKey("3", 60)).toEqual({ kind: "set-shots", shots: 3 });
    expect(actionForKey("9", 60)).toEqual({ kind: "set-shots", shots: 9 });
  });

  test("maps coarse jumps", () => {
    expect(actionForKey("ArrowLeft", 60, true)).toEqual({
      kind: "jump",
      direction: -1,
      seconds: 5,
    });
    expect(actionForKey("ArrowRight", 60, true)).toEqual({
      kind: "jump",
      direction: 1,
      seconds: 5,
    });
    expect(actionForKey("PageUp", 60)).toEqual({
      kind: "jump",
      direction: -1,
      seconds: 30,
    });
    expect(actionForKey("PageDown", 60)).toEqual({
      kind: "jump",
      direction: 1,
      seconds: 30,
    });
  });

  test("a coarse jump does not depend on the frame rate", () => {
    expect(actionForKey("ArrowRight", 0, true)).toEqual({
      kind: "jump",
      direction: 1,
      seconds: 5,
    });
  });

  test("ignores keys it does not own", () => {
    expect(actionForKey("0", 60)).toBeNull();
    expect(actionForKey("a", 60)).toBeNull();
    expect(actionForKey("Escape", 60)).toBeNull();
  });

  test("a bad frame rate is rejected rather than yielding an infinite delta", () => {
    expect(() => actionForKey("ArrowRight", 0)).toThrow(/positive finite/);
  });
});

describe("buildProvenance", () => {
  test("turns a blank source url into null and keeps the typed fields", () => {
    expect(
      buildProvenance({
        fileName: "fight.mp4",
        durationSeconds: 612.5,
        sourceUrl: "   ",
        frameRate: 60,
      }),
    ).toEqual({
      sourceUrl: null,
      fileName: "fight.mp4",
      frameRate: 60,
      durationSeconds: 612.5,
    });
  });

  test("keeps a nonblank source url and passes the validator's provenance branch", () => {
    const provenance = buildProvenance({
      fileName: "fight.mp4",
      durationSeconds: 612.5,
      sourceUrl: "https://example.com/fight",
      frameRate: 30,
    });
    const value = {
      encounterId: "killer-bee-queen",
      provenance,
      recordedAt: "2026-11-03T12:00:00.000Z",
      tags: [],
    };
    expect(validateObservationExport(value)).toBe(value);
  });

  test("rejects a missing file name", () => {
    expect(() =>
      buildProvenance({
        fileName: " ",
        durationSeconds: 10,
        sourceUrl: "",
        frameRate: 60,
      }),
    ).toThrow(/fileName/);
  });
});

describe("isEditableTarget", () => {
  test("treats text-like fields and contenteditable as editable", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "INPUT", type: "number" })).toBe(true);
    expect(isEditableTarget({ tagName: "INPUT", type: "url" })).toBe(true);
    expect(isEditableTarget({ tagName: "textarea" })).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" })).toBe(true);
    expect(
      isEditableTarget({ tagName: "DIV", isContentEditable: true }),
    ).toBe(true);
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  test("leaves checkable inputs available to the tagger's Enter key", () => {
    expect(isEditableTarget({ tagName: "INPUT", type: "radio" })).toBe(false);
    expect(isEditableTarget({ tagName: "INPUT", type: "checkbox" })).toBe(
      false,
    );
  });
});

describe("isActivationTarget", () => {
  test("lets focused controls keep their activation keys", () => {
    expect(isActivationTarget({ tagName: "BUTTON" }, "Enter")).toBe(true);
    expect(isActivationTarget({ tagName: "BUTTON" }, " ")).toBe(true);
    expect(isActivationTarget({ tagName: "A" }, "Enter")).toBe(true);
    expect(isActivationTarget({ tagName: "SUMMARY" }, " ")).toBe(true);
    expect(isActivationTarget({ tagName: "INPUT", type: "radio" }, " ")).toBe(
      true,
    );
    expect(isActivationTarget({ tagName: "INPUT", type: "checkbox" }, " ")).toBe(
      true,
    );
  });

  test("leaves Enter available on a radio or checkbox so it can record", () => {
    expect(isActivationTarget({ tagName: "INPUT", type: "radio" }, "Enter")).toBe(
      false,
    );
    expect(
      isActivationTarget({ tagName: "INPUT", type: "checkbox" }, "Enter"),
    ).toBe(false);
    expect(isActivationTarget({ tagName: "BUTTON" }, "ArrowRight")).toBe(false);
    expect(isActivationTarget(null, "Enter")).toBe(false);
  });
});
