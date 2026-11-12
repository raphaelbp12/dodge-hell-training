import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { GlossaryPanel } from "./GlossaryPanel";
import { GLOSSARY } from "./glossary";

test("the glossary opens on its button and defines telegraph", async () => {
  render(<GlossaryPanel />);
  expect(screen.queryByRole("dialog", { name: "Glossary" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Glossary" }));
  expect(screen.getByRole("dialog", { name: "Glossary" })).toBeInTheDocument();
  expect(screen.getByText("Telegraph")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog", { name: "Glossary" })).toBeNull();
});

test("every entry is a non-empty sentence with no fidelity claim", () => {
  for (const entry of GLOSSARY) {
    expect(entry.meaning.trim().length, entry.term).toBeGreaterThan(0);
    expect(entry.meaning, entry.term).not.toMatch(/rotmg|realmeye/i);
  }
  expect(new Set(GLOSSARY.map((entry) => entry.term)).size).toBe(GLOSSARY.length);
});
