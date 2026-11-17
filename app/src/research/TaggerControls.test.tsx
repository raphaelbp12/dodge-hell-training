import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Segmented, StepNav, type StepItem, type TaggerStep } from "./TaggerControls";

const steps: readonly StepItem[] = [
  { id: "setup", name: "Setup", status: "Video loaded", done: true },
  { id: "structure", name: "Structure", status: "3 boundaries" },
  { id: "attacks", name: "Attacks", status: "0 marks" },
  { id: "reconcile", name: "Reconcile", status: "Nothing to compare" },
];

test("lists every step with its status and marks the current one", () => {
  render(<StepNav steps={steps} current="structure" onChoose={vi.fn()} />);
  const nav = screen.getByRole("navigation", { name: "Steps" });
  const buttons = within(nav).getAllByRole("button");
  expect(buttons).toHaveLength(4);
  expect(buttons[1]).toHaveAttribute("aria-current", "step");
  expect(buttons[0]).not.toHaveAttribute("aria-current");
  expect(buttons[1]).toHaveTextContent("Structure3 boundaries");
});

test("a finished step shows a check, the others their number", () => {
  render(<StepNav steps={steps} current="setup" onChoose={vi.fn()} />);
  const buttons = screen.getAllByRole("button");
  expect(buttons[0]).toHaveTextContent("✓");
  expect(buttons[1]).toHaveTextContent("2");
});

test("choosing a step reports its id", async () => {
  const user = userEvent.setup();
  const onChoose = vi.fn<(step: TaggerStep) => void>();
  render(<StepNav steps={steps} current="setup" onChoose={onChoose} />);
  await user.click(screen.getByRole("button", { name: /Attacks/ }));
  expect(onChoose).toHaveBeenCalledWith("attacks");
});

const options = ["player", "fixed", "front"] as const;

test("a segmented control is a labelled radio group with the value checked", () => {
  render(<Segmented legend="Aim" name="aim" options={options} value="fixed" onChange={vi.fn()} />);
  const group = screen.getByRole("group", { name: "Aim" });
  expect(within(group).getAllByRole("radio")).toHaveLength(3);
  expect(within(group).getByRole("radio", { name: "fixed" })).toBeChecked();
  expect(within(group).getByRole("radio", { name: "player" })).not.toBeChecked();
});

test("choosing an option reports it", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Segmented legend="Aim" name="aim" options={options} value="player" onChange={onChange} />);
  await user.click(screen.getByRole("radio", { name: "front" }));
  expect(onChange).toHaveBeenCalledWith("front");
});

test("an option label can differ from its value and help sits in the legend", () => {
  render(
    <Segmented
      legend="Aim"
      name="aim"
      options={options}
      value="player"
      onChange={vi.fn()}
      label={(option) => option.toUpperCase()}
      help={<span>about aim</span>}
    />,
  );
  expect(screen.getByRole("radio", { name: "FRONT" })).toBeInTheDocument();
  expect(screen.getByText("about aim")).toBeInTheDocument();
});
