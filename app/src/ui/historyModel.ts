import { drillRulesVersion } from "../game/config/drill";
import type { EncounterConfig } from "../game/config/encounter";
import type { DrillSelection } from "../game/models";
import { retainedBestSeconds, type AttemptRecord } from "../storage/attempts";

const DRILL_SUFFIX = /^-drill-p(\d+(?:-\d+)*)(-once)?$/;
export const SPARKLINE_ATTEMPTS = 20;

export function selectedRulesVersion(
  config: EncounterConfig,
  drill: DrillSelection | null,
): string {
  return drillRulesVersion(config.rulesVersion, drill);
}

export type KnownEncounter = Readonly<{
  displayName: string;
  rulesVersion: string;
}>;

/** The label for one record in the attempts list. */
export function describeRulesVersion(
  rulesVersion: string,
  selected: string,
  encounters: readonly KnownEncounter[],
): string {
  if (rulesVersion === selected) return "This selection";
  for (const encounter of encounters) {
    if (rulesVersion === encounter.rulesVersion)
      return `${encounter.displayName}, full fight`;
    if (!rulesVersion.startsWith(encounter.rulesVersion)) continue;
    const match = DRILL_SUFFIX.exec(
      rulesVersion.slice(encounter.rulesVersion.length),
    );
    if (!match) continue;
    const phases = match[1].split("-").map((index) => Number(index) + 1);
    const noun = phases.length > 1 ? "phases" : "phase";
    return `${encounter.displayName}, ${noun} ${phases.join(", ")}${match[2] ? " once" : " on loop"}`;
  }
  return "Other rules";
}

export type ResultComparison =
  | Readonly<{ kind: "first" }>
  | Readonly<{ kind: "best" }>
  | Readonly<{ kind: "short"; seconds: number }>;

/** Compares a finished attempt to history that already includes it. */
export function compareResult(
  elapsedSeconds: number,
  records: readonly AttemptRecord[],
  rulesVersion: string,
): ResultComparison {
  const compatible = records.filter(
    (record) => record.rulesVersion === rulesVersion,
  );
  const best = retainedBestSeconds(records, rulesVersion);
  if (best === null || compatible.length <= 1) return { kind: "first" };
  if (elapsedSeconds >= best) return { kind: "best" };
  return { kind: "short", seconds: best - elapsedSeconds };
}

/** Oldest first, at most the last 20 for this identity. Records are stored newest first. */
export function sparklineSeconds(
  records: readonly AttemptRecord[],
  rulesVersion: string,
): readonly number[] {
  return records
    .filter((record) => record.rulesVersion === rulesVersion)
    .slice(0, SPARKLINE_ATTEMPTS)
    .map((record) => record.elapsedSeconds)
    .reverse();
}

/** Polyline points for an SVG of the given size; null below two values. */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
): string | null {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
