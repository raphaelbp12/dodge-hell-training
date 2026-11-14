/**
 * Pure research-tagging model, structural validator and interval derivation.
 *
 * Boundary (T13): this module depends one-way on `game/config/`; nothing under
 * `game/` may import from `research/`. It imports nothing at all today, and in
 * particular must stay free of React, the DOM, the video APIs, Phaser and the
 * simulation/session layers so the derivation is testable as plain arithmetic.
 */
import type { AuthoredAttack } from "../game/config/data";
import { validateStudyV5, type StudyV5 } from "./study";

/**
 * V18 L28: the monster draft a v4 study or session stored. Kept only so those
 * files still load and convert (plan V20 E02); nothing writes it any more.
 */
export type MonsterDraft = Readonly<{
  phases: readonly Readonly<{
    phaseId: string;
    attacks: readonly AuthoredAttack[];
    subPhases: readonly Readonly<{
      subPhaseId: string;
      attacks: readonly AuthoredAttack[];
    }>[];
  }>[];
  /** Block id to video seconds; never exported (L22). */
  anchors: Readonly<Record<string, number>>;
}>;

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

/** N19: `front` records only the aim, never a number. */
export type TagAim = "player" | "fixed" | "front";

/** N31: what each arm of a ring fires; one level only (N33). */
export type TagArmPattern = "spread" | "scatter" | "ring";

/** Everything a saved attack and an unlinked tag have in common (plan V16). */
export type TagAttackFields = Readonly<{
  /** A sprite-level appearance id. Never a variant id (T20). */
  spriteId: string;
  pattern: TagPattern;
  /** Required on spread and scatter, absent on every other pattern (Z05). */
  aim?: TagAim;
  /** Projectiles in the volley, or arms for a ring. */
  shots: number;
  /** N31: rings only. What each arm fires; absent means a single shot. */
  armPattern?: TagArmPattern;
  /** N31: required with `armPattern`, absent without it. */
  shotsPerArm?: number;
  /** N34: required when `armPattern` is spread or scatter. A typed estimate. */
  armArcDegrees?: number;
  /** N35: `rotating-arm` only. A typed estimate, not a measurement. */
  clockwiseDegreesPerSecond?: number;
  /** N35: `rotating-arm` only. A typed estimate, not a measurement. */
  initialPhaseDegrees?: number;
  /** S25: rings only. A typed estimate. */
  emitterRadiusTiles?: number;
  /** S22: spread and scatter only. A typed estimate. */
  coneDegrees?: number;
  /** S22: aim "fixed" only. A typed estimate. */
  fixedBearingDegrees?: number;
  /** S22: aim "front" only. A typed estimate. */
  frontOffsetDegrees?: number;
  /** S08: a one-shot spread with aim "player". */
  target?: "player";
  /** S11: absent when `target` is set (S12). A typed estimate. */
  bombRangeTiles?: number;
  /** S11. A typed estimate. */
  bombTravelSeconds?: number;
  /** S24. A typed estimate. */
  bulletSpeedTilesPerSecond?: number;
  /** S24. A typed estimate. */
  bulletRangeTiles?: number;
}>;

type TagCommon = Readonly<{
  /** Seconds from video start, from requestVideoFrameCallback's mediaTime (T19). */
  timeSeconds: number;
  /** Authored top-level phase index. No sub-phase field, per T25. */
  phaseIndex: number;
  /** Shared by every volley of one burst; a positive integer (Z08). Never with `repeatEndSeconds` (S42). */
  burstId?: number;
  /** Present only when a person typed this time (Z21). */
  timeSource?: "typed";
}>;

export type UnlinkedTag = TagCommon & TagAttackFields;

export type LinkedTag = TagCommon &
  Readonly<{
    savedAttackId: string;
    /** S38: after `timeSeconds`. */
    repeatEndSeconds?: number;
    /** S41: only with `repeatEndSeconds`. */
    repeatEndSource?: "typed";
  }>;

