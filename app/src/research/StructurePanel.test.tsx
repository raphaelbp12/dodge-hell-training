import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { segmentWindows, type Segment, type StudyV5 } from "./study";
import { StructurePanel } from "./StructurePanel";

const segment = (id: string): Segment => {
  const [phaseId, subPhaseId = null] = id.split("/");
  return {
    id,
    ref: { phaseId, subPhaseId },
    label: `Label ${id}`,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    durationSeconds: null,
  };
};
const segments = [segment("a"), segment("b/x"), segment("b/y")];

const study: StudyV5 = {
  schemaVersion: 5,
  encounterId: "e",
  archetypeId: "m",
  recordedAt: "2026-11-13T00:00:00.000Z",
  provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
  boundaries: [
    { timeSeconds: 10, segmentId: "a", telegraphEndSeconds: 11.5 },
    { timeSeconds: 40, segmentId: "b/x" },
  ],
  statusSpans: [{ kind: "invulnerable", inSeconds: 40, outSeconds: null }],
  tracks: [],
  scratch: [],
  acceptedSegmentValues: {},
};

function renderPanel() {
  const callbacks = {
    onSegmentStartsHere: vi.fn(),
    onTelegraphEndsHere: vi.fn(),
    onToggleInvulnerable: vi.fn(),
    onSetBoundarySegment: vi.fn(),
    onRemoveBoundary: vi.fn(),
    onRemoveSpan: vi.fn(),
    onSeek: vi.fn(),
  };
  render(
    <StructurePanel
      study={study}
      segments={segments}
      windows={segmentWindows(study.boundaries, segments, 100)}
      mediaTime={45}
      frameRate={30}
      hasVideo
      {...callbacks}
    />,
  );
  return callbacks;
}

test("each boundary's select offers every segment label", () => {
  renderPanel();
  const selects = screen.getAllByRole("combobox");
  expect(selects).toHaveLength(2);
  for (const select of selects)
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(
      segments.map((entry) => entry.label),
    );
});

test("rows show newest footage first and Remove calls back with the row's index", async () => {
  const callbacks = renderPanel();
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows[0]).toHaveTextContent("40.000");
  await userEvent.click(within(rows[0]).getByRole("button", { name: /Remove/ }));
  expect(callbacks.onRemoveBoundary).toHaveBeenCalledWith(1);
  expect(rows[1]).toHaveTextContent("1.500 s");
});

test("an open span turns the invulnerable button into its end", () => {
  renderPanel();
  expect(screen.getByRole("button", { name: /Invulnerable ends here/ })).toBeInTheDocument();
});
