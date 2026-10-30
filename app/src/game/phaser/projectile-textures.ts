import Phaser from "phaser";
import type { ProjectileAppearanceSpec } from "../config/encounter";
import { appearanceRgbaPixels } from "./appearance-pixels";

export const spentShadeMultiplier = 0.55;

export type AppearanceTextureKeys = Readonly<{
  normal: string;
  spent: string;
}>;

function textureKey(appearanceId: string, spent: boolean): string {
  return `projectile-appearance-${appearanceId}${spent ? "-spent" : ""}`;
}

function createTexture(
  scene: Phaser.Scene,
  key: string,
  appearance: ProjectileAppearanceSpec,
  spent: boolean,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const rgba = appearanceRgbaPixels(
    appearance,
    spent ? spentShadeMultiplier : 1,
  );
  const texture = scene.textures.createCanvas(key, rgba.width, rgba.height);
  if (!texture) throw new Error(`Could not create projectile texture ${key}`);
  const imageData = texture.context.createImageData(rgba.width, rgba.height);
  imageData.data.set(rgba.data);
  texture.context.putImageData(imageData, 0, 0);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/**
 * Pre-renders each non-bomb appearance and its spent variant once per scene.
 * Shards only ever draw these textures; no texture is built per frame.
 */
export function createAppearanceTextures(
  scene: Phaser.Scene,
  appearances: Iterable<ProjectileAppearanceSpec>,
): ReadonlyMap<string, AppearanceTextureKeys> {
  const textures = new Map<string, AppearanceTextureKeys>();
  for (const appearance of appearances) {
    if (appearance.bomb || appearance.nativeWidthPixels === 0) continue;
    const keys = {
      normal: textureKey(appearance.id, false),
      spent: textureKey(appearance.id, true),
    };
    createTexture(scene, keys.normal, appearance, false);
    createTexture(scene, keys.spent, appearance, true);
    textures.set(appearance.id, Object.freeze(keys));
  }
  return textures;
}

export function destroyAppearanceTextures(
  scene: Phaser.Scene,
  textures: ReadonlyMap<string, AppearanceTextureKeys>,
): void {
  for (const keys of textures.values()) {
    for (const key of [keys.normal, keys.spent]) {
      if (scene.textures.exists(key)) scene.textures.remove(key);
    }
  }
}
