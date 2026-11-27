export interface UprightPlacement {
  x: number;
  y: number;
  rotation: number;
}

/**
 * Places a canvas label or bar so that, under a main camera whose Phaser
 * rotation is `cameraRotation`, it appears at `offset` (screen axes) from its
 * world `anchor` and stays upright (D-24-6). The offset is turned back by the
 * camera rotation and the object is counter-rotated by it.
 */
export function uprightPlacement(
  anchor: { x: number; y: number },
  offset: { x: number; y: number },
  cameraRotation: number,
): UprightPlacement {
  const cos = Math.cos(cameraRotation);
  const sin = Math.sin(cameraRotation);
  return {
    x: anchor.x + offset.x * cos + offset.y * sin,
    y: anchor.y - offset.x * sin + offset.y * cos,
    rotation: 0 - cameraRotation,
  };
}

/** The rotation that keeps an entity sprite upright under a camera rotated by `cameraRotation` (D-28-4). */
export function uprightRotation(cameraRotation: number): number {
  return 0 - cameraRotation;
}

/**
 * A sprite's own world heading as it appears on screen under a camera
 * rotated by `cameraRotation` (D-28-6). A sprite drawn at
 * `uprightRotation(cameraRotation) + screenHeading(heading, cameraRotation)`
 * is drawn at the world heading, which the camera turns onto that heading.
 */
export function screenHeading(
  headingRadians: number,
  cameraRotation: number,
): number {
  return headingRadians + cameraRotation;
}
