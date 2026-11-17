import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import {
  CONDITION_KEYS,
  CONDITION_LABELS,
  type VisibleCondition,
} from "../game/simulation/conditions";
import { ConditionList } from "./ConditionList";

const [firstKey, secondKey] = CONDITION_KEYS;

const active: VisibleCondition = { key: firstKey, remainingSeconds: 3.26, inert: false };
const inert: VisibleCondition = { key: secondKey, remainingSeconds: 0.5, inert: true };

test("renders nothing without conditions", () => {
  const { container } = render(<ConditionList conditions={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test("lists each condition with its remaining seconds to one decimal", () => {
  render(<ConditionList conditions={[active, inert]} />);
  const items = within(screen.getByRole("list", { name: "Active conditions" })).getAllByRole(
    "listitem",
  );
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent(`${CONDITION_LABELS[firstKey]}3.3 s`);
  expect(items[1]).toHaveTextContent(`${CONDITION_LABELS[secondKey]} (inert)0.5 s`);
});

test("marks an inert condition for styling and leaves an active one unmarked", () => {
  render(<ConditionList conditions={[active, inert]} />);
  const [first, second] = screen.getAllByRole("listitem");
  expect(first).not.toHaveAttribute("data-inert");
  expect(second).toHaveAttribute("data-inert", "true");
});

test("shows a consequence hint only when asked and only for a key that has one", () => {
  const paralyzed: VisibleCondition = { key: "paralyzed", remainingSeconds: 1, inert: false };
  const { rerender } = render(<ConditionList conditions={[paralyzed]} />);
  expect(screen.queryByText("Can't move")).not.toBeInTheDocument();
  rerender(<ConditionList conditions={[paralyzed]} showHints />);
  expect(screen.getByText("Can't move")).toBeInTheDocument();
});
