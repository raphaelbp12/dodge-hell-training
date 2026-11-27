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
