import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { ENCOUNTER_LIST, encounterConfigOf } from "../game/config/encounter";
import { validateStudyV5, type StudyV5 } from "./study";
import { parseStudyFile } from "./studyLoad";
import { studyV5FromLegacy } from "./studyMigrate";
import { markCountOf, validateSessionDraft, type SessionDraft } from "./taggerSessions";
import type { StudyState } from "./tagging";

/**
 * Plan V22 A14: every study version the loader accepts, the committed study
 * and a tagger autosave still load and migrate into the current version, and
 * nothing tagged is lost.
 */

const FIXTURE_DIRECTORY = new URL("./__fixtures__/", import.meta.url);
const KNOWN_IDS = ENCOUNTER_LIST.map((entry) => entry.id);
const CURRENT_STUDY_VERSION = 5;
const studyFixtures = readdirSync(FIXTURE_DIRECTORY).filter((name) => /^study\.v\d+\.json$/.test(name));
const COMMITTED_STUDY = new URL(
  "../../../docs/killer-bee-queen-study-TFclwuPtC94.json",
  import.meta.url,
);

function textOf(url: URL): string {
  return readFileSync(url, "utf8");
}

/** The study in the current version, migrating a legacy one through the route's own conversion. */
function currentStudy(text: string): { study: StudyV5; legacyTagCount: number | null } {
  const loaded = parseStudyFile(text, KNOWN_IDS);
  if ("schemaVersion" in loaded) return { study: loaded, legacyTagCount: null };
  const legacy: StudyState = loaded;
  const archetypeId = legacy.archetypeId ?? encounterConfigOf(legacy.encounterId).primaryArchetypeId;
  const { study } = studyV5FromLegacy({
    legacy,
    config: encounterConfigOf(legacy.encounterId),
    archetypeId,
    rawFile: AUTHORED_MONSTER_FILES[archetypeId],
    recordedAt: "2026-11-16T00:00:00.000Z",
  });
  return { study, legacyTagCount: legacy.tags.length };
}

describe("study fixtures", () => {
  test("a fixture exists for every version from 1 to the current one", () => {
    for (let version = 1; version <= CURRENT_STUDY_VERSION; version++)
      expect(studyFixtures).toContain(`study.v${version}.json`);
  });

  test.each(studyFixtures)("%s migrates to the current version and validates", (name) => {
    const { study, legacyTagCount } = currentStudy(textOf(new URL(name, FIXTURE_DIRECTORY)));
    expect(study.schemaVersion).toBe(CURRENT_STUDY_VERSION);
    expect(() => validateStudyV5(JSON.parse(JSON.stringify(study)))).not.toThrow();
    if (legacyTagCount !== null) expect(markCountOf(study)).toBe(legacyTagCount);
  });

  test("the current-version fixture keeps every boundary, status span, track and mark", () => {
    const stored = JSON.parse(textOf(new URL("study.v5.json", FIXTURE_DIRECTORY))) as StudyV5;
    const { study } = currentStudy(JSON.stringify(stored));
    expect(study.boundaries).toHaveLength(stored.boundaries.length);
    expect(study.statusSpans).toHaveLength(stored.statusSpans.length);
    expect(study.tracks).toHaveLength(stored.tracks.length);
    expect(markCountOf(study)).toBe(markCountOf(stored));
  });

  test("the committed Killer Bee Queen study loads and keeps its counts", () => {
    const stored = JSON.parse(textOf(COMMITTED_STUDY)) as StudyV5;
    const { study } = currentStudy(textOf(COMMITTED_STUDY));
    expect(study.boundaries).toHaveLength(stored.boundaries.length);
    expect(study.tracks).toHaveLength(stored.tracks.length);
    expect(markCountOf(study)).toBe(markCountOf(stored));
  });
});

describe("tagger session fixture", () => {
  test("the autosave validates and carries its study unchanged", () => {
    const draft = validateSessionDraft(
      JSON.parse(textOf(new URL("tagger-session.json", FIXTURE_DIRECTORY))),
    ) as SessionDraft;
    expect(draft.draftVersion).toBe(4);
    expect(() => validateStudyV5(draft.study)).not.toThrow();
    expect(markCountOf(draft.study)).toBeGreaterThan(0);
  });
});
