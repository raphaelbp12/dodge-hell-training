/**
 * Pure research-tagging model, structural validator and interval derivation.
 *
 * Boundary (T13): this module depends one-way on `game/config/`; nothing under
 * `game/` may import from `research/`. It imports nothing at all today, and in
 * particular must stay free of React, the DOM, the video APIs, Phaser and the
 * simulation/session layers so the derivation is testable as plain arithmetic.
 */

export type TagKindV1 = "volley" | "rotating-arm";

/** The schema-v1 tag, kept for the committed evidence and the in-memory upgrade (Z12). */
export type TagV1 = Readonly<{
  /** Seconds from video start, from requestVideoFrameCallback's mediaTime (T19). */
  timeSeconds: number;
  /** Authored top-level phase index. No sub-phase field, per T25. */
  phaseIndex: number;
  /** A sprite-level appearance id. Never a variant id (T20). */
  spriteId: string;
  kind: TagKindV1;
  /** Projectiles in the volley, or arms for a rotating attack (T23, T24). */
  shots: number;
}>;

/** Where the shots go. `volley` is load-only (Z04). */
export type TagPattern =
  | "rotating-arm"
  | "fixed-ring"
  | "spread"
  | "scatter"
  | "volley";

export type TagAim = "player" | "fixed";

export type Tag = Readonly<{
  /** Seconds from video start, from requestVideoFrameCallback's mediaTime (T19). */
  timeSeconds: number;
  /** Authored top-level phase index. No sub-phase field, per T25. */
  phaseIndex: number;
  /** A sprite-level appearance id. Never a variant id (T20). */
  spriteId: string;
  pattern: TagPattern;
  /** Required on spread and scatter, absent on every other pattern (Z05). */
  aim?: TagAim;
  /** Projectiles in the volley, or arms for a ring. */
  shots: number;
  /** Shared by every volley of one burst; a positive integer (Z08). */
  burstId?: number;
  /** Present only when a person typed this time (Z21). */
  timeSource?: "typed";
}>;

export type VideoProvenance = Readonly<{
  /** The public source URL, or null for a local-only recording. */
  sourceUrl: string | null;
  fileName: string;
  /** The video's presented frame rate (Z26). */
  frameRate: number;
  durationSeconds: number;
}>;

export type ObservationExportV1 = Readonly<{
  /** One video is one fight, so the encounter is recorded once here (T16). */
  encounterId: string;
  provenance: VideoProvenance;
  /** ISO date the export was written. */
  recordedAt: string;
  tags: readonly TagV1[];
}>;

export type ObservationExport = Readonly<{
  schemaVersion: 2;
  encounterId: string;
  provenance: VideoProvenance;
  recordedAt: string;
  tags: readonly Tag[];
}>;

/** A loaded or restored study, before it can be exported. */
export type StudyState = Readonly<{
  encounterId: string;
  provenance: Readonly<{
    sourceUrl: string | null;
    fileName: string;
    /** Null until entered: a v1 upgrade carries no presented rate (Z27). */
    frameRate: number | null;
    durationSeconds: number;
  }>;
  tags: readonly Tag[];
}>;

export type IntervalScope = "all" | "between-bursts" | "within-bursts";

export type IntervalSummary = Readonly<{
  phaseIndex: number;
  spriteId: string;
  pattern: TagPattern;
  aim?: TagAim;
  scope: IntervalScope;
  /** Intervals observed in this scope. */
  sampleCount: number;
  meanSeconds: number;
  stdevSeconds: number;
  intervalsSeconds: readonly number[];
}>;

const TAG_KINDS_V1: readonly TagKindV1[] = ["volley", "rotating-arm"];
const TAG_PATTERNS: readonly TagPattern[] = [
  "rotating-arm",
  "fixed-ring",
  "spread",
  "scatter",
  "volley",
];
const TAG_AIMS: readonly TagAim[] = ["player", "fixed"];

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

function tagKind(value: unknown, path: string): TagKindV1 {
  if (value !== "volley" && value !== "rotating-arm")
    reject(path, `must be one of ${TAG_KINDS_V1.join(", ")}`);
  return value;
}