/** What a study stores (S29). */
export type StoredTag = UnlinkedTag | LinkedTag;

/** What every reader uses: a stored tag with its attack's values filled in. */
export type Tag = UnlinkedTag &
  Readonly<{
    savedAttackId?: string;
    repeatEndSeconds?: number;
    repeatEndSource?: "typed";
  }>;

export type SavedAttackCadence = Readonly<{
  shotsPerBurst: number;
  /** S28: required above 1 shot per burst, absent at 1. */
  shotIntervalSeconds?: number;
  cooldownAfterLastShotSeconds: number;
}>;

export type SavedAttack = TagAttackFields &
  Readonly<{
    /** Stable and never shown (S35). */
    id: string;
    /** Nonblank and unique within the study. */
    name: string;
    cadence: SavedAttackCadence;
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

export type ObservationExportV2 = Readonly<{
  schemaVersion: 2;
  encounterId: string;
  provenance: VideoProvenance;
  recordedAt: string;
  tags: readonly UnlinkedTag[];
}>;

export type ObservationExportV3 = Readonly<{
  schemaVersion: 3;
  encounterId: string;
  provenance: VideoProvenance;
  recordedAt: string;
  savedAttacks: readonly SavedAttack[];
  tags: readonly StoredTag[];
}>;

export type ObservationExportV4 = Readonly<{
  schemaVersion: 4;
  encounterId: string;
  archetypeId: string;
  provenance: VideoProvenance;
  recordedAt: string;
  savedAttacks: readonly SavedAttack[];
  tags: readonly StoredTag[];
  monsterDraft: MonsterDraft | null;
}>;

export type ObservationExport = ObservationExportV4;

/** Plan V20 E02: a v5 study file is the timeline study itself. */
export type ObservationExportV5 = StudyV5;

type AnyObservationExport =
  | ObservationExportV1
  | ObservationExportV2
  | ObservationExportV3
  | ObservationExportV4
  | ObservationExportV5;

/** A loaded or restored study, before it can be exported. */
export type StudyState = Readonly<{
  encounterId: string;
  /** Null on a study older than v4, which means the primary monster. */
  archetypeId: string | null;
  provenance: Readonly<{
    sourceUrl: string | null;
    fileName: string;
    /** Null until entered: a v1 upgrade carries no presented rate (Z27). */
    frameRate: number | null;
    durationSeconds: number;
  }>;
  savedAttacks: readonly SavedAttack[];
  tags: readonly StoredTag[];
  monsterDraft: MonsterDraft | null;
}>;

const TAG_KINDS_V1: readonly TagKindV1[] = ["volley", "rotating-arm"];
const TAG_PATTERNS: readonly TagPattern[] = [
  "rotating-arm",
  "fixed-ring",
  "spread",
  "scatter",
  "volley",
];
const TAG_AIMS: readonly TagAim[] = ["player", "fixed", "front"];
const TAG_ARM_PATTERNS: readonly TagArmPattern[] = ["spread", "scatter", "ring"];

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

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    reject(path, "must be a finite number");
  return value;
}

/**
 * Why `degrees` cannot be the typed width of a spread or scatter arm, or null
 * when it can. The ranges match the game's own: a spread arc is below a full
 * turn and a scatter cone is positive and at most one.
 */
export function armArcProblem(
  armPattern: "spread" | "scatter",
  degrees: number,
): string | null {
  if (!Number.isFinite(degrees)) return "must be a finite number of degrees";
  if (armPattern === "spread")
    return degrees >= 0 && degrees < 360 ? null : "must be from 0 up to, not including, 360 degrees";
  return degrees > 0 && degrees <= 360 ? null : "must be above 0 and at most 360 degrees";
}

