import { expect, test } from "vitest";
import {
  CAMERA_ROTATION_RADIANS_PER_SECOND,
  initialCameraRotation,
  resetCameraRotation,
  rotationInputOf,
  stepCameraRotation,
} from "./camera-rotation";

const none = { counterClockwise: false, clockwise: false };
const clockwise = { counterClockwise: false, clockwise: true };
const counterClockwise = { counterClockwise: true, clockwise: false };
const both = { counterClockwise: true, clockwise: true };
const turn = Math.PI * 2;

test("the rate is 3.0 rad/s and the state starts at angle 0", () => {
  expect(CAMERA_ROTATION_RADIANS_PER_SECOND).toBe(3);
  expect(initialCameraRotation()).toEqual({ angleRadians: 0 });
});

test("one second of E turns clockwise by the rate", () => {
  const next = stepCameraRotation(initialCameraRotation(), clockwise, 1);
  expect(next.angleRadians).toBeCloseTo(3, 10);
});

test("Q turns the opposite way, wrapped into range", () => {
  const next = stepCameraRotation(initialCameraRotation(), counterClockwise, 1);
  expect(next.angleRadians).toBeCloseTo(turn - 3, 10);
});

test("both keys, or none, leave the angle unchanged", () => {
  const state = { angleRadians: 1.25 };
  expect(stepCameraRotation(state, both, 1)).toEqual(state);
  expect(stepCameraRotation(state, none, 1)).toEqual(state);
});

test("the angle wraps past a full turn and stays in [0, 2 pi)", () => {
  const next = stepCameraRotation({ angleRadians: 6 }, clockwise, 1);
  expect(next.angleRadians).toBeCloseTo(9 - turn, 10);
  for (const input of [clockwise, counterClockwise]) {
    let state = initialCameraRotation();
    for (let index = 0; index < 500; index += 1) {
      state = stepCameraRotation(state, input, 0.1);
      expect(state.angleRadians).toBeGreaterThanOrEqual(0);
      expect(state.angleRadians).toBeLessThan(turn);
    }
  }
});

test("one 1 s step equals sixty 1/60 s steps", () => {
  let state = initialCameraRotation();
  for (let index = 0; index < 60; index += 1)
    state = stepCameraRotation(state, clockwise, 1 / 60);
  expect(state.angleRadians).toBeCloseTo(
    stepCameraRotation(initialCameraRotation(), clockwise, 1).angleRadians,
    9,
  );
});

test("reset returns angle 0 from any angle", () => {
  expect(resetCameraRotation()).toEqual({ angleRadians: 0 });
  for (const input of [clockwise, counterClockwise]) {
    const turned = stepCameraRotation(initialCameraRotation(), input, 0.7);
    expect(turned.angleRadians).not.toBe(0);
    expect(resetCameraRotation()).toEqual({ angleRadians: 0 });
  }
});

test("a tiny negative step from 0 wraps into [0, 2 pi) and never reaches 2 pi", () => {
  const next = stepCameraRotation(
    initialCameraRotation(),
    counterClockwise,
    1e-20,
  );
  expect(next.angleRadians).toBeGreaterThanOrEqual(0);
  expect(next.angleRadians).toBeLessThan(turn);
});

test("non-finite elapsed time is ignored and keeps the angle in range", () => {
  const state = { angleRadians: 2 };
  for (const elapsed of [Infinity, -Infinity, NaN])
    for (const input of [clockwise, counterClockwise])
      expect(stepCameraRotation(state, input, elapsed)).toEqual(state);
});

test("zero elapsed time changes nothing, tiny elapsed time barely moves", () => {
  const state = { angleRadians: 2 };
  expect(stepCameraRotation(state, clockwise, 0)).toEqual(state);
  expect(
    stepCameraRotation(state, clockwise, 1e-9).angleRadians - 2,
  ).toBeCloseTo(3e-9, 15);
});

test("input flags follow the held keys, gameplay focus and suppression", () => {
  const down = { q: true, e: false };
  expect(rotationInputOf(down, true, new Set())).toEqual(counterClockwise);
  expect(rotationInputOf({ q: false, e: true }, true, new Set())).toEqual(
    clockwise,
  );
  expect(rotationInputOf({ q: true, e: true }, true, new Set())).toEqual(both);
  expect(rotationInputOf(down, false, new Set())).toEqual(none);
  expect(rotationInputOf(down, true, new Set(["KeyQ"]))).toEqual(none);
  expect(
    rotationInputOf({ q: true, e: true }, true, new Set(["KeyE"])),
  ).toEqual(counterClockwise);
});
