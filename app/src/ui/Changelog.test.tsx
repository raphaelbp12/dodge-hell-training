import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Changelog } from "./Changelog";

function dates(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll("time")).map((time) => time.getAttribute("datetime")!);
}

test("shows the latest change under a Changelog heading", () => {
  render(<Changelog />);
  const section = screen.getByRole("region", { name: "Changelog" });
  expect(within(section).getByRole("heading", { name: "Changelog" })).toBeInTheDocument();
  const latest = section.querySelector(":scope > time")!;
  expect(latest.getAttribute("datetime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(latest.nextElementSibling?.tagName).toBe("UL");
});

test("keeps earlier changes inside a collapsed disclosure", async () => {
  const user = userEvent.setup();
  render(<Changelog />);
  const details = screen.getByText("Earlier changes").closest("details")!;
  expect(details).not.toHaveAttribute("open");
  await user.click(screen.getByText("Earlier changes"));
  expect(details).toHaveAttribute("open");
  expect(within(details).getAllByRole("listitem").length).toBeGreaterThan(0);
});

test("lists entries newest first, each date once, each with at least one item", () => {
  render(<Changelog />);
  const section = screen.getByRole("region", { name: "Changelog" });
  const all = dates(section);
  expect(all).toEqual([...all].sort().reverse());
  expect(new Set(all).size).toBe(all.length);
  for (const list of section.querySelectorAll("ul"))
    expect(list.querySelectorAll("li").length).toBeGreaterThan(0);
});

test("a time element carries a readable label for its machine date", () => {
  render(<Changelog />);
  const time = screen.getByRole("region", { name: "Changelog" }).querySelector("time")!;
  expect(time.textContent).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
});
