/**
 * Loads a monster's attacks into tracks (plan V20 E03) and converts a legacy
 * study into a v5 study in memory (E02). The legacy validators in
 * `tagging.ts` stay the only entry for legacy files.
 */
import type { AuthoredAttack } from "../game/config/data";
import {
  archetypeOf,
  degreesToRadians,
  type ArmPattern,
  type AttackPattern,
  type AttackSpec,
  type EncounterConfig,
  type PhaseSpec,
  type ProjectileSpec,
  type ScatterPattern,
  type SpreadPattern,
} from "../game/config/encounter";
import { EXPORT_ATTACK_ID_SUFFIX, EXPORT_TUNING_SOURCE, slugOf } from "./exportAttack";
import { attackFieldsOf } from "./taggingOptions";
import {
  segmentsOfMonster,
  type AttackTrack,
  type Boundary,
  type Mark,
  type SegmentRef,
  type StudyV5,
} from "./study";
import {
  resolveTags,
  type SavedAttack,
  type StudyState,
  type Tag,
  type TagPattern,
} from "./tagging";

// ---- The legacy tag match (plan V20 step 86.5) ------------------------------
// Copied from the retired tag preview so a legacy tag still converts to the
// attack it played as. Nothing outside this file uses it.

/** The matched attack plus the pattern a legacy tag resolved to. */
type TagMatch = Readonly<{
  attack: AttackSpec;
  projectile: ProjectileSpec;
  pattern: AttackPattern;
}>;

const FAMILY_BY_TAG_PATTERN: Readonly<
  Record<TagPattern, AttackPattern["kind"] | null>
> = {
  "rotating-arm": "ring",
  "fixed-ring": "ring",
  spread: "spread",
  scatter: "scatter",
  volley: null,
};

/** The arm pattern a tag describes; absent means a single shot, even on an authored composite. */
function armPatternOfTag(tag: Tag): ArmPattern | undefined {
  const { armPattern, shotsPerArm = 1, armArcDegrees = 0 } = tag;
  if (armPattern === "spread")
    return { kind: "spread", shots: shotsPerArm, arcDegrees: armArcDegrees };
  if (armPattern === "scatter")
    return { kind: "scatter", shots: shotsPerArm, coneDegrees: armArcDegrees };
  if (armPattern === "ring") return { kind: "ring", arms: shotsPerArm };
  return undefined;
}

/** The aim fields a tag states, or null when a `fixed` aim has no bearing anywhere (S23). */
function aimFieldsOfTag(
  tag: Tag,
  authored: SpreadPattern | ScatterPattern | null,
):
  | Readonly<{ aim: "player" }>
  | Readonly<{ aim: "fixed"; fixedBearingDegrees: number }>
  | Readonly<{ aim: "front"; offsetDegrees: number }>
  | null {
  if (tag.aim === "fixed") {
    const bearing =
      tag.fixedBearingDegrees ??
      (authored?.aim === "fixed" ? authored.fixedBearingDegrees : undefined);
    return bearing === undefined ? null : { aim: "fixed", fixedBearingDegrees: bearing };
  }
  if (tag.aim === "front")
    return {
      aim: "front",
      offsetDegrees:
        tag.frontOffsetDegrees ?? (authored?.aim === "front" ? authored.offsetDegrees : 0),
    };
  return { aim: "player" };
}

/** Why a tag has no pattern to draw; both are fixed by typing the missing value (S23, S10). */
type PatternProblem = "needs-bearing" | "needs-cone";

/**
 * The pattern the preview draws: the matched attack's pattern with the tag's
 * own geometry laid over it (M05, N36-N39, V16 S22-S25). The tag wins wherever
 * it says something; the attack only supplies what the tag cannot (the
 * projectile's motion, cadence-independent fields, and untyped values).
 *
 * - Rings: `arms` is the tag's shots; the arm pattern comes from the tag
 *   alone; `rotating-arm` takes the tag's typed rate and phase where present
 *   and the authored ones otherwise; `fixed-ring` has rate 0; a typed emitter
 *   radius replaces the authored one.
 * - Spread and scatter: `shots` is the tag's and a typed cone replaces the
 *   authored one. The tag's aim always wins: `player`; `fixed` with its typed
 *   bearing, else the attack's own when that attack is fixed; `front` with its
 *   typed offset, else the authored one, else 0. A `fixed` tag with no bearing
 *   anywhere has no pattern (S23).
 */
