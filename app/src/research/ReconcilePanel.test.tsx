import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ReconcilePanel } from "./ReconcilePanel";
import type { Segment, StudyV5 } from "./study";

const segment = (id: string, durationSeconds: number | null): Segment => {
  const [phaseId, subPhaseId = null] = id.split("/");
  return {
    id,
    ref: { phaseId, subPhaseId },
    label: `Label ${id}`,
    telegraphSeconds: 2,
    invulnerableOnEnterSeconds: 0,
    durationSeconds,
  };
};
const segments = [segment("a", null), segment("b/x", 10)];

const study: StudyV5 = {
  schemaVersion: 5,
  encounterId: "e",
  archetypeId: "m",
  recordedAt: "2026-11-13T00:00:00.000Z",
  provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
  boundaries: [
    { timeSeconds: 10, segmentId: "a", telegraphEndSeconds: 11.25 },
    { timeSeconds: 40, segmentId: "b/x" },
  ],
  statusSpans: [],
  tracks: [],
  scratch: [],
  acceptedSegmentValues: {},
};

function renderPanel() {
  const onAccept = vi.fn();
  const onSeek = vi.fn();
  render(
    <ReconcilePanel
      study={study}
      segments={segments}
      videoEndSeconds={100}
      frameSeconds={1 / 30}
      warnings={[{ where: "structure", text: "Boundary at 12.500 s is odd." }]}
      fileText={{ ok: true, value: "{}\n" }}
      fileName="app/src/game/data/enemies/m.json"
      variants={[]}
      onAccept={onAccept}
      onSeek={onSeek}
      onExportStudy={vi.fn()}
    />,
  );
  return { onAccept, onSeek };
}

test("shows the measured telegraph and accepts it", async () => {
  const { onAccept } = renderPanel();
  const row = screen.getByRole("row", { name: /Label a/ });
  expect(within(row).getByText("1.250 s")).toBeTruthy();
  await userEvent.click(within(row).getByRole("button", { name: "Accept telegraph for Label a" }));
  expect(onAccept).toHaveBeenCalledWith("a", "telegraphSeconds", 1.25);
});

test("a phase-level segment offers no duration Accept; a sub-phase does", () => {
  renderPanel();
  expect(screen.queryByRole("button", { name: "Accept duration for Label a" })).toBeNull();
  expect(screen.getByRole("button", { name: "Accept duration for Label b/x" })).toBeTruthy();
});

test("a warning with a time seeks there", async () => {
  const { onSeek } = renderPanel();
  await userEvent.click(screen.getByRole("button", { name: /Boundary at 12.500 s/ }));
  expect(onSeek).toHaveBeenCalledWith(12.5);
});
