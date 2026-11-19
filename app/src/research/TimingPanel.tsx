import { pairDetonations, type DetonationPair } from "./cadenceFit";
import { CommitInput } from "./CommitInput";
import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import type { AttackTrack } from "./study";
import { measuredRangeTilesOf, measuredTravelSeconds } from "./studyExport";
import styles from "./TaggerRoute.module.css";

export type AuthoredBombValues = Readonly<{ travelSeconds: number; rangeTiles: number }>;

/** A starting value for a newly periodic track, typed over by the person; not a game value. */
const DEFAULT_PERIOD_SECONDS = 1;

const plural =(count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const tiles = (value: number) => `${value.toFixed(3)} tiles`;

/**
 * Plan V20 steps 87.1 and 87.3, plan V23 Q14: a bomb track's measured flight
 * time (E08) and range (E09) beside the catalog's. Export writes the measured
 * values; nothing is accepted.
 */
function BombRows({
  track,
  bomb,
  tileWidthFraction,
  onMeasurePair,
}: Readonly<{
  track: AttackTrack;
  bomb: AuthoredBombValues;
  tileWidthFraction: number | null;
  onMeasurePair: (pairIndex: number, pair: DetonationPair) => void;
}>) {
  const pairs = pairDetonations(track.marks);
  const throws = track.marks.filter((mark) => mark.kind === "volley").length;
  const flight = measuredTravelSeconds(track);
  const range = measuredRangeTilesOf(track);
  const targeted = track.attack.target === "player";
  return (
    <>
      <h3>Bomb</h3>
      <p className={styles.note}>
        {plural(pairs.length, "pair")}, {plural(throws - pairs.length, "unpaired throw")}. Measured
        from this video&apos;s throw and detonation marks; export writes the measured values.
      </p>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.compactTable}`}>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Measured</th>
              <th scope="col">Authored</th>
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
              <td>{bomb.travelSeconds.toFixed(3)} s</td>
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
              <td>{tiles(bomb.rangeTiles)}</td>
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

/**
 * Plan V23 Q06, Q07: the selected track's timing. A periodic track repeats its
 * first window's marks every period until its end mark (`X`) or its segment's
 * end; a track that is not periodic plays its marks once. A bomb track also
 * shows its measured flight values.
 */
export function TimingPanel({
  track,
  bomb,
  tileWidthFraction,
  onSetPeriod,
  onMeasurePair,
}: Readonly<{
  track: AttackTrack;
  /** The catalog bomb's values; absent for a bullet. */
  bomb?: AuthoredBombValues;
  tileWidthFraction: number | null;
  /** Returns false when the edit is refused, so the field shows the stored value again. */
  onSetPeriod: (seconds: number | undefined) => boolean;
  onMeasurePair: (pairIndex: number, pair: DetonationPair) => void;
}>) {
  const periodic = track.periodSeconds !== undefined;
  return (
    <section className={styles.inspectorPanel} aria-labelledby="timing-title">
      <div className={styles.headingRow}>
        <h2 id="timing-title">Timing</h2>
        <HelpMark text={help.HELP_TIMING} />
      </div>
      <label className={styles.field}>
        <span>
          <input
            type="checkbox"
            checked={periodic}
            onChange={(event) =>
              onSetPeriod(event.target.checked ? DEFAULT_PERIOD_SECONDS : undefined)
            }
          />{" "}
          Periodic <HelpMark text={help.HELP_PERIODIC} />
        </span>
      </label>
      {periodic && (
        <CommitInput
          label={`Period (seconds) of ${track.id}`}
          caption="Period (seconds)"
          help={<HelpMark text={help.HELP_PERIOD} />}
          value={String(track.periodSeconds)}
          step="any"
          onCommit={(text) => onSetPeriod(Number(text))}
        />
      )}
      <p className={styles.note}>
        {periodic
          ? "Repeats the first window's marks every period, until the end mark or the segment's end."
          : "Plays the first window's marks once, then stays silent until the segment ends."}
      </p>
      {bomb && (
        <BombRows
          track={track}
          bomb={bomb}
          tileWidthFraction={tileWidthFraction}
          onMeasurePair={onMeasurePair}
        />
      )}
    </section>
  );
}
