/**
 * The pure model of a timeline study, schema v6 (plan V20 E02-E04, E16; plan V23 Q15).
 * Imports only types from `game/config/` one way (T13); no React, DOM,
 * storage or simulation.
 */
import type { CadencedAuthoredAttack } from "../game/config/data";
import type { EnemyArchetype } from "../game/config/encounter";

export type SegmentRef = Readonly<{ phaseId: string; subPhaseId: string | null }>;

export type Segment = Readonly<{
  id: string;
  ref: SegmentRef;
  label: string;
  telegraphSeconds: number;
  invulnerableOnEnterSeconds: number;
  /** A sub-phase's authored duration; null for a phase. */
  durationSeconds: number | null;
}>;

export type Boundary = Readonly<{
  timeSeconds: number;
  segmentId: string;
  telegraphEndSeconds?: number;
}>;

export type StatusSpan = Readonly<{
  kind: "invulnerable";
  inSeconds: number;
  outSeconds: number | null;
}>;

export type Mark = Readonly<{ timeSeconds: number; kind: "volley" | "detonation" }>;

export type AttackTrack = Readonly<{
  id: string;
  location: SegmentRef;
  /** Plan V23 Q15: `cadence` is kept, and ignored when the track has volley marks. */
  attack: CadencedAuthoredAttack;
  marks: readonly Mark[];
  /** The stop mark on a periodic track (Q07); changes nothing otherwise. */
  endSeconds?: number;
  /** Present means periodic: its first window's marks repeat every period (Q06). */
  periodSeconds?: number;
  /** E09: indexed by detonation pair, as evidence; null for an unmeasured pair (step 87.3). */
  measuredRangeTiles?: readonly (number | null)[];
}>;

/** Plan V23 Q15: schema 6, without accepted values, cadence sources, thresholds or overrides. */
export type StudyV6 = Readonly<{
  schemaVersion: 6;
  encounterId: string;
  archetypeId: string;
  recordedAt: string;
  provenance: Readonly<{
    sourceUrl: string | null;
    fileName: string;
    frameRate: number | null;
    durationSeconds: number;
  }>;
  boundaries: readonly Boundary[];
  statusSpans: readonly StatusSpan[];
  tracks: readonly AttackTrack[];
  scratch: readonly Mark[];
  scale?: Readonly<{ tileWidthFraction: number }>;
}>;

export type SegmentWindow = Readonly<{
  segmentId: string;
  startSeconds: number;
  /** The boundary's telegraph end, or start plus the authored telegraph. */
  epochSeconds: number;
  endSeconds: number;
}>;

/** `phaseId`, or `phaseId/subPhaseId`; the same text `blockIdOf` produces. */
export function segmentIdOf(ref: SegmentRef): string {
  return ref.subPhaseId === null ? ref.phaseId : `${ref.phaseId}/${ref.subPhaseId}`;
}

/**
 * The attack ids `track`'s attack must not repeat: every other track's in the
 * same top-level phase, its sub-phases included. This is the game's own scope
 * (`validatePhase` in data.ts keeps one id set per phase and shares it with the
 * phase's sub-phases), so an id may repeat in another phase.
 */
export function attackIdsInPhaseOf(study: StudyV6, track: AttackTrack): readonly string[] {
  return study.tracks
    .filter(
      (other) => other !== track && other.location.phaseId === track.location.phaseId,
    )
    .map((other) => other.attack.id);
}

/** One segment per phase without sub-phases and one per sub-phase, in authored order. */
export function segmentsOfMonster(archetype: EnemyArchetype): readonly Segment[] {
  return archetype.phases.flatMap((phase): Segment[] => {
    if (phase.subPhases && phase.subPhases.length > 0)
      return phase.subPhases.map((sub) => {
        const ref = { phaseId: phase.id, subPhaseId: sub.id };
        return {
          id: segmentIdOf(ref),
          ref,
          label: `${phase.id} / ${sub.id}`,
          telegraphSeconds: sub.telegraphSeconds,
          invulnerableOnEnterSeconds: sub.invulnerableOnEnterSeconds,
          durationSeconds: sub.durationSeconds,
        };
      });
    const ref = { phaseId: phase.id, subPhaseId: null };
    return [
      {
        id: phase.id,
        ref,
        label: phase.id,
        telegraphSeconds: phase.telegraphSeconds,
        invulnerableOnEnterSeconds: phase.invulnerableOnEnterSeconds,
        durationSeconds: null,
      },
    ];
  });
}

