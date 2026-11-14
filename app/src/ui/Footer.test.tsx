import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Footer } from "./Footer";

test("the footer links to the video tagger", () => {
  render(<Footer />);
  const link = screen.getByRole("link", { name: "Video tagger" });
  expect(link.getAttribute("href")).toBe("?tagger=1");
});
