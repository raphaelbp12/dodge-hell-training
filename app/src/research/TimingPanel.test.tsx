import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { CadencedAuthoredAttack } from "../game/config/data";
import type { AttackTrack } from "./study";
import { TimingPanel } from "./TimingPanel";

const track = (overrides: Partial<AttackTrack> = {}): AttackTrack => ({
  id: "gun",
  location: { phaseId: "a", subPhaseId: null },
  attack: { id: "gun", projectile: "p" } as unknown as CadencedAuthoredAttack,
  marks: [],
  ...overrides,
});

function renderPanel(value: AttackTrack, bomb?: { travelSeconds: number; rangeTiles: number }) {
  const onSetPeriod = vi.fn(() => true);
  render(
    <TimingPanel track={value} bomb={bomb} tileWidthFraction={null} onSetPeriod={onSetPeriod} onMeasurePair={vi.fn()} />,
  );
  return onSetPeriod;
}

test("checking Periodic makes the track periodic; unchecking clears the period (plan V23 Q06)", async () => {
  const onSetPeriod = renderPanel(track());
  expect(screen.queryByRole("spinbutton", { name: /Period/ })).toBeNull();
  await userEvent.click(screen.getByRole("checkbox", { name: /Periodic/ }));
  expect(onSetPeriod).toHaveBeenCalledWith(1);
});

test("a periodic track shows its period and commits a typed one", () => {
  const onSetPeriod = renderPanel(track({ periodSeconds: 4 }));
  expect(screen.getByRole("checkbox", { name: /Periodic/ })).toBeChecked();
  const field = screen.getByRole("spinbutton", { name: "Period (seconds) of gun" });
  expect(field).toHaveValue(4);
  fireEvent.change(field, { target: { value: "2.5" } });
  fireEvent.blur(field);
  expect(onSetPeriod).toHaveBeenCalledWith(2.5);
  fireEvent.click(screen.getByRole("checkbox", { name: /Periodic/ }));
  expect(onSetPeriod).toHaveBeenCalledWith(undefined);
});

test("a bomb track shows its measured flight time and no Accept control (plan V23 Q14, Q17)", () => {
  renderPanel(
    track({
      marks: [
        { timeSeconds: 1, kind: "volley" },
        { timeSeconds: 1.75, kind: "detonation" },
      ],
    }),
    { travelSeconds: 1, rangeTiles: 6 },
  );
  expect(screen.getByRole("row", { name: "Flight time" })).toHaveTextContent("0.750 s");
  expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
});
