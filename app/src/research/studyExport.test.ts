import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { AUTHORED_MONSTER_FILES, AUTHORED_PROJECTILES } from "../game/config/data";
import { encounterConfigOf } from "../game/config/encounter";
import type { AttackTrack, Boundary, Mark, StudyV6 } from "./study";
import { emptyStudy } from "./studyMigrate";
import {
  bombVariantOf,
  measuredSegmentValues,
  MEASURED_VARIANT_SOURCE,
  monsterFileTextFromStudy,
  studyExportJson,
} from "./studyExport";

const config = encounterConfigOf("killer-bee-queen");
const QUEEN = "killer-bee-queen";
const PHASE_6 = "phase-6-nests";
const rawText = (id: string) => `${JSON.stringify(AUTHORED_MONSTER_FILES[id], null, 2)}\n`;
const studyOf = (archetypeId: string): StudyV6 =>
  emptyStudy({
    encounterId: QUEEN,
    archetypeId,
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
    recordedAt: "2026-11-13T00:00:00.000Z",
    rawFile: AUTHORED_MONSTER_FILES[archetypeId],
  });

function must<T>(result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: string }>): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

type RawAttack = Record<string, unknown> & { id: string; projectile: string };
type RawSegment = Record<string, unknown> & { id: string; attacks: RawAttack[] };
type Raw = { phases: (RawSegment & { subPhases?: RawSegment[] | null })[] };

const exported = (study: StudyV6, archetypeId = QUEEN) =>
  JSON.parse(
    must(
      monsterFileTextFromStudy({
        archetypeId,
        study,
        currentRawFile: AUTHORED_MONSTER_FILES[archetypeId],
        config,
      }),
    ),
  ) as Raw;

const phaseOf = (raw: Raw, id: string) => raw.phases.find((phase) => phase.id === id)!;
const volleys = (...times: number[]): Mark[] => times.map((timeSeconds) => ({ timeSeconds, kind: "volley" }));

/** The Queen's untouched study with these boundaries and these tracks edited. */
function queenStudy(
  boundaries: readonly Boundary[],
  edits: Readonly<Record<string, Partial<AttackTrack>>>,
  overrides: Partial<StudyV6> = {},
): StudyV6 {
  const study = studyOf(QUEEN);
  return {
    ...study,
    boundaries,
    tracks: study.tracks.map((track) => ({ ...track, ...edits[track.id] })),
    ...overrides,
  };
}

// The user approved the committed solo-nest study as correct on 2026-11-18 and
// asked for it in the game (plan V23 Q22), so the Queen's shipped file is that
// study's export.
test("the committed Killer Bee Queen study exports to the shipped Queen file unchanged", () => {
  const committed = JSON.parse(
    readFileSync(
      new URL("../../../docs/killer-bee-queen-study-TFclwuPtC94.json", import.meta.url),
      "utf8",
    ),
  ) as StudyV6;
  expect(exported(committed)).toEqual(AUTHORED_MONSTER_FILES[QUEEN]);
});

