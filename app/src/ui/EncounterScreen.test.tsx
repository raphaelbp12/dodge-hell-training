import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { DEBUG_RULES_VERSION, DEFAULT_DEBUG_SETTINGS } from "../game/config/debug";
import { encounterConfigOf } from "../game/config/encounter";
import { PALADIN_STATS } from "../game/config/stats";
import { createEncounter, type EncounterHandle, type EncounterView } from "../game/phaser/encounter";
import { AttemptHistory, HISTORY_STORAGE_KEY } from "../storage/attempts";
import { encounterView } from "../test/encounter-view";
import { EncounterScreen } from "./EncounterScreen";

// There is no prop seam for the Phaser runtime, so the module that creates it is faked.
vi.mock("../game/phaser/encounter", () => ({ createEncounter: vi.fn() }));

const config = encounterConfigOf("killer-bee-queen");

type Options = NonNullable<Parameters<typeof createEncounter>[2]>;

let publish: (view: EncounterView) => void;
let options: Options;
let handle: { [K in keyof EncounterHandle]: ReturnType<typeof vi.fn> };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  handle = {
    destroy: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    retry: vi.fn(),
    applyDrill: vi.fn(),
    setMuted: vi.fn(),
    setControlsOpen: vi.fn(),
    setDebugSettings: vi.fn(),
    advanceSubPhase: vi.fn(),
  };
  vi.mocked(createEncounter).mockImplementation((_host, onView, opts) => {
    publish = (view) => act(() => onView(view));
    options = opts as Options;
    return handle as unknown as EncounterHandle;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(createEncounter).mockReset();
});

type Props = Parameters<typeof EncounterScreen>[0];

function mount(overrides: Partial<Props> = {}) {
  const saved: string[] = [];
  const history = new AttemptHistory(() => ({
    getItem: () => null,
    setItem: (key, value) => {
      if (key === HISTORY_STORAGE_KEY) saved.push(value);
    },
  }));
  const onHistoryChange = vi.fn<Props["onHistoryChange"]>();
  const zoomSet = vi.fn<(zoom: number) => void>();
  const props: Props = {
    zoomPreference: { current: 1 },
    zoomStorage: { set: zoomSet } as unknown as Props["zoomStorage"],
    muted: false,
    debugSettings: DEFAULT_DEBUG_SETTINGS,
    onHome: vi.fn(),
    history,
    historySnapshot: history.snapshot(),
    onHistoryChange,
    encounterHandle: { current: null as EncounterHandle | null },
    config,
    displayName: "Killer Bee Queen",
    drill: null,
    onDrillChange: vi.fn(),
    debugOpen: false,
    onDebugOpenChange: vi.fn(),
    sessionTools: <span>tools</span>,
    ...overrides,
  };
  const utils = render(<EncounterScreen {...props} />);
  return { ...utils, props, saved, onHistoryChange, zoomSet };
}

test("creates the encounter in a labelled region and shares its handle", () => {
  const { props } = mount();
  expect(screen.getByRole("region", { name: "Encounter" })).toBeInTheDocument();
  expect(createEncounter).toHaveBeenCalledTimes(1);
  expect(options.config).toBe(config);
  expect(props.encounterHandle.current).toBe(handle);
});

test("starts on a countdown that names the phase and the controls", () => {
  mount();
  const countdown = screen.getByText("to move").closest("div")!;
  expect(countdown).toHaveTextContent(String(Math.ceil(config.session.startCountdownSeconds)));
});

test("renders each published view in the HUD", () => {
  mount();
  publish(encounterView({ status: "running", healthHp: 300, elapsedSeconds: 8.25, hitsTaken: 2, phaseCount: 8 }));
  expect(screen.getByRole("status", { name: "Session status" })).toHaveTextContent("Active");
  expect(screen.getByText(`300 / ${PALADIN_STATS.healthHp} HP`)).toBeInTheDocument();
  expect(screen.getByLabelText("Survival time")).toHaveTextContent("8.3 s");
  expect(screen.queryByText("to move")).not.toBeInTheDocument();
});

test("a paused view shows the paused overlay", () => {
  mount();
  publish(encounterView({ status: "paused" }));
  expect(screen.getByLabelText("Paused overlay")).toHaveTextContent("Press Esc to resume");
});

test("health below a quarter of full marks the arena as dangerous", () => {
  const { container } = mount();
  publish(encounterView({ status: "running", healthHp: PALADIN_STATS.healthHp * 0.2 }));
  expect(container.querySelector('[class*="danger"]')).not.toBeNull();
  publish(encounterView({ status: "running", healthHp: PALADIN_STATS.healthHp }));
  expect(container.querySelector('[class*="danger"]')).toBeNull();
});

