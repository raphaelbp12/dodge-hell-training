import { describe, expect, test } from "vitest";
import {
  cameraRelativeInput,
  cameraRelativeMovement,
} from "./camera-relative-input";

const QUARTER = Math.PI / 2;
const W = { x: 0, y: -1 };
const A = { x: -1, y: 0 };
const S = { x: 0, y: 1 };
const D = { x: 1, y: 0 };

/** The camera turns the world by minus the angle (camera-rotation.ts), so screen = R(-angle) * world. */
function toScreen(v: { x: number; y: number }, angle: number) {
  const r = 0 - angle;
  return {
    x: v.x * Math.cos(r) - v.y * Math.sin(r),
    y: v.x * Math.sin(r) + v.y * Math.cos(r),
  };
}

function expectVector(actual: { x: number; y: number }, x: number, y: number) {
  expect(actual.x).toBeCloseTo(x, 10);
  expect(actual.y).toBeCloseTo(y, 10);
}

test.each([W, A, S, D])("angle 0 is the identity for %o", (v) => {
  expect(cameraRelativeMovement(v, 0)).toEqual(v);
});

test("a clockwise quarter turn maps each key to the expected world axis", () => {
  expectVector(cameraRelativeMovement(W, QUARTER), 1, 0);
  expectVector(cameraRelativeMovement(A, QUARTER), 0, -1);
  expectVector(cameraRelativeMovement(S, QUARTER), -1, 0);
  expectVector(cameraRelativeMovement(D, QUARTER), 0, 1);
});

test("a counter-clockwise quarter turn maps each key to the expected world axis", () => {
  expectVector(cameraRelativeMovement(W, -QUARTER), -1, 0);
  expectVector(cameraRelativeMovement(A, -QUARTER), 0, 1);
  expectVector(cameraRelativeMovement(S, -QUARTER), 1, 0);
  expectVector(cameraRelativeMovement(D, -QUARTER), 0, -1);
});

test("the zero vector stays zero", () => {
  expect(cameraRelativeMovement({ x: 0, y: 0 }, 1.3)).toEqual({ x: 0, y: 0 });
});

test.each([0, 0.4, QUARTER, Math.PI, Math.PI * 2, 9.5, -3])(
  "length is preserved and the camera turns the result back to the input at angle %f",
  (angle) => {
    const input = { x: 1, y: -1 };
    const world = cameraRelativeMovement(input, angle);
    expect(Math.hypot(world.x, world.y)).toBeCloseTo(Math.SQRT2, 10);
    const screen = toScreen(world, angle);
    expectVector(screen, input.x, input.y);
  },
);

describe("cameraRelativeInput", () => {
  const keys = { north: false, south: false, east: false, west: false };

  test("at angle 0 the vector is the plain screen vector", () => {
    expect(cameraRelativeInput({ ...keys, west: true }, 0).moveVector).toEqual({
      x: -1,
      y: 0,
    });
  });

  test("the vector reaching the simulation equals the mapped vector", () => {
    const input = cameraRelativeInput({ ...keys, west: true }, Math.PI / 2);
    const mapped = cameraRelativeMovement({ x: -1, y: 0 }, Math.PI / 2);
    expect(input.moveVector?.x).toBeCloseTo(mapped.x, 12);
    expect(input.moveVector?.y).toBeCloseTo(mapped.y, 12);
  });

  test("Confused swaps in screen space, then the camera rotates the result", () => {
    // D held at 90 degrees: screen east swaps to screen north (0, -1), then
    // turns clockwise by 90 degrees to world (1, 0).
    const input = cameraRelativeInput({ ...keys, east: true }, Math.PI / 2, true);
    expect(input.moveVector?.x).toBeCloseTo(1, 12);
    expect(input.moveVector?.y).toBeCloseTo(0, 12);
    expect(cameraRelativeInput({ ...keys, east: true }, 0, true).moveVector).toEqual({
      x: -0,
      y: -1,
    });
    expect(cameraRelativeInput({ ...keys, east: true }, 0, false).moveVector).toEqual({
      x: 1,
      y: 0,
    });
  });

  test("opposing keys cancel and the booleans pass through", () => {
    const input = cameraRelativeInput({ ...keys, east: true, west: true }, 1);
    expect(input.moveVector).toEqual({ x: 0, y: 0 });
    expect(input.east).toBe(true);
  });
});
