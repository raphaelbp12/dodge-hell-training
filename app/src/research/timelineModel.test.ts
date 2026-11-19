import { describe, expect, test } from "vitest";
import { unsafeFixture } from "../test/fixture";
import type { CadencedAuthoredAttack } from "../game/config/data";
import type { Segment, StudyV6 } from "./study";
import {
  markerFractions,
  timelineRows,
  TIMELINE_ROW_HEIGHT_PX,
  nextVolleyTime,
  previousVolleyTime,
  volleyStepTolerance,
} from "./timelineModel";

describe("markerFractions", () => {
  test("is empty for no times or no duration", () => {
    expect(markerFractions([], 100)).toEqual([]);
    expect(markerFractions([5], 0)).toEqual([]);
  });

  test("sorts, collapses ties and clamps", () => {
    expect(markerFractions([50, 25, 25, 150, -3], 100)).toEqual([0, 0.25, 0.5, 1]);
  });
});

describe("previous and next volley", () => {
  const times = [10, 20, 20, 30];

  test("return null at both ends and for an empty list", () => {
    expect(previousVolleyTime([], 5, 0)).toBeNull();
    expect(nextVolleyTime([], 5, 0)).toBeNull();
    expect(previousVolleyTime(times, 10, 0)).toBeNull();
    expect(nextVolleyTime(times, 30, 0)).toBeNull();
  });

  test("move across a tie once", () => {
    expect(nextVolleyTime(times, 10, 0)).toBe(20);
    expect(nextVolleyTime(times, 20, 0)).toBe(30);
    expect(previousVolleyTime(times, 30, 0)).toBe(20);
    expect(previousVolleyTime(times, 20, 0)).toBe(10);
  });

  test("a press from a marker's own frame moves on when the tolerance covers it", () => {
    const tolerance = volleyStepTolerance(60);
    expect(nextVolleyTime(times, 20.003, tolerance)).toBe(30);
    expect(previousVolleyTime(times, 20.003, tolerance)).toBe(10);
  });

  test("work between markers", () => {
    expect(nextVolleyTime(times, 15, 0)).toBe(20);
    expect(previousVolleyTime(times, 15, 0)).toBe(10);
  });
});

describe("volleyStepTolerance", () => {
  test("is half a frame, or zero without a rate", () => {
    expect(volleyStepTolerance(50)).toBeCloseTo(0.01);
    expect(volleyStepTolerance(null)).toBe(0);
  });
});

describe("timelineRows (plan V20 E20)", () => {
  const segment = (id: string): Segment => ({
    id,
    ref: { phaseId: id, subPhaseId: null },
    label: `Label ${id}`,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    durationSeconds: null,
  });
  const study: StudyV6 = {
    schemaVersion: 6,
    encounterId: "e",
    archetypeId: "m",
    recordedAt: "2026-11-13T00:00:00.000Z",
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
    boundaries: [
      { timeSeconds: 10, segmentId: "a", telegraphEndSeconds: 20 },
      { timeSeconds: 50, segmentId: "b" },
    ],
    statusSpans: [{ kind: "invulnerable", inSeconds: 80, outSeconds: null }],
    tracks: [
      {
        id: "bee",
        location: { phaseId: "a", subPhaseId: null },
        attack: unsafeFixture<CadencedAuthoredAttack>({ id: "bee" }),
        marks: [
          { timeSeconds: 25, kind: "volley" },
          { timeSeconds: 30, kind: "detonation" },
        ],
        endSeconds: 40,
        // Plan V23 Q18: cycles at 25 and 35; the one at 45 is after the stop at 40.
        periodSeconds: 10,
      },
    ],
    scratch: [{ timeSeconds: 60, kind: "volley" }],
  };

  test("a structure, status, track and scratch row with their tick styles", () => {
    const rows = timelineRows({
      study,
      segments: [segment("a"), segment("b")],
      durationSeconds: 100,
    });
    expect(TIMELINE_ROW_HEIGHT_PX).toBe(14);
    expect(rows.map((row) => row.id)).toEqual(["structure", "status", "bee", "scratch"]);
    const [structure, status, track, scratch] = rows;
    expect(structure.ticks).toEqual([
      { fraction: 0.1, style: "boundary" },
      { fraction: 0.5, style: "boundary" },
      { fraction: 0.2, style: "hollow" },
    ]);
    expect(structure.labels).toEqual([
      { fraction: 0.1, text: "Label a" },
      { fraction: 0.5, text: "Label b" },
    ]);
    expect(status.bars).toEqual([{ fromFraction: 0.8, toFraction: 1 }]);
    expect(track.ticks).toEqual([
      { fraction: 0.25, style: "solid" },
      { fraction: 0.3, style: "hollow" },
      { fraction: 0.35, style: "faint" },
    ]);
    expect(track.bars).toEqual([{ fromFraction: 0.4, toFraction: 0.5 }]);
    expect(scratch.ticks).toEqual([{ fraction: 0.6, style: "solid" }]);
  });

  test("a track that plays once has no faint repeat ticks", () => {
    const { periodSeconds: _period, ...once } = study.tracks[0];
    const rows = timelineRows({
      study: { ...study, tracks: [once] },
      segments: [segment("a"), segment("b")],
      durationSeconds: 100,
    });
    expect(rows[2].ticks.some((tick) => tick.style === "faint")).toBe(false);
  });

  test("a periodic track without a stop repeats to its window's end", () => {
    const { endSeconds: _end, ...open } = study.tracks[0];
    const rows = timelineRows({
      study: { ...study, tracks: [open] },
      segments: [segment("a"), segment("b")],
      durationSeconds: 100,
    });
    expect(rows[2].ticks.filter((tick) => tick.style === "faint").map((tick) => tick.fraction)).toEqual([
      0.35, 0.45,
    ]);
  });
});