/** Shape check for the composite and typed-geometry fields of one tag (N31, N34, N35). */
function validateGeometryFields(
  source: Record<string, unknown>,
  pattern: TagPattern,
  path: string,
): void {
  const isRing = pattern === "rotating-arm" || pattern === "fixed-ring";
  if (source.armPattern !== undefined) {
    if (!isRing)
      reject(`${path}.armPattern`, "must be absent unless the pattern is a ring");
    if (!TAG_ARM_PATTERNS.includes(source.armPattern as TagArmPattern))
      reject(`${path}.armPattern`, `must be one of ${TAG_ARM_PATTERNS.join(", ")}`);
    positiveInteger(source.shotsPerArm, `${path}.shotsPerArm`);
    if (source.armPattern === "ring") {
      if (source.armArcDegrees !== undefined)
        reject(`${path}.armArcDegrees`, "must be absent when armPattern is ring");
    } else {
      const arc = nonNegativeFinite(source.armArcDegrees, `${path}.armArcDegrees`);
      const problem = armArcProblem(source.armPattern as "spread" | "scatter", arc);
      if (problem) reject(`${path}.armArcDegrees`, problem);
    }
  } else {
    if (source.shotsPerArm !== undefined)
      reject(`${path}.shotsPerArm`, "must be absent without armPattern");
    if (source.armArcDegrees !== undefined)
      reject(`${path}.armArcDegrees`, "must be absent without armPattern");
  }
  for (const field of ["clockwiseDegreesPerSecond", "initialPhaseDegrees"] as const) {
    if (source[field] === undefined) continue;
    if (pattern !== "rotating-arm")
      reject(`${path}.${field}`, "must be absent unless the pattern is rotating-arm");
    finite(source[field], `${path}.${field}`);
  }
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

/** Every field an unlinked tag and a saved attack share. */
export const TAG_ATTACK_FIELD_KEYS: readonly (keyof TagAttackFields)[] = [
  "spriteId",
  "pattern",
  "aim",
  "shots",
  "armPattern",
  "shotsPerArm",
  "armArcDegrees",
  "clockwiseDegreesPerSecond",
  "initialPhaseDegrees",
  "emitterRadiusTiles",
  "coneDegrees",
  "fixedBearingDegrees",
  "frontOffsetDegrees",
  "target",
  "bombRangeTiles",
  "bombTravelSeconds",
  "bulletSpeedTilesPerSecond",
  "bulletRangeTiles",
];

/** Shape check for the attack fields a tag and a saved attack share (Z05, N31-N35, S22-S25, S08-S11). */
function validateAttackFields(
  source: Record<string, unknown>,
  path: string,
): TagAttackFields {
  const pattern = tagPattern(source.pattern, `${path}.pattern`);
  const takesAim = pattern === "spread" || pattern === "scatter";
  if (takesAim) {
    if (!TAG_AIMS.includes(source.aim as TagAim))
      reject(`${path}.aim`, `must be one of ${TAG_AIMS.join(", ")}`);
  } else if (source.aim !== undefined) {
    reject(`${path}.aim`, "must be absent unless the pattern is spread or scatter");
  }
  validateGeometryFields(source, pattern, path);
  nonEmptyString(source.spriteId, `${path}.spriteId`);
  const shots = positiveInteger(source.shots, `${path}.shots`);
  const isRing = pattern === "rotating-arm" || pattern === "fixed-ring";
  if (source.emitterRadiusTiles !== undefined) {
    if (!isRing)
      reject(`${path}.emitterRadiusTiles`, "must be absent unless the pattern is a ring");
    finite(source.emitterRadiusTiles, `${path}.emitterRadiusTiles`);
  }
  if (source.coneDegrees !== undefined) {
    if (!takesAim)
      reject(`${path}.coneDegrees`, "must be absent unless the pattern is spread or scatter");
    const cone = finite(source.coneDegrees, `${path}.coneDegrees`);
    const problem = armArcProblem(pattern as "spread" | "scatter", cone);
    if (problem) reject(`${path}.coneDegrees`, problem);
  }
  if (source.fixedBearingDegrees !== undefined) {
    if (source.aim !== "fixed")
      reject(`${path}.fixedBearingDegrees`, 'must be absent unless aim is "fixed"');
    finite(source.fixedBearingDegrees, `${path}.fixedBearingDegrees`);
  }
  if (source.frontOffsetDegrees !== undefined) {
    if (source.aim !== "front")
      reject(`${path}.frontOffsetDegrees`, 'must be absent unless aim is "front"');
    finite(source.frontOffsetDegrees, `${path}.frontOffsetDegrees`);
  }
  if (source.target !== undefined) {
    if (source.target !== "player")
      reject(`${path}.target`, 'must be "player" when present');
    if (pattern !== "spread" || shots !== 1 || source.aim !== "player")
      reject(
        `${path}.target`,
        'must be absent unless the tag is a one-shot spread with aim "player"',
      );
    if (source.bombRangeTiles !== undefined)
      reject(`${path}.bombRangeTiles`, "must be absent when target is set");
  }
  for (const field of [
    "bombRangeTiles",
    "bombTravelSeconds",
    "bulletSpeedTilesPerSecond",
    "bulletRangeTiles",
  ] as const)
    if (source[field] !== undefined) positiveFinite(source[field], `${path}.${field}`);
  return source as TagAttackFields;
}

/** The S28 cadence rule. */
function validateCadence(value: unknown, path: string): SavedAttackCadence {
  const source = record(value, path);
  const perBurst = positiveInteger(source.shotsPerBurst, `${path}.shotsPerBurst`);
  if (perBurst > 1) positiveFinite(source.shotIntervalSeconds, `${path}.shotIntervalSeconds`);
  else if (source.shotIntervalSeconds !== undefined)
    reject(`${path}.shotIntervalSeconds`, "must be absent when shotsPerBurst is 1");
  positiveFinite(
    source.cooldownAfterLastShotSeconds,
    `${path}.cooldownAfterLastShotSeconds`,
  );
  return source as SavedAttackCadence;
}

function validateCommon(source: Record<string, unknown>, path: string): void {
  if (source.burstId !== undefined)
    positiveInteger(source.burstId, `${path}.burstId`);
  if (source.timeSource !== undefined && source.timeSource !== "typed")
    reject(`${path}.timeSource`, 'must be "typed" when present');
  nonNegativeFinite(source.timeSeconds, `${path}.timeSeconds`);
  nonNegativeInteger(source.phaseIndex, `${path}.phaseIndex`);
}

/**
 * Shape check for one stored tag, linked or not (Z05, Z08, Z21, S29, S42).
 * Shared with the saved-session validator so the tag rules exist once. Whether
 * a linked tag's attack exists is checked by `validateSavedAttackLinks`.
 */
export function validateStoredTag(value: unknown, path: string): StoredTag {
  const source = record(value, path);
  validateCommon(source, path);
  if (source.savedAttackId === undefined) {
    for (const field of ["repeatEndSeconds", "repeatEndSource"] as const)
      if (source[field] !== undefined)
        reject(`${path}.${field}`, "must be absent without savedAttackId");
    validateAttackFields(source, path);
    return value as StoredTag;
  }
  nonEmptyString(source.savedAttackId, `${path}.savedAttackId`);
  for (const key of TAG_ATTACK_FIELD_KEYS)
    if (source[key] !== undefined)
      reject(`${path}.${key}`, "must be absent on a tag linked to a saved attack");
  if (source.repeatEndSeconds !== undefined) {
    const end = finite(source.repeatEndSeconds, `${path}.repeatEndSeconds`);
    if (end <= (source.timeSeconds as number))
      reject(`${path}.repeatEndSeconds`, "must be after timeSeconds");
    if (source.burstId !== undefined)
      reject(`${path}.burstId`, "must be absent on a repeat");
  }
  if (source.repeatEndSource !== undefined) {
    if (source.repeatEndSource !== "typed")
      reject(`${path}.repeatEndSource`, 'must be "typed" when present');
    if (source.repeatEndSeconds === undefined)
      reject(`${path}.repeatEndSource`, "must be absent without repeatEndSeconds");
  }
  return value as StoredTag;
}

/** Shape check for one tag; kept as the name the older readers use. */
export function validateTag(value: unknown, path: string): Tag {
  return validateStoredTag(value, path) as Tag;
}

/** Structural check for one saved attack: unique ids and names are checked across the list. */
export function validateSavedAttack(value: unknown, path: string): SavedAttack {
  const source = record(value, path);
  nonEmptyString(source.id, `${path}.id`);
  nonEmptyString(source.name, `${path}.name`);
  validateAttackFields(source, path);
  validateCadence(source.cadence, `${path}.cadence`);
  return value as SavedAttack;
}

export function validateSavedAttacks(
  value: unknown,
  path: string,
): readonly SavedAttack[] {
  if (!Array.isArray(value)) reject(path, "must be an array");
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.map((entry, index) => {
    const attack = validateSavedAttack(entry, `${path}[${index}]`);
    if (ids.has(attack.id)) reject(`${path}[${index}].id`, "must be unique");
    if (names.has(attack.name)) reject(`${path}[${index}].name`, "must be unique");
    ids.add(attack.id);
    names.add(attack.name);
    return attack;
  });
}

/** Every linked tag must name a saved attack in the same file. */
export function validateSavedAttackLinks(
  tags: readonly StoredTag[],
  savedAttacks: readonly SavedAttack[],
  path: string,
): void {
  const ids = new Set(savedAttacks.map((attack) => attack.id));
  tags.forEach((entry, index) => {
    if ("savedAttackId" in entry && !ids.has(entry.savedAttackId))
      reject(`${path}[${index}].savedAttackId`, "must name a saved attack in this file");
  });
}

/** V18 L28: structural check of a stored draft; attack contents stay unchecked (T31). */
export function validateMonsterDraft(value: unknown, path: string): MonsterDraft {
  const draft = record(value, path);
  const attackList = (list: unknown, at: string) => {
    if (!Array.isArray(list)) reject(at, "must be an array");
    list.forEach((attack, index) => record(attack, `${at}[${index}]`));
  };
  if (!Array.isArray(draft.phases)) reject(`${path}.phases`, "must be an array");
  draft.phases.forEach((entry, index) => {
    const phasePath = `${path}.phases[${index}]`;
    const phase = record(entry, phasePath);
    nonEmptyString(phase.phaseId, `${phasePath}.phaseId`);
    attackList(phase.attacks, `${phasePath}.attacks`);
    if (!Array.isArray(phase.subPhases))
      reject(`${phasePath}.subPhases`, "must be an array");
    phase.subPhases.forEach((subEntry, subIndex) => {
      const subPath = `${phasePath}.subPhases[${subIndex}]`;
      const sub = record(subEntry, subPath);
      nonEmptyString(sub.subPhaseId, `${subPath}.subPhaseId`);
      attackList(sub.attacks, `${subPath}.attacks`);
    });
  });
  const anchors = record(draft.anchors, `${path}.anchors`);
  for (const [id, seconds] of Object.entries(anchors))
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0)
      reject(`${path}.anchors.${id}`, "must be a nonnegative finite number");
  return value as MonsterDraft;
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
): AnyObservationExport {
  const source = record(value, "");
  const version = source.schemaVersion;
  if (version === 5) return validateStudyV5(value);
  if (version !== undefined && version !== 2 && version !== 3 && version !== 4)
    reject("schemaVersion", "must be 2, 3, 4 or 5 when present");
  nonEmptyString(source.encounterId, "encounterId");
  provenance(source.provenance);
  isoDate(source.recordedAt, "recordedAt");
  if (!Array.isArray(source.tags)) reject("tags", "must be an array");
  if (version === 3 || version === 4) {
    if (version === 4) {
      nonEmptyString(source.archetypeId, "archetypeId");
      if (source.monsterDraft !== null)
        validateMonsterDraft(source.monsterDraft, "monsterDraft");
    }
    const savedAttacks = validateSavedAttacks(source.savedAttacks, "savedAttacks");
    const tags = source.tags.map((entry, index) =>
      validateStoredTag(entry, `tags[${index}]`),
    );
    validateSavedAttackLinks(tags, savedAttacks, "tags");
  } else if (version === 2)
    source.tags.forEach((entry, index) => validateTag(entry, `tags[${index}]`));
  else source.tags.forEach((entry, index) => tagV1(entry, index));
  // Return the caller's own object unchanged: the export is evidence, and this
  // function is a guard rather than a normalizer.
  return value as AnyObservationExport;
}

