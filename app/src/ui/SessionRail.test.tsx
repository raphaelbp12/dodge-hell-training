import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PALADIN_STATS } from "../game/config/stats";
import { encounterView } from "../test/encounter-view";
import type { LadderPhase } from "./PhaseLadder";
import { SessionRail } from "./SessionRail";

const phases: readonly LadderPhase[] = [
  { index: 0, id: "phase-1-a", label: "Phase 1 - A", telegraphColor: "amber" },
  { index: 1, id: "phase-2-b", label: "Phase 2 - B", telegraphColor: "red" },
];

function renderRail(
  view = encounterView(),
  options: { phaseOpen?: boolean } = {},
) {
  const handlers = {
    onPhases: vi.fn(),
    onResume: vi.fn(),
    onRetry: vi.fn(),
    onHome: vi.fn(),
    onControls: vi.fn(),
  };
  render(
    <SessionRail
      view={view}
      displayName="Killer Bee Queen"
      phases={phases}
      phaseOpen={options.phaseOpen ?? false}
      phaseButton={createRef<HTMLButtonElement>()}
      {...handlers}
      sessionTools={<label>Mute <input type="checkbox" /></label>}
    />,
  );
  return handlers;
}

test("shows the encounter name, an active status and the session tools", () => {
  renderRail();
  expect(screen.getByRole("heading", { name: "Killer Bee Queen" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Session status" })).toHaveTextContent("Active");
  expect(screen.getByRole("checkbox")).toBeInTheDocument();
});

test.each([
  [{ status: "paused" as const }, "Paused"],
  [{ status: "countdown" as const }, "Starting"],
  [{ status: "ended" as const }, "Defeated"],
])("a %o session reads %s", (overrides, text) => {
  renderRail(encounterView(overrides));
  expect(screen.getByRole("status", { name: "Session status" })).toHaveTextContent(text);
});

test("a cleared attempt reads Boss defeated", () => {
  renderRail(
    encounterView({
      status: "ended",
      result: { attemptId: 1, rulesVersion: "x", elapsedSeconds: 3, hitsTaken: 0, outcome: "cleared" },
    }),
  );
  expect(screen.getByRole("status", { name: "Session status" })).toHaveTextContent("Boss defeated");
});

test("health, time, hits and stats come from the view and the paladin stats", () => {
  renderRail(encounterView({ healthHp: 400.2, elapsedSeconds: 12.34, hitsTaken: 5 }));
  expect(screen.getByRole("meter", { name: "Health" })).toHaveAttribute("max", String(PALADIN_STATS.healthHp));
  expect(screen.getByText(`401 / ${PALADIN_STATS.healthHp} HP`)).toBeInTheDocument();
  expect(screen.getByLabelText("Survival time")).toHaveTextContent("12.3 s");
  expect(screen.getByText("5 hits")).toBeInTheDocument();
  expect(within(screen.getByLabelText("Primary stats")).getAllByText(/VIT|SPD|DEF/)).toHaveLength(3);
});

test("the boss meter and phase ladder appear only for a boss with several phases", () => {
  renderRail(encounterView({ bossHealthFraction: 0.5, phaseCount: 2 }));
  expect(screen.getByRole("meter", { name: "Boss progress" })).toHaveValue(0.5);
  expect(screen.getByText("50%")).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Fight progress" })).toBeInTheDocument();
});

test("a single-phase, health-less encounter shows neither", () => {
  renderRail(encounterView({ bossHealthFraction: null, phaseCount: 1 }));
  expect(screen.queryByRole("meter", { name: "Boss progress" })).not.toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Fight progress" })).not.toBeInTheDocument();
});

test("a debug attempt is badged and the zoom is read out without trailing zeros", () => {
  renderRail(encounterView({ debug: true, zoom: 1.25 }));
  expect(screen.getByText("Debug attempt / not saved")).toBeInTheDocument();
  expect(screen.getByText(/Zoom 1\.25x/)).toBeInTheDocument();
});

test("active conditions are listed with hints", () => {
  renderRail(encounterView({ conditions: [{ key: "paralyzed", remainingSeconds: 2, inert: false }] }));
  expect(screen.getByRole("list", { name: "Active conditions" })).toBeInTheDocument();
  expect(screen.getByText("Can't move")).toBeInTheDocument();
});

test("the action buttons call their callbacks", async () => {
  const user = userEvent.setup();
  const handlers = renderRail(encounterView({ status: "paused" }));
  await user.click(screen.getByRole("button", { name: "Phases" }));
  await user.click(screen.getByRole("button", { name: "Resume" }));
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await user.click(screen.getByRole("button", { name: "Home" }));
  await user.click(screen.getByRole("button", { name: "Controls" }));
  for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1);
});

test("Resume is disabled unless paused", () => {
  renderRail(encounterView({ status: "running" }));
  expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
});

test("Phases reports whether its selector is open", () => {
  renderRail(encounterView(), { phaseOpen: true });
  expect(screen.getByRole("button", { name: "Phases" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Phases" })).toHaveAttribute("aria-controls", "phase-selector");
});

test("once an attempt has a result the action row is inert and hidden", () => {
  renderRail(
    encounterView({
      status: "ended",
      result: { attemptId: 1, rulesVersion: "x", elapsedSeconds: 3, hitsTaken: 0, outcome: "death" },
    }),
  );
  const actions = screen.getByText("Phases", { selector: "button" }).parentElement!;
  expect(actions).toHaveAttribute("aria-hidden", "true");
  expect(actions).toHaveAttribute("inert");
});
