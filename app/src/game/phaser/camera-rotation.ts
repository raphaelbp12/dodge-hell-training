/**
 * Pure camera-rotation model (plan V24, D-24-8): no Phaser, DOM or React.
 *
 * Sign convention: a positive `angleRadians` is a clockwise turn of the
 * camera on screen (`E`). Phaser's `camera.rotation` rotates the world, so a
 * clockwise camera turn is `camera.setRotation(-angleRadians)`; the encounter
 * applies that negation (step 101.2).
 */

/** Camera rotation speed in radians per second; the user's "Normal" preset (D-24-1, plan V24 table). */
export const CAMERA_ROTATION_RADIANS_PER_SECOND = 3.0;

const FULL_TURN_RADIANS = Math.PI * 2;

export interface CameraRotationState {
  /** Camera angle in radians, in [0, 2 pi). */
  angleRadians: number;
}

export interface CameraRotationInput {
  /** `Q` held. */
  counterClockwise: boolean;
  /** `E` held. */
  clockwise: boolean;
}

export function initialCameraRotation(): CameraRotationState {
  return { angleRadians: 0 };
}

/** `Z`: snap back to angle 0 at once (D-24-9). */
export function resetCameraRotation(): CameraRotationState {
  return initialCameraRotation();
}

/** Advances the angle by `elapsedSeconds`; both keys held cancel. */
export function stepCameraRotation(
  state: CameraRotationState,
  input: CameraRotationInput,
  elapsedSeconds: number,
): CameraRotationState {
  if (!Number.isFinite(elapsedSeconds)) return state;
  const direction = Number(input.clockwise) - Number(input.counterClockwise);
  const angle =
    state.angleRadians +
    direction * CAMERA_ROTATION_RADIANS_PER_SECOND * elapsedSeconds;
  const wrapped =
    ((angle % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;
  // `%` by 2 pi is always below 2 pi, even when a tiny negative angle plus 2 pi rounds to 2 pi.
  return { angleRadians: wrapped };
}

/**
 * Maps held `Q`/`E` to rotation flags. A key is ignored without gameplay
 * focus, or while suppressed (held through a pause, focus loss, the Controls
 * modal or debug tools), exactly as the movement keys are (D-24-7).
 */
export function rotationInputOf(
  down: { q: boolean; e: boolean },
  gameplayFocused: boolean,
  suppressed: ReadonlySet<string>,
): CameraRotationInput {
  return {
    counterClockwise: gameplayFocused && down.q && !suppressed.has("KeyQ"),
    clockwise: gameplayFocused && down.e && !suppressed.has("KeyE"),
  };
}
