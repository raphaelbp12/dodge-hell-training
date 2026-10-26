import { expect, test } from "vitest";
import {
  AUTHORED_ARENA,
  AUTHORED_SHAPES,
  validateOutline,
  validateArena,
  loadOutline,
} from "./data";

test("authored arena matches the approved circular arena in tiles", () => {
  expect(AUTHORED_ARENA).toEqual({
    centerTiles: { x: 0, y: 0 },
    radiusTiles: 19.2,
  });
});

test("authored outlines are normalized to a 1x1 tile box", () => {
  expect(Object.keys(AUTHORED_SHAPES).sort()).toEqual([
    "beveled-octagon",
    "shard-hexagon",
  ]);
  for (const outline of Object.values(AUTHORED_SHAPES)) {
    const span = (axis: "x" | "y") =>
      Math.max(...outline.map((v) => v[axis])) -
      Math.min(...outline.map((v) => v[axis]));
    expect(span("x")).toBe(1);
    expect(span("y")).toBe(1);
  }
});

test("loadOutline resolves a named outline and rejects an unknown name", () => {
  expect(loadOutline("beveled-octagon")).toHaveLength(8);
  expect(loadOutline("shard-hexagon")).toHaveLength(6);
  expect(() => loadOutline("no-such-shape")).toThrow(RangeError);
});

test("validateArena rejects malformed authored arenas", () => {
  expect(() => validateArena({ centerTiles: { x: 0, y: 0 }, radiusTiles: 1 }))
    .not.toThrow();
  for (const bad of [
    undefined,
    null,
    42,
    {},
    { centerTiles: { x: 0, y: 0 } },
    { radiusTiles: 1 },
    { centerTiles: { x: 0 }, radiusTiles: 1 },
    { centerTiles: { x: 0, y: 0 }, radiusTiles: 0 },
    { centerTiles: { x: 0, y: 0 }, radiusTiles: -1 },
    { centerTiles: { x: 0, y: 0 }, radiusTiles: Number.NaN },
    { centerTiles: { x: Number.POSITIVE_INFINITY, y: 0 }, radiusTiles: 1 },
    { centerTiles: { x: "0", y: 0 }, radiusTiles: 1 },
  ]) {
    expect(() => validateArena(bad), `arena ${JSON.stringify(bad)}`).toThrow(
      RangeError,
    );
  }
});

test("validateOutline enforces the 3-to-8 vertex 1x1 contract", () => {
  const unit = [
    { x: -0.5, y: -0.5 },
    { x: 0.5, y: -0.5 },
    { x: 0.5, y: 0.5 },
    { x: -0.5, y: 0.5 },
  ];
  expect(() => validateOutline(unit, "unit")).not.toThrow();
  for (const bad of [
    undefined,
    {},
    [],
    unit.slice(0, 2),
    [...unit, ...unit, { x: 0, y: 0 }],
    unit.map((v) => ({ x: v.x * 2, y: v.y })),
    unit.map((v) => ({ x: v.x, y: v.y * 3 })),
    unit.map((v) => ({ x: v.x, y: Number.NaN })),
    [{ x: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }],
  ]) {
    expect(() => validateOutline(bad, "bad"), JSON.stringify(bad)).toThrow(
      RangeError,
    );
  }
});

test("authored data names the offending path when it rejects", () => {
  expect(() => validateArena({ centerTiles: { x: 0, y: 0 }, radiusTiles: 0 }))
    .toThrow(/radiusTiles/);
  expect(() => loadOutline("missing")).toThrow(/missing/);
});
