/**
 * Pure option, tag and export builders for the dev-only tagger (plan V8
 * phase 34.3). Everything here reads `game/config/` one way (T13) and stays
 * independent of React, the DOM and the video APIs.
 */
import { phaseLabel } from "../game/config/drill";
import {
  PROJECTILE_APPEARANCES,
  primaryArchetype,
  type EncounterConfig,
  type ProjectileAppearanceSpec,
} from "../game/config/encounter";
import {
  armArcProblem,
  groupKey,
  TAG_ATTACK_FIELD_KEYS,
  validateObservationExport,
  type IntervalSummary,
  type ObservationExport,
  type SavedAttack,
  type StoredTag,
  type Tag,
  type TagAim,
  type TagArmPattern,
  type TagAttackFields,
  type TagPattern,
  type VideoProvenance,
} from "./tagging";

export type AppearanceOption = Readonly<{
  id: string;
  isBomb: boolean;
  spec: ProjectileAppearanceSpec;
}>;

/**
 * T20/T21: exactly the catalog's 19 sprite-level entries, in authored order.
 * A bomb is flagged so the picker renders a label plus its `bodyColor` swatch
 * instead of an animation frame.
 */
export function appearanceOptions(): readonly AppearanceOption[] {
  return Object.entries(PROJECTILE_APPEARANCES).map(([id, spec]) => ({
    id,
    isBomb: spec.bomb !== undefined,
    spec,
  }));
}

export type PhaseOption = Readonly<{
  index: number;
  id: string;
  label: string;
}>;

/**
 * T16/T25: the selected encounter's authored top-level phases, labelled from
 * their ids. There is no sub-phase option because phase 3 has none.
 */
export function phaseOptions(
  config: EncounterConfig,
): readonly PhaseOption[] {
  return primaryArchetype(config).phases.map((phase, index) => ({
    index,
    id: phase.id,
    label: phaseLabel(phase.id, index),
  }));
}

export type PixelGrid = Readonly<{
  width: number;
  height: number;
  cells: readonly (string | null)[];
}>;

/** Flattens resolved appearance pixels for the picker's canvas renderer. */
export function pixelGridCells(
  pixels: readonly (readonly (string | null)[])[],
): PixelGrid {
  const width = pixels.reduce(
    (widest, row) => Math.max(widest, row.length),
    0,
  );
  return {
    width,
    height: pixels.length,
    cells: pixels.flatMap((row) => {
      const cells: (string | null)[] = [...row];
      while (cells.length < width) cells.push(null);
      return cells;
    }),
  };
}

/** Z03/Z04: the patterns a new or edited tag may use; `volley` is load-only. */
export const OFFERABLE_PATTERNS: readonly TagPattern[] = [
  "rotating-arm",
  "fixed-ring",
  "spread",
  "scatter",
];

const TAG_ARM_PATTERNS: readonly TagArmPattern[] = ["spread", "scatter", "ring"];

export const TAG_AIMS: readonly TagAim[] = ["player", "fixed", "front"];

export const DEFAULT_AIM: TagAim = "player";

/** Z05: only spread and scatter record where they aim. */
export function patternTakesAim(pattern: TagPattern): boolean {
  return pattern === "spread" || pattern === "scatter";
}

/** N31: only the two ring patterns host arms. */
export function armPatternAllowed(pattern: TagPattern): boolean {
  return pattern === "rotating-arm" || pattern === "fixed-ring";
}

/** N35: a typed rotation rate and phase only describe a rotating arm. */
export function rotationAllowed(pattern: TagPattern): boolean {
  return pattern === "rotating-arm";
}

/**
 * Starting values the controls offer when a person first chooses an arm
 * pattern. They are input conveniences for a typed estimate, not measurements
 * and not gameplay values.
 */
export const DEFAULT_SHOTS_PER_ARM = 2;
export const DEFAULT_ARM_ARC_DEGREES = 30;

/** An arm pattern's cone/arc is typed for spread and scatter only (N34). */
export function armPatternTakesArc(
  armPattern: TagArmPattern,
): armPattern is "spread" | "scatter" {
  return armPattern !== "ring";
}

