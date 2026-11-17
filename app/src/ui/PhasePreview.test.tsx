import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { encounterConfigOf } from "../game/config/encounter";
import { createPhasePreview } from "../game/phaser/phase-preview";
import { motionAllowed, PhasePreview } from "./PhasePreview";

// The Phaser preview is faked: the component only creates it, retargets it and destroys it.
vi.mock("../game/phaser/phase-preview", () => ({ createPhasePreview: vi.fn() }));

const config = encounterConfigOf("killer-bee-queen");
const DEBOUNCE_MILLISECONDS = 120;

const handle = { setPhase: vi.fn(), destroy: vi.fn() };

function stubMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

/** Lets the component's dynamic import resolve. */
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.mocked(createPhasePreview).mockReturnValue(handle as never);
  stubMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("motion is allowed unless the user prefers reduced motion", () => {
  expect(motionAllowed()).toBe(true);
  stubMotion(true);
  expect(motionAllowed()).toBe(false);
});

test("renders a decorative host element", () => {
  const { container } = render(<PhasePreview config={config} phaseIndex={0} />);
  const host = container.querySelector("[data-phase-preview]")!;
  expect(host).toHaveAttribute("aria-hidden", "true");
});

test("creates the preview for the config and phase it was given", async () => {
  const { container } = render(<PhasePreview config={config} phaseIndex={2} />);
  await flush();
  expect(createPhasePreview).toHaveBeenCalledWith(
    container.querySelector("[data-phase-preview]"),
    config,
    2,
  );
});

test("does not load the preview when reduced motion is preferred", async () => {
  stubMotion(true);
  render(<PhasePreview config={config} phaseIndex={0} />);
  await flush();
  expect(createPhasePreview).not.toHaveBeenCalled();
});

test("retargets the phase only after the debounce", async () => {
  vi.useFakeTimers();
  const { rerender } = render(<PhasePreview config={config} phaseIndex={0} />);
  await flush();
  handle.setPhase.mockClear();
  rerender(<PhasePreview config={config} phaseIndex={3} />);
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_MILLISECONDS - 1);
  });
  expect(handle.setPhase).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(handle.setPhase).toHaveBeenCalledWith(3);
});

test("destroys the preview on unmount", async () => {
  const { unmount } = render(<PhasePreview config={config} phaseIndex={0} />);
  await flush();
  unmount();
  expect(handle.destroy).toHaveBeenCalledTimes(1);
});

test("never creates the preview if it unmounts before the import resolves", async () => {
  const { unmount } = render(<PhasePreview config={config} phaseIndex={0} />);
  unmount();
  await flush();
  expect(createPhasePreview).not.toHaveBeenCalled();
});