/**
 * Turns a validated export into a study. v1 upgrades in memory only: `kind`
 * becomes `pattern`, and the v1 frame rate is not carried over because it
 * recorded the step setting, not the presented rate (Z12, Z27). v2 and v1
 * carry no saved attacks (S04).
 */
export function studyFromExport(
  validated: AnyObservationExport,
): StudyState | StudyV5 {
  if ("schemaVersion" in validated && validated.schemaVersion === 5) return validated;
  const { sourceUrl, fileName, durationSeconds } = validated.provenance;
  if ("schemaVersion" in validated)
    return {
      encounterId: validated.encounterId,
      archetypeId: validated.schemaVersion === 4 ? validated.archetypeId : null,
      provenance: {
        sourceUrl,
        fileName,
        frameRate: validated.provenance.frameRate,
        durationSeconds,
      },
      savedAttacks:
        validated.schemaVersion === 3 || validated.schemaVersion === 4
          ? validated.savedAttacks.map((attack) => ({ ...attack }))
          : [],
      tags: validated.tags.map((entry) => ({ ...entry })),
      monsterDraft:
        validated.schemaVersion === 4 ? validated.monsterDraft : null,
    };
  return {
    encounterId: validated.encounterId,
    archetypeId: null,
    provenance: { sourceUrl, fileName, frameRate: null, durationSeconds },
    monsterDraft: null,
    savedAttacks: [],
    tags: validated.tags.map((entry) => ({
      timeSeconds: entry.timeSeconds,
      phaseIndex: entry.phaseIndex,
      spriteId: entry.spriteId,
      pattern: entry.kind,
      shots: entry.shots,
    })),
  };
}