/** Rings count arms, every other pattern counts shots. */
export function shotsLabel(pattern: TagPattern): "arms" | "shots" {
  return pattern === "rotating-arm" || pattern === "fixed-ring"
    ? "arms"
    : "shots";
}

/** The attack fields a sticky selection always holds; every other one is optional. */
type RequiredStickyKeys = "spriteId" | "pattern" | "shots";

/**
 * The optional attack fields a sticky selection may carry (N35, V16 S22-S25).
 * Each is kept even when the pattern ignores it, so the choice survives a
 * switch, and applied to a new tag only where `attackFieldApplies` allows it.
 */
export const STICKY_OPTIONAL_KEYS = TAG_ATTACK_FIELD_KEYS.filter(
  (key): key is Exclude<keyof TagAttackFields, RequiredStickyKeys | "aim"> =>
    key !== "spriteId" && key !== "pattern" && key !== "shots" && key !== "aim",
);

export type StickySelection = Readonly<{
  phaseIndex: number;
  spriteId: string;
  pattern: TagPattern;
  /** Kept even when the pattern ignores it, so the choice survives a switch. */
  aim: TagAim;
  shots: number;
}> &
  Readonly<
    Partial<
      Pick<TagAttackFields, (typeof STICKY_OPTIONAL_KEYS)[number]>
    >
  > &
  Readonly<{
    /** V16 S32: the chosen saved attack; absent means None. */
    savedAttackId?: string;
  }>;

/** T20: whether a sprite is one of the catalog's bombs. */
export function isBombSprite(spriteId: string): boolean {
  return PROJECTILE_APPEARANCES[spriteId]?.bomb !== undefined;
}

/**
 * Whether an attack field means anything for a tag of this shape (N31, N35,
 * V16 S08, S22-S25). Creation, editing and "use these settings" all ask this
 * one question, so a selection can never produce a tag `validateTag` rejects.
 */
export function attackFieldApplies(
  field: keyof TagAttackFields,
  shape: Readonly<{ pattern: TagPattern; aim?: TagAim; shots: number; spriteId: string }>,
): boolean {
  const takesAim = patternTakesAim(shape.pattern);
  switch (field) {
    case "armPattern":
    case "shotsPerArm":
    case "armArcDegrees":
    case "emitterRadiusTiles":
      return armPatternAllowed(shape.pattern);
    case "clockwiseDegreesPerSecond":
    case "initialPhaseDegrees":
      return rotationAllowed(shape.pattern);
    case "coneDegrees":
      return takesAim;
    case "fixedBearingDegrees":
      return takesAim && shape.aim === "fixed";
    case "frontOffsetDegrees":
      return takesAim && shape.aim === "front";
    case "target":
      return (
        isBombSprite(shape.spriteId) &&
        shape.pattern === "spread" &&
        shape.shots === 1 &&
        shape.aim === "player"
      );
    case "bombRangeTiles":
    case "bombTravelSeconds":
      return isBombSprite(shape.spriteId);
    case "bulletSpeedTilesPerSecond":
    case "bulletRangeTiles":
      return !isBombSprite(shape.spriteId);
    default:
      return true;
  }
}

/**
 * Drops every attack field the tag's shape disallows, and a composite whose
 * parts are incomplete (a spread or scatter arm needs its cone, every arm
 * pattern its shots per arm), so no tag is ever produced that `validateTag`
 * rejects. A targeted bomb lands on the player at any distance, so its range
 * goes too (S12).
 */
export function conformAttackFields<T extends TagAttackFields>(tag: T): T {
  const out: Record<string, unknown> = { ...tag };
  for (const key of TAG_ATTACK_FIELD_KEYS)
    if (out[key] !== undefined && !attackFieldApplies(key, tag)) delete out[key];
  if (armPatternAllowed(tag.pattern)) {
    const armPattern = out.armPattern as TagArmPattern | undefined;
    const incomplete =
      armPattern === undefined ||
      out.shotsPerArm === undefined ||
      (armPatternTakesArc(armPattern) && out.armArcDegrees === undefined);
    if (incomplete) {
      delete out.armPattern;
      delete out.shotsPerArm;
      delete out.armArcDegrees;
    } else if (armPattern === "ring") delete out.armArcDegrees;
  }
  if (out.target !== undefined) delete out.bombRangeTiles;
  return out as T;
}

