import { describe, expect, test } from "vitest";
import type { AuthoredAttack } from "../game/config/data";
import type { AttackTrack, Mark, Segment, StudyV5 } from "./study";
import { studyWarnings } from "./studyWarnings";

const segment = (id: string): Segment => {
  const [phaseId, subPhaseId = null] = id.split("/");
  return { id, ref: { phaseId, subPhaseId }, label: id, telegraphSeconds: 0, invulnerableOnEnterSeconds: 0, durationSeconds: null };
};
const segments = [segment("a"), segment("b/x"), segment("b/y")];
const volleys = (...times: number[]): Mark[] => times.map((timeSeconds) => ({ timeSeconds, kind: "volley" }));
const track = (overrides: Partial<AttackTrack> = {}): AttackTrack => ({
  id: "bee",
  location: { phaseId: "a", subPhaseId: null },
  attack: { id: "bee" } as AuthoredAttack,
  cadenceSource: "authored",
  marks: volleys(0, 1, 2),
  ...overrides,
});

function study(overrides: Partial<StudyV5> = {}): StudyV5 {
  return {
    schemaVersion: 5,
    encounterId: "e",
    archetypeId: "m",
    recordedAt: "2026-11-13T00:00:00.000Z",
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 10 },
    boundaries: [{ timeSeconds: 0, segmentId: "a" }],
    statusSpans: [],
    tracks: [track()],
    scratch: [],
    acceptedSegmentValues: {},
    ...overrides,
  };
}
const texts = (value: StudyV5, frameToleranceSeconds = 1 / 60) =>
  studyWarnings({ study: value, segments, videoEndSeconds: 10, frameToleranceSeconds }).map(
    (warning) => warning.text,
  );

describe("studyWarnings", () => {
  test("a clean study has no warnings", () => {
    expect(texts(study())).toEqual([]);
  });

  test("1. an unknown segment", () => {
    expect(texts(study({ boundaries: [{ timeSeconds: 0, segmentId: "a" }, { timeSeconds: 8, segmentId: "gone" }] }))).toContain(
      "Boundary at 8.000 s names an unknown segment gone.",
    );
  });

  test("2. a boundary out of the authored cycle", () => {
    const value = study({
      boundaries: [{ timeSeconds: 0, segmentId: "a" }, { timeSeconds: 4, segmentId: "b/x" }, { timeSeconds: 6, segmentId: "b/x" }],
    });
    expect(texts(value)).toEqual(["Boundary at 6.000 s enters b/x; the authored cycle expects b/y."]);
  });

  test("3. invulnerability away from every boundary", () => {
    const value = study({ statusSpans: [{ kind: "invulnerable", inSeconds: 3, outSeconds: 4 }, { kind: "invulnerable", inSeconds: 0.02, outSeconds: 1 }] });
    expect(studyWarnings({ study: value, segments, videoEndSeconds: 10, frameToleranceSeconds: 1 / 60 })).toEqual([
      {
        where: "status",
        text: "Invulnerable from 3.000 s starts away from every boundary; the game can only start invulnerability when a segment is entered.",
      },
    ]);
  });

  test("4. a mark outside every window of its location", () => {
    const value = study({
      boundaries: [{ timeSeconds: 0, segmentId: "a" }, { timeSeconds: 5, segmentId: "b/x" }],
      tracks: [track({ marks: volleys(0, 1, 2, 6) })],
    });
    expect(texts(value)).toEqual(["bee: mark at 6.000 s is outside every window of a."]);
  });

  test("5. an end mark before its window ends", () => {
    expect(texts(study({ tracks: [track({ endSeconds: 5 })] }))).toEqual([
      "bee: ends at 5.000 s but its window runs to 10.000 s; the game runs an attack until its segment ends, so a sub-phase boundary may be missing.",
    ]);
  });

  test("6. a fit with a null cooldown or burst size", () => {
    expect(texts(study({ tracks: [track({ marks: volleys(1) })] }))).toEqual([
      "bee: the fit needs one more burst to measure the cooldown.",
    ]);
    expect(texts(study({ tracks: [track({ marks: volleys(0, 0.1, 0.2), burstGapThresholdSeconds: 0.5 })] }))).toEqual([
      "bee: the fit needs one more burst to measure the cooldown.",
      "bee: the fit cannot tell bursts apart; set a burst gap threshold.",
    ]);
  });

  test("7. a residual above two frames, only with a frame rate", () => {
    const value = study({ tracks: [track({ marks: volleys(0, 1, 2, 3.5, 4.5, 5.5) })] });
    expect(texts(value)).toEqual(["bee: a mark lies 0.500 s from the fitted cadence."]);
    expect(texts(value, 0)).toEqual([]);
  });
});
