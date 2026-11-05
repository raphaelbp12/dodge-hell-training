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
  assignBurst,
  editTag,
  formatSummaryRow,
  OFFERABLE_PATTERNS,
  readoutInterval,
  sortNewestFirst,
  type StickySelection,
} from "./taggingOptions";

const QUEEN = encounterConfigOf("killer-bee-queen");

const STICKY: StickySelection = {
  phaseIndex: 2,
  spriteId: "red-glaive",
  pattern: "rotating-arm",
  aim: "player",
  shots: 4,
};

function tag(overrides: Partial<Tag> = {}): Tag {
  return {
    timeSeconds: 10,
    phaseIndex: 2,
    spriteId: "red-glaive",
    pattern: "rotating-arm",
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
    expect(createTag(12.345, { ...STICKY, shots: 3 })).toEqual({
      timeSeconds: 12.345,
      phaseIndex: 2,
      spriteId: "red-glaive",
      pattern: "rotating-arm",
      shots: 3,
    });
  });

  test("includes aim only on spread and scatter", () => {
    expect(createTag(1, { ...STICKY, pattern: "spread", aim: "fixed" })).toMatchObject({
      aim: "fixed",
    });
    expect(createTag(1, { ...STICKY, pattern: "scatter" })).toMatchObject({
      aim: "player",
    });
    expect(createTag(1, { ...STICKY, pattern: "fixed-ring" })).not.toHaveProperty("aim");
    expect(createTag(1, STICKY)).not.toHaveProperty("aim");
  });

  test("attaches a burst id when given", () => {
    expect(createTag(1, STICKY, 3).burstId).toBe(3);
    expect(createTag(1, STICKY)).not.toHaveProperty("burstId");
  });

  test("the offerable list excludes volley", () => {
    expect(OFFERABLE_PATTERNS).toEqual(["rotating-arm", "fixed-ring", "spread", "scatter"]);
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
      tag({ timeSeconds: 10.5, pattern: "fixed-ring" }),
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
    expect(exported.schemaVersion).toBe(2);
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

describe("assignBurst", () => {
  test("new is one more than the highest id, or 1", () => {
    expect(assignBurst([], STICKY, "new")).toBe(1);
    expect(assignBurst([tag({ burstId: 4 }), tag({ burstId: 2 })], STICKY, "new")).toBe(5);
  });

  test("continue picks the highest id in the matching group", () => {
    const tags = [
      tag({ burstId: 1 }),
      tag({ burstId: 2, pattern: "fixed-ring" }),
      tag({ burstId: 3, phaseIndex: 1 }),
      tag({ burstId: 4, pattern: "spread", aim: "fixed" }),
    ];
    expect(assignBurst(tags, STICKY, "continue")).toBe(1);
    expect(assignBurst(tags, { ...STICKY, pattern: "fixed-ring" }, "continue")).toBe(2);
    expect(assignBurst(tags, { ...STICKY, pattern: "spread", aim: "fixed" }, "continue")).toBe(4);
    expect(assignBurst(tags, { ...STICKY, pattern: "spread", aim: "player" }, "continue")).toBeNull();
  });

  test("continue ignores standalone tags", () => {
    expect(assignBurst([tag()], STICKY, "continue")).toBeNull();
  });
});

describe("editTag", () => {
  const base = tag();

  test("edits each field without mutating the input", () => {
    const frozen = Object.freeze({ ...base });
    expect(editTag(frozen, { field: "phaseIndex", value: 3 }, 100)).toEqual({
      ok: true,
      tag: { ...base, phaseIndex: 3 },
    });
    expect(editTag(frozen, { field: "spriteId", value: "blue-ball" }, 100)).toMatchObject({
      ok: true,
      tag: { spriteId: "blue-ball" },
    });
    expect(editTag(frozen, { field: "shots", value: 7 }, 100)).toMatchObject({
      ok: true,
      tag: { shots: 7 },
    });
    expect(editTag(frozen, { field: "burstId", value: 2 }, 100)).toMatchObject({
      ok: true,
      tag: { burstId: 2 },
    });
  });

  test("time accepts both limits, rejects outside, and marks typed forever", () => {
    expect(editTag(base, { field: "timeSeconds", value: 0 }, 100).ok).toBe(true);
    expect(editTag(base, { field: "timeSeconds", value: 100 }, 100).ok).toBe(true);
    expect(editTag(base, { field: "timeSeconds", value: -0.1 }, 100).ok).toBe(false);
    expect(editTag(base, { field: "timeSeconds", value: 100.1 }, 100).ok).toBe(false);
    expect(editTag(base, { field: "timeSeconds", value: Number.NaN }, 100).ok).toBe(false);
    const typed = editTag(base, { field: "timeSeconds", value: 5 }, 100);
    if (!typed.ok) throw new Error("expected ok");
    expect(typed.tag.timeSeconds).toBe(5);
    expect(typed.tag.timeSource).toBe("typed");
    const later = editTag(typed.tag, { field: "shots", value: 2 }, 100);
    if (!later.ok) throw new Error("expected ok");
    expect(later.tag.timeSource).toBe("typed");
  });

  test("pattern adds and removes aim, and volley is never assignable", () => {
    const spread = editTag(base, { field: "pattern", value: "spread" }, 100);
    if (!spread.ok) throw new Error("expected ok");
    expect(spread.tag.aim).toBe("player");
    const fixed = editTag(spread.tag, { field: "aim", value: "fixed" }, 100);
    if (!fixed.ok) throw new Error("expected ok");
    const ring = editTag(fixed.tag, { field: "pattern", value: "fixed-ring" }, 100);
    if (!ring.ok) throw new Error("expected ok");
    expect(ring.tag).not.toHaveProperty("aim");
    expect(editTag(base, { field: "aim", value: "fixed" }, 100).ok).toBe(false);
    expect(editTag(base, { field: "pattern", value: "volley" }, 100).ok).toBe(false);
    const legacy = tag({ pattern: "volley" });
    expect(editTag(legacy, { field: "shots", value: 2 }, 100)).toMatchObject({
      ok: true,
      tag: { pattern: "volley" },
    });
    expect(editTag(legacy, { field: "pattern", value: "scatter" }, 100).ok).toBe(true);
  });

  test("keeps raw unknown values through an unrelated edit", () => {
    const odd = tag({ spriteId: "removed", phaseIndex: 99 });
    expect(editTag(odd, { field: "shots", value: 2 }, 100)).toMatchObject({
      ok: true,
      tag: { spriteId: "removed", phaseIndex: 99 },
    });
  });

  test("burst blank removes, invalid values are rejected", () => {
    const burst = tag({ burstId: 3 });
    const removed = editTag(burst, { field: "burstId", value: null }, 100);
    if (!removed.ok) throw new Error("expected ok");
    expect(removed.tag).not.toHaveProperty("burstId");
    for (const value of [0, -1, 1.5, Number.NaN])
      expect(editTag(burst, { field: "burstId", value }, 100).ok).toBe(false);
    expect(editTag(base, { field: "shots", value: 0 }, 100).ok).toBe(false);
  });
});

describe("sortNewestFirst", () => {
  test("orders by time descending with later rows first on ties, without mutating", () => {
    const tags = [
      tag({ timeSeconds: 5 }),
      tag({ timeSeconds: 9 }),
      tag({ timeSeconds: 5, shots: 2 }),
    ];
    const rows = sortNewestFirst(tags);
    expect(rows.map((row) => row.index)).toEqual([1, 2, 0]);
    expect(tags.map((entry) => entry.timeSeconds)).toEqual([5, 9, 5]);
  });

  test("re-sorts after a time edit", () => {
    const edited = [tag({ timeSeconds: 1 }), tag({ timeSeconds: 2 })];
    expect(sortNewestFirst(edited).map((row) => row.index)).toEqual([1, 0]);
    const moved = [tag({ timeSeconds: 3 }), edited[1]];
    expect(sortNewestFirst(moved).map((row) => row.index)).toEqual([0, 1]);
  });
});

describe("formatSummaryRow", () => {
  const phases = phaseOptions(QUEEN);
  const base = {
    phaseIndex: 0,
    spriteId: "red-glaive",
    pattern: "rotating-arm" as const,
    scope: "all" as const,
    sampleCount: 2,
    meanSeconds: 1.23456,
    stdevSeconds: 0.5,
    intervalsSeconds: [1, 1.4691],
  };

  test("rounds to milliseconds and lists intervals", () => {
    const row = formatSummaryRow(base, phases);
    expect(row.mean).toBe("1.235 s");
    expect(row.deviation).toBe("0.500 s");
    expect(row.intervals).toBe("1.000, 1.469");
    expect(row.aim).toBe("—");
    expect(row.phase).toBe(phases[0].label);
  });

  test("shows an empty interval list and an unknown phase raw", () => {
    const row = formatSummaryRow(
      { ...base, phaseIndex: 99, sampleCount: 0, intervalsSeconds: [] },
      phases,
    );
    expect(row.intervals).toBe("—");
    expect(row.mean).toBe("—");
    expect(row.phase).toBe("99");
  });
});
