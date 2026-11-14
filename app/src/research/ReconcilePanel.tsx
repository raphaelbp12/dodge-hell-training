import { useState } from "react";
import { medianOf } from "./cadenceFit";
import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import {
  segmentIdOf,
  segmentWindows,
  type AcceptedSegmentValues,
  type Segment,
  type StudyV5,
} from "./study";
import type { DraftResult } from "./monsterDraft";
import type { StudyWarning } from "./studyWarnings";
import styles from "./TaggerRoute.module.css";

const seconds = (value: number) => `${value.toFixed(3)} s`;

/** The first `<n>.<3 digits> s` time in a warning's text, or null. */
const WARNING_TIME = /(\d+\.\d{3}) s/;

type Field = keyof AcceptedSegmentValues;

type SegmentMeasure = Readonly<{
  segment: Segment;
  telegraph: number | null;
  invulnerable: number | null;
  duration: number | null;
}>;

/** E13: one row per segment with at least one boundary; medians over its boundaries. */
function measuresOf(
  study: StudyV5,
  segments: readonly Segment[],
  videoEndSeconds: number,
  frameSeconds: number,
): readonly SegmentMeasure[] {
  const windows = segmentWindows(study.boundaries, segments, videoEndSeconds);
  return segments.flatMap((segment): SegmentMeasure[] => {
    const boundaries = study.boundaries.filter((boundary) => boundary.segmentId === segment.id);
    if (boundaries.length === 0) return [];
    const telegraph = medianOf(
      boundaries.flatMap((boundary) =>
        boundary.telegraphEndSeconds === undefined ? [] : [boundary.telegraphEndSeconds - boundary.timeSeconds],
      ),
    );
    const invulnerable = medianOf(
      study.statusSpans.flatMap((span) =>
        span.outSeconds !== null &&
        boundaries.some((boundary) => Math.abs(span.inSeconds - boundary.timeSeconds) <= frameSeconds)
          ? [span.outSeconds - span.inSeconds]
          : [],
      ),
    );
    const duration =
      segment.ref.subPhaseId === null
        ? null
        : medianOf(
            windows
              .filter((window) => window.segmentId === segment.id)
              .map((window) => window.endSeconds - window.startSeconds),
          );
    return [{ segment, telegraph, invulnerable, duration }];
  });
}

/**
 * Plan V20 step 88.1-88.2: the Reconcile step. Warnings, measured segment
 * values beside the authored ones, a read-only list of the attack tracks, and
 * the export. The panel holds no study state; the route applies every accept.
 */
