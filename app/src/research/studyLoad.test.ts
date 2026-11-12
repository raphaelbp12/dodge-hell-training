/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  currentDuration,
  encounterChangeDecision,
  fileNameMismatch,
  loadDecision,
  parseStudyFile,
  resolveProvenance,
  videoChoiceDecision,
  monsterSwitchPlan,
  observationFileName,
  studySections,
  studyMonsterProblem,
} from "./studyLoad";

const KNOWN = ["killer-bee-queen"];

function file(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 2,
    encounterId: "killer-bee-queen",
    provenance: {
      sourceUrl: null,
      fileName: "x.mp4",
      frameRate: 30,
      durationSeconds: 100,
    },
    recordedAt: "2026-11-05T12:00:00.000Z",
    tags: [
      {
        timeSeconds: 1,
        phaseIndex: 99,
        spriteId: "gone-sprite",
        pattern: "rotating-arm",
        shots: 2,
      },
    ],
    ...overrides,
  });
}

describe("parseStudyFile", () => {
  test("parses and upgrades the committed v1 evidence", () => {
    const text = readFileSync(
      new URL("../../../docs/killer-bee-queen-observations.json", import.meta.url),
      "utf8",
    );
    const study = parseStudyFile(text, KNOWN);
    expect(study.provenance.frameRate).toBeNull();
    expect(study.tags.length).toBeGreaterThan(0);
  });

  test("refuses invalid JSON readably", () => {
    expect(() => parseStudyFile("{nope", KNOWN)).toThrow(/not valid JSON/);
  });

  test("refuses an invalid shape readably", () => {
    expect(() => parseStudyFile(file({ tags: 3 }), KNOWN)).toThrow(/tags/);
  });

  test("names an unknown encounter", () => {
    expect(() =>
      parseStudyFile(file({ encounterId: "mystery" }), KNOWN),
    ).toThrow(/mystery/);
  });

  test("accepts an unknown sprite and out-of-range phase", () => {
    const study = parseStudyFile(file(), KNOWN);
    expect(study.tags[0]).toMatchObject({ spriteId: "gone-sprite" });
    expect(study.tags[0].phaseIndex).toBe(99);
    expect(study.provenance.frameRate).toBe(30);
  });
});

describe("decisions", () => {
  test("load confirms only when tags exist", () => {
    expect(loadDecision(0)).toBe("apply");
    expect(loadDecision(2)).toBe("confirm");
  });

  test("the first video after a load keeps tags, later ones confirm or reset", () => {
    expect(videoChoiceDecision({ tagCount: 3, keepTagsOnNextVideo: true })).toBe("keep");
    expect(videoChoiceDecision({ tagCount: 0, keepTagsOnNextVideo: true })).toBe("keep");
    expect(videoChoiceDecision({ tagCount: 3, keepTagsOnNextVideo: false })).toBe(
      "confirm-reset",
    );
    expect(videoChoiceDecision({ tagCount: 0, keepTagsOnNextVideo: false })).toBe("reset");
  });

  test("mismatch needs both names and a difference", () => {
    expect(fileNameMismatch("a.mp4", "b.mp4")).toBe(true);
    expect(fileNameMismatch("a.mp4", "a.mp4")).toBe(false);
    expect(fileNameMismatch(null, "a.mp4")).toBe(false);
    expect(fileNameMismatch("a.mp4", null)).toBe(false);
  });
});

