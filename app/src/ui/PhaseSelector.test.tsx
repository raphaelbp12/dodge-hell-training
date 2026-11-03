import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import type { DrillSelection } from "../game/models";
import { PhaseSelector, type PhaseOption } from "./PhaseSelector";

const phases: readonly PhaseOption[] = [
  { index: 0, id: "phase-1-honey-pond", label: "Phase 1 - Honey Pond" },
  { index: 1, id: "phase-2-color-chase", label: "Phase 2 - Color Chase" },
  { index: 2, id: "phase-3-pond-barrage", label: "Phase 3 - Pond Barrage" },
];

function Harness({
  mode = "home",
  initial = null,
  activePhaseIndex = 1,
  activePhaseLabel,
  onApply,
  onClose = vi.fn(),
}: {
  mode?: "home" | "live";
  initial?: DrillSelection | null;
  activePhaseIndex?: number;
  activePhaseLabel?: string;
  onApply?: () => void;
  onClose?: () => void;
}) {
  const [drill, setDrill] = useState<DrillSelection | null>(initial);
  return (
    <>
      <PhaseSelector
        mode={mode}
        phases={phases}
        drill={drill}
        activePhaseIndex={activePhaseIndex}
        activePhaseLabel={activePhaseLabel}
        onChange={setDrill}
        onApply={onApply}
        onClose={onClose}
      />
      <output aria-label="drill">{JSON.stringify(drill)}</output>
    </>
  );
}

test("Full fight is checked and Loop is disabled until a phase is selected", () => {
  render(<Harness />);
  expect(screen.getByRole("radio", { name: "Full fight" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Loop" })).toBeDisabled();
});

test("checking a phase switches to a custom selection and enables Loop", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    screen.getByRole("checkbox", { name: "Phase 2 - Color Chase" }),
  );
  expect(screen.getByRole("radio", { name: "Full fight" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Loop" })).toBeEnabled();
  expect(screen.getByRole("checkbox", { name: "Loop" })).toBeChecked();
  expect(screen.getByLabelText("drill")).toHaveTextContent(
    JSON.stringify({ phaseIndices: [1], loop: true }),
  );
});

test("choosing Full fight clears a custom selection", async () => {
  const user = userEvent.setup();
  render(<Harness initial={{ phaseIndices: [1, 2], loop: false }} />);
  await user.click(screen.getByRole("radio", { name: "Full fight" }));
  expect(screen.getByLabelText("drill")).toHaveTextContent("null");
  expect(screen.getByRole("checkbox", { name: "Loop" })).toBeDisabled();
});

test("unchecking the last phase returns to Full fight", async () => {
  const user = userEvent.setup();
  render(<Harness initial={{ phaseIndices: [1], loop: true }} />);
  await user.click(
    screen.getByRole("checkbox", { name: "Phase 2 - Color Chase" }),
  );
  expect(screen.getByRole("radio", { name: "Full fight" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Loop" })).toBeDisabled();
  expect(screen.getByLabelText("drill")).toHaveTextContent("null");
});

test("multi-select renders in authored order and stores a sorted unique set", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const phaseCheckboxes = screen.getAllByRole("checkbox", {
    name: /^Phase \d/,
  });
  expect(phaseCheckboxes.map((checkbox) => checkbox.getAttribute("value"))).toEqual(
    ["0", "1", "2"],
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Phase 3 - Pond Barrage" }),
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Phase 1 - Honey Pond" }),
  );
  expect(screen.getByLabelText("drill")).toHaveTextContent(
    JSON.stringify({ phaseIndices: [0, 2], loop: true }),
  );
});

test("Home mode has no Apply and calls onClose", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<Harness onClose={onClose} />);
  expect(
    screen.queryByRole("button", { name: "Apply" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledOnce();
});

test("Live mode shows the active row and calls onApply and onClose", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <Harness
      mode="live"
      initial={{ phaseIndices: [1], loop: true }}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  expect(screen.getByLabelText("Now playing")).toHaveTextContent(
    "Phase 2 - Color Chase",
  );
  await user.click(screen.getByRole("button", { name: "Apply" }));
  expect(onApply).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledOnce();
});

test("Live mode without onApply has no Apply action", () => {
  render(<Harness mode="live" />);
  expect(
    screen.queryByRole("button", { name: "Apply" }),
  ).not.toBeInTheDocument();
});

test("the live active label prop overrides the phase-list fallback", () => {
  render(
    <Harness
      mode="live"
      activePhaseIndex={1}
      activePhaseLabel="Phase 3 - Pond Barrage"
    />,
  );
  expect(screen.getByLabelText("Now playing")).toHaveTextContent(
    "Phase 3 - Pond Barrage",
  );
});

test("Live mode exposes Full fight, the phase checkboxes, Loop and Apply/Close", () => {
  render(<Harness mode="live" onApply={vi.fn()} />);
  expect(screen.getByRole("radio", { name: "Full fight" })).toBeVisible();
  expect(
    screen.getByRole("checkbox", { name: "Phase 2 - Color Chase" }),
  ).toBeVisible();
  expect(screen.getByRole("checkbox", { name: "Loop" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Apply" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
});

test("Escape closes the live panel and does not leak the key event", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const leaked = vi.fn();
  window.addEventListener("keydown", leaked);
  render(<Harness mode="live" onClose={onClose} />);

  await user.keyboard("{Escape}");

  window.removeEventListener("keydown", leaked);
  expect(onClose).toHaveBeenCalledOnce();
  expect(leaked).not.toHaveBeenCalled();
});
