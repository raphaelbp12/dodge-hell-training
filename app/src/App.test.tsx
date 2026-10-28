import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import { commitSha } from "virtual:build-info";
import type { EncounterView } from "./game/phaser/encounter";
import { RULES_VERSION } from "./game/config/encounter";
import {
  DEBUG_PARAMETERS,
  DEBUG_RULES_VERSION,
  SELECTED_DEBUG_VALUES,
} from "./game/config/debug";
import type { AttemptResult } from "./game/session/session";
import {
  ACTIVE_CONDITIONS,
  CONDITION_LABELS,
  INERT_CONDITIONS,
} from "./game/simulation/conditions";
import {
  HISTORY_STORAGE_KEY,
  HISTORY_SCHEMA_VERSION,
} from "./storage/attempts";
import styles from "./test/probe.module.css";

const adapter = vi.hoisted(() => ({
  active: 0,
  created: 0,
  destroyed: 0,
  publish: null as null | ((view: EncounterView) => void),
  onResult: null as null | ((result: AttemptResult) => void),
  resume: vi.fn(),
  retry: vi.fn(),
  setMuted: vi.fn(),
  setControlsOpen: vi.fn(),
  setDebugSettings: vi.fn(),
  initialMuted: false,
  initialZoom: undefined as number | undefined,
  onZoomChange: undefined as undefined | ((zoom: number) => void),
}));

vi.mock("./game/phaser/encounter", () => ({
  createEncounter: (
    host: HTMLElement,
    publish: (view: EncounterView) => void,
    options: {
      initialMuted?: boolean;
      initialZoom?: number;
      onZoomChange?: (zoom: number) => void;
      onResult?: (result: AttemptResult) => void;
    },
  ) => {
    adapter.initialZoom = options.initialZoom;
    adapter.initialMuted = options.initialMuted ?? false;
    adapter.onZoomChange = options.onZoomChange;
    adapter.publish = publish;
    adapter.onResult = options.onResult ?? null;
    adapter.created++;
    adapter.active++;
    const canvas = document.createElement("canvas");
    host.append(canvas);
    return {
      resume: adapter.resume,
      retry: adapter.retry,
      setMuted: adapter.setMuted,
      setControlsOpen: adapter.setControlsOpen,
      setDebugSettings: adapter.setDebugSettings,
      destroy: () => {
        adapter.active--;
        adapter.destroyed++;
        canvas.remove();
      },
    };
  },
}));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  adapter.active = 0;
  adapter.created = 0;
  adapter.destroyed = 0;
  adapter.publish = null;
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

test("debug panel exposes every parameter and sends live flags/sliders without recreating the runtime", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Debug" }));
  for (const parameter of DEBUG_PARAMETERS)
    expect(screen.getByRole("slider", { name: parameter.label })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("checkbox", { name: "God mode" }));
  await user.click(
    screen.getByRole("checkbox", { name: "Chase arena center" }),
  );
  fireEvent.change(screen.getByRole("slider", { name: "Projectile speed" }), {
    target: { value: "12" },
  });
  expect(adapter.setDebugSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({
      godMode: true,
      chaseArenaCenter: true,
      projectileSpeedTilesPerSecond: 12,
    }),
  );
  expect(adapter.created).toBe(1);
  await user.click(
    screen.getByRole("button", { name: "Load selected values" }),
  );
  expect(
    screen.getByRole("checkbox", { name: "Match player to head" }),
  ).toBeChecked();
  for (const [key, value] of Object.entries(SELECTED_DEBUG_VALUES)) {
    const parameter = DEBUG_PARAMETERS.find(
      (parameter) => parameter.key === key,
    )!;
    expect(screen.getByRole("slider", { name: parameter.label })).toHaveValue(
      String(value),
    );
  }
  expect(adapter.setDebugSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ...SELECTED_DEBUG_VALUES,
      godMode: true,
      chaseArenaCenter: true,
      matchPlayerToHead: true,
    }),
  );
  expect(adapter.created).toBe(1);
  await user.click(
    screen.getByRole("checkbox", { name: "Match player to head" }),
  );
  expect(adapter.setDebugSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({ matchPlayerToHead: false }),
  );
  await user.click(screen.getByRole("button", { name: "Reset defaults" }));
  expect(adapter.setDebugSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({
      godMode: false,
      chaseArenaCenter: false,
      projectileSpeedTilesPerSecond: 8,
    }),
  );
});