/**
 * Fills a linked tag's attack fields from its saved attack and passes an
 * unlinked tag through (S29). Throws on an unknown saved attack id.
 */
export function resolveTags(
  tags: readonly StoredTag[],
  savedAttacks: readonly SavedAttack[],
): readonly Tag[] {
  const byId = new Map(savedAttacks.map((attack) => [attack.id, attack]));
  return tags.map((entry) => {
    if (!("savedAttackId" in entry)) return entry;
    const attack = byId.get(entry.savedAttackId);
    if (!attack)
      throw new RangeError(`Unknown saved attack ${entry.savedAttackId}`);
    const fields: Record<string, unknown> = {};
    for (const key of TAG_ATTACK_FIELD_KEYS)
      if (attack[key] !== undefined) fields[key] = attack[key];
    return { ...fields, ...entry } as Tag;
  });
}

/** The Z06 grouping key (V16 S14 adds target and saved attack), shared with the tagger's live readout. */
export function groupKey(
  entry: Pick<
    Tag,
    "phaseIndex" | "spriteId" | "pattern" | "aim" | "armPattern" | "target" | "savedAttackId"
  >,
): string {
  return [
    entry.phaseIndex,
    entry.spriteId,
    entry.pattern,
    entry.aim ?? "",
    entry.armPattern ?? "",
    entry.target ?? "",
    entry.savedAttackId ?? "",
  ].join("\u0000");
}