/**
 * The segment after `segmentId` in authored order (E04): the next sub-phase of
 * the same phase, wrapping to its first; for a phase with no sub-phases, the
 * next segment in the list, wrapping to the first. Null or an unknown id gives
 * the first segment.
 */
export function nextSegmentId(segments: readonly Segment[], segmentId: string | null): string {
  if (segments.length === 0) throw new RangeError("A monster has at least one segment.");
  const index = segments.findIndex((segment) => segment.id === segmentId);
  if (index < 0) return segments[0].id;
  const current = segments[index];
  if (current.ref.subPhaseId === null) return segments[(index + 1) % segments.length].id;
  const siblings = segments.filter((segment) => segment.ref.phaseId === current.ref.phaseId);
  const position = siblings.findIndex((segment) => segment.id === current.id);
  return siblings[(position + 1) % siblings.length].id;
}

/**
 * Boundaries sorted by time; each window ends at the next boundary or the
 * video end. The authored duration never ends a window (E04). An unknown
 * segment's telegraph counts as zero.
 */
export function segmentWindows(
  boundaries: readonly Boundary[],
  segments: readonly Segment[],
  videoEndSeconds: number,
): readonly SegmentWindow[] {
  const sorted = [...boundaries].sort((first, second) => first.timeSeconds - second.timeSeconds);
  return sorted.map((boundary, index) => {
    const telegraph =
      segments.find((segment) => segment.id === boundary.segmentId)?.telegraphSeconds ?? 0;
    const next = sorted[index + 1];
    return {
      segmentId: boundary.segmentId,
      startSeconds: boundary.timeSeconds,
      epochSeconds: boundary.telegraphEndSeconds ?? boundary.timeSeconds + telegraph,
      endSeconds: next === undefined ? videoEndSeconds : next.timeSeconds,
    };
  });
}

function phaseOfSegmentId(segmentId: string): string {
  const separator = segmentId.indexOf("/");
  return separator < 0 ? segmentId : segmentId.slice(0, separator);
}

/** The windows a track fires in: every window of its phase for a phase-level track, only its sub-phase's windows otherwise (E03). */
export function windowsForTrack(
  windows: readonly SegmentWindow[],
  location: SegmentRef,
): readonly SegmentWindow[] {
  if (location.subPhaseId === null)
    return windows.filter((window) => phaseOfSegmentId(window.segmentId) === location.phaseId);
  const id = segmentIdOf(location);
  return windows.filter((window) => window.segmentId === id);
}

/** The window containing `timeSeconds`, or null before the first boundary. */
export function windowAt(
  windows: readonly SegmentWindow[],
  timeSeconds: number,
): SegmentWindow | null {
  let found: SegmentWindow | null = null;
  for (const window of windows)
    if (timeSeconds >= window.startSeconds && timeSeconds < window.endSeconds) found = window;
  if (found !== null) return found;
  const last = windows[windows.length - 1];
  return last !== undefined && timeSeconds === last.endSeconds && timeSeconds >= last.startSeconds
    ? last
    : null;
}

// ---- Validation (T31) -----------------------------------------------------

