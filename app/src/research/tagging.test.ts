/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  studyFromExport,
  summarizeTags,
  validateObservationExport,
  type ObservationExport,
  type Tag,
  type TagV1,
} from "./tagging";

/** A schema-v1 tag; the v1 cases below keep covering the committed evidence shape. */
function tag(overrides: Partial<TagV1> = {}): TagV1 {
  return {
    timeSeconds: 10,
    phaseIndex: 2,
    spriteId: "red-glaive",
    kind: "volley",
    shots: 4,
    ...overrides,
  };
}

function tag2(overrides: Partial<Tag> = {}): Tag {
  return {
    timeSeconds: 10,
    phaseIndex: 2,
    spriteId: "red-glaive",
    pattern: "rotating-arm",
    shots: 4,
    ...overrides,
  };
}

function observation(
  overrides: Partial<Record<keyof ObservationExport, unknown>> = {},
): Record<string, unknown> {
  return {
    encounterId: "killer-bee-queen",
    provenance: {
      sourceUrl: "https://example.com/killer-bee-queen",
      fileName: "killer-bee-queen.mp4",
      frameRate: 60,
      durationSeconds: 100,
    },
    recordedAt: "2026-11-03T12:00:00.000Z",
    tags: [tag()],
    ...overrides,
  };
}

describe("validateObservationExport", () => {
  test("returns a well-formed export unchanged", () => {
    const value = observation();
    expect(validateObservationExport(value)).toBe(value);
  });

  test("accepts a null source url", () => {
    const value = observation({
      provenance: {
        sourceUrl: null,
        fileName: "local.mp4",
        frameRate: 30,
        durationSeconds: 10,
      },
    });
    expect(validateObservationExport(value)).toBe(value);
  });

  const rejectionCases: ReadonlyArray<readonly [string, unknown, RegExp]> = [
    [
      "missing encounter id",
      observation({ encounterId: undefined }),
      /encounterId/,
    ],
    [
      "non-string encounter id",
      observation({ encounterId: 42 }),
      /encounterId/,
    ],
    [
      "missing provenance",
      observation({ provenance: undefined }),
      /provenance/,
    ],
    [
      "non-string file name",
      observation({
        provenance: {
          sourceUrl: null,
          fileName: 42,
          frameRate: 60,
          durationSeconds: 10,
        },
      }),
      /provenance\.fileName/,
    ],
    [
      "source url that is neither string nor null",
      observation({
        provenance: {
          sourceUrl: 42,
          fileName: "x.mp4",
          frameRate: 60,
          durationSeconds: 10,
        },
      }),
      /provenance\.sourceUrl/,
    ],
    [
      "zero frame rate",
      observation({
        provenance: {
          sourceUrl: null,
          fileName: "x.mp4",
          frameRate: 0,
          durationSeconds: 10,
        },
      }),
      /provenance\.frameRate/,
    ],
    [
      "non-finite duration",
      observation({
        provenance: {
          sourceUrl: null,
          fileName: "x.mp4",
          frameRate: 60,
          durationSeconds: Number.POSITIVE_INFINITY,
        },
      }),
      /provenance\.durationSeconds/,
    ],
    [
      "non-ISO recordedAt",
      observation({ recordedAt: "yesterday" }),
      /recordedAt/,
    ],
    ["tags not an array", observation({ tags: {} }), /tags/],
    [
      "negative tag time",
      observation({ tags: [tag({ timeSeconds: -1 })] }),
      /tags\[0\]\.timeSeconds/,
    ],
    [
      "non-finite tag time",
      observation({ tags: [tag({ timeSeconds: Number.NaN })] }),
      /tags\[0\]\.timeSeconds/,
    ],
    [
      "unknown tag kind",
      observation({ tags: [{ ...tag(), kind: "burst" }] }),
      /tags\[0\]\.kind/,
    ],
    [
      "zero shots",
      observation({ tags: [tag({ shots: 0 })] }),
      /tags\[0\]\.shots/,
    ],
    [
      "negative shots",
      observation({ tags: [tag({ shots: -1 })] }),
      /tags\[0\]\.shots/,
    ],
    [
      "fractional shots",
      observation({ tags: [tag({ shots: 1.5 })] }),
      /tags\[0\]\.shots/,
    ],
    [
      "empty sprite id",
      observation({ tags: [tag({ spriteId: "" })] }),
      /tags\[0\]\.spriteId/,
    ],
    [
      "negative phase index",
      observation({ tags: [tag({ phaseIndex: -1 })] }),
      /tags\[0\]\.phaseIndex/,
    ],
    [
      "fractional phase index",
      observation({ tags: [tag({ phaseIndex: 1.5 })] }),
      /tags\[0\]\.phaseIndex/,
    ],
  ];

  test.each(rejectionCases)("rejects %s with its path", (_label, value, path) => {
    expect(() => validateObservationExport(value)).toThrow(path);
  });

  test("accepts a single shot", () => {
    const value = observation({ tags: [tag({ shots: 1 })] });
    expect(validateObservationExport(value)).toBe(value);
  });

  test("accepts a dense ring's projectile count", () => {
    const value = observation({ tags: [tag({ shots: 64 })] });
    expect(validateObservationExport(value)).toBe(value);
  });

  // T31: validation is structural only. A configuration change must not
  // invalidate an observation of what a video actually showed.
  test("accepts an unknown sprite id and an out-of-range phase index", () => {
    const value = observation({
      tags: [tag({ spriteId: "a-sprite-removed-later", phaseIndex: 99 })],
    });
    expect(validateObservationExport(value)).toBe(value);
  });

  test("does not compare tag time with the video duration", () => {
    const value = observation({
      tags: [tag({ timeSeconds: 500 })],
      provenance: {
        sourceUrl: null,
        fileName: "x.mp4",
        frameRate: 60,
        durationSeconds: 10,
      },
    });
    expect(validateObservationExport(value)).toBe(value);
  });
});

