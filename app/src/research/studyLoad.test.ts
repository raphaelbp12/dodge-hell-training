/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  currentDuration,
  fileNameMismatch,
  loadDecision,
  parseStudyFile,
  resolveProvenance,
  videoChoiceDecision,
} from "./studyLoad";

const KNOWN = ["killer-bee-queen"];

function file(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 2,
    encounterId: "killer-bee-queen",
    provenance: {
      sourceUrl: null,
      fileName: "x.mp4",
      frameRate: 30,
      durationSeconds: 100,
    },
    recordedAt: "2026-11-05T12:00:00.000Z",
    tags: [
      {
        timeSeconds: 1,
        phaseIndex: 99,
        spriteId: "gone-sprite",
        pattern: "rotating-arm",
        shots: 2,
      },
    ],
    ...overrides,
  });
}

describe("parseStudyFile", () => {
  test("parses and upgrades the committed v1 evidence", () => {
    const text = readFileSync(
      new URL("../../../docs/killer-bee-queen-observations.json", import.meta.url),
      "utf8",
    );
    const study = parseStudyFile(text, KNOWN);
    expect(study.provenance.frameRate).toBeNull();
    expect(study.tags.length).toBeGreaterThan(0);
  });

  test("refuses invalid JSON readably", () => {
    expect(() => parseStudyFile("{nope", KNOWN)).toThrow(/not valid JSON/);
  });

  test("refuses an invalid shape readably", () => {
    expect(() => parseStudyFile(file({ tags: 3 }), KNOWN)).toThrow(/tags/);
  });

  test("names an unknown encounter", () => {
    expect(() =>
      parseStudyFile(file({ encounterId: "mystery" }), KNOWN),
    ).toThrow(/mystery/);
  });

  test("accepts an unknown sprite and out-of-range phase", () => {
    const study = parseStudyFile(file(), KNOWN);
    expect(study.tags[0].spriteId).toBe("gone-sprite");
    expect(study.tags[0].phaseIndex).toBe(99);
    expect(study.provenance.frameRate).toBe(30);
  });
});

describe("decisions", () => {
  test("load confirms only when tags exist", () => {
    expect(loadDecision(0)).toBe("apply");
    expect(loadDecision(2)).toBe("confirm");
  });

  test("the first video after a load keeps tags, later ones confirm or reset", () => {
    expect(videoChoiceDecision({ tagCount: 3, keepTagsOnNextVideo: true })).toBe("keep");
    expect(videoChoiceDecision({ tagCount: 0, keepTagsOnNextVideo: true })).toBe("keep");
    expect(videoChoiceDecision({ tagCount: 3, keepTagsOnNextVideo: false })).toBe(
      "confirm-reset",
    );
    expect(videoChoiceDecision({ tagCount: 0, keepTagsOnNextVideo: false })).toBe("reset");
  });

  test("mismatch needs both names and a difference", () => {
    expect(fileNameMismatch("a.mp4", "b.mp4")).toBe(true);
    expect(fileNameMismatch("a.mp4", "a.mp4")).toBe(false);
    expect(fileNameMismatch(null, "a.mp4")).toBe(false);
    expect(fileNameMismatch("a.mp4", null)).toBe(false);
  });
});

describe("resolveProvenance", () => {
  const video = { fileName: "open.mp4", durationSeconds: 50 };
  const study = { fileName: "study.mp4", durationSeconds: 100 };

  test("uses the open video's name and duration with the study's source", () => {
    expect(
      resolveProvenance({
        video,
        study,
        sourceUrlText: " https://example.com ",
        frameRate: 30,
      }),
    ).toEqual({
      sourceUrl: "https://example.com",
      fileName: "open.mp4",
      frameRate: 30,
      durationSeconds: 50,
    });
  });

  test("falls back to the study without a video", () => {
    expect(
      resolveProvenance({ video: null, study, sourceUrlText: "", frameRate: 30 }),
    ).toMatchObject({ fileName: "study.mp4", durationSeconds: 100, sourceUrl: null });
  });

  test("blocks export with a blank frame rate or no source", () => {
    expect(() =>
      resolveProvenance({ video, study, sourceUrlText: "", frameRate: null }),
    ).toThrow(/frame rate/);
    expect(() =>
      resolveProvenance({ video: null, study: null, sourceUrlText: "", frameRate: 30 }),
    ).toThrow(/Load a video or a study/);
  });
});

test("currentDuration prefers the open video", () => {
  expect(currentDuration(40, 100)).toBe(40);
  expect(currentDuration(0, 100)).toBe(100);
  expect(currentDuration(0, null)).toBe(0);
});
