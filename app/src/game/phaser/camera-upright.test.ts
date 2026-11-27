import { expect, test } from "vitest";
import {
  screenHeading,
  uprightPlacement,
  uprightRotation,
} from "./camera-upright";

/** Where a world point lands on screen under a camera turned by `rotation`. */
function toScreen(x: number, y: number, rotation: number) {
  return {
    x: x * Math.cos(rotation) - y * Math.sin(rotation),
    y: x * Math.sin(rotation) + y * Math.cos(rotation),
  };
}

test("at rotation 0 the placement is the plain anchor plus offset", () => {
  expect(uprightPlacement({ x: 10, y: 20 }, { x: 3, y: -4 }, 0)).toEqual({
    x: 13,
    y: 16,
    rotation: 0,
  });
});

test.each([0.7, Math.PI / 2, Math.PI, -2.4])(
  "at camera rotation %f the offset stays the same on screen and the object counter-rotates",
  (cameraRotation) => {
    const anchor = { x: 10, y: 20 };
    const offset = { x: 3, y: -4 };
    const placed = uprightPlacement(anchor, offset, cameraRotation);
    const screen = toScreen(
      placed.x - anchor.x,
      placed.y - anchor.y,
      cameraRotation,
    );
    expect(screen.x).toBeCloseTo(offset.x, 10);
    expect(screen.y).toBeCloseTo(offset.y, 10);
    expect(placed.rotation + cameraRotation).toBeCloseTo(0, 10);
  },
);

const ANGLES = [0, 0.7, Math.PI / 2, Math.PI, -2.4, 7];

test.each(ANGLES)(
  "the upright rotation is minus the camera rotation at %f",
  (cameraRotation) => {
    expect(uprightRotation(cameraRotation)).toBe(0 - cameraRotation);
  },
);

test.each(ANGLES)(
  "a world heading and camera rotation %f give the same on-screen heading as turning the world vector",
  (cameraRotation) => {
    const heading = 1.1;
    const screen = toScreen(Math.cos(heading), Math.sin(heading), cameraRotation);
    const onScreen = screenHeading(heading, cameraRotation);
    expect(Math.cos(onScreen)).toBeCloseTo(screen.x, 10);
    expect(Math.sin(onScreen)).toBeCloseTo(screen.y, 10);
    // A sprite counter-rotated and then given that heading is drawn at the world heading,
    // so the camera turns it onto the on-screen heading.
    expect(uprightRotation(cameraRotation) + onScreen).toBeCloseTo(heading, 10);
  },
);

test("camera rotation 0 changes no heading", () => {
  expect(screenHeading(1.1, 0)).toBe(1.1);
  expect(uprightRotation(0)).toBe(0);
});