describe("monsterFileTextFromStudy: marks (plan V23 step 98.2)", () => {
  test("an untouched study exports every monster's file byte-identical", () => {
    const ids = Object.keys(AUTHORED_MONSTER_FILES);
    expect(ids).toHaveLength(12);
    for (const id of ids)
      expect(
        must(
          monsterFileTextFromStudy({ archetypeId: id, study: studyOf(id), currentRawFile: AUTHORED_MONSTER_FILES[id], config }),
        ),
        id,
      ).toBe(rawText(id));
  });

  test("a track's marks become bursts of offsets from the window's start, a telegraph mark included", () => {
    const study = queenStudy([{ timeSeconds: 10, segmentId: PHASE_6, telegraphEndSeconds: 12 }], {
      "machine-gun": { marks: volleys(11, 13, 13.1, 13.2, 15) },
    });
    const phase = phaseOf(exported(study), PHASE_6);
    expect(phase.attacks.map((attack) => attack.id)).toEqual(["machine-gun"]);
    const [attack] = phase.attacks;
    expect(attack).not.toHaveProperty("cadence");
    // The mark at 11 s fires during the 2 s telegraph (Q03).
    expect(attack.marks).toEqual({ bursts: [[1], [3, 3.1, 3.2], [5]] });
  });

  test("duplicate marks survive as separate volleys (Q08)", () => {
    const study = queenStudy([{ timeSeconds: 10, segmentId: PHASE_6 }], {
      "machine-gun": { marks: volleys(13, 13, 15) },
    });
    expect(phaseOf(exported(study), PHASE_6).attacks[0].marks).toEqual({ bursts: [[3], [3], [5]] });
  });

  test("a periodic track writes its period, and its stop when the end mark is in its first window", () => {
    const boundaries = [{ timeSeconds: 10, segmentId: PHASE_6 }];
    const stopped = queenStudy(boundaries, {
      "machine-gun": { marks: volleys(14.867, 15.067), periodSeconds: 4, endSeconds: 30 },
    });
    expect(phaseOf(exported(stopped), PHASE_6).attacks[0].marks).toEqual({
      // One gap gives no split ratio, so each mark is its own burst (Q09).
      bursts: [[4.867], [5.067]],
      periodSeconds: 4,
      stopAfterSeconds: 20,
    });
    const open = queenStudy(boundaries, { "machine-gun": { marks: volleys(14.867), periodSeconds: 4 } });
    expect(phaseOf(exported(open), PHASE_6).attacks[0].marks).toEqual({ bursts: [[4.867]], periodSeconds: 4 });
  });

  test("a track that plays once exports no period and no stop, even with an end mark (Q07)", () => {
    const study = queenStudy([{ timeSeconds: 10, segmentId: PHASE_6 }], {
      "machine-gun": { marks: volleys(15), endSeconds: 30 },
    });
    expect(phaseOf(exported(study), PHASE_6).attacks[0].marks).toEqual({ bursts: [[5]] });
  });

  test("a track in two windows exports its first window's marks only (Q04)", () => {
    const study = queenStudy(
      [
        { timeSeconds: 10, segmentId: PHASE_6 },
        { timeSeconds: 40, segmentId: "phase-7-beehemoths/yellow" },
        { timeSeconds: 50, segmentId: PHASE_6 },
      ],
      { "machine-gun": { marks: volleys(15, 52, 53) } },
    );
    expect(phaseOf(exported(study), PHASE_6).attacks[0].marks).toEqual({ bursts: [[5]] });
  });

  test("a segment with no window keeps its shipped attacks and values byte-identical (Q16)", () => {
    const study = queenStudy([{ timeSeconds: 10, segmentId: PHASE_6 }], {
      "machine-gun": { marks: volleys(15) },
    });
    const out = exported(study);
    const shipped = AUTHORED_MONSTER_FILES[QUEEN] as Raw;
    for (const phase of shipped.phases.filter((entry) => entry.id !== PHASE_6))
      expect(phaseOf(out, phase.id)).toEqual(phase);
  });

  test("another monster drops only the unmarked tracks of its observed segment", () => {
    const id = "red-killer-bee";
    const shipped = AUTHORED_MONSTER_FILES[id] as Raw;
    const first = shipped.phases[0];
    const segmentId = first.subPhases?.length ? `${first.id}/${first.subPhases[0].id}` : first.id;
    const study = { ...studyOf(id), boundaries: [{ timeSeconds: 1, segmentId }] };
    const out = exported(study, id);
    const observed = first.subPhases?.length ? phaseOf(out, first.id).subPhases![0] : phaseOf(out, first.id);
    expect(observed.attacks).toEqual([]);
    for (const phase of shipped.phases.slice(1)) expect(phaseOf(out, phase.id)).toEqual(phase);
  });

  test("a track in a segment missing from the file fails, naming it", () => {
    const study = studyOf(QUEEN);
    const moved = {
      ...study,
      tracks: [{ ...study.tracks[0], location: { phaseId: "nowhere", subPhaseId: null } }, ...study.tracks.slice(1)],
    };
    expect(
      monsterFileTextFromStudy({ archetypeId: QUEEN, study: moved, currentRawFile: AUTHORED_MONSTER_FILES[QUEEN], config }),
    ).toEqual({ ok: false, error: `Track ${study.tracks[0].id} is in segment nowhere, which is not in the file.` });
  });
});

