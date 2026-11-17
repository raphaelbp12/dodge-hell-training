import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ENCOUNTER_CONFIG, ENCOUNTER_LIST, encounterConfigOf } from "../game/config/encounter";
import type { AttemptRecord, HistorySnapshot } from "../storage/attempts";
import { History } from "./History";

const RULES_VERSION = ENCOUNTER_CONFIG.rulesVersion;

function record(id: string, elapsedSeconds: number, rulesVersion = RULES_VERSION): AttemptRecord {
  return { id, rulesVersion, elapsedSeconds, hitsTaken: 4, outcome: "death" };
}

const empty: HistorySnapshot = { records: [], warning: null };

test("an empty history shows no best, no attempts and no chart", () => {
  render(<History snapshot={empty} rulesVersion={RULES_VERSION} />);
  expect(screen.getByLabelText("Retained personal best")).toHaveTextContent("None");
  expect(screen.getByText("No completed attempts")).toBeInTheDocument();
  expect(screen.getByText("Recent attempts (0)")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("states how many attempts the store keeps", () => {
  render(<History snapshot={empty} rulesVersion={RULES_VERSION} />);
  expect(
    screen.getByText(new RegExp(`latest ${ENCOUNTER_CONFIG.session.historyLimit} attempts`)),
  ).toBeInTheDocument();
});

test("lists attempts newest first and reports the best for the selection", () => {
  const snapshot: HistorySnapshot = {
    records: [record("c", 12.5), record("b", 40), record("a", 30.25)],
    warning: null,
  };
  render(<History snapshot={snapshot} rulesVersion={RULES_VERSION} />);
  expect(screen.getByLabelText("Retained personal best")).toHaveTextContent("40.00 s");
  const list = screen.getByRole("list", { name: "Recent attempts" });
  const items = within(list).getAllByRole("listitem");
  expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
    "Completed attempt: 12.50 seconds, 4 hits",
    "Completed attempt: 40.00 seconds, 4 hits",
    "Completed attempt: 30.25 seconds, 4 hits",
  ]);
  expect(screen.getByText("Recent attempts (3)")).toBeInTheDocument();
});

test("draws a chart once two attempts share the selection", () => {
  const snapshot: HistorySnapshot = {
    records: [record("b", 20), record("a", 10)],
    warning: null,
  };
  render(<History snapshot={snapshot} rulesVersion={RULES_VERSION} />);
  expect(
    screen.getByRole("img", { name: "Survival time over your last 2 attempts on this selection" }),
  ).toBeInTheDocument();
});

test("labels each attempt by the selection it belongs to", () => {
  const other = ENCOUNTER_LIST.find((entry) => encounterConfigOf(entry.id).rulesVersion !== RULES_VERSION);
  if (!other) throw new Error("expected a second encounter");
  const otherVersion = encounterConfigOf(other.id).rulesVersion;
  const snapshot: HistorySnapshot = {
    records: [record("b", 20, otherVersion), record("a", 10)],
    warning: null,
  };
  render(<History snapshot={snapshot} rulesVersion={RULES_VERSION} />);
  expect(screen.getByText("This selection")).toBeInTheDocument();
  expect(screen.getByText(`${other.displayName}, full fight`)).toBeInTheDocument();
});

test("announces a storage warning", () => {
  render(
    <History
      snapshot={{ records: [], warning: "History could not be saved." }}
      rulesVersion={RULES_VERSION}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("History could not be saved.");
});
