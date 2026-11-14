/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  resolveTags,
  studyFromExport,
  validateObservationExport,
  type ObservationExport,
  type SavedAttack,
  type Tag,
  type TagV1,
} from "./tagging";

/** Plan V20: `studyFromExport` also returns a v5 study; these tests read legacy files. */
const legacyStudyFromExport = (validated: Parameters<typeof studyFromExport>[0]) =>
  studyFromExport(validated) as import("./tagging").StudyState;

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
      validateObservationExport(observation2([tag2()], { schemaVersion: 6 })),
    ).toThrow(/schemaVersion/);
    // Plan V20: version 5 delegates to the v5 study validator.
    expect(() =>
      validateObservationExport(observation2([tag2()], { schemaVersion: 5 })),
    ).toThrow(/Study/);
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
    const study = legacyStudyFromExport(
      validateObservationExport(value),
    );
    expect(JSON.stringify(value)).toBe(before);
    expect(study.provenance.frameRate).toBeNull();
    expect(resolveTags(study.tags, study.savedAttacks).map((entry) => entry.pattern)).toEqual([
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
    const study = legacyStudyFromExport(validateObservationExport(value));
    expect(study.tags).toEqual(tags);
    expect(study.provenance.frameRate).toBe(60);
    expect(study.encounterId).toBe("killer-bee-queen");
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
    const study = legacyStudyFromExport(validateObservationExport(value));
    for (const entry of study.tags) {
      expect(entry).not.toHaveProperty("armPattern");
      expect(entry).not.toHaveProperty("clockwiseDegreesPerSecond");
    }
  });

});

function savedAttack(overrides: Partial<SavedAttack> = {}): SavedAttack {
  return {
    id: "a1",
    name: "Spiral",
    spriteId: "red-glaive",
    pattern: "rotating-arm",
    shots: 4,
    cadence: { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0.4 },
    ...overrides,
  };
}

function observation3(
  tags: readonly unknown[],
  savedAttacks: readonly unknown[] = [],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...observation({ tags }), schemaVersion: 3, savedAttacks, ...extra };
}

const linked = { timeSeconds: 5, phaseIndex: 1, savedAttackId: "a1" };

describe("validateObservationExport v3", () => {
  test("round-trips a v3 file with a linked repeat", () => {
    const value = observation3(
      [tag2(), { ...linked, repeatEndSeconds: 9, repeatEndSource: "typed" }],
      [savedAttack()],
    );
    expect(validateObservationExport(value)).toBe(value);
    const study = legacyStudyFromExport(validateObservationExport(value));
    expect(study.savedAttacks).toHaveLength(1);
    expect(study.tags).toHaveLength(2);
  });

  test("v1 and v2 files load with empty saved attacks", () => {
    expect(
      legacyStudyFromExport(validateObservationExport(observation())).savedAttacks,
    ).toEqual([]);
    expect(
      legacyStudyFromExport(validateObservationExport(observation2([tag2()]))).savedAttacks,
    ).toEqual([]);
  });

  test("the committed evidence file still validates and loads", () => {
    const exportUrl = new URL(
      "../../../docs/killer-bee-queen-observations.json",
      import.meta.url,
    );
    const study = legacyStudyFromExport(
      validateObservationExport(JSON.parse(readFileSync(exportUrl, "utf8"))),
    );
    expect(study.savedAttacks).toEqual([]);
  });

  const cases: [string, Record<string, unknown>, RegExp][] = [
    ["missing savedAttacks", { ...observation({ tags: [tag2()] }), schemaVersion: 3 }, /savedAttacks/],
    [
      "duplicate attack name",
      observation3([], [savedAttack(), savedAttack({ id: "a2" })]),
      /savedAttacks\[1\]\.name/,
    ],
    [
      "duplicate attack id",
      observation3([], [savedAttack(), savedAttack({ name: "Other" })]),
      /savedAttacks\[1\]\.id/,
    ],
    ["blank attack name", observation3([], [savedAttack({ name: " " })]), /savedAttacks\[0\]\.name/],
    [
      "a cadence with no cooldown",
      observation3([], [savedAttack({ cadence: { shotsPerBurst: 1 } as never })]),
      /cooldownAfterLastShotSeconds/,
    ],
    [
      "a multi-shot cadence with no interval",
      observation3([], [savedAttack({ cadence: { shotsPerBurst: 3, cooldownAfterLastShotSeconds: 1 } })]),
      /shotIntervalSeconds/,
    ],
    [
      "an interval at one shot per burst",
      observation3([], [
        savedAttack({
          cadence: { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1 },
        }),
      ]),
      /shotIntervalSeconds/,
    ],
    ["an unknown saved attack id", observation3([linked], []), /tags\[0\]\.savedAttackId/],
    [
      "attack fields on a linked tag",
      observation3([{ ...linked, spriteId: "x" }], [savedAttack()]),
      /tags\[0\]\.spriteId/,
    ],
    [
      "a repeat end not after the time",
      observation3([{ ...linked, repeatEndSeconds: 5 }], [savedAttack()]),
      /repeatEndSeconds/,
    ],
    [
      "a repeat end source without an end",
      observation3([{ ...linked, repeatEndSource: "typed" }], [savedAttack()]),
      /repeatEndSource/,
    ],
    [
      "a burst id on a repeat",
      observation3([{ ...linked, repeatEndSeconds: 9, burstId: 1 }], [savedAttack()]),
      /burstId/,
    ],
    [
      "an emitter radius off a ring",
      observation3([tag2({ pattern: "spread", aim: "player", emitterRadiusTiles: 1 })]),
      /emitterRadiusTiles/,
    ],
    [
      "a cone on a ring",
      observation3([tag2({ coneDegrees: 30 })]),
      /coneDegrees/,
    ],
    [
      "a bearing without aim fixed",
      observation3([tag2({ pattern: "spread", aim: "player", fixedBearingDegrees: 3 })]),
      /fixedBearingDegrees/,
    ],
    [
      "a front offset without aim front",
      observation3([tag2({ pattern: "spread", aim: "player", frontOffsetDegrees: 3 })]),
      /frontOffsetDegrees/,
    ],
    [
      "a target on a multi-shot spread",
      observation3([tag2({ pattern: "spread", aim: "player", shots: 3, target: "player" })]),
      /target/,
    ],
    [
      "a target with a range",
      observation3([
        tag2({ pattern: "spread", aim: "player", shots: 1, target: "player", bombRangeTiles: 4 }),
      ]),
      /bombRangeTiles/,
    ],
    [
      "a nonpositive bomb time",
      observation3([tag2({ bombTravelSeconds: 0 })]),
      /bombTravelSeconds/,
    ],
    ["a nonpositive bullet speed", observation3([tag2({ bulletSpeedTilesPerSecond: -1 })]), /bulletSpeedTilesPerSecond/],
  ];

  test.each(cases)("rejects %s with its path", (_label, value, path) => {
    expect(() => validateObservationExport(value)).toThrow(path);
  });

  test("accepts the new typed fields where they apply", () => {
    const value = observation3([
      tag2({ pattern: "fixed-ring", emitterRadiusTiles: 0.5 }),
      tag2({ pattern: "spread", aim: "fixed", coneDegrees: 40, fixedBearingDegrees: 90 }),
      tag2({ pattern: "spread", aim: "front", frontOffsetDegrees: 10 }),
      tag2({ pattern: "spread", aim: "player", shots: 1, target: "player", bombTravelSeconds: 1.2 }),
      tag2({ bombRangeTiles: 5, bulletRangeTiles: 6, bulletSpeedTilesPerSecond: 7 }),
    ]);
    expect(validateObservationExport(value)).toBe(value);
  });
});

