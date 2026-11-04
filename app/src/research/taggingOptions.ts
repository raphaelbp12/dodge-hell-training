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
  validateObservationExport,
  type ObservationExport,
  type Tag,
  type TagKind,
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

export type StickySelection = Readonly<{
  phaseIndex: number;
  spriteId: string;
  kind: TagKind;
  shots: number;
}>;

/** T22: one keypress records the sticky selection at the presented frame time. */
export function createTag(
  mediaTimeSeconds: number,
  sticky: StickySelection,
): Tag {
  return {
    timeSeconds: mediaTimeSeconds,
    phaseIndex: sticky.phaseIndex,
    spriteId: sticky.spriteId,
    kind: sticky.kind,
    shots: sticky.shots,
  };
}

/**
 * T28: one number, the interval since the previous tag in the current group.
 * Null means the group has fewer than two tags, not a missing measurement.
 */
export function readoutInterval(
  tags: readonly Tag[],
  sticky: Pick<StickySelection, "phaseIndex" | "spriteId" | "kind">,
): number | null {
  const times = tags
    .filter(
      (tag) =>
        tag.phaseIndex === sticky.phaseIndex &&
        tag.spriteId === sticky.spriteId &&
        tag.kind === sticky.kind,
    )
    .map((tag) => tag.timeSeconds)
    .sort((first, second) => first - second);
  if (times.length < 2) return null;
  return times[times.length - 1] - times[times.length - 2];
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
    encounterId: input.encounterId,
    provenance: input.provenance,
    recordedAt: input.recordedAt,
    tags,
  });
}
