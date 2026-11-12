import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { HelpMark } from "./HelpMark";

test("a help mark shows ? with its text as title and accessible description (J12)", () => {
  render(<HelpMark text="Explains the control." />);
  const mark = screen.getByTitle("Explains the control.");
  expect(mark).toHaveTextContent("?");
  expect(mark).toHaveAccessibleDescription("Explains the control.");
});
