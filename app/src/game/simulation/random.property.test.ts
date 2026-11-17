import fc from "fast-check";
import { expect, test } from "vitest";
import { propertyParameters } from "../../test/property";
import { assertSeed, nextSeed, unitFromSeed } from "./random";

const UINT32_MAX = 0xffffffff;
const seedArbitrary = fc.integer({ min: 0, max: UINT32_MAX });

test("unitFromSeed lies in [0, 1) for any 32-bit seed", () => {
  fc.assert(
    fc.property(seedArbitrary, (seed) => {
      const unit = unitFromSeed(seed);
      expect(unit).toBeGreaterThanOrEqual(0);
      expect(unit).toBeLessThan(1);
    }),
    propertyParameters(),
  );
});

test("nextSeed stays an unsigned 32-bit integer", () => {
  fc.assert(
    fc.property(seedArbitrary, (seed) => {
      const next = nextSeed(seed);
      expect(Number.isInteger(next)).toBe(true);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThanOrEqual(UINT32_MAX);
    }),
    propertyParameters(),
  );
});

test("assertSeed is idempotent and returns an unsigned 32-bit integer for finite input", () => {
  fc.assert(
    fc.property(
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      (value) => {
        const seed = assertSeed(value);
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThanOrEqual(UINT32_MAX);
        expect(assertSeed(seed)).toBe(seed);
      },
    ),
    propertyParameters(),
  );
});

test("assertSeed throws RangeError for non-finite input", () => {
  for (const value of [NaN, Infinity, -Infinity])
    expect(() => assertSeed(value)).toThrow(RangeError);
});
