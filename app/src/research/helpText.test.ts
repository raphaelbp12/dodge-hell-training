import { describe, expect, test } from "vitest";
import * as helpText from "./helpText";

describe("help texts", () => {
  test("every constant is a non-empty sentence with no fidelity claim", () => {
    const entries = Object.entries(helpText);
    expect(entries.length).toBeGreaterThan(30);
    for (const [name, value] of entries) {
      expect(typeof value, name).toBe("string");
      expect((value as string).trim().length, name).toBeGreaterThan(0);
      expect(value as string, name).not.toMatch(/rotmg|realmeye/i);
    }
  });

  test("Starts here says entry, before the telegraph, not a first shot (J09)", () => {
    expect(helpText.HELP_STARTS_HERE).toMatch(/entered/);
    expect(helpText.HELP_STARTS_HERE).toMatch(/before its telegraph/);
    expect(helpText.HELP_STARTS_HERE).toMatch(/not the first shot/);
  });
});