function observation2(
  tags: readonly unknown[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...observation({ tags }), schemaVersion: 2, ...extra };
}

describe("validateObservationExport v2", () => {
  test("accepts a well-formed v2 export unchanged", () => {
    const value = observation2([
      tag2(),
      tag2({ pattern: "spread", aim: "player", burstId: 1 }),
      tag2({ pattern: "volley", timeSource: "typed" }),
      tag2({ pattern: "fixed-ring" }),
      tag2({ pattern: "scatter", aim: "fixed" }),
    ]);
    expect(validateObservationExport(value)).toBe(value);
  });

  test("rejects an unknown schema version", () => {
    expect(() =>
      validateObservationExport(observation2([tag2()], { schemaVersion: 3 })),
    ).toThrow(/schemaVersion/);
    expect(() =>
      validateObservationExport(observation2([tag2()], { schemaVersion: 1 })),
    ).toThrow(/schemaVersion/);
  });

  const rejections: ReadonlyArray<readonly [string, unknown, RegExp]> = [
    ["unknown pattern", { ...tag2(), pattern: "burst" }, /pattern/],
    ["v1 kind field only", { ...tag(), kind: "volley" }, /pattern/],
    ["spread without aim", tag2({ pattern: "spread" }), /aim/],
    ["scatter with bad aim", { ...tag2({ pattern: "scatter" }), aim: "x" }, /aim/],
    ["aim on a ring", tag2({ pattern: "fixed-ring", aim: "player" }), /aim/],
    ["aim on a rotating arm", tag2({ aim: "fixed" }), /aim/],
    ["zero burst id", tag2({ burstId: 0 }), /burstId/],
    ["fractional burst id", tag2({ burstId: 1.5 }), /burstId/],
    ["bad time source", { ...tag2(), timeSource: "frame" }, /timeSource/],
  ];

  test.each(rejections)("rejects %s", (_label, entry, path) => {
    expect(() => validateObservationExport(observation2([entry]))).toThrow(path);
  });

  test("makes no referential check", () => {
    const value = observation2([tag2({ spriteId: "gone", phaseIndex: 99 })], {
      encounterId: "no-such-encounter",
    });
    expect(validateObservationExport(value)).toBe(value);
  });
});