/** T22: one keypress records the sticky selection at the presented frame time. */
export function createTag(
  mediaTimeSeconds: number,
  sticky: StickySelection,
  burstId?: number,
): Tag {
  const fields: Record<string, unknown> = {};
  for (const key of STICKY_OPTIONAL_KEYS)
    if (sticky[key] !== undefined) fields[key] = sticky[key];
  return {
    timeSeconds: mediaTimeSeconds,
    phaseIndex: sticky.phaseIndex,
    ...conformAttackFields({
      spriteId: sticky.spriteId,
      pattern: sticky.pattern,
      ...(patternTakesAim(sticky.pattern) ? { aim: sticky.aim } : {}),
      shots: sticky.shots,
      ...fields,
    }),
    ...(burstId === undefined ? {} : { burstId }),
  };
}

/**
 * V16 S20: copies a resolved tag's phase and attack fields into a sticky
 * selection. A field the tag's shape ignores keeps `current`'s value, so a
 * choice survives a pattern switch as it does today.
 */
export function stickyFromTag(tag: Tag, current: StickySelection): StickySelection {
  const next: Record<string, unknown> = {
    ...current,
    phaseIndex: tag.phaseIndex,
    spriteId: tag.spriteId,
    pattern: tag.pattern,
    aim: tag.aim ?? current.aim,
    shots: tag.shots,
  };
  for (const key of STICKY_OPTIONAL_KEYS) {
    if (tag[key] !== undefined) next[key] = tag[key];
    else if (attackFieldApplies(key, tag)) delete next[key];
  }
  if (tag.savedAttackId === undefined) delete next.savedAttackId;
  else next.savedAttackId = tag.savedAttackId;
  return next as StickySelection;
}

/**
 * The grouping key a new tag from `sticky` would have. A tag that would link
 * to a saved attack groups by that attack (V16 S14, S32), so the caller passes
 * `linkedAttackId` when the selection is unmodified.
 */
function stickyKey(sticky: StickySelection, linkedAttackId: string | null): string {
  return groupKey({
    ...createTag(0, sticky),
    savedAttackId: linkedAttackId ?? undefined,
  });
}

/**
 * T28: one number, the interval since the previous tag in the current group
 * (phase, sprite, pattern, aim). Null means the group has fewer than two tags,
 * not a missing measurement.
 */
export function readoutInterval(
  tags: readonly Tag[],
  sticky: StickySelection,
  linkedAttackId: string | null = null,
): number | null {
  const key = stickyKey(sticky, linkedAttackId);
  const times = tags
    .filter((tag) => groupKey(tag) === key)
    .map((tag) => tag.timeSeconds)
    .sort((first, second) => first - second);
  if (times.length < 2) return null;
  return times[times.length - 1] - times[times.length - 2];
}

export type BurstMode = "new" | "continue";

/**
 * Z09: `new` is one more than the highest burst id in the study; `continue`
 * is the highest id among tags in the sticky group, or null when none exists.
 */
export function assignBurst(
  tags: readonly Tag[],
  sticky: StickySelection,
  mode: BurstMode,
  linkedAttackId: string | null = null,
): number | null {
  if (mode === "new")
    return tags.reduce((highest, tag) => Math.max(highest, tag.burstId ?? 0), 0) + 1;
  const key = stickyKey(sticky, linkedAttackId);
  let found: number | null = null;
  for (const tag of tags)
    if (tag.burstId !== undefined && groupKey(tag) === key)
      found = Math.max(found ?? 0, tag.burstId);
  return found;
}

