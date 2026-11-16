import { describe, expect, test } from "vitest";
import { archetypeOf, encounterConfigOf } from "../game/config/encounter";
import { blocksOfMonster } from "./monsterDraft";
import {
  attackIdsInPhaseOf,
  nextSegmentId,
  segmentIdOf,
  segmentWindows,
  segmentsOfMonster,
  validateStudyV5,
  windowAt,
  windowsForTrack,
  type AttackTrack,
  type Segment,
  type StudyV5,
} from "./study";

const queen = archetypeOf(encounterConfigOf("killer-bee-queen"), "killer-bee-queen");
const segments = segmentsOfMonster(queen);

function segment(id: string, telegraphSeconds = 0): Segment {
  const [phaseId, subPhaseId = null] = id.split("/");
  return {
    id,
    ref: { phaseId, subPhaseId },
    label: id,
    telegraphSeconds,
    invulnerableOnEnterSeconds: 0,
    durationSeconds: null,
  };
}

function minimalStudy(overrides: Partial<StudyV5> = {}): StudyV5 {
  return {
    schemaVersion: 5,
    encounterId: "killer-bee-queen",
    archetypeId: "killer-bee-queen",
    recordedAt: "2026-11-13T00:00:00.000Z",
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
    boundaries: [],
    statusSpans: [],
    tracks: [],
    scratch: [],
    acceptedSegmentValues: {},
    ...overrides,
  };
}

describe("segments", () => {
  test("segmentIdOf joins a sub-phase with a slash", () => {
    expect(segmentIdOf({ phaseId: "p", subPhaseId: null })).toBe("p");
    expect(segmentIdOf({ phaseId: "p", subPhaseId: "s" })).toBe("p/s");
  });

  test("segmentsOfMonster on the Queen yields the block ids", () => {
    expect(segments.map((entry) => entry.id)).toEqual(
      blocksOfMonster(queen).map((block) => block.id),
    );
    const phase = segments.find((entry) => entry.ref.subPhaseId === null);
    expect(phase?.durationSeconds).toBeNull();
  });

  test("nextSegmentId wraps inside a phase with sub-phases", () => {
    const list = [segment("a"), segment("b/x"), segment("b/y"), segment("c")];
    expect(nextSegmentId(list, null)).toBe("a");
    expect(nextSegmentId(list, "a")).toBe("b/x");
    expect(nextSegmentId(list, "b/x")).toBe("b/y");
    expect(nextSegmentId(list, "b/y")).toBe("b/x");
  });

  test("nextSegmentId wraps across phases without sub-phases", () => {
    const list = [segment("a"), segment("b/x"), segment("c")];
    expect(nextSegmentId(list, "c")).toBe("a");
    expect(nextSegmentId(list, "unknown")).toBe("a");
  });
});

describe("windows", () => {
  const list = [segment("a", 1), segment("b/x", 0.5), segment("b/y", 0.5)];

  test("each window ends at the next boundary and the last at the video end", () => {
    const windows = segmentWindows(
      [
        { timeSeconds: 10, segmentId: "b/x" },
        { timeSeconds: 0, segmentId: "a" },
      ],
      list,
      30,
    );
    expect(windows).toEqual([
      { segmentId: "a", startSeconds: 0, epochSeconds: 1, endSeconds: 10 },
      { segmentId: "b/x", startSeconds: 10, epochSeconds: 10.5, endSeconds: 30 },
    ]);
  });

  test("a telegraph end is the epoch when present; an unknown segment has no telegraph", () => {
    const windows = segmentWindows(
      [
        { timeSeconds: 0, segmentId: "a", telegraphEndSeconds: 2.5 },
        { timeSeconds: 5, segmentId: "gone" },
      ],
      list,
      9,
    );
    expect(windows.map((window) => window.epochSeconds)).toEqual([2.5, 5]);
  });

  test("two equal-time boundaries keep their order and the first is empty", () => {
    const windows = segmentWindows(
      [
        { timeSeconds: 4, segmentId: "b/x" },
        { timeSeconds: 4, segmentId: "b/y" },
      ],
      list,
      9,
    );
    expect(windows.map((window) => [window.segmentId, window.startSeconds, window.endSeconds])).toEqual([
      ["b/x", 4, 4],
      ["b/y", 4, 9],
    ]);
    expect(windowAt(windows, 4)?.segmentId).toBe("b/y");
  });

  test("windowsForTrack: every window of a phase at phase level, one sub-phase otherwise", () => {
    const windows = segmentWindows(
      [
        { timeSeconds: 0, segmentId: "a" },
        { timeSeconds: 2, segmentId: "b/x" },
        { timeSeconds: 4, segmentId: "b/y" },
        { timeSeconds: 6, segmentId: "b/x" },
      ],
      list,
      9,
    );
    expect(windowsForTrack(windows, { phaseId: "b", subPhaseId: null })).toHaveLength(3);
    expect(windowsForTrack(windows, { phaseId: "b", subPhaseId: "x" })).toHaveLength(2);
    expect(windowAt(windows, 1)?.segmentId).toBe("a");
    expect(windowAt(segmentWindows([{ timeSeconds: 3, segmentId: "a" }], list, 9), 1)).toBeNull();
  });
});

