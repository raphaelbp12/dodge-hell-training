import { useState } from "react";
import type { AuthoredAttack } from "../game/config/data";
import { fitCadence, medianOf, pairDetonations, type DetonationPair } from "./cadenceFit";
import { windowsForTrack, type AttackTrack, type SegmentWindow } from "./study";
import type { ProjectileOverride } from "./studyEdits";
import styles from "./TaggerRoute.module.css";

export type AuthoredBombValues = Readonly<{ travelSeconds: number; rangeTiles: number }>;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Plan V20 steps 87.1 and 87.3: a bomb track's measured flight time (E08) and
 * range (E09), each beside the catalog's value with an Accept button.
 */
function BombRows({
  track,
  bomb,
  tileWidthFraction,
  onAcceptOverride,
  onMeasurePair,
}: Readonly<{
  track: AttackTrack;
  bomb: AuthoredBombValues;
  tileWidthFraction: number | null;
  onAcceptOverride: (fields: ProjectileOverride) => void;
  onMeasurePair: (pairIndex: number, pair: DetonationPair) => void;
}>) {
  const pairs = pairDetonations(track.marks);
  const throws = track.marks.filter((mark) => mark.kind === "volley").length;
  const flight = medianOf(pairs.map((pair) => pair.detonationSeconds - pair.throwSeconds));
  const measured = (track.measuredRangeTiles ?? [])
    .slice(0, pairs.length)
    .filter((tiles): tiles is number => tiles !== null);
  const range = medianOf(measured);
  const targeted = track.attack.target === "player";
  const current = track.projectileOverride;
  const tiles = (value: number) => `${value.toFixed(3)} tiles`;
  return (
    <>
      <h3>Bomb</h3>
      <p className={styles.note}>
        {plural(pairs.length, "pair")}, {plural(throws - pairs.length, "unpaired throw")}. Measured
        from this video&apos;s throw and detonation marks.
      </p>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.compactTable}`}>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Measured</th>
              <th scope="col">Authored</th>
              <th scope="col">
                <span className={styles.visuallyHidden}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr aria-label="Flight time">
              <th scope="row">Flight time</th>
              <td>
                {flight === null
                  ? "A throw followed by its detonation would determine this."
                  : `${flight.toFixed(3)} s`}
              </td>
              <td>
                {bomb.travelSeconds.toFixed(3)} s
                {current?.travelSeconds === undefined
                  ? ""
                  : `; accepted ${current.travelSeconds.toFixed(3)} s`}
              </td>
              <td>
                <button
                  type="button"
                  disabled={flight === null}
                  aria-label="Accept flight time"
                  onClick={() => flight !== null && onAcceptOverride({ travelSeconds: flight })}
                >
                  Accept
                </button>
              </td>
            </tr>
            <tr aria-label="Range">
              <th scope="row">Range</th>
              <td>
                {tileWidthFraction === null
                  ? "Calibrate the scale in the Structure step to measure range."
                  : range === null
                    ? "Measure a pair below to determine this."
                    : tiles(range)}
              </td>
              <td>
                {tiles(bomb.rangeTiles)}
                {current?.rangeTiles === undefined ? "" : `; accepted ${tiles(current.rangeTiles)}`}
              </td>
              <td>
                {!targeted && (
                  <button
                    type="button"
                    disabled={range === null || tileWidthFraction === null}
                    aria-label="Accept range"
                    onClick={() => range !== null && onAcceptOverride({ rangeTiles: range })}
                  >
                    Accept
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {targeted && (
        <p className={styles.note}>
          A targeted bomb lands on the player, so its range is evidence only.
        </p>
      )}
      {tileWidthFraction !== null && pairs.length > 0 && (
        <ol aria-label="Detonation pairs">
          {pairs.map((pair, index) => {
            const value = track.measuredRangeTiles?.[index];
            return (
              <li key={pair.throwSeconds}>
                {pair.throwSeconds.toFixed(3)} s to {pair.detonationSeconds.toFixed(3)} s:{" "}
                {value === undefined || value === null ? "not measured" : `${tiles(value)} measured`}{" "}
                <button
                  type="button"
                  aria-label={`Measure pair ${index + 1}`}
                  onClick={() => onMeasurePair(index, pair)}
                >
                  Measure
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

export type CadenceField = keyof AuthoredAttack["cadence"];

const ROWS: readonly Readonly<{
  field: CadenceField;
  label: string;
  /** E06: what one more mark would determine when the fit cannot. */
  missing: string;
  seconds: boolean;
}>[] = [
  {
    field: "shotsPerBurst",
    label: "Shots per burst",
    missing: "One more mark after a cooldown would complete a burst and determine this.",
    seconds: false,
  },
  {
    field: "shotIntervalSeconds",
    label: "Shot interval",
    missing: "One more mark inside a burst would determine this.",
    seconds: true,
  },
  {
    field: "cooldownAfterLastShotSeconds",
    label: "Cooldown",
    missing: "One more mark after a cooldown would determine this.",
    seconds: true,
  },
  {
    field: "initialDelaySeconds",
    label: "Initial delay",
    missing: "One mark inside a window of this track's segment would determine this.",
    seconds: true,
  },
];

/**
 * Plan V20 step 86.3: the live cadence fit of the selected track (E06), with
 * the burst gap threshold override (E17). Holds no study state.
 */
export function FitPanel({
  track,
  windows,
  frameRate,
  onAccept,
  onAcceptAll,
  onSetThreshold,
  bomb,
  tileWidthFraction,
  onAcceptOverride,
  onMeasurePair,
}: Readonly<{
  track: AttackTrack;
  /** Every segment window; the panel keeps the track's own. */
  windows: readonly SegmentWindow[];
  frameRate: number | null;
  onAccept: (field: CadenceField, value: number) => void;
  /** Every non-null fitted value. */
  onAcceptAll: (values: Partial<Record<CadenceField, number>>) => void;
  onSetThreshold: (seconds: number | undefined) => void;
  /** The catalog's bomb values; present only for a bomb track (E08). */
  bomb?: AuthoredBombValues;
  /** The study's scale (E09), or null before a calibration. */
  tileWidthFraction?: number | null;
  /** Called with the override fields to merge into the track's. */
  onAcceptOverride?: (fields: ProjectileOverride) => void;
  onMeasurePair?: (pairIndex: number, pair: DetonationPair) => void;
}>) {
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const fit = fitCadence({
    marks: track.marks,
    windows: windowsForTrack(windows, track.location),
    ...(track.burstGapThresholdSeconds === undefined
      ? {}
      : { thresholdSeconds: track.burstGapThresholdSeconds }),
  });
  const gapCount = Math.max(0, fit.volleyCount - 1);
  const showThreshold =
    thresholdOpen ||
    track.burstGapThresholdSeconds !== undefined ||
    (fit.thresholdSeconds === null && gapCount >= 2);
  const format = (value: number, inSeconds: boolean) =>
    inSeconds ? value.toFixed(3) : String(value);
  const residual =
    fit.maxResidualSeconds === null
      ? "no residual yet"
      : `largest residual ${fit.maxResidualSeconds.toFixed(3)} s${
          frameRate === null ? "" : ` (${(fit.maxResidualSeconds * frameRate).toFixed(1)} frames)`
        }`;
  return (
    <section className={styles.inspectorPanel} aria-labelledby="fit-title">
      <div className={styles.headingRow}>
        <h2 id="fit-title">Cadence fit: {track.id}</h2>
      </div>
      <p className={styles.note}>
        {fit.volleyCount} volleys, {fit.completeBurstCount} complete bursts, {residual}. Measured
        from this video&apos;s marks; the current values are {track.cadenceSource}.
      </p>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.compactTable}`}>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Measured</th>
              <th scope="col">Current</th>
              <th scope="col">
                <span className={styles.visuallyHidden}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const value = fit[row.field];
              return (
                <tr key={row.field} aria-label={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{value === null ? row.missing : format(value, row.seconds)}</td>
                  <td>{format(track.attack.cadence[row.field], row.seconds)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={value === null}
                      aria-label={`Accept ${row.label.toLowerCase()}`}
                      onClick={() => value !== null && onAccept(row.field, value)}
                    >
                      Accept
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        <button
          type="button"
          disabled={ROWS.every((row) => fit[row.field] === null)}
          onClick={() =>
            onAcceptAll(
              Object.fromEntries(
                ROWS.flatMap((row) => {
                  const value = fit[row.field];
                  return value === null ? [] : [[row.field, value]];
                }),
              ),
            )
          }
        >
          Accept all
        </button>{" "}
        {!showThreshold && (
          <button type="button" onClick={() => setThresholdOpen(true)}>
            Set threshold
          </button>
        )}
      </p>
      {bomb && (
        <BombRows
          track={track}
          bomb={bomb}
          tileWidthFraction={tileWidthFraction ?? null}
          onAcceptOverride={onAcceptOverride ?? (() => {})}
          onMeasurePair={onMeasurePair ?? (() => {})}
        />
      )}
      {showThreshold && (
        <label className={styles.field}>
          <span>
            Burst gap threshold, seconds (blank splits automatically)
            {fit.thresholdSeconds === null && gapCount >= 2 && track.burstGapThresholdSeconds === undefined
              ? ": the automatic split is ambiguous"
              : ""}
          </span>
          <input
            key={String(track.burstGapThresholdSeconds)}
            type="number"
            min="0"
            step="any"
            aria-label="Burst gap threshold in seconds"
            defaultValue={track.burstGapThresholdSeconds ?? ""}
            onBlur={(event) => {
              const text = event.currentTarget.value.trim();
              if (text === "") {
                if (track.burstGapThresholdSeconds !== undefined) onSetThreshold(undefined);
              }
              else if (Number.isFinite(Number(text))) onSetThreshold(Number(text));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
      )}
    </section>
  );
}