describe("resolveTags", () => {
  test("fills a linked tag from its saved attack and passes an unlinked tag through", () => {
    const plain = tag2();
    const resolved = resolveTags([plain, linked], [savedAttack({ shots: 6 })]);
    expect(resolved[0]).toBe(plain);
    expect(resolved[1]).toMatchObject({
      spriteId: "red-glaive",
      shots: 6,
      pattern: "rotating-arm",
      savedAttackId: "a1",
      timeSeconds: 5,
      phaseIndex: 1,
    });
    expect(resolved[1]).not.toHaveProperty("cadence");
    expect(resolved[1]).not.toHaveProperty("name");
  });

  test("throws on an unknown id", () => {
    expect(() => resolveTags([linked], [])).toThrow(/a1/);
  });
});

describe("V18 schema v4", () => {
  const provenance = { sourceUrl: null, fileName: "a.mp4", frameRate: 30, durationSeconds: 10 };
  const base = {
    schemaVersion: 4,
    encounterId: "killer-bee-queen",
    archetypeId: "red-killer-bee",
    provenance,
    recordedAt: "2026-11-07T00:00:00.000Z",
    savedAttacks: [],
    tags: [],
    monsterDraft: { phases: [{ phaseId: "p", attacks: [], subPhases: [] }], anchors: { p: 1.5 } },
  };

  test("round-trips a draft and anchors", () => {
    const study = legacyStudyFromExport(validateObservationExport(base));
    expect(study.archetypeId).toBe("red-killer-bee");
    expect(study.monsterDraft).toEqual(base.monsterDraft);
  });

  test("rejects a bad draft, a negative anchor and an empty archetype", () => {
    expect(() => validateObservationExport({ ...base, monsterDraft: { phases: {}, anchors: {} } })).toThrow(/phases/);
    expect(() =>
      validateObservationExport({ ...base, monsterDraft: { ...base.monsterDraft, anchors: { p: -1 } } }),
    ).toThrow(/anchors/);
    expect(() => validateObservationExport({ ...base, archetypeId: "" })).toThrow(/archetypeId/);
  });

  test("older versions load as the primary monster with no draft", () => {
    const v3 = legacyStudyFromExport(
      validateObservationExport({ ...base, schemaVersion: 3, archetypeId: undefined, monsterDraft: undefined }),
    );
    expect(v3.archetypeId).toBeNull();
    expect(v3.monsterDraft).toBeNull();
  });
});
