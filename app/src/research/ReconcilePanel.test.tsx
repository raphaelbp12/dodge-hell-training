import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ReconcilePanel } from "./ReconcilePanel";
import type { Segment, StudyV6 } from "./study";

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

const study: StudyV6 = {
  schemaVersion: 6,
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
};

function renderPanel() {
  const onSeek = vi.fn();
  render(
    <ReconcilePanel
      study={study}
      segments={segments}
      warnings={[{ where: "structure", text: "Boundary at 12.500 s is odd." }]}
      fileText={{ ok: true, value: "{}\n" }}
      fileName="app/src/game/data/enemies/m.json"
      variants={[]}
      onSeek={onSeek}
      onExportStudy={vi.fn()}
    >
      <p>parity goes here</p>
    </ReconcilePanel>,
  );
  return { onSeek };
}

test("shows the measured telegraph export writes beside the authored one", () => {
  renderPanel();
  const row = screen.getByRole("row", { name: /Label a/ });
  expect(within(row).getByText("1.250 s")).toBeTruthy();
  expect(within(row).getByText("authored 2.000 s")).toBeTruthy();
});

test("an unmeasured value says export keeps the authored one", () => {
  renderPanel();
  const row = screen.getByRole("row", { name: /Label b\/x/ });
  expect(within(row).getAllByText("not measured").length).toBeGreaterThan(0);
  expect(within(row).getByText("export keeps 10.000 s")).toBeTruthy();
});

test("no Accept control remains (plan V23 Q17)", () => {
  renderPanel();
  expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Clear/ })).toBeNull();
});

test("renders its children, the parity panel", () => {
  renderPanel();
  expect(screen.getByText("parity goes here")).toBeTruthy();
});

test("a warning with a time seeks there", async () => {
  const { onSeek } = renderPanel();
  await userEvent.click(screen.getByRole("button", { name: /Boundary at 12.500 s/ }));
  expect(onSeek).toHaveBeenCalledWith(12.5);
});
