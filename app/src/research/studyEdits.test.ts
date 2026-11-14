import { describe, expect, test } from "vitest";
import type { AuthoredAttack } from "../game/config/data";
import type { AttackTrack, Segment, StudyV5 } from "./study";
import {
  acceptSegmentValue,
  addBoundary,
  addMark,
  addTrack,
  createTrackFromScratch,
  duplicateTrack,
  removeBoundary,
  removeMarkNear,
  removeSpan,
  reloadTracks,
  removeTrack,
  setBoundarySegment,
  setBurstGapThreshold,
  setEndMark,
  setMeasuredRange,
  setProjectileOverride,
  setScale,
  setTelegraphEnd,
  setTrackAttack,
  setTrackLocation,
  toggleInvulnerable,
  type EditResult,
} from "./studyEdits";

const attack = (id: string) =>
  ({
    id,
    projectile: "p",
    tuningSource: "trainer-authored",
    pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "player" },
    cadence: { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 1, initialDelaySeconds: 0 },
  }) as unknown as AuthoredAttack;

const track = (id: string, overrides: Partial<AttackTrack> = {}): AttackTrack => ({
  id,
  location: { phaseId: "a", subPhaseId: null },
  attack: attack(id),
  cadenceSource: "authored",
  marks: [],
  ...overrides,
});

function study(overrides: Partial<StudyV5> = {}): StudyV5 {
  return {
    schemaVersion: 5,
    encounterId: "e",
    archetypeId: "m",
    recordedAt: "2026-11-13T00:00:00.000Z",
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
    boundaries: [],
    statusSpans: [],
    tracks: [track("bee"), track("bomb")],
    scratch: [],
    acceptedSegmentValues: {},
    ...overrides,
  };
}

const segment = (id: string): Segment => {
  const [phaseId, subPhaseId = null] = id.split("/");
  return {
    id,
    ref: { phaseId, subPhaseId },
    label: id,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    durationSeconds: null,
  };
};
const segments = [segment("a"), segment("b/x"), segment("b/y")];
const isBomb = (id: string) => id === "bomb";