describe("resolveProvenance", () => {
  const video = { fileName: "open.mp4", durationSeconds: 50 };
  const study = { fileName: "study.mp4", durationSeconds: 100 };

  test("uses the open video's name and duration with the study's source", () => {
    expect(
      resolveProvenance({
        video,
        study,
        sourceUrlText: " https://example.com ",
        frameRate: 30,
      }),
    ).toEqual({
      sourceUrl: "https://example.com",
      fileName: "open.mp4",
      frameRate: 30,
      durationSeconds: 50,
    });
  });

  test("falls back to the study without a video", () => {
    expect(
      resolveProvenance({ video: null, study, sourceUrlText: "", frameRate: 30 }),
    ).toMatchObject({ fileName: "study.mp4", durationSeconds: 100, sourceUrl: null });
  });

  test("blocks export with a blank frame rate or no source", () => {
    expect(() =>
      resolveProvenance({ video, study, sourceUrlText: "", frameRate: null }),
    ).toThrow(/frame rate/);
    expect(() =>
      resolveProvenance({ video: null, study: null, sourceUrlText: "", frameRate: 30 }),
    ).toThrow(/Load a video or a study/);
  });
});

test("currentDuration prefers the open video", () => {
  expect(currentDuration(40, 100)).toBe(40);
  expect(currentDuration(0, 100)).toBe(100);
  expect(currentDuration(0, null)).toBe(0);
});

describe("encounterChangeDecision", () => {
  test("changes at once only with no tags and no saved attacks", () => {
    expect(encounterChangeDecision({ tagCount: 0, savedAttackCount: 0 })).toBe("change");
    expect(encounterChangeDecision({ tagCount: 2, savedAttackCount: 0 })).toBe("confirm");
    expect(encounterChangeDecision({ tagCount: 0, savedAttackCount: 1 })).toBe("confirm");
  });
});

describe("studyMonsterProblem", () => {
  const study = {
    encounterId: "e",
    archetypeId: null,
    monsterDraft: null,
    provenance: { sourceUrl: null, fileName: "a", frameRate: 30, durationSeconds: 1 },
    savedAttacks: [],
    tags: [],
  } as const;
  const tag = { timeSeconds: 1, phaseIndex: 0, spriteId: "x", pattern: "rotating-arm", shots: 1 } as const;

  test("catches an unknown monster but accepts tags on a minion (J18)", () => {
    expect(studyMonsterProblem(study, "q", ["q", "m"])).toBeNull();
    expect(studyMonsterProblem({ ...study, archetypeId: "zz" }, "q", ["q", "m"])).toMatch(/Unknown/);
    expect(studyMonsterProblem({ ...study, archetypeId: "m", tags: [tag] }, "q", ["q", "m"])).toBeNull();
  });
});

describe("V18 decisions", () => {
  test("a draft counts as content to confirm", () => {
    expect(loadDecision(0, true)).toBe("confirm");
    expect(videoChoiceDecision({ tagCount: 0, keepTagsOnNextVideo: false, hasDraft: true })).toBe("confirm-reset");
    expect(encounterChangeDecision({ tagCount: 0, savedAttackCount: 0, hasDraft: true })).toBe("confirm");
  });

  test("monsterSwitchPlan", () => {
    const base = { hasVideo: true, unsaved: true, autosaveFailing: false, slotExists: true };
    expect(monsterSwitchPlan(base)).toEqual({ writeCurrent: true, open: "slot", confirmFirst: false });
    expect(monsterSwitchPlan({ ...base, slotExists: false }).open).toBe("empty");
    expect(monsterSwitchPlan({ ...base, hasVideo: false })).toMatchObject({ writeCurrent: false, open: "empty" });
    expect(monsterSwitchPlan({ ...base, autosaveFailing: true }).confirmFirst).toBe(true);
    expect(monsterSwitchPlan({ ...base, unsaved: false, autosaveFailing: true }).confirmFirst).toBe(false);
  });
});

describe("V18 names and visibility", () => {
  test("download names", () => {
    expect(observationFileName("q", "queen", "queen")).toBe("q-observations.json");
    expect(observationFileName("q", "bee", "queen")).toBe("q-bee-observations.json");
  });

  test("every study shows tagging and the source switch; tuning follows the source (J18, J19)", () => {
    expect(studySections("tags")).toEqual({ previewTuning: true, sourceSwitch: true });
    expect(studySections("draft")).toEqual({ previewTuning: false, sourceSwitch: true });
  });
});
