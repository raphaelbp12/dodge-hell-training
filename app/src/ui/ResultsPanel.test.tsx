import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { DEBUG_RULES_VERSION } from "../game/config/debug";
import { ENCOUNTER_CONFIG } from "../game/config/encounter";
import type { AttemptRecord } from "../storage/attempts";
import { encounterView } from "../test/encounter-view";
import { ResultsPanel } from "./ResultsPanel";

const config = ENCOUNTER_CONFIG;

function record(id: string, elapsedSeconds: number): AttemptRecord {
  return { id, rulesVersion: config.rulesVersion, elapsedSeconds, hitsTaken: 2, outcome: "death" };
}

function renderPanel(options: {
  elapsedSeconds?: number;
  records?: AttemptRecord[];
  outcome?: "death" | "cleared";
  rulesVersion?: string;
  extra?: Parameters<typeof encounterView>[0];
}) {
  const onRetry = vi.fn();
  const onHome = vi.fn();
  const elapsedSeconds = options.elapsedSeconds ?? 30;
  render(
    <ResultsPanel
      view={encounterView({
        status: "ended",
        elapsedSeconds,
        hitsTaken: 7,
        result: {
          attemptId: 1,
          rulesVersion: options.rulesVersion ?? config.rulesVersion,
          elapsedSeconds,
          hitsTaken: 7,
          outcome: options.outcome ?? "death",
        },
        ...options.extra,
      })}
      config={config}
      displayName="Crystal Worm"
      historySnapshot={{ records: options.records ?? [], warning: null }}
      heading={createRef<HTMLHeadingElement>()}
      onRetry={onRetry}
      onHome={onHome}
    />,
  );
  return { onRetry, onHome };
}

test("shows the survival time, hits and a first-attempt note", () => {
  renderPanel({ elapsedSeconds: 41.256, records: [record("a", 41.256)] });
  expect(screen.getByRole("heading", { name: "Attempt complete" })).toBeInTheDocument();
  expect(screen.getByText("Survival time").nextElementSibling).toHaveTextContent("41.26 s");
  expect(screen.getByText("Hits taken").nextElementSibling).toHaveTextContent("7");
  expect(screen.getByText("First attempt on this selection")).toBeInTheDocument();
});

test("a cleared attempt says the boss was defeated", () => {
  renderPanel({ outcome: "cleared" });
  expect(screen.getByRole("heading", { name: "Boss defeated" })).toBeInTheDocument();
});

test("a longer survival than the retained best is a new best", () => {
  renderPanel({ elapsedSeconds: 50, records: [record("new", 50), record("old", 30)] });
  expect(screen.getByText("New best")).toBeInTheDocument();
});

test("a shorter survival says how far it fell short", () => {
  renderPanel({ elapsedSeconds: 20, records: [record("new", 20), record("old", 30)] });
  expect(screen.getByText("10.00 s short of your best")).toBeInTheDocument();
});

test("a debug attempt is marked and is not compared", () => {
  renderPanel({ rulesVersion: DEBUG_RULES_VERSION });
  expect(screen.getByText("Debug attempt / not saved")).toBeInTheDocument();
  expect(screen.queryByText("First attempt on this selection")).not.toBeInTheDocument();
});

test("a boss encounter shows the phase reached and the health left", () => {
  renderPanel({ extra: { bossHealthFraction: 0.426, phaseLabel: "Phase 3 - Pond Barrage" } });
  expect(screen.getByText("Phase 3 - Pond Barrage")).toBeInTheDocument();
  expect(screen.getByText("43% left")).toBeInTheDocument();
});

test("an encounter without boss health omits the boss rows", () => {
  renderPanel({});
  expect(screen.queryByText("Boss progress")).not.toBeInTheDocument();
});

test("lists the final hit amounts only when there are some", () => {
  renderPanel({ extra: { finalHitAmounts: [64, 128] } });
  const group = screen.getByRole("group", { name: "Final hit amounts" });
  expect(group).toHaveTextContent("-64");
  expect(group).toHaveTextContent("-128");
});

test("hides the final hit group when no hit landed", () => {
  renderPanel({ extra: { finalHitAmounts: [] } });
  expect(screen.queryByRole("group", { name: "Final hit amounts" })).not.toBeInTheDocument();
});

test("Retry and Home call their callbacks once", async () => {
  const user = userEvent.setup();
  const { onRetry, onHome } = renderPanel({});
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onHome).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Home" }));
  expect(onHome).toHaveBeenCalledTimes(1);
});
