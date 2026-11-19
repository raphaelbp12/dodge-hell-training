import { describe, expect, test } from "vitest";
import type { CadencedAuthoredAttack } from "../game/config/data";
import type { AttackTrack, Mark, SegmentWindow } from "./study";
import {
  firstWindowOf,
  MAX_REPEAT_TICKS,
  repeatTimesOf,
  roundToMillisecond,
  trackMarksOf,
  trackWindowsOf,
  volleyTimesInWindow,
} from "./trackMarks";

const volleys = (...times: number[]): Mark[] => times.map((timeSeconds) => ({ timeSeconds, kind: "volley" }));
const track = (overrides: Partial<AttackTrack> = {}): AttackTrack => ({
  id: "t",
  location: { phaseId: "p", subPhaseId: null },
  attack: { id: "t" } as unknown as CadencedAuthoredAttack,
  marks: [],
  ...overrides,
});
const window = (segmentId: string, startSeconds: number, endSeconds: number): SegmentWindow => ({
  segmentId,
  startSeconds,
  epochSeconds: startSeconds + 1,
  endSeconds,
});

test("roundToMillisecond", () => {
  expect(roundToMillisecond(3.0999999)).toBe(3.1);
  expect(roundToMillisecond(0.0004)).toBe(0);
});

describe("trackWindowsOf", () => {
  const subWindows = [window("p/a", 0, 10), window("p/b", 10, 20), window("q", 20, 30), window("p/a", 30, 40)];

  test("a phase-level track of a phase with sub-phases counts each run of its sub-phase windows as one", () => {
    expect(trackWindowsOf(track(), subWindows)).toEqual([
      { segmentId: "p/a", startSeconds: 0, epochSeconds: 1, endSeconds: 20 },
      window("p/a", 30, 40),
    ]);
  });

  test("a sub-phase track keeps its own windows, and a plain phase never merges", () => {
    expect(trackWindowsOf(track({ location: { phaseId: "p", subPhaseId: "b" } }), subWindows)).toEqual([
      window("p/b", 10, 20),
    ]);
    const plain = [window("p", 0, 10), window("p", 10, 20)];
    expect(trackWindowsOf(track(), plain)).toEqual(plain);
  });

  test("the first window, or null without one", () => {
    expect(firstWindowOf(track(), subWindows)?.endSeconds).toBe(20);
    expect(firstWindowOf(track({ location: { phaseId: "r", subPhaseId: null } }), subWindows)).toBeNull();
  });

  test("volleyTimesInWindow keeps the window's volley marks, sorted", () => {
    const marked = track({ marks: [...volleys(15, 2, 35), { timeSeconds: 3, kind: "detonation" }] });
    expect(volleyTimesInWindow(marked, subWindows, firstWindowOf(marked, subWindows)!)).toEqual([2, 15]);
  });
});

describe("trackMarksOf", () => {
  const windows = [window("p", 10, 30)];

  test("null without a window or without a volley mark in the first one", () => {
    expect(trackMarksOf(track({ marks: volleys(12) }), [])).toBeNull();
    expect(trackMarksOf(track({ marks: volleys(35) }), windows)).toBeNull();
  });

  test("a stop mark outside the first window is not exported", () => {
    expect(trackMarksOf(track({ marks: volleys(12), periodSeconds: 2, endSeconds: 31 }), windows)).toEqual({
      bursts: [[2]],
      periodSeconds: 2,
    });
    expect(trackMarksOf(track({ marks: volleys(12), periodSeconds: 2, endSeconds: 9 }), windows)).toEqual({
      bursts: [[2]],
      periodSeconds: 2,
    });
    expect(trackMarksOf(track({ marks: volleys(12), periodSeconds: 2, endSeconds: 30 }), windows)).toEqual({
      bursts: [[2]],
      periodSeconds: 2,
      stopAfterSeconds: 20,
    });
  });
});

describe("repeatTimesOf (plan V23 Q18)", () => {
  const windows = [window("p", 10, 30)];

  test("a periodic track's later cycles up to the window's end, without the first cycle", () => {
    expect(repeatTimesOf(track({ marks: volleys(12, 13), periodSeconds: 5 }), windows)).toEqual([17, 18, 22, 23, 27, 28]);
  });

  test("nothing for a track that plays once or exports nothing", () => {
    expect(repeatTimesOf(track({ marks: volleys(12) }), windows)).toEqual([]);
    expect(repeatTimesOf(track({ periodSeconds: 1 }), windows)).toEqual([]);
  });

  test("a tiny period is capped", () => {
    expect(repeatTimesOf(track({ marks: volleys(10), periodSeconds: 0.001 }), windows)).toHaveLength(MAX_REPEAT_TICKS);
  });
});