test("a phase change while running shows a banner that clears after two seconds", () => {
  vi.useFakeTimers();
  const { container } = mount();
  publish(encounterView({ status: "running", phaseIndex: 0, phaseCount: 8 }));
  publish(encounterView({ status: "running", phaseIndex: 1, phaseCount: 8, phaseLabel: "Phase 2 - Color Chase" }));
  const banner = () => container.querySelector('[class*="phaseBanner"]');
  expect(banner()).toHaveTextContent("Phase 2 - Color Chase");
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(banner()).toBeNull();
});

test("a finished attempt shows the results and saves one history record", () => {
  const { onHistoryChange } = mount();
  const result = { attemptId: 4, rulesVersion: config.rulesVersion, elapsedSeconds: 33.5, hitsTaken: 6, outcome: "death" as const };
  act(() => options.onResult?.(result));
  act(() => options.onResult?.(result));
  expect(onHistoryChange).toHaveBeenCalledTimes(1);
  expect(onHistoryChange.mock.calls[0][0].records[0]).toMatchObject({
    elapsedSeconds: 33.5,
    hitsTaken: 6,
    outcome: "death",
  });
  publish(encounterView({ status: "ended", result, elapsedSeconds: 33.5, hitsTaken: 6 }));
  expect(screen.getByRole("heading", { name: "Attempt complete" })).toHaveFocus();
});

test("a debug attempt is never saved", () => {
  const { onHistoryChange } = mount();
  act(() =>
    options.onResult?.({ attemptId: 1, rulesVersion: DEBUG_RULES_VERSION, elapsedSeconds: 2, hitsTaken: 1, outcome: "death" }),
  );
  expect(onHistoryChange).not.toHaveBeenCalled();
});

test("Retry and Resume reach the handle, Home reaches the caller", async () => {
  const user = userEvent.setup();
  const { props } = mount();
  publish(encounterView({ status: "paused" }));
  await user.click(screen.getByRole("button", { name: "Resume" }));
  expect(handle.resume).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(handle.retry).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Home" }));
  expect(props.onHome).toHaveBeenCalledTimes(1);
});

test("Phases pauses and opens the selector, and closing it resumes", async () => {
  const user = userEvent.setup();
  mount();
  publish(encounterView({ status: "running", phaseCount: 8 }));
  await user.click(screen.getByRole("button", { name: "Phases" }));
  expect(handle.pause).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Phases" })).toHaveAttribute("aria-expanded", "true");
  await user.click(screen.getByRole("button", { name: "Phases" }));
  expect(handle.resume).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Phases" })).toHaveAttribute("aria-expanded", "false");
});

test("Controls opens the dialog and closing it tells the handle", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: "Controls" }));
  expect(handle.setControlsOpen).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("dialog", { name: "Controls" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(handle.setControlsOpen).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole("dialog", { name: "Controls" })).not.toBeInTheDocument();
});

test("a changed mute setting and debug settings reach the handle", () => {
  const { rerender, props } = mount();
  rerender(<EncounterScreen {...props} muted debugSettings={{ ...DEFAULT_DEBUG_SETTINGS }} />);
  expect(handle.setMuted).toHaveBeenLastCalledWith(true);
  expect(handle.setDebugSettings).toHaveBeenCalled();
});

test("a zoom change from the runtime is stored", () => {
  const { props, zoomSet } = mount();
  act(() => options.onZoomChange?.(1.5));
  expect(zoomSet).toHaveBeenCalledWith(1.5);
  expect(props.zoomPreference.current).toBe(1.5);
});

test("unmounting destroys the encounter and clears the shared handle", () => {
  const { unmount, props } = mount();
  unmount();
  expect(handle.destroy).toHaveBeenCalledTimes(1);
  expect(props.encounterHandle.current).toBeNull();
});

test("mounts when crypto.randomUUID is unavailable", () => {
  vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
  try {
    expect(() => mount()).not.toThrow();
  } finally {
    vi.unstubAllGlobals();
  }
});

function savedId(): string {
  const { onHistoryChange } = mount();
  act(() => options.onResult?.({ attemptId: 7, rulesVersion: config.rulesVersion, elapsedSeconds: 1, hitsTaken: 0, outcome: "death" }));
  return onHistoryChange.mock.calls[0][0].records[0].id;
}

test("falls back to a version 4 uuid built from getRandomValues", () => {
  vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
  try {
    expect(savedId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:7$/);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("uses crypto.randomUUID when it exists", () => {
  vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid", getRandomValues: crypto.getRandomValues.bind(crypto) });
  try {
    expect(savedId()).toBe("fixed-uuid:7");
  } finally {
    vi.unstubAllGlobals();
  }
});
