import { describe, expect, it } from "vitest";
import { AUTHORED_ARENAS } from "../config/data";
import { honeyAt, honeySpeedMultiplier } from "./terrain";

const nestBossRoom = AUTHORED_ARENAS["nest-boss-room"];
const crystalWormCircle = AUTHORED_ARENAS["crystal-worm-circle"];

describe("honeyAt", () => {
  it("reports the arena centre as honey (inside the diamond and the annulus hole)", () => {
    expect(honeyAt(nestBossRoom, nestBossRoom.shape.centerTiles)).toBe(true);
  });

  it("proves the diamond shape, not a circle", () => {
    expect(honeyAt(nestBossRoom, { x: 3.5, y: 0 })).toBe(true);
    expect(honeyAt(nestBossRoom, { x: 3.51, y: 0 })).toBe(false);
    expect(honeyAt(nestBossRoom, { x: 1.75, y: 1.75 })).toBe(true);
    expect(honeyAt(nestBossRoom, { x: 1.8, y: 1.8 })).toBe(false);
  });

  it("is safe at a radius that clears both the diamond and the annulus hole", () => {
    expect(honeyAt(nestBossRoom, { x: 5, y: 0 })).toBe(false);
  });

  it("matches the annulus boundary exactly", () => {
    expect(honeyAt(nestBossRoom, { x: 7.5, y: 0 })).toBe(true);
    expect(honeyAt(nestBossRoom, { x: 9.5, y: 0 })).toBe(true);
    expect(honeyAt(nestBossRoom, { x: 7.49, y: 0 })).toBe(false);
  });

  it("is a hazard-math test, not a containment test: honey ignores the arena's own wall entirely", () => {
    // A tiny circular arena (radius 1) authored with the Queen's annulus
    // hazard: (8, 0) is well outside this arena's own wall, but honeyAt only
    // evaluates the hazard region's math against the offset point, never the
    // shape's containment boundary.
    const tinyArenaWithQueenAnnulus = {
      shape: { kind: "circle" as const, centerTiles: { x: 0, y: 0 }, radiusTiles: 1 },
      hazards: nestBossRoom.hazards.filter((hazard) => hazard.region.shape === "annulus"),
    };
    expect(honeyAt(tinyArenaWithQueenAnnulus, { x: 8, y: 0 })).toBe(true);
  });

  it("reports every point as safe for an arena with no hazards", () => {
    expect(honeyAt(crystalWormCircle, crystalWormCircle.shape.centerTiles)).toBe(
      false,
    );
    expect(honeyAt(crystalWormCircle, { x: 5, y: 5 })).toBe(false);
    expect(honeyAt(crystalWormCircle, { x: 100, y: 100 })).toBe(false);
  });
});

describe("honeySpeedMultiplier", () => {
  it("starts at the flat wiki multiplier", () => {
    expect(honeySpeedMultiplier(0)).toBeCloseTo(0.75);
  });

  it("ramps down 0.05 per second of contact", () => {
    expect(honeySpeedMultiplier(1)).toBeCloseTo(0.7);
  });

  it("floors at 0.50 at exactly five seconds", () => {
    expect(honeySpeedMultiplier(5)).toBeCloseTo(0.5);
  });

  it("stays at the floor past five seconds", () => {
    expect(honeySpeedMultiplier(10)).toBeCloseTo(0.5);
  });

  it("rejects negative contact seconds", () => {
    expect(() => honeySpeedMultiplier(-1)).toThrow(RangeError);
  });
});
