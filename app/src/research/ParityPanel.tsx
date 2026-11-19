import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import type { ParityReport, ValueChange } from "./parity";
import styles from "./TaggerRoute.module.css";

const seconds = (value: number) => `${value.toFixed(3)} s`;

const FIELD_NAMES: Readonly<Record<ValueChange["field"], string>> = {
  telegraphSeconds: "telegraph",
  invulnerableOnEnterSeconds: "invulnerable",
  durationSeconds: "duration",
  exitAfterSeconds: "exit after",
};

const valueText = (value: number | null) => (value === null ? "none" : seconds(value));

/**
 * Plan V23 Q19: the read-only parity panel in the Reconcile step. It lists
 * whether the game will fire each exported track's marks, the tracks export
 * drops, the segment values it changes and the later windows whose marks
 * differ from the first. It never blocks the export; a time seeks there.
 */
export function ParityPanel({
  report,
  onSeek,
}: Readonly<{ report: ParityReport | null; onSeek: (seconds: number) => void }>) {
  const seek = (time: number) => (
    <button type="button" onClick={() => onSeek(time)}>
      {seconds(time)}
    </button>
  );
  return (
    <section aria-labelledby="parity-title">
      <h3 id="parity-title">
        Parity <HelpMark text={help.HELP_PARITY} />
      </h3>
      {report === null ? (
        <p className={styles.note}>The export has an error, so parity cannot be checked.</p>
      ) : (
        <>
          <h4>The game fires the marks</h4>
          {report.tracks.length === 0 ? (
            <p className={styles.note}>No track is exported yet.</p>
          ) : (
            <ul aria-label="Track parity">
              {report.tracks.map((track) => (
                <li key={track.trackId}>
                  {track.segmentId} {track.trackId}:{" "}
                  {track.firstMismatchSeconds === null ? (
                    "matches"
                  ) : (
                    <>differs first at {seek(track.firstMismatchSeconds)}</>
                  )}
                </li>
              ))}
            </ul>
          )}
          <h4>Dropped tracks</h4>
          {report.dropped.length === 0 ? (
            <p className={styles.note}>No track is dropped.</p>
          ) : (
            <ul aria-label="Dropped tracks">
              {report.dropped.map((track) => (
                <li key={track.trackId}>
                  {track.segmentId} {track.trackId}: no volley mark in its first window
                </li>
              ))}
            </ul>
          )}
          <h4>Changed segment values</h4>
          {report.valueChanges.length === 0 ? (
            <p className={styles.note}>No segment value changes.</p>
          ) : (
            <ul aria-label="Changed segment values">
              {report.valueChanges.map((change) => (
                <li key={`${change.segmentId}-${change.field}`}>
                  {change.segmentId} {FIELD_NAMES[change.field]}: {valueText(change.shipped)} to{" "}
                  {valueText(change.exported)}
                </li>
              ))}
            </ul>
          )}
          <h4>Later windows that differ</h4>
          {report.laterWindows.length === 0 ? (
            <p className={styles.note}>Every later window matches its first window.</p>
          ) : (
            <ul aria-label="Later windows that differ">
              {report.laterWindows.map((window) => (
                <li key={`${window.trackId}-${window.windowStartSeconds}`}>
                  {window.trackId} in the window from {seconds(window.windowStartSeconds)}: differs
                  first at {seek(window.firstDifferenceSeconds)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
