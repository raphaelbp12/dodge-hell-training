import { describe, expect, test } from "vitest";
import { encounterConfigOf, primaryArchetype } from "../game/config/encounter";
import { phaseLabel } from "../game/config/drill";
import { validateTag, type Tag } from "./tagging";
import {
  appearanceOptions,
  assembleExport,
  createTag,
  phaseOptions,
  pixelGridCells,
  assignBurst,
  editTag,
  formatSummaryRow,
  armPatternAllowed,
  DEFAULT_SHOTS_PER_ARM,
  OFFERABLE_PATTERNS,
  readoutInterval,
  rotationAllowed,
  TAG_AIMS,
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

describe("composite and typed-geometry options (plan V15 phase 53)", () => {
  const composite = (overrides: Partial<Tag> = {}) =>
    tag({ pattern: "fixed-ring", armPattern: "spread", shotsPerArm: 3, armArcDegrees: 20, ...overrides });
  const ok = (result: ReturnType<typeof editTag>) => {
    if (!result.ok) throw new Error(result.error);
    return result.tag;
  };

  test("front is a selectable aim on spread and scatter only", () => {
    expect(TAG_AIMS).toContain("front");
    expect(ok(editTag(tag({ pattern: "spread", aim: "player" }), { field: "aim", value: "front" }, 100)).aim).toBe("front");
    expect(editTag(tag(), { field: "aim", value: "front" }, 100).ok).toBe(false);
  });

  test("armPatternAllowed and rotationAllowed", () => {
    expect(armPatternAllowed("rotating-arm")).toBe(true);
    expect(armPatternAllowed("fixed-ring")).toBe(true);
    expect(armPatternAllowed("spread")).toBe(false);
    expect(armPatternAllowed("volley")).toBe(false);
    expect(rotationAllowed("rotating-arm")).toBe(true);
    expect(rotationAllowed("fixed-ring")).toBe(false);
  });

  test("choosing an arm pattern needs a cone for spread and scatter, but not ring", () => {
    expect(editTag(tag(), { field: "armPattern", value: "spread" }, 100)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/cone/i),
    });
    const spread = ok(editTag(tag(), { field: "armPattern", value: "spread", armArcDegrees: 25 }, 100));
    expect(spread).toMatchObject({ armPattern: "spread", armArcDegrees: 25, shotsPerArm: DEFAULT_SHOTS_PER_ARM });
    const ring = ok(editTag(tag(), { field: "armPattern", value: "ring" }, 100));
    expect(ring).toMatchObject({ armPattern: "ring", shotsPerArm: DEFAULT_SHOTS_PER_ARM });
    expect(ring).not.toHaveProperty("armArcDegrees");
  });

  test("an arm pattern is refused on a pattern that cannot host arms", () => {
    expect(
      editTag(tag({ pattern: "spread", aim: "player" }), { field: "armPattern", value: "ring" }, 100).ok,
    ).toBe(false);
  });

  test("armPattern null removes it and its dependants", () => {
    const plain = ok(editTag(composite(), { field: "armPattern", value: null }, 100));
    expect(plain).not.toHaveProperty("armPattern");
    expect(plain).not.toHaveProperty("shotsPerArm");
    expect(plain).not.toHaveProperty("armArcDegrees");
  });

  test("switching the arm pattern to ring drops the cone; to scatter keeps it", () => {
    const ring = ok(editTag(composite(), { field: "armPattern", value: "ring" }, 100));
    expect(ring).not.toHaveProperty("armArcDegrees");
    expect(ring.shotsPerArm).toBe(3);
    const scatter = ok(editTag(composite(), { field: "armPattern", value: "scatter" }, 100));
    expect(scatter.armArcDegrees).toBe(20);
    const backToSpread = editTag(ring, { field: "armPattern", value: "spread" }, 100);
    expect(backToSpread.ok).toBe(false);
  });

  test("shotsPerArm and armArcDegrees edit with validation and keep the old tag on error", () => {
    expect(ok(editTag(composite(), { field: "shotsPerArm", value: 5 }, 100)).shotsPerArm).toBe(5);
    expect(ok(editTag(composite(), { field: "armArcDegrees", value: 45 }, 100)).armArcDegrees).toBe(45);
    for (const bad of [0, 1.5, Number.NaN])
      expect(editTag(composite(), { field: "shotsPerArm", value: bad }, 100).ok).toBe(false);
    expect(editTag(composite(), { field: "shotsPerArm", value: null }, 100).ok).toBe(false);
    expect(editTag(composite(), { field: "armArcDegrees", value: -1 }, 100).ok).toBe(false);
    expect(editTag(composite(), { field: "armArcDegrees", value: 360 }, 100).ok).toBe(false);
    expect(
      editTag(composite({ armPattern: "scatter" }), { field: "armArcDegrees", value: 0 }, 100).ok,
    ).toBe(false);
    expect(editTag(composite(), { field: "armArcDegrees", value: null }, 100).ok).toBe(false);
    expect(editTag(tag(), { field: "shotsPerArm", value: 2 }, 100).ok).toBe(false);
    expect(
      editTag(composite({ armPattern: "ring", armArcDegrees: undefined }), { field: "armArcDegrees", value: 10 }, 100).ok,
    ).toBe(false);
  });

  test("rotation fields edit on a rotating arm, accept negatives, and null removes each", () => {
    const withRate = ok(editTag(tag(), { field: "clockwiseDegreesPerSecond", value: -45 }, 100));
    expect(withRate.clockwiseDegreesPerSecond).toBe(-45);
    const withBoth = ok(editTag(withRate, { field: "initialPhaseDegrees", value: 12 }, 100));
    expect(withBoth.initialPhaseDegrees).toBe(12);
    const cleared = ok(editTag(withBoth, { field: "clockwiseDegreesPerSecond", value: null }, 100));
    expect(cleared).not.toHaveProperty("clockwiseDegreesPerSecond");
    expect(cleared.initialPhaseDegrees).toBe(12);
    expect(editTag(tag({ pattern: "fixed-ring" }), { field: "initialPhaseDegrees", value: 3 }, 100).ok).toBe(false);
    expect(editTag(tag(), { field: "clockwiseDegreesPerSecond", value: Number.NaN }, 100).ok).toBe(false);
  });

  test("changing the pattern drops fields the new pattern disallows", () => {
    const rich = composite({ pattern: "rotating-arm", clockwiseDegreesPerSecond: 30, initialPhaseDegrees: 5 });
    const fixed = ok(editTag(rich, { field: "pattern", value: "fixed-ring" }, 100));
    expect(fixed).toMatchObject({ armPattern: "spread", shotsPerArm: 3, armArcDegrees: 20 });
    expect(fixed).not.toHaveProperty("clockwiseDegreesPerSecond");
    expect(fixed).not.toHaveProperty("initialPhaseDegrees");
    const spread = ok(editTag(rich, { field: "pattern", value: "spread" }, 100));
    for (const field of ["armPattern", "shotsPerArm", "armArcDegrees", "clockwiseDegreesPerSecond", "initialPhaseDegrees"])
      expect(spread).not.toHaveProperty(field);
  });

  test("createTag copies sticky geometry only where the pattern allows it", () => {
    const sticky: StickySelection = {
      ...STICKY,
      armPattern: "spread",
      shotsPerArm: 3,
      armArcDegrees: 20,
      clockwiseDegreesPerSecond: 40,
      initialPhaseDegrees: 10,
    };
    expect(createTag(1, sticky)).toMatchObject({
      armPattern: "spread",
      shotsPerArm: 3,
      armArcDegrees: 20,
      clockwiseDegreesPerSecond: 40,
      initialPhaseDegrees: 10,
    });
    const fixedRing = createTag(1, { ...sticky, pattern: "fixed-ring" });
    expect(fixedRing).toMatchObject({ armPattern: "spread", armArcDegrees: 20 });
    expect(fixedRing).not.toHaveProperty("clockwiseDegreesPerSecond");
    expect(fixedRing).not.toHaveProperty("initialPhaseDegrees");
    const spreadTag = createTag(1, { ...sticky, pattern: "spread" });
    for (const field of ["armPattern", "shotsPerArm", "armArcDegrees", "clockwiseDegreesPerSecond", "initialPhaseDegrees"])
      expect(spreadTag).not.toHaveProperty(field);
  });

  test("createTag never produces a tag validateTag rejects", () => {
    const incomplete: StickySelection = { ...STICKY, armPattern: "spread", shotsPerArm: 3 };
    const result = createTag(1, incomplete);
    expect(result).not.toHaveProperty("armPattern");
    expect(() => validateTag(result, "tag")).not.toThrow();
    const full: StickySelection = { ...STICKY, armPattern: "ring", shotsPerArm: 2, armArcDegrees: 9 };
    const ringTag = createTag(1, full);
    expect(ringTag).not.toHaveProperty("armArcDegrees");
    expect(() => validateTag(ringTag, "tag")).not.toThrow();
  });

  test("the live-readout group separates a composite from a plain ring", () => {
    const tags = [
      tag({ timeSeconds: 1 }),
      tag({ timeSeconds: 2 }),
      composite({ pattern: "rotating-arm", timeSeconds: 9 }),
    ];
    expect(readoutInterval(tags, STICKY)).toBe(1);
    expect(readoutInterval(tags, { ...STICKY, armPattern: "spread", shotsPerArm: 3, armArcDegrees: 20 })).toBeNull();
  });

  test("a summary row names its arm pattern", () => {
    const base = {
      phaseIndex: 0,
      spriteId: "red-glaive",
      pattern: "fixed-ring" as const,
      scope: "all" as const,
      sampleCount: 0,
      meanSeconds: 0,
      stdevSeconds: 0,
      intervalsSeconds: [],
    };
    expect(formatSummaryRow(base, phaseOptions(QUEEN)).armPattern).toBe("—");
    expect(formatSummaryRow({ ...base, armPattern: "ring" }, phaseOptions(QUEEN)).armPattern).toBe("ring");
  });
});
