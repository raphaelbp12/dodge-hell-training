import { HelpMark } from "./HelpMark";
import { HELP_CALIBRATE_SCALE } from "./helpText";
import styles from "./TaggerRoute.module.css";

/** A tile width as a percentage of the video's width. */
const PERCENT = 100;

/**
 * Plan V20 step 87.2: the scale calibration (E09). "Calibrate scale" arms a
 * drag on the route's overlay over the video; the panel holds no study state.
 */
export function ScalePanel({
  tileWidthFraction,
  armed,
  hasVideo,
  onCalibrate,
  onClear,
}: Readonly<{
  tileWidthFraction: number | null;
  armed: boolean;
  hasVideo: boolean;
  onCalibrate: () => void;
  onClear: () => void;
}>) {
  return (
    <section className={styles.inspectorPanel} aria-labelledby="scale-title">
      <div className={styles.headingRow}>
        <h2 id="scale-title">Scale</h2>
      </div>
      <p>
        <button type="button" onClick={onCalibrate} disabled={!hasVideo || armed}>
          Calibrate scale
        </button>{" "}
        <HelpMark text={HELP_CALIBRATE_SCALE} />{" "}
        <button type="button" onClick={onClear} disabled={tileWidthFraction === null}>
          Clear
        </button>
      </p>
      <p className={styles.note} role="status">
        {armed
          ? "Drag across the monster's body on the video."
          : tileWidthFraction === null
            ? "No scale yet."
            : `1 tile = ${(tileWidthFraction * PERCENT).toFixed(2)} % of the video width, measured.`}
      </p>
    </section>
  );
}
