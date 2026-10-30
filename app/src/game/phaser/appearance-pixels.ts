import type { ProjectileAppearanceSpec } from "../config/encounter";

export type RgbaPixels = Readonly<{
  width: number;
  height: number;
  data: Uint8ClampedArray;
}>;

function parseHex(hex: string): readonly [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** Selects the zero-based bomb explosion frame, holding the last frame. */
export function bombExplosionFrameIndex(
  ageSeconds: number,
  frameSeconds: number,
  frameCount: number,
): number {
  if (frameCount <= 0) return 0;
  return Math.min(
    frameCount - 1,
    Math.max(0, Math.floor(ageSeconds / frameSeconds)),
  );
}

/**
 * Converts an appearance's resolved pixel grid into RGBA bytes. A null cell is
 * transparent; a spent appearance multiplies RGB by the supplied shade factor
 * while preserving alpha, so its silhouette remains readable.
 */
export function appearanceRgbaPixels(
  appearance: ProjectileAppearanceSpec,
  spentShadeMultiplier = 1,
): RgbaPixels {
  const width = appearance.nativeWidthPixels;
  const height = appearance.nativeHeightPixels;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colour = appearance.pixels[y]?.[x] ?? null;
      const offset = (y * width + x) * 4;
      if (colour === null) {
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
        continue;
      }
      const [red, green, blue] = parseHex(colour);
      data[offset] = Math.round(red * spentShadeMultiplier);
      data[offset + 1] = Math.round(green * spentShadeMultiplier);
      data[offset + 2] = Math.round(blue * spentShadeMultiplier);
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}
