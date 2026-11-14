import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { StepGuidePanel } from "./StepGuidePanel";
import { STEP_GUIDES } from "./stepGuide";
import type { TaggerStep } from "./TaggerControls";

const STEPS: readonly TaggerStep[] = ["setup", "structure", "attacks", "reconcile"];

test("the step guide opens on its button and explains the selected step", async () => {
  render(<StepGuidePanel step="structure" />);
  const title = `How to: ${STEP_GUIDES.structure.name}`;
  expect(screen.queryByRole("dialog", { name: title })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Step guide" }));
  const dialog = screen.getByRole("dialog", { name: title });
  expect(within(dialog).getByText(STEP_GUIDES.structure.purpose)).toBeInTheDocument();
  expect(within(dialog).getAllByRole("listitem").length).toBeGreaterThanOrEqual(
    STEP_GUIDES.structure.actions.length,
  );
  await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog", { name: title })).toBeNull();
});

test("each step has its own guide: what it is for, what to do, and tips", () => {
  for (const step of STEPS) {
    const guide = STEP_GUIDES[step];
    expect(guide.purpose.trim().length, step).toBeGreaterThan(0);
    expect(guide.actions.length, step).toBeGreaterThan(0);
    for (const text of [guide.purpose, ...guide.actions, ...guide.tips])
      expect(text, step).not.toMatch(/rotmg|realmeye/i);
  }
  expect(new Set(STEPS.map((step) => STEP_GUIDES[step].purpose)).size).toBe(STEPS.length);
});

test("every step's guide renders in its dialog", async () => {
  for (const step of STEPS) {
    const { unmount } = render(<StepGuidePanel step={step} />);
    await userEvent.click(screen.getByRole("button", { name: "Step guide" }));
    const dialog = screen.getByRole("dialog", { name: `How to: ${STEP_GUIDES[step].name}` });
    for (const action of STEP_GUIDES[step].actions)
      expect(within(dialog).getByText(action)).toBeInTheDocument();
    unmount();
  }
});

test("the guides use none of the retired words (plan V20 E01)", () => {
  const text = JSON.stringify(STEP_GUIDES).toLowerCase();
  for (const word of ["block", "sticky", "anchor", "typed estimate"]) expect(text).not.toContain(word);
});
