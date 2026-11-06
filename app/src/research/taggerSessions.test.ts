import { describe, expect, test } from "vitest";
import { ENCOUNTER_CONFIG } from "../game/config/encounter";
import {
  buildDraft,
  restoreSticky,
  shouldWriteDraft,
  TAGGER_SESSION_KEY_PREFIX,
  TaggerSessions,
  validateSessionDraft,
  type SessionStorage,
} from "./taggerSessions";
import { appearanceOptions, type StickySelection } from "./taggingOptions";
import type { StudyState } from "./tagging";

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
    provenance: { sourceUrl: null, fileName, frameRate, durationSeconds: 100 },
    tags: [
      { timeSeconds: 1, phaseIndex: 0, spriteId: "x", pattern: "rotating-arm", shots: 2 },
    ],
  };
}

function draft(fileName = "a.mp4", frameRate: number | null = 30) {
  return buildDraft({
    study: study(fileName, frameRate),
    sticky: STICKY,
    savedAt: "2026-11-05T12:00:00.000Z",
  });
}

describe("TaggerSessions", () => {
  test("round-trips a draft with one slot per file name", () => {
    const storage = new FakeStorage();
    const sessions = new TaggerSessions(() => storage);
    sessions.write(draft("a.mp4"));
    sessions.write(draft("b.mp4"));
    sessions.write(draft("a.mp4"));
    expect(storage.data.size).toBe(2);
    const read = sessions.read(TaggerSessions.keyFor("a.mp4"));
    expect(read).toEqual({ ok: true, value: draft("a.mp4") });
  });

  test("lists readable and unreadable slots and ignores unrelated keys", () => {
    const storage = new FakeStorage();
    storage.data.set("other", "{}");
    storage.data.set(`${TAGGER_SESSION_KEY_PREFIX}corrupt`, "{nope");
    storage.data.set(`${TAGGER_SESSION_KEY_PREFIX}invalid`, '{"draftVersion":1}');
    const sessions = new TaggerSessions(() => storage);
    sessions.write(draft("a.mp4"));
    const result = sessions.list();
    if (!result.ok) throw new Error("expected ok");
    expect(result.value).toEqual([
      { readable: true, key: TaggerSessions.keyFor("a.mp4"), fileName: "a.mp4", tagCount: 1, savedAt: "2026-11-05T12:00:00.000Z" },
      { readable: false, key: `${TAGGER_SESSION_KEY_PREFIX}corrupt` },
      { readable: false, key: `${TAGGER_SESSION_KEY_PREFIX}invalid` },
    ]);
  });

  test("discard removes only that slot", () => {
    const storage = new FakeStorage();
    const sessions = new TaggerSessions(() => storage);
    sessions.write(draft("a.mp4"));
    sessions.write(draft("b.mp4"));
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
    expect(sessions.write(draft()).ok).toBe(false);
    storage.failRead = true;
    expect(sessions.read("k").ok).toBe(false);
    const unavailable = new TaggerSessions(() => {
      throw new Error("blocked");
    });
    expect(unavailable.list()).toEqual({ ok: false, error: "blocked" });
    expect(unavailable.write(draft()).ok).toBe(false);
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
    [false, 3, false],
    [true, 0, false],
    [true, 3, true],
  ])("dirty %s, %i tags -> %s", (dirty, tagCount, expected) => {
    expect(shouldWriteDraft({ dirty, tagCount })).toBe(expected);
  });
});

test("buildDraft carries sticky selection and a null frame rate", () => {
  const built = draft("a.mp4", null);
  expect(built.sticky).toEqual(STICKY);
  expect(built.study.provenance.frameRate).toBeNull();
  expect(built.draftVersion).toBe(1);
});

describe("restoreSticky", () => {
  test("keeps valid values", () => {
    expect(restoreSticky(STICKY, ENCOUNTER_CONFIG)).toEqual({
      sticky: STICKY,
      notices: [],
    });
  });

  test("falls back with a notice per missing value", () => {
    const result = restoreSticky(
      { ...STICKY, spriteId: "gone", phaseIndex: 99 },
      ENCOUNTER_CONFIG,
    );
    expect(result.sticky.spriteId).toBe(appearanceOptions()[0].id);
    expect(result.sticky.phaseIndex).toBe(0);
    expect(result.notices).toEqual(["sprite-missing", "phase-missing"]);
  });
});