describe("studyFromExport", () => {
  test("upgrades v1: kind to pattern, null frame rate, no input mutation", () => {
    const value = observation({
      tags: [tag(), tag({ kind: "rotating-arm", timeSeconds: 11 })],
    });
    const before = JSON.stringify(value);
    const study = studyFromExport(
      validateObservationExport(value),
    );
    expect(JSON.stringify(value)).toBe(before);
    expect(study.provenance.frameRate).toBeNull();
    expect(study.tags.map((entry) => entry.pattern)).toEqual([
      "volley",
      "rotating-arm",
    ]);
    expect(study.tags[0]).not.toHaveProperty("aim");
    expect(study.tags[0]).not.toHaveProperty("burstId");
    expect(study.tags[0]).not.toHaveProperty("kind");
  });

  test("copies v2 values unchanged", () => {
    const tags = [tag2({ burstId: 2 }), tag2({ pattern: "spread", aim: "fixed" })];
    const value = observation2(tags);
    const study = studyFromExport(validateObservationExport(value));
    expect(study.tags).toEqual(tags);
    expect(study.provenance.frameRate).toBe(60);
    expect(study.encounterId).toBe("killer-bee-queen");
  });
});

describe("summarizeTags", () => {
  test("returns no summaries for no tags", () => {
    expect(summarizeTags([])).toEqual([]);
  });

  test("a no-burst group keeps one all result with sorted intervals", () => {
    const tags = [
      tag2({ timeSeconds: 12 }),
      tag2({ timeSeconds: 10 }),
      tag2({ timeSeconds: 11 }),
    ];
    expect(summarizeTags(tags)).toEqual([
      {
        phaseIndex: 2,
        spriteId: "red-glaive",
        pattern: "rotating-arm",
        scope: "all",
        sampleCount: 2,
        meanSeconds: 1,
        stdevSeconds: 0,
        intervalsSeconds: [1, 1],
      },
    ]);
  });

  test("keeps patterns separate when only the pattern differs", () => {
    const summaries = summarizeTags([
      tag2({ timeSeconds: 10 }),
      tag2({ timeSeconds: 11 }),
      tag2({ timeSeconds: 12, pattern: "fixed-ring" }),
      tag2({ timeSeconds: 15, pattern: "fixed-ring" }),
    ]);
    expect(summaries.map((s) => [s.pattern, s.sampleCount])).toEqual([
      ["fixed-ring", 1],
      ["rotating-arm", 1],
    ]);
  });

  test("keeps concurrent groups with different aim separate", () => {
    const summaries = summarizeTags([
      tag2({ pattern: "spread", aim: "player", timeSeconds: 1 }),
      tag2({ pattern: "spread", aim: "fixed", timeSeconds: 2 }),
      tag2({ pattern: "spread", aim: "player", timeSeconds: 4 }),
    ]);
    expect(summaries.map((s) => [s.aim, s.sampleCount])).toEqual([
      ["fixed", 0],
      ["player", 1],
    ]);
  });

  test("keeps a one-tag group with zero samples", () => {
    expect(summarizeTags([tag2()])).toEqual([
      {
        phaseIndex: 2,
        spriteId: "red-glaive",
        pattern: "rotating-arm",
        scope: "all",
        sampleCount: 0,
        meanSeconds: 0,
        stdevSeconds: 0,
        intervalsSeconds: [],
      },
    ]);
  });

  test("uses population standard deviation", () => {
    const tags = [0, 1, 3, 6].map((timeSeconds) => tag2({ timeSeconds }));
    const [summary] = summarizeTags(tags);
    expect(summary.sampleCount).toBe(3);
    expect(summary.meanSeconds).toBe(2);
    // Population variance of [1, 2, 3] is 2/3.
    expect(summary.stdevSeconds).toBeCloseTo(Math.sqrt(2 / 3), 12);
  });

  test("orders summaries by phase, sprite, pattern, aim then scope", () => {
    const tags = [
      tag2({ phaseIndex: 3, spriteId: "a", pattern: "volley" }),
      tag2({ phaseIndex: 1, spriteId: "b", pattern: "volley" }),
      tag2({ phaseIndex: 1, spriteId: "a", pattern: "volley" }),
      tag2({ phaseIndex: 1, spriteId: "a", pattern: "rotating-arm" }),
    ];
    const first = summarizeTags(tags);
    const second = summarizeTags([...tags].reverse());
    expect(first).toEqual(second);
    expect(first.map((s) => [s.phaseIndex, s.spriteId, s.pattern])).toEqual([
      [1, "a", "rotating-arm"],
      [1, "a", "volley"],
      [1, "b", "volley"],
      [3, "a", "volley"],
    ]);
  });

  test("the upgraded pilot tags stay one all result", () => {
    const exportUrl = new URL(
      "../../../docs/killer-bee-queen-observations.json",
      import.meta.url,
    );
    const study = studyFromExport(
      validateObservationExport(JSON.parse(readFileSync(exportUrl, "utf8"))),
    );
    const summaries = summarizeTags(study.tags);
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries.every((s) => s.scope === "all")).toBe(true);
  });

  test("splits two bursts into between and within intervals", () => {
    // Burst 1 at 0, 0.5, 1.0; burst 2 at 4, 4.5; one standalone at 8.
    const tags = [
      tag2({ timeSeconds: 0, burstId: 1 }),
      tag2({ timeSeconds: 0.5, burstId: 1 }),
      tag2({ timeSeconds: 1, burstId: 1 }),
      tag2({ timeSeconds: 4, burstId: 2 }),
      tag2({ timeSeconds: 4.5, burstId: 2 }),
      tag2({ timeSeconds: 8 }),
    ];
    const summaries = summarizeTags(tags);
    expect(summaries.map((s) => s.scope)).toEqual([
      "between-bursts",
      "within-bursts",
    ]);
    expect(summaries[0].intervalsSeconds).toEqual([4, 4]);
    expect(summaries[0].meanSeconds).toBe(4);
    expect(summaries[1].intervalsSeconds).toEqual([0.5, 0.5, 0.5]);
    expect(summaries[1].sampleCount).toBe(3);
  });

  test("a single one-volley burst yields zero-sample results", () => {
    const summaries = summarizeTags([tag2({ burstId: 1 })]);
    expect(summaries.map((s) => [s.scope, s.sampleCount])).toEqual([
      ["between-bursts", 0],
      ["within-bursts", 0],
    ]);
  });

  test("emits no cadence-mapping fields", () => {
    const [summary] = summarizeTags([tag2({ burstId: 1 }), tag2({ burstId: 1, timeSeconds: 11 })]);
    for (const field of [
      "shotsPerBurst",
      "shotIntervalSeconds",
      "cooldownAfterLastShotSeconds",
    ])
      expect(summary).not.toHaveProperty(field);
  });
});

