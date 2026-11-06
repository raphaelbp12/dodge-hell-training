import { describe, expect, test } from "vitest";
import {
  clearRepeatEnd,
  endRepeatTarget,
  MAX_REPEAT_VOLLEYS,
  setRepeatEnd,
  volleyTime,
  volleyTimesOf,
} from "./repeat";
import type { StoredTag } from "./tagging";

const SINGLE = { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0.4 };
const THREE = { shotsPerBurst: 3, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1 };
const linked = (overrides: Partial<StoredTag> = {}): StoredTag =>
  ({ timeSeconds: 10, phaseIndex: 0, savedAttackId: "a", ...overrides }) as StoredTag;

describe("volleyTimesOf", () => {
  test("a row with no end is its own time", () => {
    expect(volleyTimesOf({ timeSeconds: 4 }, SINGLE)).toEqual([4]);
  });

  test("a 0.4 s single-shot repeat steps by 0.4 s and includes an end on a volley", () => {
    const times = volleyTimesOf({ timeSeconds: 10, repeatEndSeconds: 11.2 }, SINGLE);
    expect(times).toHaveLength(4);
    times.forEach((time, index) => expect(time).toBeCloseTo(10 + 0.4 * index, 9));
  });

  test("an end between volleys excludes the next one", () => {
    const times = volleyTimesOf({ timeSeconds: 10, repeatEndSeconds: 11.0 }, SINGLE);
    expect(times.map((time) => Number(time.toFixed(6)))).toEqual([10, 10.4, 10.8]);
  });

  test("three shots per burst follow the game's clock", () => {
    const times = volleyTimesOf({ timeSeconds: 0, repeatEndSeconds: 3 }, THREE);
    // Burst period = 2 * 0.1 + 1 = 1.2 s.
    expect(times.map((time) => Number(time.toFixed(6)))).toEqual([
      0, 0.1, 0.2, 1.2, 1.3, 1.4, 2.4, 2.5, 2.6,
    ]);
  });

  test("agrees with the formula at a far index and stays bounded", () => {
    expect(volleyTime(5, THREE, 3000)).toBeCloseTo(5 + 1000 * 1.2, 6);
    expect(volleyTime(5, THREE, 3001)).toBeCloseTo(5 + 1000 * 1.2 + 0.1, 6);
    const dense = volleyTimesOf(
      { timeSeconds: 0, repeatEndSeconds: 1e9 },
      { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 1e-9 },
    );
    expect(dense).toHaveLength(MAX_REPEAT_VOLLEYS);
  });
});

describe("setRepeatEnd and clearRepeatEnd", () => {
  test("a frame end removes the typed mark, a typed end sets it", () => {
    const typed = setRepeatEnd(linked(), 12, "typed");
    expect(typed.ok && typed.tag).toMatchObject({ repeatEndSeconds: 12, repeatEndSource: "typed" });
    if (!typed.ok) return;
    const frame = setRepeatEnd(typed.tag, 13, "frame");
    expect(frame.ok && frame.tag).toMatchObject({ repeatEndSeconds: 13 });
    expect(frame.ok && frame.tag).not.toHaveProperty("repeatEndSource");
  });

  test("rejects an unlinked tag, a burst number and an end not after the time", () => {
    expect(setRepeatEnd({ timeSeconds: 1, phaseIndex: 0, spriteId: "x", pattern: "fixed-ring", shots: 2 }, 5, "frame").ok).toBe(false);
    expect(setRepeatEnd(linked({ burstId: 1 }), 12, "frame").ok).toBe(false);
    expect(setRepeatEnd(linked(), 10, "frame").ok).toBe(false);
    expect(setRepeatEnd(linked(), 9, "typed").ok).toBe(false);
  });

  test("clearing removes both fields", () => {
    const set = setRepeatEnd(linked(), 12, "typed");
    if (!set.ok) throw new Error("setup");
    const cleared = clearRepeatEnd(set.tag);
    expect(cleared).not.toHaveProperty("repeatEndSeconds");
    expect(cleared).not.toHaveProperty("repeatEndSource");
  });
});

describe("endRepeatTarget", () => {
  const tags: StoredTag[] = [
    linked({ timeSeconds: 2 }),
    linked({ timeSeconds: 6, savedAttackId: "b" }),
    linked({ timeSeconds: 8 }),
    { timeSeconds: 9, phaseIndex: 0, spriteId: "x", pattern: "fixed-ring", shots: 2 },
  ];

  test("the selected linked row wins", () => {
    expect(endRepeatTarget(tags, 0, "a", 20)).toBe(0);
  });

  test("otherwise the latest row of the chosen attack before the current frame", () => {
    expect(endRepeatTarget(tags, null, "a", 20)).toBe(2);
    expect(endRepeatTarget(tags, 3, "a", 7)).toBe(0);
  });

  test("otherwise null", () => {
    expect(endRepeatTarget(tags, null, null, 20)).toBeNull();
    expect(endRepeatTarget(tags, null, "a", 1)).toBeNull();
    expect(endRepeatTarget(tags, null, "zzz", 20)).toBeNull();
  });
});