describe("attackIdsInPhaseOf", () => {
  const track = (id: string, attackId: string, phaseId: string, subPhaseId: string | null = null) =>
    ({
      id,
      location: { phaseId, subPhaseId },
      attack: { id: attackId } as AttackTrack["attack"],
      cadenceSource: "authored",
      marks: [],
    }) satisfies AttackTrack;

  test("returns the other attack ids of the same top-level phase, sub-phases included", () => {
    const selected = track("a", "ring", "phase-1");
    const study = minimalStudy({
      tracks: [
        selected,
        track("b", "spiral", "phase-1"),
        track("c", "burst", "phase-1", "sub-a"),
        track("d", "ring", "phase-2"),
      ],
    });
    expect(attackIdsInPhaseOf(study, selected)).toEqual(["spiral", "burst"]);
  });

  test("a sub-phase track shares its parent phase's scope", () => {
    const selected = track("c", "burst", "phase-1", "sub-a");
    const study = minimalStudy({
      tracks: [track("a", "ring", "phase-1"), selected, track("d", "ring", "phase-2")],
    });
    expect(attackIdsInPhaseOf(study, selected)).toEqual(["ring"]);
  });
});

describe("validateStudyV5", () => {
  test("accepts a minimal study and returns it unchanged", () => {
    const study = minimalStudy();
    expect(validateStudyV5(study)).toBe(study);
  });

  const track = (id: string, phaseId = "p") => ({
    id,
    location: { phaseId, subPhaseId: null },
    attack: {},
    cadenceSource: "authored",
    marks: [],
  });

  test.each([
    ["schemaVersion", { schemaVersion: 4 }],
    ["boundaries\\[0\\].timeSeconds", { boundaries: [{ timeSeconds: -1, segmentId: "a" }] }],
    ["boundaries\\[0\\].timeSeconds", { boundaries: [{ timeSeconds: Number.NaN, segmentId: "a" }] }],
    [
      "boundaries\\[0\\].telegraphEndSeconds",
      { boundaries: [{ timeSeconds: 2, segmentId: "a", telegraphEndSeconds: 2 }] },
    ],
    [
      "statusSpans\\[0\\].outSeconds",
      { statusSpans: [{ kind: "invulnerable", inSeconds: 3, outSeconds: 3 }] },
    ],
    ["scratch\\[0\\].kind", { scratch: [{ timeSeconds: 1, kind: "burst" }] }],
    ["tracks\\[1\\].id", { tracks: [track("t"), track("t")] }],
    ["tracks\\[0\\].location.phaseId", { tracks: [track("t", " ")] }],
    [
      "acceptedSegmentValues.a.telegraphSeconds",
      { acceptedSegmentValues: { a: { telegraphSeconds: -0.5 } } },
    ],
  ])("rejects a fault at %s", (path, overrides) => {
    expect(() => validateStudyV5({ ...minimalStudy(), ...overrides })).toThrow(new RegExp(path));
  });

  test("accepts an open span", () => {
    const study = minimalStudy({
      statusSpans: [{ kind: "invulnerable", inSeconds: 3, outSeconds: null }],
    });
    expect(validateStudyV5(study)).toBe(study);
  });
});
