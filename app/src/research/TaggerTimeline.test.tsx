import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { TaggerTimeline } from "./TaggerTimeline";
import type { TimelineRow } from "./timelineModel";

const rows: readonly TimelineRow[] = [
  { id: "structure", label: "Structure", ticks: [], bars: [], labels: [] },
  { id: "scratch", label: "Scratch", ticks: [{ fraction: 0.5, style: "solid" }], bars: [], labels: [] },
];

const renderTimeline = (mediaTime = 50) =>
  render(
    <TaggerTimeline
      durationSeconds={100}
      mediaTime={mediaTime}
      rows={rows}
      selectedRowId={null}
      onSelectRow={vi.fn()}
      enabled
      onSeek={vi.fn()}
    />,
  );

test("the timeline zooms its time axis around the playhead and resets", async () => {
  const user = userEvent.setup();
  renderTimeline();
  const canvas = screen.getByLabelText("Timeline tracks");
  const heightBefore = canvas.getAttribute("height");
  expect(screen.getByRole("button", { name: "Reset zoom" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  expect(screen.getByText("Showing 0.000-100.000 s")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(screen.getByText("Showing 25.000-75.000 s")).toBeInTheDocument();
  expect(canvas.getAttribute("height")).toBe(heightBefore);
  await user.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(screen.getByText("Showing 37.500-62.500 s")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Zoom out" }));
  expect(screen.getByText("Showing 25.000-75.000 s")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Reset zoom" }));
  expect(screen.getByText("Showing 0.000-100.000 s")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset zoom" })).toBeDisabled();
});

test("the zoomed timeline follows the playhead out of its window", async () => {
  const user = userEvent.setup();
  const { rerender } = renderTimeline(50);
  await user.click(screen.getByRole("button", { name: "Zoom in" }));
  rerender(
    <TaggerTimeline
      durationSeconds={100}
      mediaTime={90}
      rows={rows}
      selectedRowId={null}
      onSelectRow={vi.fn()}
      enabled
      onSeek={vi.fn()}
    />,
  );
  expect(screen.getByText("Showing 50.000-100.000 s")).toBeInTheDocument();
});

test("zooming in stops at the minimum visible span", async () => {
  const user = userEvent.setup();
  renderTimeline();
  const zoomIn = screen.getByRole("button", { name: "Zoom in" });
  for (let step = 0; step < 10; step += 1) if (!zoomIn.hasAttribute("disabled")) await user.click(zoomIn);
  expect(zoomIn).toBeDisabled();
  expect(screen.getByText("Showing 49.500-50.500 s")).toBeInTheDocument();
});