// T34 / V8 35.3: the committed evidence is cited by later decisions, so a
// malformed or hand-edited file must fail a gate rather than be discovered
// later. Nothing at runtime reads it. This test is durable only because T31
// keeps validation structural; if validation started checking sprites or
// phase indices against the encounter, an unrelated config change would turn
// this test red, so those two decisions are linked.
test("the committed phase-3 observation export passes structural validation", () => {
  const exportUrl = new URL(
    "../../../docs/killer-bee-queen-observations.json",
    import.meta.url,
  );
  const value: unknown = JSON.parse(readFileSync(exportUrl, "utf8"));
  expect(() => validateObservationExport(value)).not.toThrow();
});

describe("composite and typed-geometry tag fields (plan V15 phase 53)", () => {
  const validations: ReadonlyArray<readonly [string, Tag]> = [
    ["front aim on a spread", tag2({ pattern: "spread", aim: "front" })],
    ["front aim on a scatter", tag2({ pattern: "scatter", aim: "front" })],
    [
      "a ring of spreads",
      tag2({ pattern: "fixed-ring", armPattern: "spread", shotsPerArm: 3, armArcDegrees: 20 }),
    ],
    [
      "a rotating ring of scatters",
      tag2({ armPattern: "scatter", shotsPerArm: 2, armArcDegrees: 30 }),
    ],
    ["a ring of rings", tag2({ armPattern: "ring", shotsPerArm: 2 })],
    ["a negative rotation rate", tag2({ clockwiseDegreesPerSecond: -45 })],
    ["a rotation phase alone", tag2({ initialPhaseDegrees: 12.5 })],
    ["a rate alone", tag2({ clockwiseDegreesPerSecond: 30 })],
  ];

  test.each(validations)("accepts %s", (_label, entry) => {
    const value = observation2([entry]);
    expect(validateObservationExport(value)).toBe(value);
  });

  const rejections: ReadonlyArray<readonly [string, unknown, RegExp]> = [
    ["an unknown armPattern", { ...tag2(), armPattern: "single", shotsPerArm: 1 }, /armPattern/],
    [
      "armPattern on a spread",
      tag2({ pattern: "spread", aim: "player", armPattern: "ring", shotsPerArm: 2 }),
      /armPattern/,
    ],
    ["armPattern on a volley", tag2({ pattern: "volley", armPattern: "ring", shotsPerArm: 2 }), /armPattern/],
    ["armPattern without shotsPerArm", tag2({ armPattern: "ring" }), /shotsPerArm/],
    ["shotsPerArm without armPattern", tag2({ shotsPerArm: 2 }), /shotsPerArm/],
    ["a zero shotsPerArm", tag2({ armPattern: "ring", shotsPerArm: 0 }), /shotsPerArm/],
    ["a fractional shotsPerArm", tag2({ armPattern: "ring", shotsPerArm: 1.5 }), /shotsPerArm/],
    ["a spread arm without a cone", tag2({ armPattern: "spread", shotsPerArm: 3 }), /armArcDegrees/],
    ["a scatter arm without a cone", tag2({ armPattern: "scatter", shotsPerArm: 3 }), /armArcDegrees/],
    ["a negative cone", tag2({ armPattern: "spread", shotsPerArm: 3, armArcDegrees: -1 }), /armArcDegrees/],
    ["a full-turn spread arc", tag2({ armPattern: "spread", shotsPerArm: 3, armArcDegrees: 360 }), /armArcDegrees/],
    ["a zero scatter cone", tag2({ armPattern: "scatter", shotsPerArm: 3, armArcDegrees: 0 }), /armArcDegrees/],
    ["a scatter cone over 360", tag2({ armPattern: "scatter", shotsPerArm: 3, armArcDegrees: 361 }), /armArcDegrees/],
    ["a cone on a ring of rings", tag2({ armPattern: "ring", shotsPerArm: 2, armArcDegrees: 10 }), /armArcDegrees/],
    ["a cone without armPattern", tag2({ armArcDegrees: 10 }), /armArcDegrees/],
    ["a rate on a fixed ring", tag2({ pattern: "fixed-ring", clockwiseDegreesPerSecond: 10 }), /clockwiseDegreesPerSecond/],
    ["a phase on a spread", tag2({ pattern: "spread", aim: "fixed", initialPhaseDegrees: 10 }), /initialPhaseDegrees/],
    ["a nonfinite rate", { ...tag2(), clockwiseDegreesPerSecond: Number.NaN }, /clockwiseDegreesPerSecond/],
    ["a string phase", { ...tag2(), initialPhaseDegrees: "10" }, /initialPhaseDegrees/],
  ];

  test.each(rejections)("rejects %s", (_label, entry, path) => {
    expect(() => validateObservationExport(observation2([entry]))).toThrow(path);
  });

  test("a v2 file without the new fields is unchanged and the studies keep them out", () => {
    const value = observation2([tag2(), tag2({ pattern: "spread", aim: "player" })]);
    expect(validateObservationExport(value)).toBe(value);
    const study = studyFromExport(validateObservationExport(value));
    for (const entry of study.tags) {
      expect(entry).not.toHaveProperty("armPattern");
      expect(entry).not.toHaveProperty("clockwiseDegreesPerSecond");
    }
  });

  test("a composite and a plain ring of one sprite summarize separately (N31)", () => {
    const summaries = summarizeTags([
      tag2({ pattern: "fixed-ring", timeSeconds: 1 }),
      tag2({ pattern: "fixed-ring", timeSeconds: 2 }),
      tag2({ pattern: "fixed-ring", armPattern: "ring", shotsPerArm: 2, timeSeconds: 3 }),
      tag2({ pattern: "fixed-ring", armPattern: "ring", shotsPerArm: 2, timeSeconds: 5 }),
    ]);
    expect(summaries).toHaveLength(2);
    expect(summaries.map((summary) => summary.armPattern)).toEqual([undefined, "ring"]);
  });

  test("rotation and arc values do not join the grouping key", () => {
    const summaries = summarizeTags([
      tag2({ timeSeconds: 1, clockwiseDegreesPerSecond: 10, initialPhaseDegrees: 0 }),
      tag2({ timeSeconds: 2, clockwiseDegreesPerSecond: 99, initialPhaseDegrees: 40 }),
    ]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].sampleCount).toBe(1);
  });
});
