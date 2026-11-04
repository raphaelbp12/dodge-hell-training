/**
 * Pure research-tagging model, structural validator and interval derivation.
 *
 * Boundary (T13): this module depends one-way on `game/config/`; nothing under
 * `game/` may import from `research/`. It imports nothing at all today, and in
 * particular must stay free of React, the DOM, the video APIs, Phaser and the
 * simulation/session layers so the derivation is testable as plain arithmetic.
 */

export type TagKind = "volley" | "rotating-arm";

export type Tag = Readonly<{
  /** Seconds from video start, from requestVideoFrameCallback's mediaTime (T19). */
  timeSeconds: number;
  /** Authored top-level phase index. No sub-phase field, per T25. */
  phaseIndex: number;
  /** A sprite-level appearance id. Never a variant id (T20). */
  spriteId: string;
  kind: TagKind;
  /** Projectiles in the volley, or arms for a rotating attack (T23, T24). */
  shots: number;
}>;

export type VideoProvenance = Readonly<{
  /** The public source URL, or null for a local-only recording. */
  sourceUrl: string | null;
  fileName: string;
  frameRate: number;
  durationSeconds: number;
}>;

export type ObservationExport = Readonly<{
  /** One video is one fight, so the encounter is recorded once here (T16). */
  encounterId: string;
  provenance: VideoProvenance;
  /** ISO date the export was written. */
  recordedAt: string;
  tags: readonly Tag[];
}>;

export type IntervalSummary = Readonly<{
  phaseIndex: number;
  spriteId: string;
  kind: TagKind;
  /** Intervals observed, one fewer than the group's tag count. */
  sampleCount: number;
  meanSeconds: number;
  stdevSeconds: number;
}>;

const TAG_KINDS: readonly TagKind[] = ["volley", "rotating-arm"];

function reject(path: string, reason: string): never {
  throw new RangeError(`Observation export ${path} ${reason}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) reject(path, "must be an object");
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    reject(path, "must be a nonempty string");
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string") reject(path, "must be a string");
  return value;
}

function positiveFinite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    reject(path, "must be a positive finite number");
  return value;
}

function nonNegativeFinite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    reject(path, "must be a nonnegative finite number");
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const number = nonNegativeFinite(value, path);
  if (!Number.isInteger(number)) reject(path, "must be an integer");
  return number;
}

function positiveInteger(value: unknown, path: string): number {
  const number = positiveFinite(value, path);
  if (!Number.isInteger(number)) reject(path, "must be an integer");
  return number;
}

/** The exact ISO-8601 form `Date#toISOString` writes, with a timezone. */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isoDate(value: unknown, path: string): string {
  const text = string(value, path);
  if (!ISO_DATE_TIME.test(text) || Number.isNaN(Date.parse(text)))
    reject(path, "must be an ISO date string");
  return text;
}

function tagKind(value: unknown, path: string): TagKind {
  if (value !== "volley" && value !== "rotating-arm")
    reject(path, `must be one of ${TAG_KINDS.join(", ")}`);
  return value;
}

function provenance(value: unknown): VideoProvenance {
  const source = record(value, "provenance");
  const sourceUrl = source.sourceUrl;
  if (sourceUrl !== null && typeof sourceUrl !== "string")
    reject("provenance.sourceUrl", "must be a string or null");
  return {
    sourceUrl,
    fileName: nonEmptyString(source.fileName, "provenance.fileName"),
    frameRate: positiveFinite(source.frameRate, "provenance.frameRate"),
    durationSeconds: positiveFinite(
      source.durationSeconds,
      "provenance.durationSeconds",
    ),
  };
}

function tag(value: unknown, index: number): Tag {
  const path = `tags[${index}]`;
  const source = record(value, path);
  return {
    timeSeconds: nonNegativeFinite(
      source.timeSeconds,
      `${path}.timeSeconds`,
    ),
    phaseIndex: nonNegativeInteger(source.phaseIndex, `${path}.phaseIndex`),
    spriteId: nonEmptyString(source.spriteId, `${path}.spriteId`),
    kind: tagKind(source.kind, `${path}.kind`),
    shots: positiveInteger(source.shots, `${path}.shots`),
  };
}

/**
 * Structural validation only; throws on malformed input, never coerces (T31).
 *
 * Deliberately does NOT check the sprite id against the appearance catalog, the
 * phase index against the encounter's phase count, or a tag time against the
 * video duration. This guards a committed evidence file for the long term: a
 * later configuration change must not invalidate an observation of what a
 * video actually showed. A referential mistake is caught in the tagger at tag
 * time, where it is actionable, because the tagger only offers real options.
 */
export function validateObservationExport(value: unknown): ObservationExport {
  const source = record(value, "");
  nonEmptyString(source.encounterId, "encounterId");
  provenance(source.provenance);
  isoDate(source.recordedAt, "recordedAt");
  if (!Array.isArray(source.tags)) reject("tags", "must be an array");
  source.tags.forEach((entry, index) => tag(entry, index));
  // Return the caller's own object unchanged: the export is evidence, and this
  // function is a guard rather than a normalizer.
  return value as ObservationExport;
}

type MutableGroup = {
  phaseIndex: number;
  spriteId: string;
  kind: TagKind;
  times: number[];
};

function compareText(first: string, second: string): number {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function compareGroups(first: MutableGroup, second: MutableGroup): number {
  return (
    first.phaseIndex - second.phaseIndex ||
    compareText(first.spriteId, second.spriteId) ||
    compareText(first.kind, second.kind)
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Groups by the three-part key `(phaseIndex, spriteId, kind)`, then derives the
 * interval sample count, mean and population standard deviation (T32).
 *
 * Population statistics are the right choice here: these are complete
 * observations of a tagged run, not a sample drawn from a larger population.
 * The derivation stops at these three statistics. It deliberately emits
 * nothing shaped like authored cadence (`shotsPerBurst`, `shotIntervalSeconds`,
 * `cooldownAfterLastShotSeconds`); that mapping is the tuning decision held
 * under D13 and T08 forbids making it here.
 */
export function summarizeTags(tags: readonly Tag[]): readonly IntervalSummary[] {
  const groups = new Map<string, MutableGroup>();
  for (const entry of tags) {
    const key = `${entry.phaseIndex}\u0000${entry.spriteId}\u0000${entry.kind}`;
    const group = groups.get(key);
    if (group) group.times.push(entry.timeSeconds);
    else
      groups.set(key, {
        phaseIndex: entry.phaseIndex,
        spriteId: entry.spriteId,
        kind: entry.kind,
        times: [entry.timeSeconds],
      });
  }
  return [...groups.values()].sort(compareGroups).map((group) => {
    const times = [...group.times].sort((first, second) => first - second);
    const intervals = times
      .slice(1)
      .map((time, index) => time - times[index]);
    if (intervals.length === 0)
      return {
        phaseIndex: group.phaseIndex,
        spriteId: group.spriteId,
        kind: group.kind,
        sampleCount: 0,
        meanSeconds: 0,
        stdevSeconds: 0,
      };
    const average = mean(intervals);
    const variance = mean(
      intervals.map((interval) => (interval - average) ** 2),
    );
    return {
      phaseIndex: group.phaseIndex,
      spriteId: group.spriteId,
      kind: group.kind,
      sampleCount: intervals.length,
      meanSeconds: average,
      stdevSeconds: Math.sqrt(variance),
    };
  });
}