test("debug deaths never write normal attempt history", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  act(() =>
    adapter.onResult!({
      attemptId: 1,
      rulesVersion: DEBUG_RULES_VERSION,
      elapsedSeconds: 10,
      hitsTaken: 7,
      outcome: "death",
    }),
  );
  expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
});

test("Home Controls is labeled, lists actual bindings, closes and restores its opener without launching", async () => {
  const user = userEvent.setup();
  render(<App />);
  const controls = screen.getByRole("button", { name: "Controls" });
  await user.click(controls);
  const dialog = screen.getByRole("dialog", { name: "Controls" });
  for (const binding of ["WASD", "R", "O / P", "Escape", "Mute", "Resume"])
    expect(within(dialog).getByText(binding, { exact: true })).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(controls).toHaveFocus();
  expect(adapter.created).toBe(0);
});

test("Controls dialog lists all thirteen conditions and marks the six inert ones", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Controls" }));
  const dialog = screen.getByRole("dialog", { name: "Controls" });
  for (const key of ACTIVE_CONDITIONS)
    expect(
      within(dialog).getByText(CONDITION_LABELS[key], { exact: true }),
    ).toBeVisible();
  for (const key of INERT_CONDITIONS)
    expect(
      within(dialog).getByText(`${CONDITION_LABELS[key]} (inert)`, {
        exact: true,
      }),
    ).toBeVisible();
});

test("HUD Controls uses runtime modal isolation and never resumes on close", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  act(() => adapter.publish!(runningView));
  await user.click(screen.getByRole("button", { name: "Controls" }));
  expect(adapter.setControlsOpen).toHaveBeenLastCalledWith(true);
  act(() => adapter.publish!({ ...runningView, status: "paused" }));
  expect(screen.getByLabelText("Paused overlay")).toHaveTextContent("Paused");
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
  );
  expect(adapter.setControlsOpen).toHaveBeenLastCalledWith(false);
  expect(adapter.resume).not.toHaveBeenCalled();
  expect(adapter.created).toBe(1);
  await user.click(screen.getByRole("button", { name: "Resume" }));
  expect(adapter.resume).toHaveBeenCalledOnce();
});

test("launches and unmounts one effective runtime under Strict Mode", async () => {
  const user = userEvent.setup();
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  expect(
    screen.getByRole("heading", { name: "Crystal Worm Child", level: 1 }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Start" }));
  expect(adapter.created).toBe(2);
  expect(adapter.destroyed).toBe(1);
  expect(adapter.active).toBe(1);
  expect(view.container.querySelectorAll("canvas")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Home" }));
  expect(adapter.active).toBe(0);
  expect(view.container.querySelectorAll("canvas")).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Start" }));
  expect(adapter.active).toBe(1);
  view.unmount();
  expect(adapter.active).toBe(0);
});

const runningView: EncounterView = {
  healthHp: 646.2,
  elapsedSeconds: 12.25,
  hitsTaken: 1,
  status: "running",
  countdownRemainingSeconds: 0,
  zoom: 1,
  result: null,
};

test("restores zoom before runtime creation and persists only explicit camera changes", async () => {
  localStorage.setItem("dodge-hell-training.zoom", "2.375");
  const writes = vi.spyOn(Storage.prototype, "setItem");
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  expect(adapter.initialZoom).toBe(2.375);
  act(() => adapter.publish!({ ...runningView, zoom: 2.375 }));
  expect(writes).not.toHaveBeenCalled();
  act(() => adapter.onZoomChange?.(2.5));
  expect(writes).toHaveBeenCalledExactlyOnceWith(
    "dodge-hell-training.zoom",
    "2.5",
  );
  act(() => adapter.onZoomChange?.(2.5));
  expect(writes).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Home" }));
  await user.click(screen.getByRole("button", { name: "Start" }));
  expect(adapter.initialZoom).toBe(2.5);
  expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
});

test("Home includes description, accurate changelog, and delegated links", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
  expect(screen.getByText(/Survive the returning shards/)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Changelog" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Enemy reference" })).toHaveAttribute(
    "href",
    "https://www.realmeye.com/wiki/crystal-worm-child",
  );
  expect(
    screen.getByRole("link", { name: "Realm of the Mad God" }),
  ).toHaveAttribute("href", "https://www.realmofthemadgod.com/");
  expect(screen.getByRole("link", { name: "Source code" })).toHaveAttribute(
    "href",
    "https://github.com/raphaelbp12/dodge-hell-training",
  );
  expect(screen.getByLabelText("Retained personal best")).toHaveTextContent(
    "None",
  );
});

