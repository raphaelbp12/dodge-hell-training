import type { DrillSelection } from "../game/models";

export type LadderRowState = "done" | "current" | "upcoming" | "excluded";

export function ladderRowState(
  index: number,
  currentIndex: number,
  drill: DrillSelection | null,
): LadderRowState {
  if (index === currentIndex) return "current";
  if (drill && !drill.phaseIndices.includes(index)) return "excluded";
  if (drill?.loop) return "upcoming"; // A looping drill has no "finished" phase.
  return index < currentIndex ? "done" : "upcoming";
}

/** "Phase 3 - Pond Barrage" to its number and name. */
export function splitPhaseLabel(
  label: string,
): Readonly<{ number: string; name: string | null }> {
  const match = /^Phase (\d+)(?: - (.+))?$/.exec(label);
  return match
    ? { number: match[1], name: match[2] ?? null }
    : { number: "", name: label };
}

export const subPhaseWords = (id: string) =>
  id
    .split("-")
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(" ");
