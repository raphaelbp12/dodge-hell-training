import { readFileSync } from "node:fs";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ENCOUNTER_LIST } from "../game/config/encounter";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { HISTORY_STORAGE_KEY, AttemptHistory } from "../storage/attempts";
import { propertyParameters } from "../test/property";
import { validateStudyV5, type Mark, type StudyV5 } from "./study";
import { parseStudyFile } from "./studyLoad";
import { emptyStudy } from "./studyMigrate";
import { validateSessionDraft } from "./taggerSessions";

const anyJson = fc.oneof(fc.jsonValue(), fc.anything());
const KNOWN_IDS = ENCOUNTER_LIST.map((entry) => entry.id);

function expectReturnsOrRangeError(call: () => unknown): void {
  try {
    call();
  } catch (error) {
    expect(error).toBeInstanceOf(RangeError);
  }
}

test("the study and session validators fail with RangeError, or return, for any value", () => {
  fc.assert(
    fc.property(anyJson, (value) => {
      expectReturnsOrRangeError(() => validateStudyV5(value));
      expectReturnsOrRangeError(() => validateSessionDraft(value));
    }),
    propertyParameters(),
  );
});

test("a study file that is not valid fails with a plain Error whose cause is no incidental crash", () => {
  fc.assert(
    fc.property(anyJson, (value) => {
      let text: string;
      try {
        text = JSON.stringify(value) ?? "null";
      } catch {
        return;
      }
      try {
        parseStudyFile(text, KNOWN_IDS);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const cause = (error as Error).cause;
        expect(cause).not.toBeInstanceOf(TypeError);
        expect(cause).not.toBeInstanceOf(ReferenceError);
      }
    }),
    propertyParameters(),
  );
});

test("the attempt history constructor never throws on any stored text", () => {
  fc.assert(
    fc.property(fc.oneof(fc.string(), anyJson.map((value) => JSON.stringify(value) ?? "")), (text) => {
      const storage = {
        getItem: (key: string) => (key === HISTORY_STORAGE_KEY ? text : null),
        setItem: () => undefined,
      };
      const history = new AttemptHistory(() => storage);
      expect(Array.isArray(history.snapshot().records)).toBe(true);
    }),
    propertyParameters(),
  );
});

// `fc.record` yields null-prototype objects, which `toStrictEqual` tells apart from parsed JSON.
const mark: fc.Arbitrary<Mark> = fc
  .record({
    timeSeconds: fc.double({ min: 0, max: 600, noNaN: true }),
    kind: fc.constantFrom("volley" as const, "detonation" as const),
  })
  .map((value) => ({ ...value }));

const queenStudy = (): StudyV5 =>
  emptyStudy({
    encounterId: "killer-bee-queen",
    archetypeId: "killer-bee-queen",
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 600 },
    recordedAt: "2026-11-16T00:00:00.000Z",
    rawFile: AUTHORED_MONSTER_FILES["killer-bee-queen"],
  });

const committedStudy = JSON.parse(
  readFileSync(
    new URL("../../../docs/killer-bee-queen-study-TFclwuPtC94.json", import.meta.url),
    "utf8",
  ),
) as StudyV5;

test("a valid study survives a JSON round trip unchanged, whatever its marks", () => {
  const base = queenStudy();
  fc.assert(
    fc.property(
      fc.array(mark, { maxLength: 30 }),
      fc.array(mark, { maxLength: 10 }),
      fc.boolean(),
      (marks, scratch, useCommitted) => {
        const source = useCommitted ? committedStudy : base;
        const study: StudyV5 = {
          ...source,
          scratch,
          tracks: source.tracks.map((track, index) =>
            index === 0 ? { ...track, marks } : track,
          ),
        };
        const restored = validateStudyV5(JSON.parse(JSON.stringify(study)));
        expect(restored).toStrictEqual(study);
      },
    ),
    propertyParameters(),
  );
});