test("visible mute is visit-local, survives Home and updates audio without recreating play", async () => {
  const user = userEvent.setup();
  render(<App />);
  const mute = screen.getByRole("checkbox", { name: "Mute hit audio" });
  expect(mute).not.toBeChecked();
  await user.click(mute);
  await user.click(screen.getByRole("button", { name: "Start" }));
  expect(adapter.initialMuted).toBe(true);
  await user.click(mute);
  expect(adapter.setMuted).toHaveBeenLastCalledWith(false);
  expect(adapter.created).toBe(1);
  await user.click(screen.getByRole("button", { name: "Home" }));
  expect(mute).not.toBeChecked();
  expect(localStorage.getItem("dodge-hell-training.mute")).toBeNull();
});

test("HUD reads snapshots and results Retry keeps the runtime while Home cleans up", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  expect(
    screen.getByRole("status", { name: "Session status" }),
  ).toHaveTextContent("Starting");
  expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
  act(() => adapter.publish!(runningView));
  expect(screen.getByRole("meter", { name: "Health" })).toHaveAttribute(
    "value",
    "646.2",
  );
  expect(screen.getByText("647 / 775 HP")).toBeVisible();
  expect(screen.getByLabelText("Survival time")).toHaveTextContent("12.3 s");
  expect(screen.getByLabelText("Primary stats")).toHaveTextContent("42 VIT");
  expect(screen.getByLabelText("Primary stats")).toHaveTextContent("41 SPD");
  expect(screen.getByLabelText("Primary stats")).toHaveTextContent("32 DEF");
  expect(screen.getByLabelText("Survival time")).toHaveAttribute(
    "aria-live",
    "off",
  );
  act(() =>
    adapter.publish!({
      ...runningView,
      healthHp: 0,
      status: "ended",
      result: {
        attemptId: 1,
        rulesVersion: RULES_VERSION,
        elapsedSeconds: 12.25,
        hitsTaken: 7,
        outcome: "death",
      },
    }),
  );
  const results = screen.getByRole("region", { name: "Attempt complete" });
  expect(within(results).getByText("12.25 s")).toBeVisible();
  expect(within(results).getByText("7")).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Attempt complete" }),
  ).toHaveFocus();
  await user.click(within(results).getByRole("button", { name: "Retry" }));
  expect(adapter.retry).toHaveBeenCalledOnce();
  expect(adapter.active).toBe(1);
  act(() =>
    adapter.publish!({
      ...runningView,
      healthHp: 775,
      elapsedSeconds: 0,
      hitsTaken: 0,
    }),
  );
  expect(
    screen.queryByRole("region", { name: "Attempt complete" }),
  ).not.toBeInTheDocument();
  expect(view.container.querySelectorAll("canvas")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Home" }));
  expect(adapter.active).toBe(0);
  expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
});

test("paused state enables Resume without owning a second session clock", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  act(() => adapter.publish!({ ...runningView, status: "paused" }));
  expect(
    screen.getByRole("status", { name: "Session status" }),
  ).toHaveTextContent("Paused");
  await user.click(screen.getByRole("button", { name: "Resume" }));
  expect(adapter.resume).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("Survival time")).toHaveTextContent("12.3 s");
});

