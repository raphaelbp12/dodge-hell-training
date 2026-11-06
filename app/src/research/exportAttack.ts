/**
 * Pure tag-to-attack conversion (plan V15 N41-N43). Reads `game/config/` one
 * way (T13) and stays free of React, the DOM and storage.
 */
import type { AuthoredAttack } from "../game/config/data";
import type { AttackPattern, EncounterConfig } from "../game/config/encounter";
import { matchTagAttack } from "./previewModel";
import type { Tag } from "./tagging";

/** N42: the exported id is the matched attack's id plus this suffix. */
export const EXPORT_ATTACK_ID_SUFFIX = "-tagged";

/** N42: an exported attack records that a person observed it in video. */
export const EXPORT_TUNING_SOURCE = "video-observation";

export type ExportedAttack = Readonly<{
  attack: AuthoredAttack;
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
 * Converts a tag to the authored attack the preview draws for it, or null when
 * the tag matches no attack. Nothing is invented (N42): `projectile` and
 * `cadence` come from the matched attack, never from the tag's intervals
 * (T08, T32, D13), and the pattern is exactly the preview's resolved pattern
 * (N43). The matched attack's `target` survives only while the exported
 * pattern is still the single player-aimed shot N30 requires of it.
 */
export function authoredAttackFromTag(
  tag: Tag,
  config: EncounterConfig,
): ExportedAttack | null {
  const match = matchTagAttack(tag, config);
  if (!match) return null;
  const { attack, pattern } = match;
  const keepsTarget =
    attack.target === "player" &&
    pattern.kind === "spread" &&
    pattern.shots === 1 &&
    pattern.aim === "player";
  return {
    attack: {
      id: `${attack.id}${EXPORT_ATTACK_ID_SUFFIX}`,
      projectile: attack.projectileId,
      tuningSource: EXPORT_TUNING_SOURCE,
      pattern: authoredPattern(pattern),
      cadence: attack.cadence,
      ...(keepsTarget ? { target: "player" as const } : {}),
    },
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
