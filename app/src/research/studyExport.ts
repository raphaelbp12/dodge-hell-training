/**
 * Pure export of a v6 study (plan V20 E08, E09; plan V23 Q02-Q07, Q13, Q14,
 * Q16): the monster's whole file rewritten from the marked tracks and the
 * measured segment values, a projectile variant per measured bomb, and the
 * study JSON. Nothing is written anywhere (L23); pasting is a separate
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
  type AttackMarks,
  type EncounterConfig,
} from "../game/config/encounter";
import { medianOf, pairDetonations } from "./cadenceFit";
import type { DraftResult } from "./monsterDraft";
import {
  segmentIdOf,
  segmentWindows,
  windowsForTrack,
  type AttackTrack,
  type Segment,
  type SegmentRef,
  type SegmentWindow,
  type StudyV6,
} from "./study";
import { roundToMillisecond, trackMarksOf } from "./trackMarks";

/** E09: the `source` of a projectile variant whose values were measured from video. */
export const MEASURED_VARIANT_SOURCE = "measured from video (tagger)";

/** E09: a measured variant's id is its track id plus this suffix. */
export const MEASURED_VARIANT_SUFFIX = "-measured";

type RawSegment = Record<string, unknown> & { id: string; attacks: unknown };
type RawPhase = RawSegment & { subPhases?: RawSegment[] | null };

const fail = <T>(error: string): DraftResult<T> => ({ ok: false, error });

const APPEARANCE_IDS: ReadonlySet<string> = new Set(Object.keys(AUTHORED_APPEARANCES.appearances));

/** Q14: a bomb track's median measured flight time, from its throw and detonation pairs. */
export function measuredTravelSeconds(track: AttackTrack): number | null {
  const travel = medianOf(
    pairDetonations(track.marks).map((pair) => pair.detonationSeconds - pair.throwSeconds),
  );
  return travel === null ? null : roundToMillisecond(travel);
}

/** Q14: a bomb track's median measured range over its measured, still paired, pairs. */
export function measuredRangeTilesOf(track: AttackTrack): number | null {
  const range = medianOf(
    (track.measuredRangeTiles ?? [])
      .slice(0, pairDetonations(track.marks).length)
      .filter((value): value is number => value !== null),
  );
  return range === null ? null : roundToMillisecond(range);
}

/** E08, E09, Q14: a projectile variant for a bomb track with a measurement, or null without one. */
export function bombVariantOf(
  track: AttackTrack,
): Readonly<{ id: string; entry: Record<string, unknown> }> | null {
  const authored = AUTHORED_PROJECTILES[track.attack.projectile] as
    | (Record<string, unknown> & { type?: string; rangeTiles?: number; travelSeconds?: number })
    | undefined;
  if (authored?.type !== "bomb") return null;
  const travelSeconds = measuredTravelSeconds(track);
  const rangeTiles = measuredRangeTilesOf(track);
  if (travelSeconds === null && rangeTiles === null) return null;
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
      rangeTiles: targeted ? authoredRange : (rangeTiles ?? authoredRange),
      travelSeconds: travelSeconds ?? authored.travelSeconds,
    },
  };
}

/** Q10: the track's attack with `cadence` replaced by its marks, and its measured variant. */
function exportedAttack(track: AttackTrack, marks: AttackMarks): unknown {
  const variant = bombVariantOf(track);
  const { cadence: _cadence, ...attack } = structuredClone(track.attack);
  return {
    ...attack,
    ...(variant ? { projectile: variant.id } : {}),
    marks: structuredClone(marks),
  };
}

/** Q13: one segment or phase's measured values; null where nothing was measured. */
export type SegmentMeasure = Readonly<{
  telegraphSeconds: number | null;
  invulnerableOnEnterSeconds: number | null;
  /** A sub-phase's length; always null for a phase. */
  durationSeconds: number | null;
  /** A phase's length, from its first boundary to the next phase's; always null for a sub-phase. */
  exitAfterSeconds: number | null;
}>;

const phaseOfId = (id: string) => id.split("/")[0];

const roundedMedian = (values: readonly number[]): number | null => {
  const median = medianOf(values);
  return median === null ? null : roundToMillisecond(median);
};

/**
 * Plan V23 Q13: the medians over a segment's (or, with a phase id, a phase's)
 * windows. A telegraph from each boundary's telegraph end; a sub-phase's
 * duration from windows ending at another boundary of the same phase; a
 * phase's exit time from each run of its boundaries to the next phase's
 * boundary; the invulnerable time from closed spans opening within one frame
 * of the segment's boundary (E05).
 */
