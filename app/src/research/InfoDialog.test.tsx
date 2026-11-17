import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { InfoDialog } from "./InfoDialog";

beforeEach(() => {
  // jsdom implements neither `showModal` nor `close`; the component falls back to the `open` attribute.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { value: undefined, configurable: true });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { value: undefined, configurable: true });
});

function renderDialog() {
  render(
    <InfoDialog label="Glossary" title="Glossary of terms">
      <p>A volley is one burst of shots.</p>
    </InfoDialog>,
  );
}

test("shows only its button until it is opened", () => {
  renderDialog();
  expect(screen.getByRole("button", { name: "Glossary" })).toHaveAttribute("aria-haspopup", "dialog");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("opens a dialog named by its title with the children inside", async () => {
  const user = userEvent.setup();
  renderDialog();
  await user.click(screen.getByRole("button", { name: "Glossary" }));
  const dialog = screen.getByRole("dialog", { name: "Glossary of terms" });
  expect(dialog).toHaveAttribute("open");
  expect(dialog).toHaveTextContent("A volley is one burst of shots.");
});

test("Close removes the dialog", async () => {
  const user = userEvent.setup();
  renderDialog();
  await user.click(screen.getByRole("button", { name: "Glossary" }));
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("clicking the backdrop closes it, but clicking inside does not", async () => {
  const user = userEvent.setup();
  renderDialog();
  await user.click(screen.getByRole("button", { name: "Glossary" }));
  await user.click(screen.getByText("A volley is one burst of shots."));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("dialog"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
