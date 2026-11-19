import { describe, expect, test } from "vitest";
import { markedVolleysBetween } from "./marks";

const offsets = (volleys: ReturnType<typeof markedVolleysBetween>) =>
  volleys.map((volley) => volley.offsetSeconds);

describe("markedVolleysBetween (plan V23 Q05-Q09)", () => {
  test("once-only marks fire each volley once and nothing after the last", () => {
    const marks = { bursts: [[1, 1.2], [3]] };
    expect(markedVolleysBetween(marks, -1, 100)).toEqual([
      { offsetSeconds: 1, burstIndex: 0, shotIndex: 0 },
      { offsetSeconds: 1.2, burstIndex: 0, shotIndex: 1 },
      { offsetSeconds: 3, burstIndex: 1, shotIndex: 0 },
    ]);
    expect(markedVolleysBetween(marks, 3, 1000)).toEqual([]);
  });

  test("the span is half-open: a volley at from is excluded, at to included", () => {
    const marks = { bursts: [[0], [1]] };
    expect(offsets(markedVolleysBetween(marks, 0, 1))).toEqual([1]);
    expect(offsets(markedVolleysBetween(marks, -1, 0))).toEqual([0]);
  });

  test("the phase 6 escalation repeats every period until the stop", () => {
    const marks = { bursts: [[4.867], [5.067]], periodSeconds: 4, stopAfterSeconds: 20 };
    const volleys = markedVolleysBetween(marks, -1, 60);
    // Cycles start at 4.867 + 4k for k = 0..3; 20.867 is after the stop.
    expect(volleys).toHaveLength(8);
    expect(volleys.map((volley) => volley.burstIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(volleys[6].offsetSeconds).toBeCloseTo(16.867, 9);
    expect(volleys[7].offsetSeconds).toBeCloseTo(17.067, 9);
  });

  test("a periodic cycle without a stop repeats forever", () => {
    const marks = { bursts: [[0, 0.5]], periodSeconds: 2 };
    const volleys = markedVolleysBetween(marks, 99, 101);
    expect(volleys).toEqual([
      { offsetSeconds: 100, burstIndex: 50, shotIndex: 0 },
      { offsetSeconds: 100.5, burstIndex: 50, shotIndex: 1 },
    ]);
  });

  test("a stop between two cycles stops the next; a stop inside a cycle lets it finish", () => {
    const between = { bursts: [[0], [1]], periodSeconds: 3, stopAfterSeconds: 2 };
    expect(offsets(markedVolleysBetween(between, -1, 10))).toEqual([0, 1]);
    const inside = { bursts: [[0], [1]], periodSeconds: 3, stopAfterSeconds: 3.5 };
    expect(offsets(markedVolleysBetween(inside, -1, 10))).toEqual([0, 1, 3, 4]);
  });

  test("overlapping cycles interleave in time order", () => {
    const marks = { bursts: [[0], [2]], periodSeconds: 1, stopAfterSeconds: 1 };
    expect(markedVolleysBetween(marks, -1, 10)).toEqual([
      { offsetSeconds: 0, burstIndex: 0, shotIndex: 0 },
      { offsetSeconds: 1, burstIndex: 2, shotIndex: 0 },
      { offsetSeconds: 2, burstIndex: 1, shotIndex: 0 },
      { offsetSeconds: 3, burstIndex: 3, shotIndex: 0 },
    ]);
  });

  test("duplicate offsets are both returned", () => {
    expect(markedVolleysBetween({ bursts: [[1, 1]] }, 0, 2)).toEqual([
      { offsetSeconds: 1, burstIndex: 0, shotIndex: 0 },
      { offsetSeconds: 1, burstIndex: 0, shotIndex: 1 },
    ]);
  });

  test("a span crossing a cycle boundary returns both sides", () => {
    const marks = { bursts: [[0, 0.9]], periodSeconds: 1 };
    expect(markedVolleysBetween(marks, 0.85, 1.05)).toEqual([
      { offsetSeconds: 0.9, burstIndex: 0, shotIndex: 1 },
      { offsetSeconds: 1, burstIndex: 1, shotIndex: 0 },
    ]);
  });
});