/** Runs an edit and asserts it left its input untouched. */
function run(input: StudyV5, edit: (value: StudyV5) => EditResult<StudyV5>): EditResult<StudyV5> {
  const before = structuredClone(input);
  const result = edit(input);
  expect(input).toEqual(before);
  return result;
}
function value(result: EditResult<StudyV5>): StudyV5 {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
function error(result: EditResult<StudyV5>): string {
  if (result.ok) throw new Error("expected a refusal");
  expect(result.error).toMatch(/^[A-Z].*\.$/);
  return result.error;
}

describe("structure edits", () => {
  test("addBoundary guesses the next sub-phase, wraps, and keeps boundaries sorted", () => {
    let current = study();
    for (const time of [0, 5, 10, 15]) current = value(run(current, (s) => addBoundary(s, time, segments)));
    expect(current.boundaries.map((boundary) => boundary.segmentId)).toEqual(["a", "b/x", "b/y", "b/x"]);
    const early = value(run(current, (s) => addBoundary(s, 2, segments)));
    expect(early.boundaries.map((boundary) => boundary.timeSeconds)).toEqual([0, 2, 5, 10, 15]);
    expect(early.boundaries[1].segmentId).toBe("b/x");
    error(run(current, (s) => addBoundary(s, -1, segments)));
  });

  test("setBoundarySegment and removeBoundary", () => {
    const base = study({ boundaries: [{ timeSeconds: 1, segmentId: "a" }] });
    expect(value(run(base, (s) => setBoundarySegment(s, 0, "b/y"))).boundaries[0].segmentId).toBe("b/y");
    expect(value(run(base, (s) => removeBoundary(s, 0))).boundaries).toEqual([]);
    expect(error(run(base, (s) => removeBoundary(s, 3)))).toBe("No boundary is at that position.");
  });

  test("setTelegraphEnd sets the latest boundary's end and refuses before the first", () => {
    const base = study({ boundaries: [{ timeSeconds: 1, segmentId: "a" }, { timeSeconds: 5, segmentId: "b/x" }] });
    expect(value(run(base, (s) => setTelegraphEnd(s, 6))).boundaries[1].telegraphEndSeconds).toBe(6);
    expect(error(run(base, (s) => setTelegraphEnd(s, 0.5)))).toBe(
      "Add a boundary before marking where its telegraph ends.",
    );
    error(run(base, (s) => setTelegraphEnd(s, 5)));
  });

  test("toggleInvulnerable opens then closes, refusing a close at or before the in", () => {
    const opened = value(run(study(), (s) => toggleInvulnerable(s, 3)));
    expect(opened.statusSpans).toEqual([{ kind: "invulnerable", inSeconds: 3, outSeconds: null }]);
    expect(error(run(opened, (s) => toggleInvulnerable(s, 3)))).toMatch(/must end after it starts/);
    const closed = value(run(opened, (s) => toggleInvulnerable(s, 4)));
    expect(closed.statusSpans[0].outSeconds).toBe(4);
    expect(value(run(closed, (s) => removeSpan(s, 0))).statusSpans).toEqual([]);
    error(run(closed, (s) => removeSpan(s, 1)));
  });
});

describe("mark edits", () => {
  test("addMark keeps marks sorted", () => {
    let current = study();
    for (const time of [3, 1, 2])
      current = value(run(current, (s) => addMark(s, "bee", { timeSeconds: time, kind: "volley" }, isBomb)));
    expect(current.tracks[0].marks.map((mark) => mark.timeSeconds)).toEqual([1, 2, 3]);
    const scratch = value(run(current, (s) => addMark(s, null, { timeSeconds: 4, kind: "volley" }, isBomb)));
    expect(scratch.scratch).toHaveLength(1);
  });

  test("addMark refuses a detonation on a non-bomb track and on scratch", () => {
    const detonation = { timeSeconds: 1, kind: "detonation" } as const;
    expect(error(run(study(), (s) => addMark(s, "bee", detonation, isBomb)))).toBe(
      "Only a bomb's track takes detonation marks.",
    );
    expect(error(run(study(), (s) => addMark(s, null, detonation, isBomb)))).toMatch(/scratch track/);
    expect(value(run(study(), (s) => addMark(s, "bomb", detonation, isBomb))).tracks[1].marks).toHaveLength(1);
    expect(error(run(study(), (s) => addMark(s, "gone", detonation, isBomb)))).toBe(
      "No attack track is named gone.",
    );
  });

  test("removeMarkNear removes the nearest of two marks inside the tolerance", () => {
    const base = study({
      tracks: [track("bee", { marks: [{ timeSeconds: 1, kind: "volley" }, { timeSeconds: 1.03, kind: "volley" }] })],
    });
    const result = value(run(base, (s) => removeMarkNear(s, "bee", 1.02, 0.05)));
    expect(result.tracks[0].marks).toEqual([{ timeSeconds: 1, kind: "volley" }]);
    expect(error(run(base, (s) => removeMarkNear(s, "bee", 2, 0.05)))).toBe(
      "No mark within one frame of this frame.",
    );
    const scratch = study({ scratch: [{ timeSeconds: 2, kind: "volley" }] });
    expect(value(run(scratch, (s) => removeMarkNear(s, null, 2, 0))).scratch).toEqual([]);
  });

  test("setEndMark sets and clears", () => {
    const ended = value(run(study(), (s) => setEndMark(s, "bee", 7)));
    expect(ended.tracks[0].endSeconds).toBe(7);
    expect(value(run(ended, (s) => setEndMark(s, "bee", null))).tracks[0]).not.toHaveProperty("endSeconds");
  });
});

describe("track edits", () => {
  test("addTrack refuses a duplicate id and removeTrack an unknown one", () => {
    expect(error(run(study(), (s) => addTrack(s, track("bee"))))).toBe(
      "An attack track named bee already exists.",
    );
    expect(value(run(study(), (s) => addTrack(s, track("new")))).tracks).toHaveLength(3);
    expect(value(run(study(), (s) => removeTrack(s, "bee"))).tracks.map((t) => t.id)).toEqual(["bomb"]);
    error(run(study(), (s) => removeTrack(s, "gone")));
  });

  test("duplicateTrack copies the definition without marks", () => {
    const base = study({ tracks: [track("bee", { marks: [{ timeSeconds: 1, kind: "volley" }], endSeconds: 4 })] });
    const copy = value(run(base, (s) => duplicateTrack(s, "bee", "bee-2"))).tracks[1];
    expect(copy.id).toBe("bee-2");
    expect(copy.attack.id).toBe("bee-2");
    expect(copy.marks).toEqual([]);
    expect(copy).not.toHaveProperty("endSeconds");
    error(run(base, (s) => duplicateTrack(s, "bee", "bee")));
  });

  test("setTrackAttack, setTrackLocation and setBurstGapThreshold", () => {
    const attacked = value(run(study(), (s) => setTrackAttack(s, "bee", attack("other"), "typed")));
    expect(attacked.tracks[0]).toMatchObject({ cadenceSource: "typed", attack: { id: "other" } });
    const moved = value(run(study(), (s) => setTrackLocation(s, "bee", { phaseId: "b", subPhaseId: "x" })));
    expect(moved.tracks[0].location).toEqual({ phaseId: "b", subPhaseId: "x" });
    error(run(study(), (s) => setTrackLocation(s, "bee", { phaseId: "", subPhaseId: null })));
    const threshold = value(run(study(), (s) => setBurstGapThreshold(s, "bee", 0.2)));
    expect(threshold.tracks[0].burstGapThresholdSeconds).toBe(0.2);
    expect(value(run(threshold, (s) => setBurstGapThreshold(s, "bee", undefined))).tracks[0]).not.toHaveProperty(
      "burstGapThresholdSeconds",
    );
    error(run(study(), (s) => setBurstGapThreshold(s, "bee", 0)));
  });

  test("createTrackFromScratch moves exactly the listed marks", () => {
    const base = study({
      scratch: [1, 2, 3].map((timeSeconds) => ({ timeSeconds, kind: "volley" as const })),
    });
    const result = value(run(base, (s) => createTrackFromScratch(s, [0, 2], track("new"))));
    expect(result.scratch).toEqual([{ timeSeconds: 2, kind: "volley" }]);
    expect(result.tracks[2].marks.map((mark) => mark.timeSeconds)).toEqual([1, 3]);
    error(run(base, (s) => createTrackFromScratch(s, [0], track("new", { marks: [{ timeSeconds: 9, kind: "volley" }] }))));
    error(run(base, (s) => createTrackFromScratch(s, [5], track("new"))));
    error(run(base, (s) => createTrackFromScratch(s, [0], track("bee"))));
  });
});

describe("accepted values and scale", () => {
  test("acceptSegmentValue sets and withdraws", () => {
    const accepted = value(run(study(), (s) => acceptSegmentValue(s, "a", "telegraphSeconds", 1.5)));
    expect(accepted.acceptedSegmentValues).toEqual({ a: { telegraphSeconds: 1.5 } });
    expect(value(run(accepted, (s) => acceptSegmentValue(s, "a", "telegraphSeconds", undefined))).acceptedSegmentValues).toEqual({});
    error(run(study(), (s) => acceptSegmentValue(s, "a", "durationSeconds", -1)));
  });

  test("setScale sets, clears and refuses a non-positive fraction", () => {
    const scaled = value(run(study(), (s) => setScale(s, 0.05)));
    expect(scaled.scale).toEqual({ tileWidthFraction: 0.05 });
    expect(value(run(scaled, (s) => setScale(s, undefined)))).not.toHaveProperty("scale");
    error(run(study(), (s) => setScale(s, 0)));
  });
});

describe("reloadTracks", () => {
  test("replaces every track with no marks and keeps every track with marks", () => {
    const marked = track("bee", { marks: [{ timeSeconds: 1, kind: "volley" }] });
    const start = study({ tracks: [marked, track("bomb"), track("old")] });
    const fresh = [track("bee"), track("bomb", { cadenceSource: "fitted" }), track("new")];
    const { study: next, keptCount } = reloadTracks(start, fresh);
    expect(keptCount).toBe(1);
    expect(next.tracks.map((entry) => entry.id)).toEqual(["bee", "bomb", "new"]);
    expect(next.tracks[0]).toBe(marked);
    expect(next.tracks[1].cadenceSource).toBe("fitted");
  });

  test("a kept track whose id the file no longer has stays at the end", () => {
    const marked = track("gone", { marks: [{ timeSeconds: 1, kind: "volley" }] });
    const { study: next } = reloadTracks(study({ tracks: [marked] }), [track("bee")]);
    expect(next.tracks.map((entry) => entry.id)).toEqual(["bee", "gone"]);
  });
});

describe("bomb overrides (plan V20 phase 87)", () => {
  test("setProjectileOverride merges fields and clears with undefined", () => {
    const first = run(study(), (value) => setProjectileOverride(value, "bomb", { travelSeconds: 1.5 }));
    if (!first.ok) throw new Error(first.error);
    const second = run(first.value, (value) =>
      setProjectileOverride(value, "bomb", { ...first.value.tracks[1].projectileOverride, rangeTiles: 4 }),
    );
    if (!second.ok) throw new Error(second.error);
    expect(second.value.tracks[1].projectileOverride).toEqual({ travelSeconds: 1.5, rangeTiles: 4 });
    const cleared = run(second.value, (value) => setProjectileOverride(value, "bomb", undefined));
    if (!cleared.ok) throw new Error(cleared.error);
    expect("projectileOverride" in cleared.value.tracks[1]).toBe(false);
  });

  test("setProjectileOverride refuses a non-positive value", () => {
    expect(setProjectileOverride(study(), "bomb", { travelSeconds: 0 }).ok).toBe(false);
  });

  test("setMeasuredRange writes at the pair index and leaves earlier entries", () => {
    const start = study({ tracks: [track("bomb", { measuredRangeTiles: [3] })] });
    const result = run(start, (value) => setMeasuredRange(value, "bomb", 2, 5));
    if (!result.ok) throw new Error(result.error);
    expect(result.value.tracks[0].measuredRangeTiles).toEqual([3, null, 5]);
    const again = setMeasuredRange(result.value, "bomb", 0, 4);
    expect(again.ok && again.value.tracks[0].measuredRangeTiles).toEqual([4, null, 5]);
    expect(setMeasuredRange(start, "bomb", -1, 5).ok).toBe(false);
    expect(setMeasuredRange(start, "bomb", 0, Number.NaN).ok).toBe(false);
  });
});