export function ReconcilePanel({
  study,
  segments,
  videoEndSeconds,
  frameSeconds,
  warnings,
  fileText,
  fileName,
  variants,
  onAccept,
  onSeek,
  onExportStudy,
}: Readonly<{
  study: StudyV5;
  segments: readonly Segment[];
  videoEndSeconds: number;
  /** One frame in seconds; zero without a frame rate. */
  frameSeconds: number;
  warnings: readonly StudyWarning[];
  fileText: DraftResult<string>;
  fileName: string;
  variants: readonly Readonly<{ id: string; entry: Record<string, unknown> }>[];
  onAccept: (segmentId: string, field: Field, value: number | undefined) => void;
  onSeek: (seconds: number) => void;
  onExportStudy: () => void;
}>) {
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const copy = (text: string) => {
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      setCopyNote("Copy the text above by hand.");
      return;
    }
    clipboard.writeText(text).then(
      () => setCopyNote("Copied."),
      () => setCopyNote("Copy the text above by hand."),
    );
  };
  const measures = measuresOf(study, segments, videoEndSeconds, frameSeconds);

  const cell = (
    measure: SegmentMeasure,
    field: Field,
    name: string,
    measured: number | null,
    authored: number | null,
  ) => {
    const { segment } = measure;
    const accepted = study.acceptedSegmentValues[segment.id]?.[field];
    return (
      <td>
        <div>{measured === null ? "not measured" : seconds(measured)}</div>
        <div className={styles.note}>
          authored {authored === null ? "none" : seconds(authored)}
          {accepted !== undefined && `, accepted ${seconds(accepted)}`}
        </div>
        {measured !== null && (
          <button
            type="button"
            aria-label={`Accept ${name} for ${segment.label}`}
            onClick={() => onAccept(segment.id, field, measured)}
          >
            Accept
          </button>
        )}
        {accepted !== undefined && (
          <button
            type="button"
            aria-label={`Clear ${name} for ${segment.label}`}
            onClick={() => onAccept(segment.id, field, undefined)}
          >
            Clear
          </button>
        )}
      </td>
    );
  };

  return (
    <section className={styles.inspectorPanel} aria-labelledby="reconcile-title">
      <div className={styles.headingRow}>
        <h2 id="reconcile-title">Reconcile</h2>
      </div>

      <h3>
        Warnings <HelpMark text={help.HELP_RECONCILE_WARNINGS} />
      </h3>
      {warnings.length === 0 ? (
        <p className={styles.note}>No warnings.</p>
      ) : (
        <ul aria-label="Warnings">
          {warnings.map((warning, index) => {
            const time = WARNING_TIME.exec(warning.text);
            const text = `${warning.where}: ${warning.text}`;
            return (
              <li key={`${index}-${warning.text}`}>
                {time ? (
                  <button type="button" onClick={() => onSeek(Number(time[1]))}>
                    {text}
                  </button>
                ) : (
                  text
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h3>
        Segments <HelpMark text={help.HELP_RECONCILE_SEGMENTS} />
      </h3>
      {measures.length === 0 ? (
        <p className={styles.note}>Mark a boundary in the Structure step to measure a segment.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.compactTable}`}>
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col">Telegraph</th>
                <th scope="col">Invulnerable</th>
                <th scope="col">Duration</th>
              </tr>
            </thead>
            <tbody>
              {measures.map((measure) => (
                <tr key={measure.segment.id} aria-label={measure.segment.label}>
                  <th scope="row">{measure.segment.label}</th>
                  {cell(measure, "telegraphSeconds", "telegraph", measure.telegraph, measure.segment.telegraphSeconds)}
                  {cell(
                    measure,
                    "invulnerableOnEnterSeconds",
                    "invulnerable",
                    measure.invulnerable,
                    measure.segment.invulnerableOnEnterSeconds,
                  )}
                  {measure.segment.ref.subPhaseId === null ? (
                    <td className={styles.note}>a phase has no duration</td>
                  ) : (
                    cell(measure, "durationSeconds", "duration", measure.duration, measure.segment.durationSeconds)
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>
        Attacks <HelpMark text={help.HELP_RECONCILE_ATTACKS} />
      </h3>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.compactTable}`}>
          <thead>
            <tr>
              <th scope="col">Track</th>
              <th scope="col">Segment</th>
              <th scope="col">Cadence from</th>
              <th scope="col">Shots per burst</th>
              <th scope="col">Shot interval</th>
              <th scope="col">Cooldown</th>
              <th scope="col">Initial delay</th>
              <th scope="col">Flight time, range</th>
            </tr>
          </thead>
          <tbody>
            {study.tracks.map((track) => {
              const { cadence } = track.attack;
              const override = track.projectileOverride;
              return (
                <tr key={track.id}>
                  <th scope="row">{track.id}</th>
                  <td>{segmentIdOf(track.location)}</td>
                  <td>{track.cadenceSource}</td>
                  <td>{cadence.shotsPerBurst}</td>
                  <td>{seconds(cadence.shotIntervalSeconds)}</td>
                  <td>{seconds(cadence.cooldownAfterLastShotSeconds)}</td>
                  <td>{seconds(cadence.initialDelaySeconds)}</td>
                  <td>
                    {override
                      ? [
                          override.travelSeconds === undefined ? null : seconds(override.travelSeconds),
                          override.rangeTiles === undefined ? null : `${override.rangeTiles.toFixed(2)} tiles`,
                        ]
                          .filter(Boolean)
                          .join(", ")
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Export</h3>
      <div className={styles.exportBox}>
        <p className={styles.note}>
          Copy the monster file and paste it over <code>{fileName}</code> by hand. Nothing is
          written for you. Pasting it changes gameplay: the rulesVersion bump and the test updates
          are a separate approved change.
        </p>
        <div className={styles.toolbar}>
          <span>
            <button type="button" disabled={!fileText.ok} onClick={() => fileText.ok && copy(fileText.value)}>
              Copy file
            </button>
            <HelpMark text={help.HELP_COPY_FILE} />
          </span>
          <button type="button" onClick={onExportStudy}>
            Export study JSON
          </button>
          {copyNote && <span role="status">{copyNote}</span>}
        </div>
        <label className={styles.field}>
          <span>File for {fileName}</span>
          <textarea
            readOnly
            rows={14}
            aria-label="Monster file text"
            value={fileText.ok ? fileText.value : fileText.error}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        {variants.map((variant) => {
          const text = `"${variant.id}": ${JSON.stringify(variant.entry, null, 2)}`;
          return (
            <label key={variant.id} className={styles.field}>
              <span>
                Projectile variant {variant.id} <HelpMark text={help.HELP_PROJECTILE_VARIANT} />
                <button type="button" onClick={() => copy(text)}>
                  Copy
                </button>
              </span>
              <textarea
                readOnly
                rows={8}
                aria-label={`Projectile variant ${variant.id}`}
                value={text}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
