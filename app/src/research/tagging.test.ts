/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  summarizeTags,
  validateObservationExport,
  type ObservationExport,
  type Tag,
} from "./tagging";

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

describe("summarizeTags", () => {
  test("returns no summaries for no tags", () => {
    expect(summarizeTags([])).toEqual([]);
  });

  test("sorts tags in time before differencing", () => {
    const tags = [
      tag({ timeSeconds: 12 }),
      tag({ timeSeconds: 10 }),
      tag({ timeSeconds: 11 }),
    ];
    expect(summarizeTags(tags)).toEqual([
      {
        phaseIndex: 2,
        spriteId: "red-glaive",
        kind: "volley",
        sampleCount: 2,
        meanSeconds: 1,
        stdevSeconds: 0,
      },
    ]);
  });

  test("keeps kinds separate when only the kind differs", () => {
    const summaries = summarizeTags([
      tag({ timeSeconds: 10 }),
      tag({ timeSeconds: 11 }),
      tag({ timeSeconds: 12, kind: "rotating-arm" }),
      tag({ timeSeconds: 15, kind: "rotating-arm" }),
    ]);
    expect(summaries.map((summary) => [summary.kind, summary.sampleCount])).toEqual([
      ["rotating-arm", 1],
      ["volley", 1],
    ]);
  });

  test("keeps a one-tag group with zero samples", () => {
    expect(summarizeTags([tag()])).toEqual([
      {
        phaseIndex: 2,
        spriteId: "red-glaive",
        kind: "volley",
        sampleCount: 0,
        meanSeconds: 0,
        stdevSeconds: 0,
      },
    ]);
  });

  test("uses population standard deviation", () => {
    const tags = [0, 1, 3, 6].map((timeSeconds) => tag({ timeSeconds }));
    const [summary] = summarizeTags(tags);
    expect(summary.sampleCount).toBe(3);
    expect(summary.meanSeconds).toBe(2);
    // Population variance of [1, 2, 3] is 2/3.
    expect(summary.stdevSeconds).toBeCloseTo(Math.sqrt(2 / 3), 12);
  });

  test("orders summaries deterministically by phase, sprite and kind", () => {
    const tags = [
      tag({ phaseIndex: 3, spriteId: "a", kind: "volley" }),
      tag({ phaseIndex: 1, spriteId: "b", kind: "volley" }),
      tag({ phaseIndex: 1, spriteId: "a", kind: "volley" }),
      tag({ phaseIndex: 1, spriteId: "a", kind: "rotating-arm" }),
    ];
    const first = summarizeTags(tags);
    const second = summarizeTags([...tags].reverse());
    expect(first).toEqual(second);
    expect(first.map((s) => [s.phaseIndex, s.spriteId, s.kind])).toEqual([
      [1, "a", "rotating-arm"],
      [1, "a", "volley"],
      [1, "b", "volley"],
      [3, "a", "volley"],
    ]);
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
