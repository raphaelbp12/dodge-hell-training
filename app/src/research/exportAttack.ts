/**
 * Pure tag-to-attack conversion (plan V15 N41-N43). Reads `game/config/` one
 * way (T13) and stays free of React, the DOM and storage.
 */
import { AUTHORED_PROJECTILES, type AuthoredAttack } from "../game/config/data";
import type { Tag } from "./tagging";

/** N42: the exported id is the matched attack's id plus this suffix. */
export const EXPORT_ATTACK_ID_SUFFIX = "-tagged";

/** N42: an exported attack records that a person observed it in video. */
export const EXPORT_TUNING_SOURCE = "video-observation";

/** S13: the `source` of a projectile entry whose values a person typed. */
export const EXPORT_VARIANT_SOURCE = "typed video estimate (tagger)";

export type ExportedAttack = Readonly<{
  attack: AuthoredAttack;
  /**
   * S13: present when a typed bomb or linear-bullet value needs its own
   * catalog entry, to paste under `projectiles` in `projectiles.json`. A
   * calculated speed is never written (S11).
   */
  projectileVariant?: Readonly<{ id: string; entry: Record<string, unknown> }>;
  /** N43: a front-aimed export needs `initialHeadingDegrees` on its archetype. */
  aimsFront: boolean;
}>;

/**
 * The matched projectile's authored entry with the tag's typed values laid
 * over it, or null when the tag types nothing the catalog entry holds (S13,
 * S24). `type` stays only for a bomb, as the catalog authors it.
 */
export function projectileVariantOf(
  tag: Tag,
  projectileId: string,
  variantId: string,
): { id: string; entry: Record<string, unknown> } | null {
  const authored = AUTHORED_PROJECTILES[projectileId];
  if (!authored) return null;
  const { id: _id, type, ...rest } = authored as Record<string, unknown> & {
    type: string;
  };
  const source = EXPORT_VARIANT_SOURCE;
  if (authored.type === "bomb") {
    const rangeTiles = tag.target === "player" ? undefined : tag.bombRangeTiles;
    if (rangeTiles === undefined && tag.bombTravelSeconds === undefined) return null;
    return {
      id: variantId,
      entry: {
        ...rest,
        source,
        type,
        rangeTiles: rangeTiles ?? authored.rangeTiles,
        travelSeconds: tag.bombTravelSeconds ?? authored.travelSeconds,
      },
    };
  }
  if (
    authored.motion.kind !== "linear" ||
    (tag.bulletSpeedTilesPerSecond === undefined && tag.bulletRangeTiles === undefined)
  )
    return null;
  return {
    id: variantId,
    entry: {
      ...rest,
      source,
      speedTilesPerSecond: tag.bulletSpeedTilesPerSecond ?? authored.speedTilesPerSecond,
      motion: {
        ...authored.motion,
        rangeTiles: tag.bulletRangeTiles ?? authored.motion.rangeTiles,
      },
    },
  };
}

/**
 * S37: a saved attack's name as an id stem: lowercase letters, digits and
 * single hyphens. A name of only symbols falls back to `fallback` (the attack's
 * stable id), so an exported id is never empty.
 */
export function slugOf(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : fallback;
}

/** N43: shown beside a front-aimed export. */
export const FRONT_EXPORT_NOTE =
  "This attack aims at the enemy's front, so its monster file under game/data/enemies/ needs initialHeadingDegrees.";
