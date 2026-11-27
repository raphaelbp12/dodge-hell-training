import type { SimulationInput } from "../models";

/**
 * Pure view-relative movement mapping (plan V28, D-28-1, D-28-2): no Phaser,
 * DOM or React.
 *
 * Sign convention, fixed in `camera-rotation.ts`: a positive `angleRadians`
 * is a clockwise turn of the camera on screen (`E`), so the world appears
 * turned counter-clockwise by that angle. A screen-space vector is therefore
 * turned clockwise by `angleRadians` (in y-down axes, a positive rotation) to
 * give the world vector that appears as that direction on screen. At angle 0
 * the vector is unchanged; length is preserved.
 */
export function cameraRelativeMovement(
  screenVector: { x: number; y: number },
  angleRadians: number,
): { x: number; y: number } {
  if (angleRadians === 0) return { x: screenVector.x, y: screenVector.y };
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  return {
    x: screenVector.x * cos - screenVector.y * sin,
    y: screenVector.x * sin + screenVector.y * cos,
  };
}

/**
 * The simulation input for one frame (D-28-2, owner decision): the held keys
 * unchanged, plus the analogue `moveVector` of the key direction turned by the
 * camera angle. Opposing keys cancel to the zero vector.
 */
export function cameraRelativeInput(
  keys: Pick<SimulationInput, "north" | "south" | "east" | "west">,
  angleRadians: number,
  confused = false,
): SimulationInput {
  const held = {
    x: Number(keys.east) - Number(keys.west),
    y: Number(keys.south) - Number(keys.north),
  };
  // Confused swaps east<->north and west<->south on screen, before the camera
  // turns the result: (x, y) -> (-y, -x).
  const screen = confused ? { x: -held.y, y: -held.x } : held;
  return { ...keys, moveVector: cameraRelativeMovement(screen, angleRadians) };
}
