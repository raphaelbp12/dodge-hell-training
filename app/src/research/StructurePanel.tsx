import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import type { Segment, SegmentWindow, StudyV6 } from "./study";
import styles from "./TaggerRoute.module.css";

const seconds = (value: number) => `${value.toFixed(3)} s`;

/**
 * Plan V20 step 85.3: the Structure step. Boundaries, telegraph ends and
 * invulnerable spans, each added at the presented frame. The panel holds no
 * study state; every change goes through the route's callbacks.
 */
export function StructurePanel({
  study,
  segments,
  windows,
  mediaTime,
  frameRate,
  hasVideo,
  onSegmentStartsHere,
  onTelegraphEndsHere,
  onToggleInvulnerable,
  onSetBoundarySegment,
  onRemoveBoundary,
  onRemoveSpan,
  onSeek,
}: Readonly<{
  study: StudyV6;
  segments: readonly Segment[];
  windows: readonly SegmentWindow[];
  mediaTime: number;
  frameRate: number | null;
  hasVideo: boolean;
  onSegmentStartsHere: () => void;
  onTelegraphEndsHere: () => void;
  onToggleInvulnerable: () => void;
  onSetBoundarySegment: (index: number, segmentId: string) => void;
  onRemoveBoundary: (index: number) => void;
  onRemoveSpan: (index: number) => void;
  onSeek: (seconds: number) => void;
}>) {
  const rows = study.boundaries
    .map((boundary, index) => ({ boundary, index }))
    .sort((first, second) => second.boundary.timeSeconds - first.boundary.timeSeconds);
  const openSpan = study.statusSpans.some((span) => span.outSeconds === null);
  const frames = (value: number) =>
    frameRate === null ? "" : `, ${Math.round(value * frameRate)} frames`;
  const windowEnd = (timeSeconds: number) =>
    windows.find((window) => window.startSeconds === timeSeconds)?.endSeconds;
  return (
    <section className={styles.inspectorPanel} aria-labelledby="structure-title">
      <div className={styles.headingRow}>
        <h2 id="structure-title">Structure</h2>
      </div>
      <p className={styles.note}>
        Mark the frame each phase or sub-phase is entered. Every later mark takes its segment from
        these.
      </p>
      <p>
        <button type="button" onClick={onSegmentStartsHere} disabled={!hasVideo}>
          Segment starts here <kbd aria-hidden="true">S</kbd>
        </button>
        <HelpMark text={help.HELP_SEGMENT_STARTS_HERE} />{" "}
        <button type="button" onClick={onTelegraphEndsHere} disabled={!hasVideo}>
          Telegraph ends here <kbd aria-hidden="true">T</kbd>
        </button>
        <HelpMark text={help.HELP_TELEGRAPH_ENDS_HERE} />
      </p>
      {rows.length === 0 ? (
        <p className={styles.empty}>No boundaries yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.compactTable}`}>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">
                  Segment <HelpMark text={help.HELP_BOUNDARY_SEGMENT} />
                </th>
                <th scope="col">Telegraph (measured)</th>
                <th scope="col">Window ends</th>
                <th scope="col">
                  <span className={styles.visuallyHidden}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ boundary, index }) => {
                const end = windowEnd(boundary.timeSeconds);
                return (
                  <tr key={`${index}-${boundary.timeSeconds}`}>
                    <td>
                      <button
                        type="button"
                        onClick={() => onSeek(boundary.timeSeconds)}
                        disabled={!hasVideo}
                        aria-label={`Go to boundary at ${seconds(boundary.timeSeconds)}`}
                      >
                        {boundary.timeSeconds.toFixed(3)}
                      </button>
                    </td>
                    <td>
                      <select
                        className={styles.cellSelect}
                        aria-label={`Segment of boundary at ${seconds(boundary.timeSeconds)}`}
                        value={boundary.segmentId}
                        onChange={(event) => onSetBoundarySegment(index, event.target.value)}
                      >
                        {!segments.some((segment) => segment.id === boundary.segmentId) && (
                          <option value={boundary.segmentId}>{boundary.segmentId} (unknown)</option>
                        )}
                        {segments.map((segment) => (
                          <option key={segment.id} value={segment.id}>
                            {segment.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {boundary.telegraphEndSeconds === undefined
                        ? "—"
                        : `${seconds(boundary.telegraphEndSeconds - boundary.timeSeconds)}${frames(
                            boundary.telegraphEndSeconds - boundary.timeSeconds,
                          )}`}
                    </td>
                    <td>{end === undefined ? "—" : seconds(end)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onRemoveBoundary(index)}
                        aria-label={`Remove boundary at ${seconds(boundary.timeSeconds)}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <h3>Invulnerable spans</h3>
      <p>
        <button type="button" onClick={onToggleInvulnerable} disabled={!hasVideo}>
          {openSpan ? "Invulnerable ends here" : "Invulnerable starts here"}{" "}
          <kbd aria-hidden="true">I</kbd>
        </button>
        <HelpMark text={help.HELP_INVULNERABLE} />
      </p>
      {study.statusSpans.length === 0 ? (
        <p className={styles.empty}>No invulnerable spans yet.</p>
      ) : (
        <ul>
          {study.statusSpans.map((span, index) => (
            <li key={`${index}-${span.inSeconds}`}>
              In {seconds(span.inSeconds)}, out{" "}
              {span.outSeconds === null
                ? `open (now ${seconds(mediaTime)})`
                : `${seconds(span.outSeconds)}, ${seconds(span.outSeconds - span.inSeconds)} long`}{" "}
              <button
                type="button"
                onClick={() => onRemoveSpan(index)}
                aria-label={`Remove invulnerable span at ${seconds(span.inSeconds)}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
