/**
 * Pure export of a v5 study (plan V20 E08, E09, E13): the monster's whole
 * file rewritten from the tracks, a projectile variant per measured bomb, and
 * the study JSON. Nothing is written anywhere (L23); pasting is a separate
 * approved change (L25).
 */
import {
  AUTHORED_APPEARANCES,
  AUTHORED_MONSTER_FILES,
  AUTHORED_PROJECTILES,
  validateArchetypes,
  validateProjectile,
} from "../game/config/data";
import {
  attackSpecFromAuthored,
  validateAttackSpec,
  type EncounterConfig,
} from "../game/config/encounter";
import type { DraftResult } from "./monsterDraft";
import { segmentIdOf, type AttackTrack, type StudyV5 } from "./study";

/** E09: the `source` of a projectile variant whose values were measured from video. */
export const MEASURED_VARIANT_SOURCE = "measured from video (tagger)";

/** E09: a measured variant's id is its track id plus this suffix. */
export const MEASURED_VARIANT_SUFFIX = "-measured";

type RawSegment = Record<string, unknown> & { id: string; attacks: unknown };
type RawPhase = RawSegment & { subPhases?: RawSegment[] | null };

const fail = <T>(error: string): DraftResult<T> => ({ ok: false, error });

const APPEARANCE_IDS: ReadonlySet<string> = new Set(Object.keys(AUTHORED_APPEARANCES.appearances));

/** E08, E09: a projectile variant entry for a bomb track with an override, or null without one. */
export function bombVariantOf(
  track: AttackTrack,
): Readonly<{ id: string; entry: Record<string, unknown> }> | null {
  const override = track.projectileOverride;
  const authored = AUTHORED_PROJECTILES[track.attack.projectile] as
    | (Record<string, unknown> & { type?: string; rangeTiles?: number; travelSeconds?: number })
    | undefined;
  if (!override || authored?.type !== "bomb") return null;
  const { id: _id, type, rangeTiles: authoredRange, ...rest } = authored;
  // A targeted bomb lands on the player and ignores its range at runtime, but
  // the projectile validator requires one on every bomb, so it keeps the
  // authored range (user decision 2026-11-17, the former plan V22 A10 finding).
  const targeted = track.attack.target === "player";
  return {
    id: `${track.id}${MEASURED_VARIANT_SUFFIX}`,
    entry: {
      ...rest,
      source: MEASURED_VARIANT_SOURCE,
      type,
      rangeTiles: targeted ? authoredRange : (override.rangeTiles ?? authoredRange),
      travelSeconds: override.travelSeconds ?? authored.travelSeconds,
    },
  };
}

function exportedAttack(track: AttackTrack): unknown {
  const variant = bombVariantOf(track);
  const attack = structuredClone(track.attack);
  return variant ? { ...attack, projectile: variant.id } : attack;
}

/** E13: the monster's whole file with every attack list replaced from the tracks and the accepted segment values applied. */
export function monsterFileTextFromStudy(
  input: Readonly<{
    archetypeId: string;
    study: StudyV5;
    currentRawFile: unknown;
    config: EncounterConfig;
  }>,
): DraftResult<string> {
  const { archetypeId, study, config } = input;
  const result = structuredClone(input.currentRawFile) as { phases: RawPhase[] };
  const owners = new Map<string, RawSegment>();
  for (const phase of result.phases) {
    owners.set(phase.id, phase);
    for (const sub of phase.subPhases ?? []) owners.set(`${phase.id}/${sub.id}`, sub);
  }
  for (const track of study.tracks) {
    const id = segmentIdOf(track.location);
    if (!owners.has(id)) return fail(`Track ${track.id} is in segment ${id}, which is not in the file.`);
  }
  for (const [id, owner] of owners)
    owner.attacks = study.tracks
      .filter((track) => segmentIdOf(track.location) === id)
      .map(exportedAttack);
  for (const [id, accepted] of Object.entries(study.acceptedSegmentValues)) {
    const owner = owners.get(id);
    if (!owner) continue;
    if (accepted.telegraphSeconds !== undefined) owner.telegraphSeconds = accepted.telegraphSeconds;
    if (accepted.invulnerableOnEnterSeconds !== undefined)
      owner.invulnerableOnEnterSeconds = accepted.invulnerableOnEnterSeconds;
    if (accepted.durationSeconds !== undefined && id.includes("/"))
      owner.durationSeconds = accepted.durationSeconds;
  }
  const variants = Object.fromEntries(
    study.tracks.flatMap((track) => {
      const variant = bombVariantOf(track);
      return variant ? [[variant.id, variant.entry]] : [];
    }),
  );
  try {
    // Each variant is checked as the game would load it from projectiles.json,
    // so an entry the game would reject is refused here instead.
    for (const [id, entry] of Object.entries(variants))
      validateProjectile(entry, id, config.simulation.fixedStepSeconds, APPEARANCE_IDS);
    // Every shipped file is re-checked with the edited one, so the catalog is
    // every authored projectile, not one encounter's: any monster is taggable
    // under any encounter.
    const archetypes = validateArchetypes(
      { archetypes: { ...AUTHORED_MONSTER_FILES, [archetypeId]: result } },
      new Set([
        ...Object.keys(AUTHORED_PROJECTILES),
        ...Object.keys(config.projectiles),
        ...Object.keys(variants),
      ]),
      config.maxConcurrentMinions,
    );
    for (const phase of archetypes[archetypeId].phases)
      for (const attack of [...phase.attacks, ...(phase.subPhases ?? []).flatMap((sub) => sub.attacks)])
        if (!(attack.projectile in variants)) validateAttackSpec(config, attackSpecFromAuthored(attack));
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause));
  }
  return { ok: true, value: `${JSON.stringify(result, null, 2)}\n` };
}

/** The study JSON text, with `recordedAt` refreshed. */
export function studyExportJson(study: StudyV5, recordedAt: string): string {
  return JSON.stringify({ ...study, recordedAt }, null, 2);
}
