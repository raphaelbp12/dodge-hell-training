import { describe, expect, test } from "vitest";
import { hexToNumber, paletteCssVariables } from "./palette";

describe("palette", () => {
  test("converts hex to a number", () => {
    expect(hexToNumber("#1E1A26")).toBe(0x1e1a26);
  });

  test("every css variable is a six digit hex colour", () => {
    for (const value of Object.values(paletteCssVariables()))
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
