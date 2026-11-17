import fc from "fast-check";
import { expect, test } from "vitest";
import { propertyParameters } from "../test/property";
import {
  FULL_WINDOW,
  followPlayhead,
  zoomWindow,
  type TimelineWindow,
} from "./timelineZoom";

/** Floating-point tolerance for window edges after a zoom round trip. */
const WINDOW_EPSILON = 1e-9;

const fraction = fc.double({ min: 0, max: 1, noNaN: true });
const factor = fc.double({ min: 0.1, max: 4, noNaN: true });
const minSpan = fc.double({ min: 0.001, max: 0.5, noNaN: true });
const step = fc.record({ factor, center: fraction });

function applyAll(
  steps: readonly { factor: number; center: number }[],
  min: number,
  start: TimelineWindow = FULL_WINDOW,
): TimelineWindow {
  return steps.reduce(
    (window, entry) => zoomWindow(window, entry.factor, entry.center, min),
    start,
  );
}

test("the visible window always lies inside the video", () => {
  fc.assert(
    fc.property(fc.array(step, { maxLength: 12 }), minSpan, fraction, (steps, min, playhead) => {
      const zoomed = applyAll(steps, min);
      expect(zoomed.start).toBeGreaterThanOrEqual(0);
      expect(zoomed.end).toBeLessThanOrEqual(1 + WINDOW_EPSILON);
      expect(zoomed.end).toBeGreaterThan(zoomed.start);
      const followed = followPlayhead(zoomed, playhead);
      expect(followed.start).toBeGreaterThanOrEqual(0);
      expect(followed.end).toBeLessThanOrEqual(1 + WINDOW_EPSILON);
    }),
    propertyParameters(),
  );
});

test("zooming in and then out by the same factor restores the window while it stays inside the video", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.2, max: 0.9, noNaN: true }),
      fc.double({ min: 0.3, max: 0.7, noNaN: true }),
      (zoomInFactor, center) => {
        const start = zoomWindow(FULL_WINDOW, zoomInFactor, center, 0.001);
        const inner = zoomWindow(start, 0.5, center, 0.001);
        const restored = zoomWindow(inner, 2, center, 0.001);
        expect(restored.start).toBeCloseTo(start.start, 9);
        expect(restored.end).toBeCloseTo(start.end, 9);
      },
    ),
    propertyParameters(),
  );
});
