import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, expect, test, vi } from "vitest";
import { CONDITION_KEYS, CONDITION_LABELS, INERT_CONDITIONS } from "../game/simulation/conditions";
import { ControlsDialog } from "./ControlsDialog";

beforeAll(() => {
  // jsdom implements neither `showModal` nor `close`.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

test("opens as a modal dialog titled Controls and lists the keys", () => {
  render(<ControlsDialog onClose={vi.fn()} />);
  const dialog = screen.getByRole("dialog", { name: "Controls" });
  expect(dialog).toHaveAttribute("open");
  expect(screen.getByText("WASD")).toBeInTheDocument();
  expect(screen.getByText("Immediate retry")).toBeInTheDocument();
});

test("describes every status effect, marking inert ones", () => {
  render(<ControlsDialog onClose={vi.fn()} />);
  for (const key of CONDITION_KEYS) {
    const inert = (INERT_CONDITIONS as readonly string[]).includes(key);
    expect(
      screen.getByText(inert ? `${CONDITION_LABELS[key]} (inert)` : CONDITION_LABELS[key]),
    ).toBeInTheDocument();
  }
});

test("Close calls onClose", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<ControlsDialog onClose={onClose} />);
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Escape asks to close instead of dismissing natively", () => {
  const onClose = vi.fn();
  render(<ControlsDialog onClose={onClose} />);
  const dialog = screen.getByRole("dialog", { name: "Controls" });
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Tab keeps focus on the Close button", async () => {
  const user = userEvent.setup();
  render(<ControlsDialog onClose={vi.fn()} />);
  const close = screen.getByRole("button", { name: "Close" });
  await user.tab();
  expect(close).toHaveFocus();
});

test("unmounting closes the dialog", () => {
  const { unmount } = render(<ControlsDialog onClose={vi.fn()} />);
  const dialog = screen.getByRole("dialog", { name: "Controls" });
  unmount();
  expect(dialog).not.toHaveAttribute("open");
});
