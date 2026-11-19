import { describe, expect, test } from "vitest";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { encounterConfigOf } from "../game/config/encounter";
import { firstMismatch, parityReport } from "./parity";
import type { AttackTrack, Boundary, Mark, StudyV6 } from "./study";
import { monsterFileTextFromStudy } from "./studyExport";
import { emptyStudy } from "./studyMigrate";

const QUEEN = "killer-bee-queen";
const PHASE_6 = "phase-6-nests";
const config = encounterConfigOf(QUEEN);
const shipped = AUTHORED_MONSTER_FILES[QUEEN];
const volleys = (...times: number[]): Mark[] => times.map((timeSeconds) => ({ timeSeconds, kind: "volley" }));

function studyWith(boundaries: readonly Boundary[], edits: Readonly<Record<string, Partial<AttackTrack>>>): StudyV6 {
  const study = emptyStudy({
    encounterId: QUEEN,
    archetypeId: QUEEN,
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
    recordedAt: "2026-11-19T00:00:00.000Z",
    rawFile: shipped,
  });
  return { ...study, boundaries, tracks: study.tracks.map((track) => ({ ...track, ...edits[track.id] })) };
}

function reportOf(study: StudyV6) {
  const text = monsterFileTextFromStudy({ archetypeId: QUEEN, study, currentRawFile: shipped, config });
  if (!text.ok) throw new Error(text.error);
  return parityReport({ study, shippedRawFile: shipped, exportedRawFile: JSON.parse(text.value) });
}

test("firstMismatch finds the first disagreement beyond the tolerance", () => {
  expect(firstMismatch([1, 2], [1.01, 2.02], 0.05)).toBeNull();
  expect(firstMismatch([1, 2], [1, 2.2], 0.05)).toEqual({ index: 1, expected: 2, actual: 2.2 });
  expect(firstMismatch([1, 2], [1], 0.05)).toEqual({ index: 1, expected: 2, actual: null });
});

describe("parityReport (plan V23 Q19)", () => {
  const boundaries = [
    { timeSeconds: 10, segmentId: PHASE_6, telegraphEndSeconds: 13 },
    { timeSeconds: 40, segmentId: "phase-8-final" },
    { timeSeconds: 60, segmentId: PHASE_6 },
  ];

  test("an exported track whose schedule reproduces its marks matches", () => {
    const report = reportOf(studyWith(boundaries, { "machine-gun": { marks: volleys(12, 14, 14.1) } }));
    expect(report.tracks).toEqual([
      { trackId: "machine-gun", segmentId: PHASE_6, matches: true, firstMismatchSeconds: null },
    ]);
  });

  test("a periodic track whose later marks break the period reports the first mismatch", () => {
    // All three marks are one cycle (Q06); its next cycle starts at 15, before the mark at 15.5.
    const study = studyWith(boundaries, { "machine-gun": { marks: volleys(12, 13, 15.5), periodSeconds: 3 } });
    const [track] = reportOf(study).tracks;
    expect(track.matches).toBe(false);
    expect(track.firstMismatchSeconds).toBe(15.5);
  });

  test("lists the tracks export drops in an observed segment only", () => {
    const report = reportOf(studyWith(boundaries, { "machine-gun": { marks: volleys(12) } }));
    const droppedIds = report.dropped.map((track) => track.trackId);
    expect(droppedIds).toContain("machine-gun-9-shots");
    expect(droppedIds).not.toContain("machine-gun");
    expect(report.dropped.every((track) => [PHASE_6, "phase-8-final"].includes(track.segmentId))).toBe(true);
  });

  test("lists the segment values export changes, with both values", () => {
    const report = reportOf(studyWith(boundaries, { "machine-gun": { marks: volleys(12) } }));
    const phase6 = (shipped as { phases: { id: string; telegraphSeconds: number; exitAfterSeconds: number }[] }).phases.find(
      (phase) => phase.id === PHASE_6,
    )!;
    expect(report.valueChanges).toContainEqual({
      segmentId: PHASE_6,
      field: "telegraphSeconds",
      shipped: phase6.telegraphSeconds,
      exported: 3,
    });
    expect(report.valueChanges).toContainEqual({
      segmentId: PHASE_6,
      field: "exitAfterSeconds",
      shipped: phase6.exitAfterSeconds,
      exported: 30,
    });
  });

  test("lists a later window whose marks differ from the first", () => {
    const study = studyWith(boundaries, { "machine-gun": { marks: volleys(12, 14, 62, 64.5) } });
    expect(reportOf(study).laterWindows).toEqual([
      { trackId: "machine-gun", windowStartSeconds: 60, firstDifferenceSeconds: 64.5 },
    ]);
  });

  test("an untouched study has nothing to report", () => {
    expect(reportOf(studyWith([], {}))).toEqual({ tracks: [], dropped: [], valueChanges: [], laterWindows: [] });
  });
});
