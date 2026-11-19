import fc from "fast-check";
import { expect, test } from "vitest";
import { propertyParameters } from "../../test/property";
import { markedVolleysBetween, type MarkedVolley } from "./marks";

const offsetsArbitrary = fc
  .array(fc.array(fc.double({ min: 0, max: 10, noNaN: true }), { minLength: 1, maxLength: 4 }), {
    minLength: 1,
    maxLength: 4,
  })
  .map((bursts) => {
    const sorted = bursts.flat().sort((a, b) => a - b);
    let cursor = 0;
    return bursts.map((burst) => burst.map(() => sorted[cursor++]));
  });

const marksArbitrary = fc.record(
  {
    bursts: offsetsArbitrary,
    periodSeconds: fc.double({ min: 0.05, max: 10, noNaN: true }),
    stopAfterSeconds: fc.double({ min: 0, max: 30, noNaN: true }),
  },
  { requiredKeys: ["bursts"] },
).filter((marks) => marks.periodSeconds !== undefined || marks.stopAfterSeconds === undefined);

const horizon = 40;

test("consecutive spans concatenate to one span", () => {
  fc.assert(
    fc.property(
      marksArbitrary,
      fc.array(fc.double({ min: 0, max: horizon, noNaN: true }), { maxLength: 8 }),
      (marks, cuts) => {
        const edges = [-1, ...cuts.sort((a, b) => a - b), horizon];
        const pieces: MarkedVolley[] = [];
        for (let index = 1; index < edges.length; index++)
          pieces.push(...markedVolleysBetween(marks, edges[index - 1], edges[index]));
        expect(pieces).toEqual(markedVolleysBetween(marks, -1, horizon));
      },
    ),
    propertyParameters(),
  );
});

test("results are sorted and no cycle starts after the stop", () => {
  fc.assert(
    fc.property(marksArbitrary, (marks) => {
      const volleys = markedVolleysBetween(marks, -1, horizon);
      for (let index = 1; index < volleys.length; index++)
        expect(volleys[index].offsetSeconds).toBeGreaterThanOrEqual(volleys[index - 1].offsetSeconds);
      if (marks.periodSeconds === undefined || marks.stopAfterSeconds === undefined) return;
      const first = marks.bursts[0][0];
      for (const volley of volleys) {
        const cycle = Math.floor(volley.burstIndex / marks.bursts.length);
        expect(first + cycle * marks.periodSeconds).toBeLessThanOrEqual(
          marks.stopAfterSeconds + 1e-9,
        );
      }
    }),
    propertyParameters(),
  );
});

test("without a period every offset fires exactly once", () => {
  fc.assert(
    fc.property(offsetsArbitrary, (bursts) => {
      expect(markedVolleysBetween({ bursts }, -1, Number.MAX_VALUE)).toHaveLength(
        bursts.flat().length,
      );
    }),
    propertyParameters(),
  );
});
