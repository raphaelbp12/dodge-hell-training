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