function withTagGeometry(
  pattern: AttackPattern,
  tag: Tag,
): AttackPattern | null {
  if (pattern.kind === "ring") {
    const { armPattern: _authoredArms, ...ring } = pattern;
    const armPattern = armPatternOfTag(tag);
    const rotating = tag.pattern === "rotating-arm";
    return {
      ...ring,
      arms: tag.shots,
      emitterRadiusTiles: tag.emitterRadiusTiles ?? pattern.emitterRadiusTiles,
      clockwiseDegreesPerSecond: rotating
        ? (tag.clockwiseDegreesPerSecond ?? pattern.clockwiseDegreesPerSecond)
        : 0,
      initialPhaseRadians:
        rotating && tag.initialPhaseDegrees !== undefined
          ? degreesToRadians(tag.initialPhaseDegrees)
          : pattern.initialPhaseRadians,
      ...(armPattern ? { armPattern } : {}),
    };
  }
  const aim = aimFieldsOfTag(tag, pattern);
  if (!aim) return null;
  const {
    aim: _aim,
    fixedBearingDegrees: _bearing,
    offsetDegrees: _offset,
    ...bare
  } = pattern as typeof pattern & { fixedBearingDegrees?: number; offsetDegrees?: number };
  const shape =
    pattern.kind === "spread"
      ? { arcDegrees: tag.coneDegrees ?? pattern.arcDegrees }
      : { coneDegrees: tag.coneDegrees ?? pattern.coneDegrees };
  return { ...bare, ...shape, shots: tag.shots, ...aim } as AttackPattern;
}

/**
 * A pattern built from the tag alone, for a bomb fired in another family than
 * the tag's (S10). Only the attack's emitter radius is borrowed. A ring's
 * missing phase and rate are 0 and a spread's missing arc is 0: neutral
 * defaults, not observations. A scatter with no typed cone has no pattern.
 */
function patternFromTag(
  tag: Tag,
  family: AttackPattern["kind"],
  borrowedRadiusTiles: number,
): AttackPattern | PatternProblem {
  const emitterRadiusTiles = tag.emitterRadiusTiles ?? borrowedRadiusTiles;
  if (family === "ring") {
    const armPattern = armPatternOfTag(tag);
    const rotating = tag.pattern === "rotating-arm";
    return {
      kind: "ring",
      arms: tag.shots,
      emitterRadiusTiles,
      initialPhaseRadians: degreesToRadians(rotating ? (tag.initialPhaseDegrees ?? 0) : 0),
      clockwiseDegreesPerSecond: rotating ? (tag.clockwiseDegreesPerSecond ?? 0) : 0,
      ...(armPattern ? { armPattern } : {}),
    };
  }
  const aim = aimFieldsOfTag(tag, null);
  if (!aim) return "needs-bearing";
  if (family === "spread")
    return {
      kind: "spread",
      shots: tag.shots,
      arcDegrees: tag.coneDegrees ?? 0,
      emitterRadiusTiles,
      ...aim,
    } as AttackPattern;
  if (tag.coneDegrees === undefined) return "needs-cone";
  return {
    kind: "scatter",
    shots: tag.shots,
    coneDegrees: tag.coneDegrees,
    emitterRadiusTiles,
    ...aim,
  } as AttackPattern;
}

/**
 * Lays a tag's typed projectile values over a copy of the matched spec, so the
 * game's own `resolveBombDestination`, `poseAtAge` and `resolveShardLifetime`
 * work unchanged and speed stays derived (S11, S24, N25). A typed bullet value
 * applies to `linear` motion only.
 */
function withTypedProjectileValues(projectile: ProjectileSpec, tag: Tag): ProjectileSpec {
  if (projectile.type === "bomb")
    return {
      ...projectile,
      rangeTiles: tag.bombRangeTiles ?? projectile.rangeTiles,
      travelSeconds: tag.bombTravelSeconds ?? projectile.travelSeconds,
    };
  if (
    projectile.motion.kind !== "linear" ||
    (tag.bulletSpeedTilesPerSecond === undefined && tag.bulletRangeTiles === undefined)
  )
    return projectile;
  return {
    ...projectile,
    speedTilesPerSecond: tag.bulletSpeedTilesPerSecond ?? projectile.speedTilesPerSecond,
    motion: {
      ...projectile.motion,
      rangeTiles: tag.bulletRangeTiles ?? projectile.motion.rangeTiles,
    },
  };
}

type MatchProblem = "no-attack" | "needs-bearing" | "needs-cone" | "legacy-volley" | "unknown-phase";

type Resolved =
  | Readonly<{ ok: true; match: TagMatch; borrowedFromPhaseIndex?: number }>
  | Readonly<{ ok: false; reason: MatchProblem }>;

