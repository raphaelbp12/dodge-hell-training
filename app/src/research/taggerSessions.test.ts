import { describe, expect, test } from "vitest";
import { unsafeFixture } from "../test/fixture";
import { ENCOUNTER_CONFIG, encounterConfigOf } from "../game/config/encounter";
import {
  buildDraft,
  isLegacyDraft,
  markCountOf,
  restoreSticky,
  shouldWriteDraft,
  TAGGER_SESSION_KEY_PREFIX,
  TaggerSessions,
  validateSessionDraft,
  type SessionStorage,
} from "./taggerSessions";
import { appearanceOptions, type StickySelection } from "./taggingOptions";
import type { StudyState } from "./tagging";
import type { StudyV5 } from "./study";

class FakeStorage implements SessionStorage {
  data = new Map<string, string>();
  failRead = false;
  failWrite = false;
  get length() {
    return this.data.size;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key: string) {
    if (this.failRead) throw new Error("read blocked");
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const STICKY: StickySelection = {
  phaseIndex: 0,
  spriteId: appearanceOptions()[0].id,
  pattern: "rotating-arm",
  aim: "player",
  shots: 4,
};

function study(fileName = "a.mp4", frameRate: number | null = 30): StudyState {
  return {
    encounterId: "killer-bee-queen",
    archetypeId: null,
    monsterDraft: null,
    provenance: { sourceUrl: null, fileName, frameRate, durationSeconds: 100 },
    savedAttacks: [],
    tags: [
      { timeSeconds: 1, phaseIndex: 0, spriteId: "x", pattern: "rotating-arm", shots: 2 },
    ],
  };
}

/** A version 3 draft, as the tagger wrote before plan V20. */
function draft(fileName = "a.mp4", frameRate: number | null = 30) {
  return {
    draftVersion: 3 as const,
    study: study(fileName, frameRate),
    sticky: STICKY,
    savedAt: "2026-11-05T12:00:00.000Z",
  };
}

function studyV5(fileName = "a.mp4", archetypeId = "killer-bee-queen"): StudyV5 {
  return {
    schemaVersion: 5,
    encounterId: "killer-bee-queen",
    archetypeId,
    recordedAt: "2026-11-13T00:00:00.000Z",
    provenance: { sourceUrl: null, fileName, frameRate: 30, durationSeconds: 100 },
    boundaries: [{ timeSeconds: 1, segmentId: "p1" }],
    statusSpans: [],
    tracks: [
      {
        id: "bee",
        location: { phaseId: "p1", subPhaseId: null },
        attack: unsafeFixture<StudyV5["tracks"][number]["attack"]>({ id: "bee" }),
        cadenceSource: "authored",
        marks: [{ timeSeconds: 2, kind: "volley" }, { timeSeconds: 3, kind: "volley" }],
      },
    ],
    scratch: [{ timeSeconds: 4, kind: "volley" }],
    acceptedSegmentValues: {},
  };
}

function draftV4(fileName = "a.mp4", archetypeId = "killer-bee-queen") {
  return buildDraft({
    study: studyV5(fileName, archetypeId),
    selectedTrackId: "bee",
    savedAt: "2026-11-05T12:00:00.000Z",
  });
}

describe("version 4 drafts (plan V20 E14)", () => {
  test("a version 4 draft round-trips through storage", () => {
    const storage = new FakeStorage();
    const sessions = new TaggerSessions(() => storage);
    sessions.write(draftV4("a.mp4"), "killer-bee-queen");
    expect(sessions.read(TaggerSessions.keyFor("a.mp4"))).toEqual({ ok: true, value: draftV4("a.mp4") });
    expect(draftV4().draftVersion).toBe(4);
  });

  test("a version 3 draft is returned as legacy", () => {
    const restored = validateSessionDraft(JSON.parse(JSON.stringify(draft())));
    expect(isLegacyDraft(restored)).toBe(true);
    expect(isLegacyDraft(draftV4())).toBe(false);
  });

  test("a version 4 draft with an invalid study or selection is rejected", () => {
    const bad = JSON.parse(JSON.stringify(draftV4()));
    bad.study.boundaries[0].timeSeconds = -1;
    expect(() => validateSessionDraft(bad)).toThrow(/timeSeconds|boundar/i);
    expect(() => validateSessionDraft({ ...draftV4(), selectedTrackId: 3 })).toThrow(/selectedTrackId/);
  });

  test("markCountOf sums the marks over tracks and scratch", () => {
    expect(markCountOf(studyV5())).toBe(3);
  });
});

describe("TaggerSessions", () => {
  test("round-trips a draft with one slot per file name", () => {
    const storage = new FakeStorage();
    const sessions = new TaggerSessions(() => storage);
    sessions.write(draftV4("a.mp4"), "killer-bee-queen");
    sessions.write(draftV4("b.mp4"), "killer-bee-queen");
    sessions.write(draftV4("a.mp4"), "killer-bee-queen");
    expect(storage.data.size).toBe(2);
    const read = sessions.read(TaggerSessions.keyFor("a.mp4"));
    expect(read).toEqual({ ok: true, value: draftV4("a.mp4") });
  });

  test("lists readable and unreadable slots and ignores unrelated keys", () => {
    const storage = new FakeStorage();
    storage.data.set("other", "{}");
    storage.data.set(`${TAGGER_SESSION_KEY_PREFIX}corrupt`, "{nope");
    storage.data.set(`${TAGGER_SESSION_KEY_PREFIX}invalid`, '{"draftVersion":1}');
    const sessions = new TaggerSessions(() => storage);
    storage.data.set(TaggerSessions.keyFor("a.mp4"), JSON.stringify(draft("a.mp4")));
    sessions.write(draftV4("b.mp4"), "killer-bee-queen");
    const result = sessions.list();
    if (!result.ok) throw new Error("expected ok");
    expect(result.value).toEqual([
      { readable: true, key: TaggerSessions.keyFor("a.mp4"), fileName: "a.mp4", archetypeId: null, markCount: 1, savedAt: "2026-11-05T12:00:00.000Z" },
      { readable: true, key: TaggerSessions.keyFor("b.mp4"), fileName: "b.mp4", archetypeId: "killer-bee-queen", markCount: 3, savedAt: "2026-11-05T12:00:00.000Z" },
      { readable: false, key: `${TAGGER_SESSION_KEY_PREFIX}corrupt` },
      { readable: false, key: `${TAGGER_SESSION_KEY_PREFIX}invalid` },
    ]);
  });

  test("discard removes only that slot", () => {
    const storage = new FakeStorage();
    const sessions = new TaggerSessions(() => storage);
    sessions.write(draftV4("a.mp4"), "killer-bee-queen");
    sessions.write(draftV4("b.mp4"), "killer-bee-queen");
    sessions.discard(TaggerSessions.keyFor("a.mp4"));
    expect([...storage.data.keys()]).toEqual([TaggerSessions.keyFor("b.mp4")]);
  });

  test("accepts a null frame rate", () => {
    expect(() => validateSessionDraft(draft("a.mp4", null))).not.toThrow();
  });

  test("returns failure values instead of throwing", () => {
    const storage = new FakeStorage();
    const sessions = new TaggerSessions(() => storage);
    storage.failWrite = true;
    expect(sessions.write(draftV4()).ok).toBe(false);
    storage.failRead = true;
    expect(sessions.read("k").ok).toBe(false);
    const unavailable = new TaggerSessions(() => {
      throw new Error("blocked");
    });
    expect(unavailable.list()).toEqual({ ok: false, error: "blocked" });
    expect(unavailable.write(draftV4()).ok).toBe(false);
  });

  test("rejects invalid tags and sticky values", () => {
    const bad = JSON.parse(JSON.stringify(draft()));
    bad.study.tags[0].pattern = "spread";
    expect(() => validateSessionDraft(bad)).toThrow(/aim/);
    const badSticky = JSON.parse(JSON.stringify(draft()));
    badSticky.sticky.pattern = "volley";
    expect(() => validateSessionDraft(badSticky)).toThrow(/sticky\.pattern/);
  });
});

describe("saved sessions carry typed geometry (plan V15 phase 53)", () => {
  test("a draft with composite tags and sticky geometry validates and round-trips", () => {
    const rich = JSON.parse(JSON.stringify(draft()));
    rich.study.tags[0] = {
      ...rich.study.tags[0],
      pattern: "rotating-arm",
      armPattern: "spread",
      shotsPerArm: 3,
      armArcDegrees: 20,
      clockwiseDegreesPerSecond: -30,
      initialPhaseDegrees: 5,
    };
    rich.sticky = {
      ...rich.sticky,
      aim: "front",
      armPattern: "scatter",
      shotsPerArm: 2,
      armArcDegrees: 40,
      clockwiseDegreesPerSecond: 12,
      initialPhaseDegrees: 0,
    };
    expect(validateSessionDraft(rich)).toBe(rich);
    expect(JSON.parse(JSON.stringify(rich))).toEqual(rich);
  });

  test.each([
    ["a tag with armPattern but no shotsPerArm", (d: any) => { d.study.tags[0].armPattern = "ring"; }, /shotsPerArm/],
    ["a tag rate on a fixed ring", (d: any) => { d.study.tags[0].pattern = "fixed-ring"; d.study.tags[0].clockwiseDegreesPerSecond = 3; }, /clockwiseDegreesPerSecond/],
    ["a bad sticky armPattern", (d: any) => { d.sticky.armPattern = "star"; }, /sticky\.armPattern/],
    ["a fractional sticky shotsPerArm", (d: any) => { d.sticky.shotsPerArm = 1.5; }, /sticky\.shotsPerArm/],
    ["a negative sticky cone", (d: any) => { d.sticky.armArcDegrees = -1; }, /sticky\.armArcDegrees/],
    ["a nonfinite sticky rate", (d: any) => { d.sticky.clockwiseDegreesPerSecond = Number.NaN; }, /sticky\.clockwiseDegreesPerSecond/],
  ])("rejects %s", (_label, mutate, pattern) => {
    const bad = JSON.parse(JSON.stringify(draft()));
    mutate(bad);
    expect(() => validateSessionDraft(bad)).toThrow(pattern);
  });
});

describe("shouldWriteDraft", () => {
  test.each([
    [false, 3, 1, false],
    [true, 0, 0, false],
    [true, 3, 0, true],
    [true, 0, 2, true],
  ])("dirty %s, %i marks, %i boundaries -> %s", (dirty, markCount, boundaryCount, expected) => {
    expect(shouldWriteDraft({ dirty, markCount, boundaryCount })).toBe(expected);
  });
});

describe("restoreSticky", () => {
  test("keeps valid values", () => {
    expect(restoreSticky(STICKY, ENCOUNTER_CONFIG, ENCOUNTER_CONFIG.primaryArchetypeId)).toEqual({
      sticky: STICKY,
      notices: [],
    });
  });

  test("falls back with a notice per missing value", () => {
    const result = restoreSticky(
      { ...STICKY, spriteId: "gone", phaseIndex: 99 },
      ENCOUNTER_CONFIG, ENCOUNTER_CONFIG.primaryArchetypeId,
    );
    expect(result.sticky.spriteId).toBe(appearanceOptions()[0].id);
    expect(result.sticky.phaseIndex).toBe(0);
    expect(result.notices).toEqual(["sprite-missing", "phase-missing"]);
  });
});

describe("draft version 2 (plan V16 S05)", () => {
  const attack = {
    id: "a1",
    name: "Spiral",
    spriteId: "x",
    pattern: "rotating-arm" as const,
    shots: 3,
    cadence: { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0.5 },
  };

  test("a version 1 draft restores with its tags intact and no saved attacks", () => {
    const { savedAttacks: _omit, ...v1Study } = study();
    const v1 = {
      draftVersion: 1,
      savedAt: "2026-11-05T12:00:00.000Z",
      study: v1Study,
      sticky: STICKY,
    };
    const upgraded = validateSessionDraft(v1);
    if (!isLegacyDraft(upgraded)) throw new Error("expected legacy");
    expect(upgraded.draftVersion).toBe(3);
    expect(upgraded.study.savedAttacks).toEqual([]);
    expect(upgraded.study.tags).toEqual(v1Study.tags);
  });

  test("a version 2 draft with a linked tag round-trips", () => {
    const withAttack: StudyState = {
      ...study(),
      savedAttacks: [attack],
      tags: [{ timeSeconds: 2, phaseIndex: 0, savedAttackId: "a1" }],
    };
    const value = { ...draft(), study: withAttack, sticky: { ...STICKY, savedAttackId: "a1" } };
    expect(validateSessionDraft(JSON.parse(JSON.stringify(value)))).toEqual(value);
  });

  test("rejects a linked tag naming a missing attack", () => {
    const value = { ...draft(), study: { ...study(), tags: [{ timeSeconds: 2, phaseIndex: 0, savedAttackId: "no" }] } };
    expect(() => validateSessionDraft(value)).toThrow(/savedAttackId/);
  });

  test("a missing chosen attack is cleared with a notice", () => {
    const restored = restoreSticky(
      { ...STICKY, savedAttackId: "gone" },
      ENCOUNTER_CONFIG, ENCOUNTER_CONFIG.primaryArchetypeId,
      [attack],
    );
    expect(restored.sticky).not.toHaveProperty("savedAttackId");
    expect(restored.notices).toContain("attack-missing");
    const kept = restoreSticky({ ...STICKY, savedAttackId: "a1" }, ENCOUNTER_CONFIG, ENCOUNTER_CONFIG.primaryArchetypeId, [attack]);
    expect(kept.sticky.savedAttackId).toBe("a1");
    expect(kept.notices).not.toContain("attack-missing");
  });

  test("the session list reads both versions", () => {
    const storage = new FakeStorage();
    const { savedAttacks: _omit, ...v1Study } = study("old.mp4");
    storage.data.set(
      `${TAGGER_SESSION_KEY_PREFIX}old.mp4`,
      JSON.stringify({ draftVersion: 1, savedAt: "2026-11-05T12:00:00.000Z", study: v1Study, sticky: STICKY }),
    );
    new TaggerSessions(() => storage).write(draftV4("new.mp4"));
    const listed = new TaggerSessions(() => storage).list();
    expect(listed.ok && listed.value.every((entry) => entry.readable)).toBe(true);
  });
});

describe("V18 monster slots", () => {
  const minion = (name: string) => draftV4(name, "red-killer-bee");

  test("two monsters on one video use two slots", () => {
    const store = new Map<string, string>();
    const sessions = new TaggerSessions(() => ({
      get length() { return store.size; },
      key: (i) => [...store.keys()][i] ?? null,
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    }));
    sessions.write(draftV4("a.mp4"), "killer-bee-queen");
    sessions.write(minion("a.mp4"), "killer-bee-queen");
    expect(store.size).toBe(2);
    expect(TaggerSessions.keyFor("a.mp4")).toBe(TAGGER_SESSION_KEY_PREFIX + "a.mp4");
    expect(store.has(TaggerSessions.keyFor("a.mp4", "red-killer-bee"))).toBe(true);
  });

  test("a version 2 slot restores as the primary monster with no draft", () => {
    const old = { ...draft("a.mp4"), draftVersion: 2 };
    const restored = validateSessionDraft(old);
    if (!isLegacyDraft(restored)) throw new Error("expected legacy");
    expect(restored.draftVersion).toBe(3);
    expect(restored.study.archetypeId).toBeNull();
    expect(restored.study.monsterDraft).toBeNull();
  });

  test("a malformed draft is rejected", () => {
    const bad = { ...draft("a.mp4"), study: { ...study(), monsterDraft: { phases: 1, anchors: {} } } };
    expect(() => validateSessionDraft(bad)).toThrow(/monsterDraft/);
  });
});

describe("restoreSticky for a minion (J23)", () => {
  const QUEEN_CONFIG = encounterConfigOf("killer-bee-queen");
  test("a phase index beyond the minion's phases falls back to phase 0", () => {
    const result = restoreSticky({ ...STICKY, phaseIndex: 3 }, QUEEN_CONFIG, "red-killer-bee");
    expect(result.sticky.phaseIndex).toBe(0);
    expect(result.notices).toEqual(["phase-missing"]);
    expect(restoreSticky({ ...STICKY, phaseIndex: 1 }, QUEEN_CONFIG, "killer-bee-nest-red").sticky.phaseIndex).toBe(1);
  });
});
