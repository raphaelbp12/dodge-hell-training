/**
 * Pure tag-to-attack conversion (plan V15 N41-N43). Reads `game/config/` one
 * way (T13) and stays free of React, the DOM and storage.
 */
import { AUTHORED_PROJECTILES, type AuthoredAttack } from "../game/config/data";
import type { AttackPattern, EncounterConfig } from "../game/config/encounter";
import { matchTagAttack } from "./previewModel";
import type { SavedAttack, Tag } from "./tagging";

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

const RADIANS_TO_DEGREES = 180 / Math.PI;
/** Removes the float noise a degrees-to-radians-and-back round trip leaves. */
const DEGREE_DECIMALS = 9;

function toDegrees(radians: number): number {
  return Number((radians * RADIANS_TO_DEGREES).toFixed(DEGREE_DECIMALS));
}

/** The runtime pattern in authored form: a ring's phase goes back to degrees. */
function authoredPattern(pattern: AttackPattern): AuthoredAttack["pattern"] {
  if (pattern.kind !== "ring") return pattern;
  const { initialPhaseRadians, ...rest } = pattern;
  return { ...rest, initialPhaseDegrees: toDegrees(initialPhaseRadians) };
}

/**
 * The matched projectile's authored entry with the tag's typed values laid
 * over it, or null when the tag types nothing the catalog entry holds (S13,
 * S24). `type` stays only for a bomb, as the catalog authors it.
 */
function projectileVariantOf(
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

/**
 * Converts a tag to the authored attack the preview draws for it, or null when
 * the tag matches no attack. Nothing is invented (N42): `projectile` and
 * `cadence` come from the matched attack, never from the tag's intervals
 * (T08, T32, D13), and the pattern is exactly the preview's resolved pattern
 * (N43). The tag decides `target` (S09), and only while the exported pattern
 * is still the single player-aimed shot N30 requires of it.
 */
export function authoredAttackFromTag(
  tag: Tag,
  config: EncounterConfig,
  savedAttack?: SavedAttack,
): ExportedAttack | null {
  const match = matchTagAttack(tag, config);
  if (!match) return null;
  const { attack, pattern } = match;
  const keepsTarget =
    tag.target === "player" &&
    pattern.kind === "spread" &&
    pattern.shots === 1 &&
    pattern.aim === "player";
  // S37: a linked tag's ids come from its saved attack's name; others keep N42.
  const stem = savedAttack
    ? slugOf(savedAttack.name, savedAttack.id)
    : null;
  const exportedId = `${stem ?? attack.id}${EXPORT_ATTACK_ID_SUFFIX}`;
  const projectileVariant = projectileVariantOf(
    tag,
    attack.projectileId,
    stem === null ? `${attack.projectileId}${EXPORT_ATTACK_ID_SUFFIX}` : exportedId,
  );
  // S45: a linked tag's typed cadence replaces the match's; initial delay stays.
  const cadence = savedAttack
    ? {
        ...attack.cadence,
        shotsPerBurst: savedAttack.cadence.shotsPerBurst,
        ...(savedAttack.cadence.shotsPerBurst > 1 &&
        savedAttack.cadence.shotIntervalSeconds !== undefined
          ? { shotIntervalSeconds: savedAttack.cadence.shotIntervalSeconds }
          : {}),
        cooldownAfterLastShotSeconds: savedAttack.cadence.cooldownAfterLastShotSeconds,
      }
    : attack.cadence;
  return {
    attack: {
      id: exportedId,
      projectile: projectileVariant?.id ?? attack.projectileId,
      tuningSource: EXPORT_TUNING_SOURCE,
      pattern: authoredPattern(pattern),
      cadence,
      ...(keepsTarget ? { target: "player" as const } : {}),
    },
    ...(projectileVariant ? { projectileVariant } : {}),
    aimsFront:
      (pattern.kind === "spread" || pattern.kind === "scatter") &&
      pattern.aim === "front",
  };
}

/** N41: the pretty-printed JSON a person pastes into `enemies.json`. */
export function attackJson(attack: AuthoredAttack): string {
  return JSON.stringify(attack, null, 2);
}

/** N43: shown beside a front-aimed export. */
export const FRONT_EXPORT_NOTE =
  "This attack aims at the enemy's front, so its archetype in enemies.json needs initialHeadingDegrees.";