describe("measured segment values (plan V23 step 98.3)", () => {
  const SUB = "phase-7-beehemoths";

  test("each measured value is written: telegraph, invulnerable, sub-phase duration and exit time", () => {
    const study = queenStudy(
      [
        { timeSeconds: 10, segmentId: PHASE_6, telegraphEndSeconds: 14.0666 },
        { timeSeconds: 43.1333, segmentId: `${SUB}/yellow`, telegraphEndSeconds: 44 },
        { timeSeconds: 55.5, segmentId: `${SUB}/red` },
        { timeSeconds: 70, segmentId: "phase-8-final" },
      ],
      {},
      { statusSpans: [{ kind: "invulnerable", inSeconds: 10.02, outSeconds: 40 }] },
    );
    const out = exported(study);
    const phase6 = phaseOf(out, PHASE_6);
    expect(phase6.telegraphSeconds).toBe(4.067);
    expect(phase6.invulnerableOnEnterSeconds).toBe(29.98);
    expect(phase6.exitAfterSeconds).toBe(33.133);
    const phase7 = phaseOf(out, SUB);
    // Yellow ends at red, a boundary of the same phase; red ends at another phase.
    expect(phase7.subPhases![0].durationSeconds).toBe(12.367);
    expect(phase7.subPhases![0].telegraphSeconds).toBe(0.867);
    const shippedRed = (phaseOf(AUTHORED_MONSTER_FILES[QUEEN] as Raw, SUB).subPhases ?? []).find(
      (sub) => sub.id === "red",
    )!;
    expect(phase7.subPhases!.find((sub) => sub.id === "red")!.durationSeconds).toBe(shippedRed.durationSeconds);
  });

  test("a phase without exitAfterSeconds gains none, and a segment with no telegraph end keeps its telegraph", () => {
    const study = queenStudy(
      [
        { timeSeconds: 10, segmentId: "phase-3-pond-barrage" },
        { timeSeconds: 30, segmentId: PHASE_6 },
      ],
      {},
    );
    const phase3 = phaseOf(exported(study), "phase-3-pond-barrage");
    const shipped = phaseOf(AUTHORED_MONSTER_FILES[QUEEN] as Raw, "phase-3-pond-barrage");
    expect(phase3.exitAfterSeconds).toBeNull();
    expect(phase3.telegraphSeconds).toBe(shipped.telegraphSeconds);
  });

  test("a span away from every boundary is not attributed to the segment (E05)", () => {
    const study = queenStudy([{ timeSeconds: 10, segmentId: PHASE_6 }], {}, {
      statusSpans: [{ kind: "invulnerable", inSeconds: 11, outSeconds: 12 }],
    });
    expect(measuredSegmentValues(study, PHASE_6).invulnerableOnEnterSeconds).toBeNull();
  });

  test("the committed study's phase 6 measures a 4.067 s telegraph and a 33.133 s exit", () => {
    const committed = JSON.parse(
      readFileSync(new URL("../../../docs/killer-bee-queen-study-TFclwuPtC94.json", import.meta.url), "utf8"),
    ) as StudyV6;
    const measured = measuredSegmentValues(committed, PHASE_6);
    expect(measured.telegraphSeconds).toBe(4.067);
    expect(measured.exitAfterSeconds).toBe(33.133);
  });
});

describe("bombVariantOf (plan V23 Q14)", () => {
  const track = (id: string) => studyOf(QUEEN).tracks.find((entry) => entry.id === id)!;
  const thrown: Mark[] = [
    { timeSeconds: 10, kind: "volley" },
    { timeSeconds: 10.75, kind: "detonation" },
    { timeSeconds: 12, kind: "volley" },
    { timeSeconds: 12.75, kind: "detonation" },
  ];

  test("is null for a bomb with neither measurement, and for a bullet", () => {
    expect(bombVariantOf(track("blue-bomb-ring"))).toBeNull();
    expect(bombVariantOf({ ...track("red-stinger-spread"), marks: thrown })).toBeNull();
  });

  test("the median pair gap and the median measured range replace the catalog's", () => {
    const variant = bombVariantOf({ ...track("blue-bomb-ring"), marks: thrown, measuredRangeTiles: [3, null] });
    expect(variant?.id).toBe("blue-bomb-ring-measured");
    expect(variant?.entry).toMatchObject({
      type: "bomb",
      source: MEASURED_VARIANT_SOURCE,
      travelSeconds: 0.75,
      rangeTiles: 3,
    });
    expect(variant?.entry).not.toHaveProperty("id");
  });

  test("a targeted bomb's variant keeps the authored range", () => {
    const targeted = track("white-bomb-targeted");
    const authoredRange = (AUTHORED_PROJECTILES[targeted.attack.projectile] as { rangeTiles: number }).rangeTiles;
    const variant = bombVariantOf({ ...targeted, marks: thrown, measuredRangeTiles: [authoredRange + 3] });
    expect(variant?.entry.travelSeconds).toBe(0.75);
    expect(variant?.entry.rangeTiles).toBe(authoredRange);
  });

  test("an exported bomb track fires its -measured projectile", () => {
    const study = queenStudy([{ timeSeconds: 9, segmentId: "phase-1-honey-pond/circle-room" }], {
      "blue-bomb-ring": { marks: thrown },
    });
    const phase1 = phaseOf(exported(study), "phase-1-honey-pond");
    expect(phase1.attacks.map((attack) => [attack.id, attack.projectile])).toEqual([
      ["blue-bomb-ring", "blue-bomb-ring-measured"],
    ]);
  });
});

test("studyExportJson refreshes recordedAt", () => {
  const text = studyExportJson(studyOf(QUEEN), "2027-01-01T00:00:00.000Z");
  expect(JSON.parse(text).recordedAt).toBe("2027-01-01T00:00:00.000Z");
  expect(JSON.parse(text).schemaVersion).toBe(6);
});
