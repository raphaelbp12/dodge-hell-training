import {
  ENCOUNTER_CONFIG,
  ENCOUNTER_LIST,
  encounterConfigOf,
} from "../game/config/encounter";
import { retainedBestSeconds, type HistorySnapshot } from "../storage/attempts";
import {
  describeRulesVersion,
  sparklinePoints,
  sparklineSeconds,
  type KnownEncounter,
} from "./historyModel";
import styles from "../App.module.css";

const KNOWN_ENCOUNTERS: readonly KnownEncounter[] = ENCOUNTER_LIST.map(
  (entry) => ({
    displayName: entry.displayName,
    rulesVersion: encounterConfigOf(entry.id).rulesVersion,
  }),
);

const SPARKLINE_WIDTH = 240;
const SPARKLINE_HEIGHT = 36;

/** Survival time over the last attempts on one identity; nothing below two. */
function Sparkline({ values }: { values: readonly number[] }) {
  const points = sparklinePoints(values, SPARKLINE_WIDTH, SPARKLINE_HEIGHT);
  if (!points) return null;
  return (
    <svg
      className={styles.sparkline}
      role="img"
      aria-label={`Survival time over your last ${values.length} attempts on this selection`}
      viewBox={`-2 -2 ${SPARKLINE_WIDTH + 4} ${SPARKLINE_HEIGHT + 4}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function History({
  snapshot,
  rulesVersion,
}: {
  snapshot: HistorySnapshot;
  rulesVersion: string;
}) {
  const best = retainedBestSeconds(snapshot.records, rulesVersion);
  return (
    <section className={styles.history} aria-label="Attempt history">
      <p>
        Personal best{" "}
        <strong aria-label="Retained personal best">
          {best === null ? "None" : `${best.toFixed(2)} s`}
        </strong>
      </p>
      <small>
        Best for this selection. Keeps your latest{" "}
        {ENCOUNTER_CONFIG.session.historyLimit} attempts.
      </small>
      <Sparkline values={sparklineSeconds(snapshot.records, rulesVersion)} />
      <details open>
        <summary>Recent attempts ({snapshot.records.length})</summary>
        {snapshot.records.length ? (
          <ol aria-label="Recent attempts">
            {snapshot.records.map((record) => (
              <li
                key={record.id}
                aria-label={`Completed attempt: ${record.elapsedSeconds.toFixed(2)} seconds, ${record.hitsTaken} hits`}
              >
                <span>{record.elapsedSeconds.toFixed(2)} s</span>
                <span>{record.hitsTaken} hits</span>
                <span title={record.rulesVersion}>
                  {describeRulesVersion(
                    record.rulesVersion,
                    rulesVersion,
                    KNOWN_ENCOUNTERS,
                  )}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No completed attempts</p>
        )}
      </details>
      {snapshot.warning && <p role="status">{snapshot.warning}</p>}
    </section>
  );
}
