import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { encounterConfigOf } from "../game/config/encounter";
import type { AuthoredAttack } from "../game/config/data";
import type { AttackTrack, Segment, StudyV5 } from "./study";
import { TrackPanel } from "./TrackPanel";

const config = encounterConfigOf("killer-bee-queen");
const projectile = Object.keys(config.projectiles)[0];

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
const segments = [segment("a"), segment("b/x")];

const track = (id: string, marks: AttackTrack["marks"] = []): AttackTrack => ({
  id,
  location: { phaseId: "a", subPhaseId: null },
  attack: {
    id,
    projectile,
    tuningSource: "trainer-authored",
    pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "player", emitterRadiusTiles: 0 },
    cadence: {
      shotsPerBurst: 1,
      shotIntervalSeconds: 0.1,
      cooldownAfterLastShotSeconds: 1,
      initialDelaySeconds: 0,
    },
  } as unknown as AuthoredAttack,
  cadenceSource: "authored",
  marks,
});

const study: StudyV5 = {
  schemaVersion: 5,
  encounterId: "killer-bee-queen",
  archetypeId: "killer-bee-queen",
  recordedAt: "2026-11-13T00:00:00.000Z",
  provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
  boundaries: [],
  statusSpans: [],
  tracks: [
    track("first"),
    track("second", [
      { timeSeconds: 5, kind: "volley" },
      { timeSeconds: 2, kind: "volley" },
    ]),
    track("third"),
  ],
  scratch: [{ timeSeconds: 7, kind: "volley" }],
  acceptedSegmentValues: {},
};

function renderPanel(selectedTrackId: string | null = "second") {
  const callbacks = {
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onReload: vi.fn(),
    onEditAttack: vi.fn(() => true),
    onSetLocation: vi.fn(),
    onSeek: vi.fn(),
    onRemoveMark: vi.fn(),
    onCreateFromScratch: vi.fn(),
  };
  render(
    <TrackPanel
      study={study}
      segments={segments}
      config={config}
      selectedTrackId={selectedTrackId}
      {...callbacks}
    />,
  );
  return callbacks;
}

test("tracks are numbered from 1 and a click selects a row", async () => {
  const callbacks = renderPanel();
  const list = screen.getByRole("list", { name: "Attack tracks" });
  const rows = within(list).getAllByRole("button");
  expect(rows.map((row) => row.textContent?.slice(0, 1))).toEqual(["1", "2", "3"]);
  expect(rows[1]).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(rows[2]);
  expect(callbacks.onSelect).toHaveBeenCalledWith("third");
});

test("Delete asks for a second click", async () => {
  const callbacks = renderPanel();
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(callbacks.onDelete).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
});

test("the marks table lists the selected track's marks in time order", () => {
  renderPanel();
  const table = screen.getByRole("table", { name: "Marks of second" });
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows[0]).toHaveTextContent("2.000");
  expect(rows[1]).toHaveTextContent("5.000");
});

test("Create attack from selected marks is disabled with nothing checked", async () => {
  renderPanel(null);
  const create = screen.getByRole("button", { name: "Create attack from selected marks" });
  expect(create).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox", { name: /7.000/ }));
  expect(create).toBeEnabled();
});