export type TagChange =
  | Readonly<{ field: "timeSeconds"; value: number }>
  | Readonly<{ field: "phaseIndex"; value: number }>
  | Readonly<{ field: "spriteId"; value: string }>
  | Readonly<{ field: "pattern"; value: TagPattern }>
  | Readonly<{ field: "aim"; value: TagAim }>
  | Readonly<{ field: "shots"; value: number }>
  /**
   * Null removes the arm pattern and its dependants. A spread or scatter arm
   * needs a cone: supply `armArcDegrees` or have one already.
   */
  | Readonly<{
      field: "armPattern";
      value: TagArmPattern | null;
      armArcDegrees?: number;
    }>
  | Readonly<{ field: "shotsPerArm"; value: number | null }>
  | Readonly<{ field: "armArcDegrees"; value: number | null }>
  /** Null removes the typed value. */
  | Readonly<{ field: "clockwiseDegreesPerSecond"; value: number | null }>
  | Readonly<{ field: "initialPhaseDegrees"; value: number | null }>
  /** Null removes the burst id (blank field). */
  | Readonly<{ field: "burstId"; value: number | null }>
  /** V16 S22-S25, S11, S24: typed estimates; null (a blank field) removes the value. */
  | Readonly<{ field: TypedNumberField; value: number | null }>
  /** V16 S08: a bomb thrown at the player; true needs a one-shot player-aimed spread. */
  | Readonly<{ field: "target"; value: boolean }>;

/** The attack fields that are a single optional typed number. */
export type TypedNumberField =
  | "coneDegrees"
  | "fixedBearingDegrees"
  | "frontOffsetDegrees"
  | "emitterRadiusTiles"
  | "bombRangeTiles"
  | "bombTravelSeconds"
  | "bulletSpeedTilesPerSecond"
  | "bulletRangeTiles";

const POSITIVE_TYPED_FIELDS: readonly TypedNumberField[] = [
  "bombRangeTiles",
  "bombTravelSeconds",
  "bulletSpeedTilesPerSecond",
  "bulletRangeTiles",
];

const TYPED_FIELD_LABEL: Readonly<Record<TypedNumberField, string>> = {
  coneDegrees: "Cone width",
  fixedBearingDegrees: "Bearing",
  frontOffsetDegrees: "Front offset",
  emitterRadiusTiles: "Emitter radius",
  bombRangeTiles: "Bomb range",
  bombTravelSeconds: "Bomb flight time",
  bulletSpeedTilesPerSecond: "Bullet speed",
  bulletRangeTiles: "Bullet range",
};

export type EditResult =
  | Readonly<{ ok: true; tag: Tag }>
  | Readonly<{ ok: false; error: string }>;

function fail(error: string): EditResult {
  return { ok: false, error };
}

/**
 * Z20/Z21: a pure row edit. Invalid input yields an error and the caller keeps
 * the old tag. A valid time change permanently marks the tag typed.
 */
export function editTag(
  tag: Tag,
  change: TagChange,
  durationSeconds: number,
): EditResult {
  const result = editTagRaw(tag, change, durationSeconds);
  // Every edit then drops what the new shape disallows (V16 S22-S25, S08).
  return result.ok ? { ok: true, tag: conformAttackFields(result.tag) } : result;
}