function reject(path: string, reason: string): never {
  throw new RangeError(`Study ${path} ${reason}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    reject(path, "must be an object");
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) reject(path, "must be an array");
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    reject(path, "must be a nonempty string");
  return value;
}

function nonNegativeFinite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    reject(path, "must be a nonnegative finite number");
  return value;
}

function validateMark(value: unknown, path: string): void {
  const mark = record(value, path);
  nonNegativeFinite(mark.timeSeconds, `${path}.timeSeconds`);
  if (mark.kind !== "volley" && mark.kind !== "detonation")
    reject(`${path}.kind`, "must be volley or detonation");
}

function validateTrack(value: unknown, path: string): string {
  const track = record(value, path);
  const id = nonEmptyString(track.id, `${path}.id`);
  const location = record(track.location, `${path}.location`);
  nonEmptyString(location.phaseId, `${path}.location.phaseId`);
  if (location.subPhaseId !== null)
    nonEmptyString(location.subPhaseId, `${path}.location.subPhaseId`);
  record(track.attack, `${path}.attack`);
  array(track.marks, `${path}.marks`).forEach((mark, index) =>
    validateMark(mark, `${path}.marks[${index}]`),
  );
  if (track.endSeconds !== undefined) nonNegativeFinite(track.endSeconds, `${path}.endSeconds`);
  if (
    track.periodSeconds !== undefined &&
    (typeof track.periodSeconds !== "number" ||
      !Number.isFinite(track.periodSeconds) ||
      track.periodSeconds <= 0)
  )
    reject(`${path}.periodSeconds`, "must be a positive finite number");
  return id;
}

/**
 * Plan V23 Q15: a schema 5 study as schema 6. Accepted segment values, cadence
 * sources, burst-gap thresholds and bomb overrides are dropped and kept nowhere.
 * Anything that is not a schema 5 object is returned unchanged for the
 * validator to reject. It lives here, not in `studyMigrate.ts`, so the legacy
 * loader in `tagging.ts` can call it without an import cycle.
 */
export function studyV6FromV5(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const study = value as Record<string, unknown>;
  if (study.schemaVersion !== 5) return value;
  const { acceptedSegmentValues: _accepted, ...rest } = study;
  return {
    ...rest,
    schemaVersion: 6,
    tracks: Array.isArray(study.tracks)
      ? study.tracks.map((track: unknown) => {
          if (typeof track !== "object" || track === null) return track;
          const {
            cadenceSource: _source,
            burstGapThresholdSeconds: _threshold,
            projectileOverride: _override,
            ...kept
          } = track as Record<string, unknown>;
          return kept;
        })
      : study.tracks,
  };
}

/** Structural check, throwing a readable error at the offending path (T31). Attack contents stay unchecked. */
export function validateStudyV6(value: unknown): StudyV6 {
  const study = record(value, "study");
  if (study.schemaVersion !== 6) reject("schemaVersion", "must be 6");
  nonEmptyString(study.encounterId, "encounterId");
  nonEmptyString(study.archetypeId, "archetypeId");
  record(study.provenance, "provenance");
  array(study.boundaries, "boundaries").forEach((entry, index) => {
    const path = `boundaries[${index}]`;
    const boundary = record(entry, path);
    const time = nonNegativeFinite(boundary.timeSeconds, `${path}.timeSeconds`);
    nonEmptyString(boundary.segmentId, `${path}.segmentId`);
    if (boundary.telegraphEndSeconds !== undefined) {
      const end = nonNegativeFinite(boundary.telegraphEndSeconds, `${path}.telegraphEndSeconds`);
      if (end <= time) reject(`${path}.telegraphEndSeconds`, "must be after the boundary's time");
    }
  });
  array(study.statusSpans, "statusSpans").forEach((entry, index) => {
    const path = `statusSpans[${index}]`;
    const span = record(entry, path);
    if (span.kind !== "invulnerable") reject(`${path}.kind`, "must be invulnerable");
    const inSeconds = nonNegativeFinite(span.inSeconds, `${path}.inSeconds`);
    if (span.outSeconds !== null) {
      const out = nonNegativeFinite(span.outSeconds, `${path}.outSeconds`);
      if (out <= inSeconds) reject(`${path}.outSeconds`, "must be after inSeconds");
    }
  });
  const ids = new Set<string>();
  array(study.tracks, "tracks").forEach((entry, index) => {
    const id = validateTrack(entry, `tracks[${index}]`);
    if (ids.has(id)) reject(`tracks[${index}].id`, `repeats the track id ${id}`);
    ids.add(id);
  });
  array(study.scratch, "scratch").forEach((mark, index) =>
    validateMark(mark, `scratch[${index}]`),
  );
  if (study.scale !== undefined) {
    const scale = record(study.scale, "scale");
    if (
      typeof scale.tileWidthFraction !== "number" ||
      !Number.isFinite(scale.tileWidthFraction) ||
      scale.tileWidthFraction <= 0
    )
      reject("scale.tileWidthFraction", "must be a positive finite number");
  }
  return value as StudyV6;
}