function attacksOfPhase(phase: PhaseSpec): readonly AttackSpec[] {
  return [
    ...phase.attacks,
    ...(phase.subPhases ?? []).flatMap((subPhase) => subPhase.attacks),
  ];
}

/**
 * M03/M04, extended for bombs by S10. A bullet tag matches the first attack of
 * its phase firing its sprite in its pattern family. A bomb tag matches the
 * first attack of its phase firing its sprite whatever the family, otherwise
 * the first in any phase, in authored order.
 */
function resolveTagMatch(
  tag: Tag,
  config: EncounterConfig,
  archetypeId: string,
): Resolved {
  const family = FAMILY_BY_TAG_PATTERN[tag.pattern];
  if (!family) return { ok: false, reason: "legacy-volley" };
  const phases = config.archetypes[archetypeId].phases;
  const phase = phases[tag.phaseIndex];
  if (!phase) return { ok: false, reason: "unknown-phase" };
  const firesSprite = (attack: AttackSpec) =>
    config.projectiles[attack.projectileId]?.appearance?.id === tag.spriteId;
  const bomb = Object.values(config.projectiles).some(
    (spec) => spec.type === "bomb" && spec.appearance?.id === tag.spriteId,
  );
  let attack = attacksOfPhase(phase).find(
    (candidate) => firesSprite(candidate) && (bomb || candidate.pattern.kind === family),
  );
  let borrowedFromPhaseIndex: number | undefined;
  if (!attack && bomb)
    phases.some((other, index) => {
      attack = attacksOfPhase(other).find(firesSprite);
      if (attack) borrowedFromPhaseIndex = index;
      return attack !== undefined;
    });
  if (!attack) return { ok: false, reason: "no-attack" };
  const projectile = withTypedProjectileValues(config.projectiles[attack.projectileId], tag);
  const built =
    attack.pattern.kind === family
      ? (withTagGeometry(attack.pattern, tag) ?? "needs-bearing")
      : patternFromTag(tag, family, attack.pattern.emitterRadiusTiles);
  if (typeof built === "string") return { ok: false, reason: built };
  return {
    ok: true,
    match: { attack, projectile, pattern: built },
    ...(borrowedFromPhaseIndex === undefined ? {} : { borrowedFromPhaseIndex }),
  };
}

/** M03/M04/S10: the attack, projectile and pattern a tag plays as, or null when it plays as nothing. */
function matchTagAttack(
  tag: Tag,
  config: EncounterConfig,
  archetypeId: string,
): TagMatch | null {
  const resolved = resolveTagMatch(tag, config, archetypeId);
  return resolved.ok ? resolved.match : null;
}

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
 * The authored attack a legacy tag played as, or null when it matches no
 * attack: the retired `authoredAttackFromTag` without its projectile variant.
 * `projectile` is the matched catalog id; the caller moves typed bomb values to
 * the track's override.
 */
function authoredAttackFromLegacyTag(
  tag: Tag,
  config: EncounterConfig,
  archetypeId: string,
  savedAttack?: SavedAttack,
): Readonly<{ attack: AuthoredAttack; isBomb: boolean }> | null {
  const match = matchTagAttack(tag, config, archetypeId);
  if (!match) return null;
  const { attack, pattern } = match;
  const keepsTarget =
    tag.target === "player" &&
    pattern.kind === "spread" &&
    pattern.shots === 1 &&
    pattern.aim === "player";
  const stem = savedAttack ? slugOf(savedAttack.name, savedAttack.id) : null;
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
      id: `${stem ?? attack.id}${EXPORT_ATTACK_ID_SUFFIX}`,
      projectile: attack.projectileId,
      tuningSource: EXPORT_TUNING_SOURCE,
      pattern: authoredPattern(pattern),
      cadence,
      ...(keepsTarget ? { target: "player" as const } : {}),
    } as AuthoredAttack,
    isBomb: config.projectiles[attack.projectileId]?.type === "bomb",
  };
}

type RawPhase = {
  id: string;
  attacks: AuthoredAttack[];
  subPhases?: { id: string; attacks: AuthoredAttack[] }[] | null;
};

