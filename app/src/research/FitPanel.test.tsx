import { render, screen, within } from "@testing-library/react";
import { unsafeFixture } from "../test/fixture";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { AuthoredAttack } from "../game/config/data";
import { FitPanel } from "./FitPanel";
import type { AttackTrack, SegmentWindow } from "./study";

const track: AttackTrack = {
  id: "bee",
  location: { phaseId: "a", subPhaseId: null },
  attack: {
    id: "bee",
    projectile: "p",
    tuningSource: "trainer-authored",
    pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "player" },
    cadence: {
      shotsPerBurst: 1,
      shotIntervalSeconds: 0.1,
      cooldownAfterLastShotSeconds: 1,
      initialDelaySeconds: 0,
    },
  } as unknown as AuthoredAttack,
  cadenceSource: "authored",
  marks: [1, 1.2, 1.4, 3.4, 3.6, 3.8].map((timeSeconds) => ({ timeSeconds, kind: "volley" })),
};
const windows: SegmentWindow[] = [
  { segmentId: "a", startSeconds: 0, epochSeconds: 0, endSeconds: 100 },
];

const bombTrack = (target?: "player"): AttackTrack => ({
  ...track,
  attack: unsafeFixture<AuthoredAttack>({ ...track.attack, ...(target ? { target } : {}) }),
  marks: [
    { timeSeconds: 0, kind: "volley" },
    { timeSeconds: 1.5, kind: "detonation" },
    { timeSeconds: 3, kind: "volley" },
    { timeSeconds: 4.5, kind: "detonation" },
    { timeSeconds: 6, kind: "volley" },
  ],
  measuredRangeTiles: [4, null],
});
const bomb = { travelSeconds: 1, rangeTiles: 5 };

function renderBomb(target?: "player", scale: number | null = 0.1) {
  const callbacks = {
    onAccept: vi.fn(),
    onAcceptAll: vi.fn(),
    onSetThreshold: vi.fn(),
    onAcceptOverride: vi.fn(),
    onMeasurePair: vi.fn(),
  };
  render(
    <FitPanel
      track={bombTrack(target)}
      windows={windows}
      frameRate={30}
      bomb={bomb}
      tileWidthFraction={scale}
      {...callbacks}
    />,
  );
  return callbacks;
}

test("a bomb track shows the median flight time, its pairs and its unpaired throws", async () => {
  const callbacks = renderBomb();
  const row = screen.getByRole("row", { name: /Flight time/ });
  expect(row).toHaveTextContent("1.500 s");
  expect(row).toHaveTextContent("1.000 s");
  expect(screen.getByText(/2 pairs, 1 unpaired throw/)).toBeInTheDocument();
  await userEvent.click(within(row).getByRole("button", { name: /Accept flight time/ }));
  expect(callbacks.onAcceptOverride).toHaveBeenCalledWith({ travelSeconds: 1.5 });
});

test("a non-targeted bomb's range row accepts the median measured range", async () => {
  const callbacks = renderBomb();
  const row = screen.getByRole("row", { name: /^Range/ });
  expect(row).toHaveTextContent("4.000 tiles");
  await userEvent.click(within(row).getByRole("button", { name: /Accept range/ }));
  expect(callbacks.onAcceptOverride).toHaveBeenCalledWith({ rangeTiles: 4 });
  await userEvent.click(screen.getByRole("button", { name: "Measure pair 2" }));
  expect(callbacks.onMeasurePair).toHaveBeenCalledWith(1, { throwSeconds: 3, detonationSeconds: 4.5 });
});

test("a targeted bomb shows no Accept button on the Range row", () => {
  renderBomb("player");
  const row = screen.getByRole("row", { name: /^Range/ });
  expect(within(row).queryByRole("button", { name: /Accept/ })).toBeNull();
  expect(
    screen.getByText("A targeted bomb lands on the player, so its range is evidence only."),
  ).toBeInTheDocument();
});

test("without a scale the range row asks for a calibration", () => {
  renderBomb(undefined, null);
  expect(
    screen.getByText("Calibrate the scale in the Structure step to measure range."),
  ).toBeInTheDocument();
});

function renderPanel() {
  const callbacks = { onAccept: vi.fn(), onAcceptAll: vi.fn(), onSetThreshold: vi.fn() };
  render(<FitPanel track={track} windows={windows} frameRate={30} {...callbacks} />);
  return callbacks;
}

test("the fit shows three decimals and Accept calls back with the field and value", async () => {
  const callbacks = renderPanel();
  const row = screen.getByRole("row", { name: /Shot interval/ });
  expect(row).toHaveTextContent("0.200");
  expect(screen.getByRole("row", { name: /Cooldown/ })).toHaveTextContent("2.000");
  expect(screen.getByRole("row", { name: /Shots per burst/ })).toHaveTextContent("3");
  await userEvent.click(within(row).getByRole("button", { name: /Accept/ }));
  expect(callbacks.onAccept).toHaveBeenCalledWith("shotIntervalSeconds", expect.closeTo(0.2, 6));
});