function editTagRaw(
  tag: Tag,
  change: TagChange,
  durationSeconds: number,
): EditResult {
  switch (change.field) {
    case "timeSeconds":
      if (
        !Number.isFinite(change.value) ||
        change.value < 0 ||
        change.value > durationSeconds
      )
        return fail(`Time must be between 0 and ${durationSeconds.toFixed(3)} s.`);
      return {
        ok: true,
        tag: { ...tag, timeSeconds: change.value, timeSource: "typed" },
      };
    case "phaseIndex":
      if (!Number.isInteger(change.value) || change.value < 0)
        return fail("Phase must be a nonnegative whole number.");
      return { ok: true, tag: { ...tag, phaseIndex: change.value } };
    case "spriteId":
      if (change.value.trim().length === 0) return fail("Sprite must not be blank.");
      return { ok: true, tag: { ...tag, spriteId: change.value } };
    case "pattern": {
      if (!OFFERABLE_PATTERNS.includes(change.value))
        return fail("That pattern cannot be chosen.");
      const {
        aim,
        armPattern,
        shotsPerArm,
        armArcDegrees,
        clockwiseDegreesPerSecond,
        initialPhaseDegrees,
        ...rest
      } = tag;
      // Fields the new pattern disallows are dropped, as the aim rule does.
      return {
        ok: true,
        tag: {
          ...rest,
          pattern: change.value,
          ...(patternTakesAim(change.value) ? { aim: aim ?? DEFAULT_AIM } : {}),
          ...(armPatternAllowed(change.value) && armPattern !== undefined
            ? {
                armPattern,
                ...(shotsPerArm === undefined ? {} : { shotsPerArm }),
                ...(armArcDegrees === undefined ? {} : { armArcDegrees }),
              }
            : {}),
          ...(rotationAllowed(change.value)
            ? {
                ...(clockwiseDegreesPerSecond === undefined
                  ? {}
                  : { clockwiseDegreesPerSecond }),
                ...(initialPhaseDegrees === undefined ? {} : { initialPhaseDegrees }),
              }
            : {}),
        },
      };
    }
    case "aim":
      if (!patternTakesAim(tag.pattern))
        return fail("Only spread and scatter have an aim.");
      if (!TAG_AIMS.includes(change.value))
        return fail("Aim must be player, fixed or front.");
      return { ok: true, tag: { ...tag, aim: change.value } };
    case "shots":
      if (!Number.isInteger(change.value) || change.value < 1)
        return fail("Shots must be a positive whole number.");
      return { ok: true, tag: { ...tag, shots: change.value } };
    case "armPattern": {
      if (!armPatternAllowed(tag.pattern))
        return fail("Only a ring can have an arm pattern.");
      const { armPattern: _armPattern, shotsPerArm, armArcDegrees, ...rest } = tag;
      if (change.value === null) return { ok: true, tag: rest };
      if (!TAG_ARM_PATTERNS.includes(change.value))
        return fail("Arm pattern must be spread, scatter or ring.");
      if (!armPatternTakesArc(change.value))
        return {
          ok: true,
          tag: {
            ...rest,
            armPattern: change.value,
            shotsPerArm: shotsPerArm ?? DEFAULT_SHOTS_PER_ARM,
          },
        };
      const arc = change.armArcDegrees ?? armArcDegrees;
      if (arc === undefined)
        return fail("Enter the cone width in degrees for a spread or scatter arm.");
      const arcProblem = armArcProblem(change.value, arc);
      if (arcProblem) return fail(`Cone width ${arcProblem}.`);
      return {
        ok: true,
        tag: {
          ...rest,
          armPattern: change.value,
          shotsPerArm: shotsPerArm ?? DEFAULT_SHOTS_PER_ARM,
          armArcDegrees: arc,
        },
      };
    }
    case "shotsPerArm":
      if (tag.armPattern === undefined) return fail("Choose an arm pattern first.");
      if (
        change.value === null ||
        !Number.isInteger(change.value) ||
        change.value < 1
      )
        return fail("Shots per arm must be a positive whole number.");
      return { ok: true, tag: { ...tag, shotsPerArm: change.value } };
    case "armArcDegrees":
      if (tag.armPattern === undefined || !armPatternTakesArc(tag.armPattern))
        return fail("Only a spread or scatter arm has a cone width.");
      if (change.value === null) return fail("Cone width is required.");
      {
        const arcProblem = armArcProblem(tag.armPattern, change.value);
        if (arcProblem) return fail(`Cone width ${arcProblem}.`);
      }
      return { ok: true, tag: { ...tag, armArcDegrees: change.value } };
    case "clockwiseDegreesPerSecond":
    case "initialPhaseDegrees": {
      if (!rotationAllowed(tag.pattern))
        return fail("Only a rotating arm has a typed rotation rate and phase.");
      const { [change.field]: _removed, ...rest } = tag;
      if (change.value === null) return { ok: true, tag: rest };
      if (!Number.isFinite(change.value))
        return fail("Rotation values must be finite numbers of degrees.");
      return { ok: true, tag: { ...tag, [change.field]: change.value } };
    }
    case "target": {
      const { target: _removed, ...rest } = tag;
      if (!change.value) return { ok: true, tag: rest };
      if (!attackFieldApplies("target", tag))
        return fail(
          'A targeted bomb needs a bomb sprite fired as a one-shot spread with aim "player".',
        );
      return { ok: true, tag: { ...rest, target: "player" } };
    }
    case "coneDegrees":
    case "fixedBearingDegrees":
    case "frontOffsetDegrees":
    case "emitterRadiusTiles":
    case "bombRangeTiles":
    case "bombTravelSeconds":
    case "bulletSpeedTilesPerSecond":
    case "bulletRangeTiles": {
      const field = change.field;
      const { [field]: _removed, ...rest } = tag;
      if (change.value === null) return { ok: true, tag: rest };
      if (!attackFieldApplies(field, tag))
        return fail(`${TYPED_FIELD_LABEL[field]} does not apply to this tag.`);
      if (!Number.isFinite(change.value))
        return fail(`${TYPED_FIELD_LABEL[field]} must be a finite number.`);
      if (field === "coneDegrees") {
        const problem = armArcProblem(
          tag.pattern === "scatter" ? "scatter" : "spread",
          change.value,
        );
        if (problem) return fail(`Cone width ${problem}.`);
      }
      if (field === "emitterRadiusTiles" && change.value < 0)
        return fail("Emitter radius must not be negative.");
      if (POSITIVE_TYPED_FIELDS.includes(field) && change.value <= 0)
        return fail(`${TYPED_FIELD_LABEL[field]} must be above 0.`);
      return { ok: true, tag: { ...tag, [field]: change.value } };
    }
    case "burstId": {
      if (change.value === null) {
        const { burstId: _removed, ...rest } = tag;
        return { ok: true, tag: rest };
      }
      if (!Number.isInteger(change.value) || change.value < 1)
        return fail("Burst must be blank or a positive whole number.");
      return { ok: true, tag: { ...tag, burstId: change.value } };
    }
  }
}

