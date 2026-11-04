import { describe, expect, test } from "vitest";
import { encounterConfigOf, primaryArchetype } from "../game/config/encounter";
import { phaseLabel } from "../game/config/drill";
import type { Tag } from "./tagging";
import {
  appearanceOptions,
  assembleExport,
  createTag,
  phaseOptions,
  pixelGridCells,
  readoutInterval,
  type StickySelection,
} from "./taggingOptions";

const QUEEN = encounterConfigOf("killer-bee-queen");

const STICKY: StickySelection = {
  phaseIndex: 2,
  spriteId: "red-glaive",
  kind: "volley",
  shots: 4,
};

function tag(overrides: Partial<Tag> = {}): Tag {
  return {
    timeSeconds: 10,
    phaseIndex: 2,
    spriteId: "red-glaive",
    kind: "volley",
    shots: 4,
    ...overrides,
  };
}

describe("appearanceOptions", () => {
  test("lists exactly the nineteen catalog appearances in catalog order", () => {
    const options = appearanceOptions();
    expect(options).toHaveLength(19);
    expect(options.map((option) => option.id)).toEqual([
      "red-stinger-small",
      "red-stinger-large",
      "yellow-stinger-small",
      "yellow-stinger-large",
      "blue-stinger-small",
      "blue-stinger-large",
      "red-ball",
      "yellow-ball",
      "blue-ball",
      "red-glaive",
      "yellow-glaive",
      "blue-glaive",
      "hive-spiral-shot",
      "hive-range-shot",
      "hive-shot",
      "bee-shot",
      "red-bomb",
      "white-bomb",
      "blue-bomb",
    ]);
    for (const option of options) expect(option.spec.id).toBe(option.id);
  });

  test("flags exactly the three bombs", () => {
    const options = appearanceOptions();
    expect(options.filter((option) => option.isBomb).map((option) => option.id)).toEqual([
      "red-bomb",
      "white-bomb",
      "blue-bomb",
    ]);
    expect(options.filter((option) => !option.isBomb)).toHaveLength(16);
  });
});

describe("phaseOptions", () => {
  test("lists the encounter's top-level phases labelled by authored id", () => {
    const options = phaseOptions(QUEEN);
    const phases = primaryArchetype(QUEEN).phases;
    expect(options).toHaveLength(phases.length);
    expect(options.map((option) => option.index)).toEqual(
      phases.map((_phase, index) => index),
    );
    expect(options.map((option) => option.id)).toEqual(
      phases.map((phase) => phase.id),
    );
    expect(options.map((option) => option.label)).toEqual(
      phases.map((phase, index) => phaseLabel(phase.id, index)),
    );
    expect(options[2]).toEqual({
      index: 2,
      id: "phase-3-pond-barrage",
      label: "Phase 3 - Pond Barrage",
    });
    // T25: no sub-phase entries are offered.
    expect(options.every((option) => !("subPhaseIndex" in option))).toBe(true);
  });
});

describe("pixelGridCells", () => {
  test("flattens a pixel grid and keeps transparent cells", () => {
    const grid = pixelGridCells([
      ["#ff0000", null],
      [null, "#0000ff"],
    ]);
    expect(grid).toEqual({
      width: 2,
      height: 2,
      cells: ["#ff0000", null, null, "#0000ff"],
    });
  });
});

describe("createTag", () => {
  test("takes its time from the supplied media time and copies the sticky fields", () => {
    expect(createTag(12.345, { ...STICKY, kind: "rotating-arm", shots: 3 })).toEqual({
      timeSeconds: 12.345,
      phaseIndex: 2,
      spriteId: "red-glaive",
      kind: "rotating-arm",
      shots: 3,
    });
  });
});

describe("readoutInterval", () => {
  test("returns the interval since the previous tag in the current group", () => {
    const tags = [
      tag({ timeSeconds: 10 }),
      tag({ timeSeconds: 11.5 }),
      tag({ timeSeconds: 13.5 }),
    ];
    expect(readoutInterval(tags, STICKY)).toBe(2);
  });

  test("returns null with fewer than two tags in the group", () => {
    expect(readoutInterval([], STICKY)).toBeNull();
    expect(readoutInterval([tag()], STICKY)).toBeNull();
  });

  test("ignores tags outside the sticky group", () => {
    const tags = [
      tag({ timeSeconds: 10 }),
      tag({ timeSeconds: 10.5, kind: "rotating-arm" }),
      tag({ timeSeconds: 11, spriteId: "blue-ball" }),
      tag({ timeSeconds: 11.5, phaseIndex: 3 }),
      tag({ timeSeconds: 12 }),
    ];
    expect(readoutInterval(tags, STICKY)).toBe(2);
  });
});

describe("assembleExport", () => {
  const provenance = {
    sourceUrl: null,
    fileName: "fight.mp4",
    frameRate: 60,
    durationSeconds: 100,
  };

  test("time-sorts the tags and returns a validator-accepted export", () => {
    const tags = [tag({ timeSeconds: 12 }), tag({ timeSeconds: 10 })];
    const exported = assembleExport({
      encounterId: "killer-bee-queen",
      provenance,
      tags,
      recordedAt: "2026-11-03T12:00:00.000Z",
    });
    expect(exported.tags.map((entry) => entry.timeSeconds)).toEqual([10, 12]);
    expect(exported.encounterId).toBe("killer-bee-queen");
    expect(exported.provenance).toBe(provenance);
    expect(exported.recordedAt).toBe("2026-11-03T12:00:00.000Z");
    // The input order is preserved for the caller; only the export is sorted.
    expect(tags.map((entry) => entry.timeSeconds)).toEqual([12, 10]);
  });

  test("surfaces an invalid payload rather than returning it", () => {
    expect(() =>
      assembleExport({
        encounterId: "killer-bee-queen",
        provenance,
        tags: [tag({ shots: 0 })],
        recordedAt: "2026-11-03T12:00:00.000Z",
      }),
    ).toThrow(/tags\[0\]\.shots/);
  });
});
