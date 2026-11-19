import { useState, type ReactNode } from "react";
import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import { segmentIdOf, type Segment, type StudyV6 } from "./study";
import type { DraftResult } from "./monsterDraft";
import {
  measuredRangeTilesOf,
  measuredSegmentValues,
  measuredTravelSeconds,
  type SegmentMeasure,
} from "./studyExport";
import type { StudyWarning } from "./studyWarnings";
import styles from "./TaggerRoute.module.css";

const seconds = (value: number) => `${value.toFixed(3)} s`;

/** The first `<n>.<3 digits> s` time in a warning's text, or null. */
const WARNING_TIME = /(\d+\.\d{3}) s/;

/** Plan V23 Q13: one row per segment with at least one boundary, with what export writes. */
function measuresOf(
  study: StudyV6,
  segments: readonly Segment[],
): readonly Readonly<{ segment: Segment; measure: SegmentMeasure }>[] {
  return segments.flatMap((segment) =>
    study.boundaries.some((boundary) => boundary.segmentId === segment.id)
      ? [{ segment, measure: measuredSegmentValues(study, segment.id) }]
      : [],
  );
}

/**
 * Plan V20 step 88.1-88.2, plan V23 Q13-Q17: the Reconcile step. Warnings, the
 * measured segment values export writes beside the authored ones, a read-only
 * list of the attack tracks, the export, and `children` (the parity panel).
 */
export function ReconcilePanel({
  study,
  segments,
  warnings,
  fileText,
  fileName,
  variants,
  onSeek,
  onExportStudy,
  children,
}: Readonly<{
  study: StudyV6;
  segments: readonly Segment[];
  warnings: readonly StudyWarning[];
  fileText: DraftResult<string>;
  fileName: string;
  variants: readonly Readonly<{ id: string; entry: Record<string, unknown> }>[];
  onSeek: (seconds: number) => void;
  onExportStudy: () => void;
  children?: ReactNode;
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
  const measures = measuresOf(study, segments);

  const cell = (measured: number | null, authored: number | null) => (
    <td>
      <div>{measured === null ? "not measured" : seconds(measured)}</div>
      <div className={styles.note}>
        {measured === null ? "export keeps " : "authored "}
        {authored === null ? "none" : seconds(authored)}
      </div>
    </td>
  );

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
              {measures.map(({ segment, measure }) => (
                <tr key={segment.id} aria-label={segment.label}>
                  <th scope="row">{segment.label}</th>
                  {cell(measure.telegraphSeconds, segment.telegraphSeconds)}
                  {cell(measure.invulnerableOnEnterSeconds, segment.invulnerableOnEnterSeconds)}
                  {segment.ref.subPhaseId === null ? (
                    <td className={styles.note}>a phase has no duration</td>
                  ) : (
                    cell(measure.durationSeconds, segment.durationSeconds)
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
              <th scope="col">Volley marks</th>
              <th scope="col">Period</th>
              <th scope="col">Flight time, range</th>
            </tr>
          </thead>
          <tbody>
            {study.tracks.map((track) => {
              const travel = measuredTravelSeconds(track);
              const range = measuredRangeTilesOf(track);
              return (
                <tr key={track.id}>
                  <th scope="row">{track.id}</th>
                  <td>{segmentIdOf(track.location)}</td>
                  <td>{track.marks.filter((mark) => mark.kind === "volley").length}</td>
                  <td>{track.periodSeconds === undefined ? "once" : seconds(track.periodSeconds)}</td>
                  <td>
                    {[
                      travel === null ? null : seconds(travel),
                      range === null ? null : `${range.toFixed(2)} tiles`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {children}

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
