import type { DrillSelection } from "../models";
import { primaryArchetype, type EncounterConfig } from "./encounter";

/**
 * Validates and normalizes a drill selection at the simulation boundary: a
 * nonempty list of unique, in-range, integer top-level phase indices, sorted
 * ascending. An empty, absent or null selection is the normal full fight.
 */
export function normalizeDrillSelection(
  drill: DrillSelection | null | undefined,
  phaseCount: number,
): DrillSelection | null {
  if (!drill || drill.phaseIndices.length === 0) return null;
  const indices = [...drill.phaseIndices].sort((first, second) => first - second);
  const unique: number[] = [];
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= phaseCount)
      throw new RangeError("drill phaseIndices must name authored phases");
    if (unique[unique.length - 1] !== index) unique.push(index);
  }
  return { phaseIndices: unique, loop: drill.loop };
}

/**
 * The next selected phase after `currentIndex` in authored order, wrapping to
 * the first selected phase when looping, or `null` when a one-shot selection
 * has finished.
 */
export function nextDrillPhaseIndex(
  drill: DrillSelection,
  currentIndex: number,
): number | null {
  const next = drill.phaseIndices.find((index) => index > currentIndex);
  if (next !== undefined) return next;
  return drill.loop ? drill.phaseIndices[0] : null;
}

/**
 * The attempt identity for a drill selection. Full fight keeps the base
 * version; a single loop keeps the existing `-drill-p<N>` identity; a
 * one-shot appends `-once`; a group joins its sorted indices with dashes.
 */
export function drillRulesVersion(
  baseRulesVersion: string,
  drill: DrillSelection | null,
): string {
  if (!drill || drill.phaseIndices.length === 0) return baseRulesVersion;
  const suffix = `-drill-p${drill.phaseIndices.join("-")}`;
  return drill.loop ? `${baseRulesVersion}${suffix}` : `${baseRulesVersion}${suffix}-once`;
}

/** Authored phase ids are `phase-<n>-<suffix>`; the suffix is optional. */
const PHASE_ID = /^phase-(\d+)(?:-(.*))?$/;

/**
 * The player-facing label for a top-level phase (R11), derived from its
 * authored id: `phase-3-pond-barrage` becomes "Phase 3 - Pond Barrage". The
 * id's own number wins over `index`, and an id without that prefix falls back
 * to the authored position. An empty or hyphen-only suffix keeps the number.
 */
export function phaseLabel(id: string, index: number): string {
  const match = PHASE_ID.exec(id);
  if (!match) return `Phase ${index + 1}`;
  const [, number, suffix] = match;
  if (!suffix) return `Phase ${number}`;
  const words = suffix
    .split("-")
    .filter((word) => word.length > 0)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`);
  if (words.length === 0) return `Phase ${number}`;
  return `Phase ${number} - ${words.join(" ")}`;
}

/**
 * Parses the `?phase=` deep link (R07): a comma-separated list of top-level
 * phase indices for this encounter's primary archetype, plus `loop=1` for a
 * looped selection. An absent, empty or invalid list - including a fractional
 * or out-of-range value anywhere in it - falls back to the full fight rather
 * than throwing. The URL only seeds the initial selection; nothing writes it
 * back. The default reads `window.location.search` when one is available.
 */
export function parseDrillFromLocation(
  config: EncounterConfig,
  search: string = typeof window === "undefined" ? "" : window.location.search,
): DrillSelection | null {
  const params = new URLSearchParams(search);
  const rawPhases = params.getAll("phase");
  // Repeated phase parameters are ambiguous, so the whole link is invalid.
  if (rawPhases.length > 1) return null;
  const raw = rawPhases[0] ?? null;
  if (raw === null) return null;
  const phaseCount = primaryArchetype(config).phases.length;
  const indices: number[] = [];
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (!/^\d+$/.test(value)) return null;
    const index = Number(value);
    if (index < 0 || index >= phaseCount) return null;
    indices.push(index);
  }
  const rawLoops = params.getAll("loop");
  // Repeated loop parameters are ambiguous, so the whole link is invalid.
  if (rawLoops.length > 1) return null;
  // Validation happened above, so normalization only sorts and deduplicates.
  return normalizeDrillSelection(
    { phaseIndices: indices, loop: rawLoops[0] === "1" },
    phaseCount,
  );
}
