import { describe, expect, it } from "vitest";
import { GLOSSARY, REQUIRED_TERMS } from "./glossary";

describe("GLOSSARY", () => {
  it("has exactly one entry for every required term", () => {
    for (const term of REQUIRED_TERMS) {
      expect(GLOSSARY.filter((entry) => entry.term === term)).toHaveLength(1);
    }
  });

  it("has no blank or duplicate terms", () => {
    const terms = GLOSSARY.map((entry) => entry.term.trim());
    expect(terms.every((term) => term.length > 0)).toBe(true);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("uses none of the retired words", () => {
    for (const { meaning } of GLOSSARY) {
      expect(meaning).not.toMatch(/block|sticky|typed estimate|anchor/i);
    }
  });
});
