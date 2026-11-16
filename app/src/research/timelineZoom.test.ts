import { describe, expect, it } from "vitest";
import {
  FULL_WINDOW,
  followPlayhead,
  isFullWindow,
  visibleFraction,
  zoomWindow,
} from "./timelineZoom";

describe("timeline zoom window", () => {
  it("halves the visible span around the playhead when zooming in", () => {
    expect(zoomWindow(FULL_WINDOW, 0.5, 0.5, 0.01)).toEqual({ start: 0.25, end: 0.75 });
  });

  it("keeps the zoomed window inside the video", () => {
    expect(zoomWindow(FULL_WINDOW, 0.5, 0.05, 0.01)).toEqual({ start: 0, end: 0.5 });
    expect(zoomWindow(FULL_WINDOW, 0.5, 0.95, 0.01)).toEqual({ start: 0.5, end: 1 });
  });

  it("never zooms in past the minimum span", () => {
    const window = zoomWindow({ start: 0.4, end: 0.42 }, 0.5, 0.41, 0.02);
    expect(window.end - window.start).toBeCloseTo(0.02);
  });

  it("never zooms out past the whole video", () => {
    expect(zoomWindow({ start: 0.2, end: 0.8 }, 2, 0.5, 0.01)).toEqual(FULL_WINDOW);
    expect(isFullWindow(zoomWindow({ start: 0.2, end: 0.8 }, 2, 0.5, 0.01))).toBe(true);
  });

  it("maps a video fraction onto the visible window", () => {
    const window = { start: 0.25, end: 0.75 };
    expect(visibleFraction(0.25, window)).toBe(0);
    expect(visibleFraction(0.5, window)).toBe(0.5);
    expect(visibleFraction(0.75, window)).toBe(1);
    expect(visibleFraction(0.1, window)).toBeLessThan(0);
  });

  it("keeps the window while the playhead is inside it", () => {
    const window = { start: 0.25, end: 0.75 };
    expect(followPlayhead(window, 0.6)).toBe(window);
  });

  it("moves the window to the playhead when the playhead leaves it", () => {
    expect(followPlayhead({ start: 0.25, end: 0.75 }, 0.8)).toEqual({ start: 0.5, end: 1 });
    const moved = followPlayhead({ start: 0.5, end: 0.6 }, 0.1);
    expect(moved.start).toBeCloseTo(0.05);
    expect(moved.end).toBeCloseTo(0.15);
  });
});