export function measuredSegmentValues(study: StudyV6, ownerId: string): SegmentMeasure {
  const sorted = [...study.boundaries].sort((first, second) => first.timeSeconds - second.timeSeconds);
  const frameRate = study.provenance.frameRate;
  const frameSeconds = frameRate ? 1 / frameRate : 0;
  const isPhase = !ownerId.includes("/");
  const own = sorted.filter((boundary) => boundary.segmentId === ownerId);
  const telegraphSeconds = roundedMedian(
    own.flatMap((boundary) =>
      boundary.telegraphEndSeconds === undefined ? [] : [boundary.telegraphEndSeconds - boundary.timeSeconds],
    ),
  );
  const invulnerableOnEnterSeconds = roundedMedian(
    study.statusSpans.flatMap((span) =>
      span.outSeconds !== null &&
      own.some((boundary) => Math.abs(span.inSeconds - boundary.timeSeconds) <= frameSeconds)
        ? [span.outSeconds - span.inSeconds]
        : [],
    ),
  );
  const durations: number[] = [];
  const exits: number[] = [];
  sorted.forEach((boundary, index) => {
    const next = sorted[index + 1];
    if (!isPhase && boundary.segmentId === ownerId && next && phaseOfId(next.segmentId) === phaseOfId(ownerId))
      durations.push(next.timeSeconds - boundary.timeSeconds);
    const startsRun =
      isPhase &&
      phaseOfId(boundary.segmentId) === ownerId &&
      (index === 0 || phaseOfId(sorted[index - 1].segmentId) !== ownerId);
    if (!startsRun) return;
    const leave = sorted.slice(index + 1).find((later) => phaseOfId(later.segmentId) !== ownerId);
    if (leave) exits.push(leave.timeSeconds - boundary.timeSeconds);
  });
  return {
    telegraphSeconds,
    invulnerableOnEnterSeconds,
    durationSeconds: isPhase ? null : roundedMedian(durations),
    exitAfterSeconds: isPhase ? roundedMedian(exits) : null,
  };
}

/** The segments of a raw monster file, for its windows; the game's config need not hold the monster. */
function segmentsOfRawFile(phases: readonly RawPhase[]): Segment[] {
  const segment = (ref: SegmentRef, raw: RawSegment): Segment => ({
    id: segmentIdOf(ref),
    ref,
    label: segmentIdOf(ref),
    telegraphSeconds: Number(raw.telegraphSeconds ?? 0),
    invulnerableOnEnterSeconds: Number(raw.invulnerableOnEnterSeconds ?? 0),
    durationSeconds: typeof raw.durationSeconds === "number" ? raw.durationSeconds : null,
  });
  return phases.flatMap((phase) =>
    phase.subPhases && phase.subPhases.length > 0
      ? phase.subPhases.map((sub) => segment({ phaseId: phase.id, subPhaseId: sub.id }, sub))
      : [segment({ phaseId: phase.id, subPhaseId: null }, phase)],
  );
}

/** The windows of a study over a raw monster file's segments. */
export function studyWindowsOfFile(study: StudyV6, rawFile: unknown): readonly SegmentWindow[] {
  return segmentWindows(
    study.boundaries,
    segmentsOfRawFile((rawFile as { phases: RawPhase[] }).phases),
    study.provenance.durationSeconds,
  );
}

const refOfOwnerId = (id: string): SegmentRef => {
  const [phaseId, subPhaseId] = id.split("/");
  return { phaseId, subPhaseId: subPhaseId ?? null };
};

/** Q02, Q16: the tracks export keeps, each with its marks, in study order. */
export function exportedTracksOf(
  study: StudyV6,
  windows: readonly SegmentWindow[],
): readonly Readonly<{ track: AttackTrack; marks: AttackMarks }>[] {
  return study.tracks.flatMap((track) => {
    const marks = trackMarksOf(track, windows);
    return marks === null ? [] : [{ track, marks }];
  });
}

/**
 * Plan V23: the monster's whole file. A segment the study never shows keeps
 * its attacks and values (Q16); one it shows gets its marked tracks as its
 * attacks (Q02) and its measured values where measured (Q13).
 */
export function monsterFileTextFromStudy(
  input: Readonly<{
    archetypeId: string;
    study: StudyV6;
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
  const windows = studyWindowsOfFile(study, input.currentRawFile);
  const exported = exportedTracksOf(study, windows);
  const variants: Record<string, Record<string, unknown>> = {};
  for (const [id, owner] of owners) {
    if (windowsForTrack(windows, refOfOwnerId(id)).length === 0) continue;
    owner.attacks = exported
      .filter(({ track }) => segmentIdOf(track.location) === id)
      .map(({ track, marks }) => {
        const variant = bombVariantOf(track);
        if (variant) variants[variant.id] = variant.entry;
        return exportedAttack(track, marks);
      });
    const measured = measuredSegmentValues(study, id);
    if (measured.telegraphSeconds !== null) owner.telegraphSeconds = measured.telegraphSeconds;
    if (measured.invulnerableOnEnterSeconds !== null)
      owner.invulnerableOnEnterSeconds = measured.invulnerableOnEnterSeconds;
    if (measured.durationSeconds !== null) owner.durationSeconds = measured.durationSeconds;
    if (measured.exitAfterSeconds !== null && typeof owner.exitAfterSeconds === "number")
      owner.exitAfterSeconds = measured.exitAfterSeconds;
  }
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

/** The projectile variants export writes, one per exported bomb track with a measurement (Q14). */
export function exportedVariantsOf(
  study: StudyV6,
  rawFile: unknown,
): readonly Readonly<{ id: string; entry: Record<string, unknown> }>[] {
  return exportedTracksOf(study, studyWindowsOfFile(study, rawFile)).flatMap(({ track }) => {
    const variant = bombVariantOf(track);
    return variant ? [variant] : [];
  });
}

/** The study JSON text, with `recordedAt` refreshed. */
export function studyExportJson(study: StudyV6, recordedAt: string): string {
  return JSON.stringify({ ...study, recordedAt }, null, 2);
}
