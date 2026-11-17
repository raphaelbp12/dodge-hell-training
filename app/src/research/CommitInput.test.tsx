import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { CommitInput } from "./CommitInput";

function renderInput(props: Partial<Parameters<typeof CommitInput>[0]> = {}) {
  const onCommit = vi.fn<(text: string) => boolean>(() => true);
  render(<CommitInput value="2" label="Cooldown" onCommit={onCommit} {...props} />);
  return { onCommit, input: screen.getByRole("spinbutton", { name: "Cooldown" }) };
}

test("shows the current value in a number input named by its label", () => {
  const { input } = renderInput();
  expect(input).toHaveValue(2);
});

test("commits the typed text on blur", async () => {
  const user = userEvent.setup();
  const { onCommit, input } = renderInput();
  await user.clear(input);
  await user.type(input, "3.5");
  await user.tab();
  expect(onCommit).toHaveBeenCalledWith("3.5");
});

test("commits on Enter", async () => {
  const user = userEvent.setup();
  const { onCommit, input } = renderInput();
  await user.clear(input);
  await user.type(input, "4{Enter}");
  expect(onCommit).toHaveBeenCalledWith("4");
});

test("does not commit an unchanged value", async () => {
  const user = userEvent.setup();
  const { onCommit, input } = renderInput();
  await user.click(input);
  await user.tab();
  expect(onCommit).not.toHaveBeenCalled();
});

test("restores the previous text when the edit is refused", async () => {
  const user = userEvent.setup();
  const { input } = renderInput({ onCommit: () => false });
  await user.clear(input);
  await user.type(input, "9");
  await user.tab();
  expect(input).toHaveValue(2);
});

test("keeps a rejected blank from lingering when blank is not allowed", async () => {
  const user = userEvent.setup();
  const onCommit = vi.fn(() => false);
  render(<CommitInput value="" label="Optional" onCommit={onCommit} blankAllowed />);
  const input = screen.getByRole("spinbutton", { name: "Optional" });
  await user.click(input);
  await user.tab();
  expect(onCommit).not.toHaveBeenCalled();
});

test("a caption names the field visibly and a help node sits beside the caption", () => {
  render(
    <CommitInput value="1" label="Shot interval seconds" caption="Interval" help={<span>help</span>} onCommit={() => true} />,
  );
  expect(screen.getByText("Interval")).toBeInTheDocument();
  expect(screen.getByText("help")).toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: "Shot interval seconds" })).toBeInTheDocument();
});

test("the step is passed to the input", () => {
  const { input } = renderInput({ step: "0.05" });
  expect(input).toHaveAttribute("step", "0.05");
});
