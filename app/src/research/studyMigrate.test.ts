/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { archetypeOf, encounterConfigOf } from "../game/config/encounter";
import { validateStudyV6 } from "./study";
import { emptyStudy, studyV5FromLegacy, tracksFromMonsterFile } from "./studyMigrate";
import {
  studyFromExport,
  validateObservationExport,
  type StoredTag,
  type StudyState,
} from "./tagging";

/** Plan V20: `studyFromExport` also returns a v5 study; these tests read legacy files. */
const legacyStudyFromExport = (validated: Parameters<typeof studyFromExport>[0]) =>
  studyFromExport(validated) as import("./tagging").StudyState;

const QUEEN = "killer-bee-queen";
const config = encounterConfigOf(QUEEN);
const rawFile = AUTHORED_MONSTER_FILES[QUEEN];
const recordedAt = "2026-11-13T00:00:00.000Z";
const provenance = { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 900 };
const fields = { spriteId: "white-bomb", pattern: "rotating-arm", shots: 4 } as const;

function legacy(overrides: Partial<StudyState> = {}): StudyState {
  return {
    encounterId: QUEEN,
    archetypeId: QUEEN,
    provenance,
    savedAttacks: [],
    tags: [],
    monsterDraft: null,
    ...overrides,
  };
}
const convert = (state: StudyState) =>
  studyV5FromLegacy({ legacy: state, config, archetypeId: QUEEN, rawFile, recordedAt });

describe("tracksFromMonsterFile and emptyStudy", () => {
  test("one track per authored attack with its location", () => {
    const tracks = tracksFromMonsterFile(rawFile);
    const raw = rawFile as {
      phases: { id: string; attacks: unknown[]; subPhases?: { id: string; attacks: unknown[] }[] | null }[];
    };
    const expected = raw.phases.flatMap((phase) => [
      ...phase.attacks.map(() => `${phase.id}|null`),
      ...(phase.subPhases ?? []).flatMap((sub) => sub.attacks.map(() => `${phase.id}|${sub.id}`)),
    ]);
    expect(tracks.map((track) => `${track.location.phaseId}|${track.location.subPhaseId}`)).toEqual(expected);
    expect(new Set(tracks.map((track) => track.id)).size).toBe(tracks.length);
    expect(tracks.every((track) => track.marks.length === 0 && track.attack.cadence !== undefined)).toBe(true);
  });

  test("emptyStudy has no boundaries, spans or marks and validates", () => {
    const study = emptyStudy({ encounterId: QUEEN, archetypeId: QUEEN, provenance, recordedAt, rawFile });
    expect(study.boundaries).toEqual([]);
    expect(study.statusSpans).toEqual([]);
    expect(study.scratch).toEqual([]);
    expect(validateStudyV6(study)).toBe(study);
  });
});

describe("studyV5FromLegacy", () => {
  test("converts the committed Queen observations", () => {
    const text = readFileSync(
      new URL("../../../docs/killer-bee-queen-observations.json", import.meta.url),
      "utf8",
    );
    const state = legacyStudyFromExport(validateObservationExport(JSON.parse(text)));
    const { study } = convert(state);
    expect(validateStudyV6(study)).toBe(study);
    const marks =
      study.tracks.reduce((sum, track) => sum + track.marks.length, 0) + study.scratch.length;
    expect(marks).toBe(state.tags.length);
    const phase = archetypeOf(config, QUEEN).phases[2];
    expect(study.boundaries.map((boundary) => boundary.segmentId)).toContain(phase.id);
  });

  test("a saved attack with two linked tags and a repeat end becomes one track", () => {
    const tags: StoredTag[] = [
      { timeSeconds: 10, phaseIndex: 2, savedAttackId: "s1" },
      { timeSeconds: 12, phaseIndex: 2, savedAttackId: "s1", repeatEndSeconds: 20 },
    ];
    const { study, notices } = convert(
      legacy({
        tags,
        savedAttacks: [
          { id: "s1", name: "White Bomb", ...fields, cadence: { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 2 } },
        ],
      }),
    );
    expect(notices).toEqual([]);
    const track = study.tracks.find((entry) => entry.id === "white-bomb")!;
    expect(track.marks.map((mark) => mark.timeSeconds)).toEqual([10, 12]);
    expect(track.endSeconds).toBe(20);
    expect(track.attack.cadence).toMatchObject({ cooldownAfterLastShotSeconds: 2, initialDelaySeconds: 0 });
    expect(validateStudyV6(study)).toBe(study);
  });

  test("two unlinked tags of identical fields become one observed track", () => {
    const { study } = convert(
      legacy({
        tags: [
          { timeSeconds: 5, phaseIndex: 2, ...fields },
          { timeSeconds: 7, phaseIndex: 2, burstId: 1, ...fields },
        ],
      }),
    );
    const track = study.tracks.find((entry) => entry.id === "observed-1")!;
    expect(track.marks).toHaveLength(2);
    expect(study.tracks.some((entry) => entry.id === "observed-2")).toBe(false);
  });

  test("an unmatched group goes to scratch with a notice", () => {
    const { study, notices } = convert(
      legacy({ tags: [{ timeSeconds: 5, phaseIndex: 2, spriteId: "nothing", pattern: "spread", shots: 1 }] }),
    );
    expect(study.scratch).toEqual([{ timeSeconds: 5, kind: "volley" }]);
    expect(notices).toHaveLength(1);
  });

  test("a draft anchor takes precedence over a tag-derived boundary", () => {
    const phaseId = archetypeOf(config, QUEEN).phases[2].id;
    const { study } = convert(
      legacy({
        tags: [{ timeSeconds: 50, phaseIndex: 2, ...fields }],
        monsterDraft: { phases: [], anchors: { [phaseId]: 40 } },
      }),
    );
    expect(study.boundaries).toEqual([{ timeSeconds: 40, segmentId: phaseId }]);
  });

  test("a tagged phase with sub-phases gets a boundary on its first sub-phase and a notice", () => {
    const phase = archetypeOf(config, QUEEN).phases[1];
    const { study, notices } = convert(legacy({ tags: [{ timeSeconds: 3, phaseIndex: 1, ...fields }] }));
    expect(study.boundaries).toEqual([{ timeSeconds: 3, segmentId: `${phase.id}/${phase.subPhases![0].id}` }]);
    expect(notices[0]).toBe(`Phase ${phase.id} was given a boundary at its first tag; check it.`);
  });
});
