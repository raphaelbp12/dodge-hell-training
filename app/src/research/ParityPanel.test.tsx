import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ParityPanel } from "./ParityPanel";
import type { ParityReport } from "./parity";

const report: ParityReport = {
  tracks: [
    { trackId: "gun", segmentId: "p6", matches: true, firstMismatchSeconds: null },
    { trackId: "spiral", segmentId: "p6", matches: false, firstMismatchSeconds: 15.5 },
  ],
  dropped: [{ trackId: "old", segmentId: "p6" }],
  valueChanges: [{ segmentId: "p6", field: "telegraphSeconds", shipped: 2, exported: 4.067 }],
  laterWindows: [{ trackId: "gun", windowStartSeconds: 60, firstDifferenceSeconds: 64.5 }],
};

test("renders the four lists, and a time seeks there", async () => {
  const onSeek = vi.fn();
  render(<ParityPanel report={report} onSeek={onSeek} />);
  const tracks = screen.getByRole("list", { name: "Track parity" });
  expect(within(tracks).getByText(/p6 gun: matches/)).toBeTruthy();
  expect(within(screen.getByRole("list", { name: "Dropped tracks" })).getByText(/p6 old/)).toBeTruthy();
  expect(
    within(screen.getByRole("list", { name: "Changed segment values" })).getByText(/p6 telegraph: 2.000 s to 4.067 s/),
  ).toBeTruthy();
  expect(within(screen.getByRole("list", { name: "Later windows that differ" })).getByText(/gun in the window from 60.000 s/)).toBeTruthy();
  await userEvent.click(within(tracks).getByRole("button", { name: "15.500 s" }));
  expect(onSeek).toHaveBeenCalledWith(15.5);
});

test("renders each empty state", () => {
  render(<ParityPanel report={{ tracks: [], dropped: [], valueChanges: [], laterWindows: [] }} onSeek={vi.fn()} />);
  expect(screen.getByText("No track is exported yet.")).toBeTruthy();
  expect(screen.getByText("No track is dropped.")).toBeTruthy();
  expect(screen.getByText("No segment value changes.")).toBeTruthy();
  expect(screen.getByText("Every later window matches its first window.")).toBeTruthy();
});

test("an export error shows no report and never a block", () => {
  render(<ParityPanel report={null} onSeek={vi.fn()} />);
  expect(screen.getByText(/cannot be checked/)).toBeTruthy();
});
