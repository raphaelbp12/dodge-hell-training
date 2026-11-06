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
  validateObservationExport,
  type IntervalSummary,
  type ObservationExport,
  type Tag,
  type TagAim,
  type TagArmPattern,
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

export type StickySelection = Readonly<{
  phaseIndex: number;
  spriteId: string;
  pattern: TagPattern;
  /** Kept even when the pattern ignores it, so the choice survives a switch. */
  aim: TagAim;
  shots: number;
  /**
   * N35: typed-geometry choices, each optional and kept even when the pattern
   * ignores it, so the choice survives a switch. Applied to a new tag only
   * where the sticky pattern allows it.
   */
  armPattern?: TagArmPattern;
  shotsPerArm?: number;
  armArcDegrees?: number;
  clockwiseDegreesPerSecond?: number;
  initialPhaseDegrees?: number;
}>;

/**
 * The composite and typed-geometry fields a new tag takes from the sticky
 * selection. A composite needs its shots per arm, and a spread or scatter arm
 * its cone; a selection missing one records a plain ring instead, so no tag is
 * ever produced that `validateTag` rejects.
 */
function stickyGeometry(sticky: StickySelection): Partial<Tag> {
  const geometry: {
    -readonly [Field in keyof Tag]?: Tag[Field];
  } = {};
  const { armPattern, shotsPerArm, armArcDegrees } = sticky;
  if (
    armPatternAllowed(sticky.pattern) &&
    armPattern !== undefined &&
    shotsPerArm !== undefined &&
    (!armPatternTakesArc(armPattern) || armArcDegrees !== undefined)
  ) {
    geometry.armPattern = armPattern;
    geometry.shotsPerArm = shotsPerArm;
    if (armPatternTakesArc(armPattern)) geometry.armArcDegrees = armArcDegrees;
  }
  if (rotationAllowed(sticky.pattern)) {
    if (sticky.clockwiseDegreesPerSecond !== undefined)
      geometry.clockwiseDegreesPerSecond = sticky.clockwiseDegreesPerSecond;
    if (sticky.initialPhaseDegrees !== undefined)
      geometry.initialPhaseDegrees = sticky.initialPhaseDegrees;
  }
  return geometry;
}

/** T22: one keypress records the sticky selection at the presented frame time. */
export function createTag(
  mediaTimeSeconds: number,
  sticky: StickySelection,
  burstId?: number,
): Tag {
  return {
    timeSeconds: mediaTimeSeconds,
    phaseIndex: sticky.phaseIndex,
    spriteId: sticky.spriteId,
    pattern: sticky.pattern,
    ...(patternTakesAim(sticky.pattern) ? { aim: sticky.aim } : {}),
    shots: sticky.shots,
    ...stickyGeometry(sticky),
    ...(burstId === undefined ? {} : { burstId }),
  };
}

function stickyKey(sticky: StickySelection): string {
  return groupKey({
    phaseIndex: sticky.phaseIndex,
    spriteId: sticky.spriteId,
    pattern: sticky.pattern,
    aim: patternTakesAim(sticky.pattern) ? sticky.aim : undefined,
    armPattern: stickyGeometry(sticky).armPattern,
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
): number | null {
  const key = stickyKey(sticky);
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
): number | null {
  if (mode === "new")
    return tags.reduce((highest, tag) => Math.max(highest, tag.burstId ?? 0), 0) + 1;
  const key = stickyKey(sticky);
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
  | Readonly<{ field: "burstId"; value: number | null }>;

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
  tags: readonly Tag[];
  recordedAt: string;
}): ObservationExport {
  const tags = [...input.tags].sort(
    (first, second) => first.timeSeconds - second.timeSeconds,
  );
  return validateObservationExport({
    schemaVersion: 2,
    encounterId: input.encounterId,
    provenance: input.provenance,
    recordedAt: input.recordedAt,
    tags,
  }) as ObservationExport;
}

export type SummaryRow = Readonly<{
  phase: string;
  sprite: string;
  pattern: string;
  aim: string;
  armPattern: string;
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
): SummaryRow {
  const phase = phases.find((option) => option.index === summary.phaseIndex);
  const seconds = (value: number) => `${value.toFixed(3)} s`;
  return {
    phase: phase ? phase.label : String(summary.phaseIndex),
    sprite: summary.spriteId,
    pattern: summary.pattern,
    aim: summary.aim ?? "—",
    armPattern: summary.armPattern ?? "—",
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