function tagPattern(value: unknown, path: string): TagPattern {
  if (!TAG_PATTERNS.includes(value as TagPattern))
    reject(path, `must be one of ${TAG_PATTERNS.join(", ")}`);
  return value as TagPattern;
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

function tagV1(value: unknown, index: number): TagV1 {
  const path = `tags[${index}]`;
  const source = record(value, path);
  return {
    timeSeconds: nonNegativeFinite(source.timeSeconds, `${path}.timeSeconds`),
    phaseIndex: nonNegativeInteger(source.phaseIndex, `${path}.phaseIndex`),
    spriteId: nonEmptyString(source.spriteId, `${path}.spriteId`),
    kind: tagKind(source.kind, `${path}.kind`),
    shots: positiveInteger(source.shots, `${path}.shots`),
  };
}

/**
 * Shape check for one v2 tag (Z05, Z08, Z21). Shared with the saved-session
 * validator so the tag rules exist once.
 */
export function validateTag(value: unknown, path: string): Tag {
  const source = record(value, path);
  const pattern = tagPattern(source.pattern, `${path}.pattern`);
  const takesAim = pattern === "spread" || pattern === "scatter";
  if (takesAim) {
    if (!TAG_AIMS.includes(source.aim as TagAim))
      reject(`${path}.aim`, `must be one of ${TAG_AIMS.join(", ")}`);
  } else if (source.aim !== undefined) {
    reject(`${path}.aim`, "must be absent unless the pattern is spread or scatter");
  }
  if (source.burstId !== undefined)
    positiveInteger(source.burstId, `${path}.burstId`);
  if (source.timeSource !== undefined && source.timeSource !== "typed")
    reject(`${path}.timeSource`, 'must be "typed" when present');
  nonNegativeFinite(source.timeSeconds, `${path}.timeSeconds`);
  nonNegativeInteger(source.phaseIndex, `${path}.phaseIndex`);
  nonEmptyString(source.spriteId, `${path}.spriteId`);
  positiveInteger(source.shots, `${path}.shots`);
  return value as Tag;
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
export function validateObservationExport(
  value: unknown,
): ObservationExportV1 | ObservationExport {
  const source = record(value, "");
  const version = source.schemaVersion;
  if (version !== undefined && version !== 2)
    reject("schemaVersion", "must be 2 when present");
  nonEmptyString(source.encounterId, "encounterId");
  provenance(source.provenance);
  isoDate(source.recordedAt, "recordedAt");
  if (!Array.isArray(source.tags)) reject("tags", "must be an array");
  if (version === 2)
    source.tags.forEach((entry, index) => validateTag(entry, `tags[${index}]`));
  else source.tags.forEach((entry, index) => tagV1(entry, index));
  // Return the caller's own object unchanged: the export is evidence, and this
  // function is a guard rather than a normalizer.
  return value as ObservationExportV1 | ObservationExport;
}

/**
 * Turns a validated export into a study. v1 upgrades in memory only: `kind`
 * becomes `pattern`, and the v1 frame rate is not carried over because it
 * recorded the step setting, not the presented rate (Z12, Z27).
 */
export function studyFromExport(
  validated: ObservationExportV1 | ObservationExport,
): StudyState {
  const { sourceUrl, fileName, durationSeconds } = validated.provenance;
  if ("schemaVersion" in validated)
    return {
      encounterId: validated.encounterId,
      provenance: {
        sourceUrl,
        fileName,
        frameRate: validated.provenance.frameRate,
        durationSeconds,
      },
      tags: validated.tags.map((entry) => ({ ...entry })),
    };
  return {
    encounterId: validated.encounterId,
    provenance: { sourceUrl, fileName, frameRate: null, durationSeconds },
    tags: validated.tags.map((entry) => ({
      timeSeconds: entry.timeSeconds,
      phaseIndex: entry.phaseIndex,
      spriteId: entry.spriteId,
      pattern: entry.kind,
      shots: entry.shots,
    })),
  };
}

type MutableGroup = {
  phaseIndex: number;
  spriteId: string;
  pattern: TagPattern;
  aim?: TagAim;
  tags: Tag[];
};

const SCOPE_ORDER: Readonly<Record<IntervalScope, number>> = {
  all: 0,
  "between-bursts": 1,
  "within-bursts": 2,
};

function compareText(first: string, second: string): number {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function compareSummaries(
  first: IntervalSummary,
  second: IntervalSummary,
): number {
  return (
    first.phaseIndex - second.phaseIndex ||
    compareText(first.spriteId, second.spriteId) ||
    compareText(first.pattern, second.pattern) ||
    compareText(first.aim ?? "", second.aim ?? "") ||
    SCOPE_ORDER[first.scope] - SCOPE_ORDER[second.scope]
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function differences(times: readonly number[]): number[] {
  return times.slice(1).map((time, index) => time - times[index]);
}

function byTime(first: number, second: number): number {
  return first - second;
}

function summaryOf(
  group: MutableGroup,
  scope: IntervalScope,
  intervals: readonly number[],
): IntervalSummary {
  const base = {
    phaseIndex: group.phaseIndex,
    spriteId: group.spriteId,
    pattern: group.pattern,
    ...(group.aim === undefined ? {} : { aim: group.aim }),
    scope,
    intervalsSeconds: intervals,
  };
  if (intervals.length === 0)
    return { ...base, sampleCount: 0, meanSeconds: 0, stdevSeconds: 0 };
  const average = mean(intervals);
  const variance = mean(intervals.map((interval) => (interval - average) ** 2));
  return {
    ...base,
    sampleCount: intervals.length,
    meanSeconds: average,
    stdevSeconds: Math.sqrt(variance),
  };
}

function summariesOf(group: MutableGroup): IntervalSummary[] {
  if (group.tags.every((entry) => entry.burstId === undefined))
    return [
      summaryOf(
        group,
        "all",
        differences(group.tags.map((entry) => entry.timeSeconds).sort(byTime)),
      ),
    ];
  // A burst is its tags sharing a burstId; a standalone tag is a burst of one.
  const bursts = new Map<string, number[]>();
  group.tags.forEach((entry, index) => {
    const key =
      entry.burstId === undefined ? `s${index}` : `b${entry.burstId}`;
    const times = bursts.get(key);
    if (times) times.push(entry.timeSeconds);
    else bursts.set(key, [entry.timeSeconds]);
  });
  const ordered = [...bursts.values()]
    .map((times) => [...times].sort(byTime))
    .sort((first, second) => first[0] - second[0]);
  return [
    summaryOf(group, "between-bursts", differences(ordered.map((times) => times[0]))),
    summaryOf(
      group,
      "within-bursts",
      ordered.flatMap((times) => differences(times)),
    ),
  ];
}

/**
 * Groups by `(phaseIndex, spriteId, pattern, aim)` (Z06), then derives the
 * interval sample count, mean and population standard deviation (T32).
 *
 * A group with no burst ids yields one `all` result. A group with any burst id
 * yields separate between-burst and within-burst results (Z10).
 *
 * Population statistics are the right choice here: these are complete
 * observations of a tagged run, not a sample drawn from a larger population.
 * The derivation deliberately emits nothing shaped like authored cadence
 * (`shotsPerBurst`, `shotIntervalSeconds`, `cooldownAfterLastShotSeconds`);
 * that mapping is the tuning decision held under D13 and T08 forbids making
 * it here.
 */
export function summarizeTags(tags: readonly Tag[]): readonly IntervalSummary[] {
  const groups = new Map<string, MutableGroup>();
  for (const entry of tags) {
    const key = groupKey(entry);
    const group = groups.get(key);
    if (group) group.tags.push(entry);
    else
      groups.set(key, {
        phaseIndex: entry.phaseIndex,
        spriteId: entry.spriteId,
        pattern: entry.pattern,
        aim: entry.aim,
        tags: [entry],
      });
  }
  return [...groups.values()].flatMap(summariesOf).sort(compareSummaries);
}

/** The Z06 grouping key, shared with the tagger's live readout. */
export function groupKey(
  entry: Pick<Tag, "phaseIndex" | "spriteId" | "pattern" | "aim">,
): string {
  return [entry.phaseIndex, entry.spriteId, entry.pattern, entry.aim ?? ""].join(
    "\u0000",
  );
}