test("Home from results discards the view and ignores a disposed runtime publication", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  const oldPublish = adapter.publish!;
  act(() =>
    oldPublish({
      ...runningView,
      healthHp: 0,
      status: "ended",
      result: {
        attemptId: 1,
        rulesVersion: RULES_VERSION,
        elapsedSeconds: 12.25,
        hitsTaken: 7,
        outcome: "death",
      },
    }),
  );
  const results = screen.getByRole("region", { name: "Attempt complete" });
  await user.click(within(results).getByRole("button", { name: "Home" }));
  expect(adapter.active).toBe(0);
  expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
  act(() => oldPublish(runningView));
  expect(
    screen.queryByRole("region", { name: "Attempt complete" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Start" }));
  expect(screen.getByLabelText("Survival time")).toHaveTextContent("0.0 s");
  expect(
    screen.getByRole("status", { name: "Session status" }),
  ).toHaveTextContent("Starting");
});

const completedResult: AttemptResult = {
  attemptId: 1,
  rulesVersion: RULES_VERSION,
  elapsedSeconds: 12.25,
  hitsTaken: 7,
  outcome: "death",
};

test("lethal feedback remains individually observable in immediate results", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  act(() =>
    adapter.publish!({
      ...runningView,
      status: "ended",
      healthHp: 0,
      result: completedResult,
      finalHitAmounts: [128, 128],
    }),
  );
  expect(
    within(
      screen.getByRole("group", { name: "Final hit amounts" }),
    ).getAllByText("-128"),
  ).toHaveLength(2);
});

test("completed attempts save once despite duplicate callbacks, survive remount, and exclude aborted retries", async () => {
  const user = userEvent.setup();
  const mounted = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  act(() => {
    adapter.publish!({
      ...runningView,
      status: "ended",
      healthHp: 0,
      result: completedResult,
    });
    adapter.onResult!(completedResult);
    adapter.onResult!({ ...completedResult });
  });
  expect(screen.getByLabelText("Retained personal best")).toHaveTextContent(
    "12.25 s",
  );
  expect(
    screen.getAllByRole("listitem", { name: /completed attempt/i }),
  ).toHaveLength(1);
  expect(
    JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY)!).records,
  ).toHaveLength(1);
  await user.click(
    screen
      .getByRole("region", { name: "Attempt complete" })
      .querySelector<HTMLButtonElement>("button")!,
  );
  const staleResultCallback = adapter.onResult!;
  mounted.unmount();
  act(() => staleResultCallback({ ...completedResult, attemptId: 2 }));
  render(<App />);
  expect(screen.getByLabelText("Retained personal best")).toHaveTextContent(
    "12.25 s",
  );
  await user.click(screen.getByRole("button", { name: "Start" }));
  act(() => {
    adapter.publish!({
      ...runningView,
      status: "ended",
      healthHp: 0,
      result: completedResult,
    });
    adapter.onResult!(completedResult);
  });
  expect(
    JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY)!).records,
  ).toHaveLength(2);
});

test("personal best excludes incompatible rules while recent attempts identify them", () => {
  localStorage.setItem(
    HISTORY_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: HISTORY_SCHEMA_VERSION,
      records: [
        {
          id: "older-rules",
          rulesVersion: "crystal-worm-child-head-paladin-v1",
          elapsedSeconds: 999,
          hitsTaken: 1,
          outcome: "death",
        },
        {
          id: "same-rules",
          rulesVersion: RULES_VERSION,
          elapsedSeconds: 20,
          hitsTaken: 9,
          outcome: "death",
        },
      ],
    }),
  );
  render(<App />);
  expect(screen.getByLabelText("Retained personal best")).toHaveTextContent(
    "20.00 s",
  );
  expect(screen.getByText("Other rules")).toBeVisible();
  expect(screen.getByText("999.00 s")).toBeVisible();
});

test.each(["corrupt", "blocked", "quota"])(
  "%s storage leaves Start, results Retry and Home usable",
  async (failure) => {
    if (failure === "corrupt") localStorage.setItem(HISTORY_STORAGE_KEY, "{");
    if (failure === "blocked")
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
    if (failure === "quota")
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Start" }));
    act(() => {
      adapter.publish!({
        ...runningView,
        status: "ended",
        healthHp: 0,
        result: completedResult,
      });
      adapter.onResult!(completedResult);
    });
    expect(
      screen.getByText(/Results are kept for this visit only/),
    ).toBeVisible();
    const results = screen.getByRole("region", { name: "Attempt complete" });
    await user.click(within(results).getByRole("button", { name: "Retry" }));
    expect(adapter.retry).toHaveBeenCalledOnce();
    await user.click(within(results).getByRole("button", { name: "Home" }));
    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
    expect(screen.getByLabelText("Retained personal best")).toHaveTextContent(
      "12.25 s",
    );
  },
);

test("loads scoped CSS Module styles", () => {
  render(<span className={styles.probe}>CSS Module probe</span>);

  const probe = screen.getByText("CSS Module probe");
  expect(styles.probe).not.toBe("probe");
  expect(probe).toHaveClass(styles.probe);
  expect(probe).toHaveStyle({ color: "rgb(20, 90, 70)" });
});

test("the footer identifies the deployed build by commit", () => {
  render(<App />);
  const sha = commitSha;
  if (/^[0-9a-f]{7,40}$/.test(sha)) {
    const short = sha.slice(0, 7);
    const link = screen.getByRole("link", { name: short });
    expect(link).toHaveAttribute(
      "href",
      `https://github.com/raphaelbp12/dodge-hell-training/commit/${sha}`,
    );
    // The short form is shown, not the full forty characters.
    expect(link).toHaveTextContent(new RegExp(`^${short}$`));
    expect(screen.getByText(/Deployed build/)).toBeVisible();
  } else {
    // An unidentified build says so rather than inventing an identity.
    expect(screen.getByText("Local build")).toBeVisible();
  }
});