/** The first free id of `base`, `base-2`, `base-3` and so on. */
function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${base}-${suffix}`;
  taken.add(id);
  return id;
}

/**
 * The tracks for attack lists in file order. A track id is its attack's id;
 * an attack id the file repeats in another list gets a numeric suffix on the
 * track only, so the attack itself stays byte-identical.
 */
function tracksOfLists(
  lists: readonly Readonly<{ location: SegmentRef; attacks: readonly AuthoredAttack[] }>[],
  taken: Set<string>,
): AttackTrack[] {
  return lists.flatMap(({ location, attacks }) =>
    attacks.map((attack) => ({
      id: uniqueId(attack.id, taken),
      location,
      attack: structuredClone(attack),
      cadenceSource: "authored" as const,
      marks: [],
    })),
  );
}

/** E03: one track per authored attack, in file order, with `cadenceSource: "authored"` and no marks. */
export function tracksFromMonsterFile(rawFile: unknown): readonly AttackTrack[] {
  const phases = (rawFile as { phases: RawPhase[] }).phases;
  return tracksOfLists(
    phases.flatMap((phase) => [
      { location: { phaseId: phase.id, subPhaseId: null }, attacks: phase.attacks },
      ...(phase.subPhases ?? []).map((sub) => ({
        location: { phaseId: phase.id, subPhaseId: sub.id },
        attacks: sub.attacks,
      })),
    ]),
    new Set(),
  );
}

/** A new, empty v5 study for a monster whose tracks come from its file. */
export function emptyStudy(
  input: Readonly<{
    encounterId: string;
    archetypeId: string;
    provenance: StudyV5["provenance"];
    recordedAt: string;
    rawFile: unknown;
  }>,
): StudyV5 {
  return {
    schemaVersion: 5,
    encounterId: input.encounterId,
    archetypeId: input.archetypeId,
    recordedAt: input.recordedAt,
    provenance: input.provenance,
    boundaries: [],
    statusSpans: [],
    tracks: tracksFromMonsterFile(input.rawFile),
    scratch: [],
    acceptedSegmentValues: {},
  };
}

export type LegacyConversion = Readonly<{
  study: StudyV5;
  /** One sentence per thing the conversion could not keep, shown once after the load. */
  notices: readonly string[];
}>;

const volleyMarks = (tags: readonly Tag[]): Mark[] =>
  tags
    .map((tag) => ({ timeSeconds: tag.timeSeconds, kind: "volley" as const }))
    .sort((first, second) => first.timeSeconds - second.timeSeconds);

/**
 * The attack a legacy tag plays as, under the track's id. A typed bomb time
 * or range moves to the track's `projectileOverride` and the attack keeps the
 * catalog projectile; other typed projectile values have no home and drop.
 */
function attackOfTag(
  tag: Tag,
  config: EncounterConfig,
  archetypeId: string,
  trackId: string,
  savedAttack?: SavedAttack,
): Pick<AttackTrack, "attack" | "projectileOverride"> | null {
  const exported = authoredAttackFromLegacyTag(tag, config, archetypeId, savedAttack);
  if (exported === null) return null;
  const range = tag.target === "player" ? undefined : tag.bombRangeTiles;
  const override = {
    ...(tag.bombTravelSeconds === undefined ? {} : { travelSeconds: tag.bombTravelSeconds }),
    ...(range === undefined ? {} : { rangeTiles: range }),
  };
  const { isBomb } = exported;
  return {
    attack: {
      ...exported.attack,
      id: trackId,
      ...(savedAttack
        ? { cadence: { ...exported.attack.cadence, initialDelaySeconds: 0 } }
        : {}),
    },
    ...(isBomb && Object.keys(override).length > 0 ? { projectileOverride: override } : {}),
  };
}

/** E02: converts a `StudyState`, in the six steps of plan step 84.4. */
export function studyV5FromLegacy(
  input: Readonly<{
    legacy: StudyState;
    config: EncounterConfig;
    archetypeId: string;
    rawFile: unknown;
    recordedAt: string;
  }>,
): LegacyConversion {
  const { legacy, config, archetypeId } = input;
  const archetype = archetypeOf(config, archetypeId);
  const segments = segmentsOfMonster(archetype);
  const notices: string[] = [];
  const taken = new Set<string>();
  const scratch: Mark[] = [];

  // 1. Tracks from the draft, or from the monster's file.
  const draft = legacy.monsterDraft;
  const tracks: AttackTrack[] = draft
    ? tracksOfLists(
        draft.phases.flatMap((phase) => [
          { location: { phaseId: phase.phaseId, subPhaseId: null }, attacks: phase.attacks },
          ...phase.subPhases.map((sub) => ({
            location: { phaseId: phase.phaseId, subPhaseId: sub.subPhaseId },
            attacks: sub.attacks,
          })),
        ]),
        taken,
      )
    : [...tracksFromMonsterFile(input.rawFile)];
  for (const track of tracks) taken.add(track.id);

  // 2. Boundaries from the draft's anchors, then one per tagged phase without one.
  const boundaries: Boundary[] = Object.entries(draft?.anchors ?? {}).map(
    ([segmentId, timeSeconds]) => ({ timeSeconds, segmentId }),
  );
  const phaseOfBoundary = (boundary: Boundary) =>
    segments.find((segment) => segment.id === boundary.segmentId)?.ref.phaseId ??
    boundary.segmentId.split("/")[0];
  const tagged = [...new Set(legacy.tags.map((tag) => tag.phaseIndex))].sort((a, b) => a - b);
  for (const phaseIndex of tagged) {
    const phase = archetype.phases[phaseIndex];
    if (!phase || boundaries.some((boundary) => phaseOfBoundary(boundary) === phase.id)) continue;
    const first = segments.find((segment) => segment.ref.phaseId === phase.id);
    if (!first) continue;
    const earliest = Math.min(
      ...legacy.tags.filter((tag) => tag.phaseIndex === phaseIndex).map((tag) => tag.timeSeconds),
    );
    boundaries.push({ timeSeconds: earliest, segmentId: first.id });
    if (phase.subPhases && phase.subPhases.length > 0)
      notices.push(`Phase ${phase.id} was given a boundary at its first tag; check it.`);
  }
  boundaries.sort((first, second) => first.timeSeconds - second.timeSeconds);

  const resolved = resolveTags(legacy.tags, legacy.savedAttacks);
  const phaseLocation = (tag: Tag | undefined): SegmentRef => ({
    phaseId: archetype.phases[tag?.phaseIndex ?? 0]?.id ?? archetype.phases[0].id,
    subPhaseId: null,
  });
  const trackFromTags = (
    id: string,
    group: readonly Tag[],
    cadenceSource: AttackTrack["cadenceSource"],
    noticeOf: (count: number) => string,
    savedAttack?: SavedAttack,
  ): void => {
    const sorted = [...group].sort((first, second) => first.timeSeconds - second.timeSeconds);
    const built = sorted[0] && attackOfTag(sorted[0], config, archetypeId, id, savedAttack);
    if (!built) {
      if (sorted.length > 0) {
        scratch.push(...volleyMarks(sorted));
        notices.push(noticeOf(sorted.length));
      }
      return;
    }
    const ends = sorted.flatMap((tag) =>
      tag.repeatEndSeconds === undefined ? [] : [tag.repeatEndSeconds],
    );
    tracks.push({
      id,
      location: phaseLocation(sorted[0]),
      ...built,
      cadenceSource,
      marks: volleyMarks(sorted),
      ...(ends.length > 0 ? { endSeconds: Math.max(...ends) } : {}),
    });
  };

  // 3. One track per saved attack, holding its linked tags.
  for (const savedAttack of legacy.savedAttacks) {
    const linked = resolved.filter((tag) => tag.savedAttackId === savedAttack.id);
    const id = uniqueId(slugOf(savedAttack.name, savedAttack.id), taken);
    if (linked.length === 0) {
      const fallback = { timeSeconds: 0, phaseIndex: 0, ...attackFieldsOf(savedAttack) } as Tag;
      const built = attackOfTag(fallback, config, archetypeId, id, savedAttack);
      if (built)
        tracks.push({ id, location: phaseLocation(undefined), ...built, cadenceSource: "typed", marks: [] });
      else notices.push(`Saved attack ${savedAttack.name} matched no attack and was dropped.`);
      continue;
    }
    trackFromTags(
      id,
      linked,
      "typed",
      (count) => `Saved attack ${savedAttack.name} matched no attack; its ${count} marks went to the scratch track.`,
      savedAttack,
    );
  }

  // 4. Unlinked tags, grouped by identical attack fields and phase.
  const groups = new Map<string, Tag[]>();
  for (const tag of resolved) {
    if (tag.savedAttackId !== undefined) continue;
    const key = `${JSON.stringify(attackFieldsOf(tag))}\u0000${tag.phaseIndex}`;
    groups.set(key, [...(groups.get(key) ?? []), tag]);
  }
  let observed = 0;
  for (const group of groups.values()) {
    let id: string;
    do {
      observed += 1;
      id = `observed-${observed}`;
    } while (taken.has(id));
    taken.add(id);
    trackFromTags(
      id,
      group,
      "authored",
      (count) => `${count} tags matched no attack and went to the scratch track.`,
    );
  }

  // 5 and 6: burst ids, typed sources and other estimates drop; nothing is accepted yet.
  return {
    study: {
      schemaVersion: 5,
      encounterId: legacy.encounterId,
      archetypeId,
      recordedAt: input.recordedAt,
      provenance: legacy.provenance,
      boundaries,
      statusSpans: [],
      tracks,
      scratch: scratch.sort((first, second) => first.timeSeconds - second.timeSeconds),
      acceptedSegmentValues: {},
    },
    notices,
  };
}