/** Z23: display order, newest footage first. Ties keep later-recorded rows first. */
export function sortNewestFirst(
  tags: readonly Tag[],
): readonly Readonly<{ tag: Tag; index: number }>[] {
  return tags
    .map((tag, index) => ({ tag, index }))
    .sort(
      (first, second) =>
        second.tag.timeSeconds - first.tag.timeSeconds ||
        second.index - first.index,
    );
}

/**
 * Builds the download payload and validates it before the browser is offered
 * it. Tags are time-sorted because the export is a file, not a session log;
 * the caller's array is never mutated.
 */
export function assembleExport(input: {
  encounterId: string;
  provenance: VideoProvenance;
  savedAttacks?: readonly SavedAttack[];
  tags: readonly StoredTag[];
  recordedAt: string;
}): ObservationExport {
  const tags = [...input.tags].sort(
    (first, second) => first.timeSeconds - second.timeSeconds,
  );
  return validateObservationExport({
    schemaVersion: 3,
    encounterId: input.encounterId,
    provenance: input.provenance,
    recordedAt: input.recordedAt,
    savedAttacks: input.savedAttacks ?? [],
    tags,
  }) as ObservationExport;
}

export type SummaryRow = Readonly<{
  phase: string;
  sprite: string;
  pattern: string;
  aim: string;
  armPattern: string;
  /** V16 S14: "player" for a targeted bomb throw, else a dash. */
  target: string;
  /** V16 S46: the saved attack's name, else a dash. */
  attack: string;
  scope: string;
  sampleCount: number;
  mean: string;
  deviation: string;
  intervals: string;
}>;

/**
 * Z11: display strings for one summary result. An unknown phase index shows
 * raw; an empty interval list shows an em dash.
 */
export function formatSummaryRow(
  summary: IntervalSummary,
  phases: readonly PhaseOption[],
  savedAttacks: readonly SavedAttack[] = [],
): SummaryRow {
  const phase = phases.find((option) => option.index === summary.phaseIndex);
  const seconds = (value: number) => `${value.toFixed(3)} s`;
  return {
    phase: phase ? phase.label : String(summary.phaseIndex),
    sprite: summary.spriteId,
    pattern: summary.pattern,
    aim: summary.aim ?? "—",
    armPattern: summary.armPattern ?? "—",
    target: summary.target ?? "—",
    attack:
      summary.savedAttackId === undefined
        ? "—"
        : (savedAttacks.find((entry) => entry.id === summary.savedAttackId)?.name ??
          summary.savedAttackId),
    scope: summary.scope,
    sampleCount: summary.sampleCount,
    mean: summary.sampleCount === 0 ? "—" : seconds(summary.meanSeconds),
    deviation: summary.sampleCount === 0 ? "—" : seconds(summary.stdevSeconds),
    intervals:
      summary.intervalsSeconds.length === 0
        ? "—"
        : summary.intervalsSeconds.map((value) => value.toFixed(3)).join(", "),
  };
}
