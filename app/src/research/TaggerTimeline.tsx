import { useEffect, useRef, useState } from "react";
import { markerFractions } from "./timelineModel";
import styles from "./TaggerRoute.module.css";

const CANVAS_WIDTH_PX = 1200;
const CANVAS_HEIGHT_PX = 24;
const MARKER_COLOR = "#ffd479";
const MARKER_WIDTH_PX = 2;

/**
 * The scrub bar (plan V16 S15, S16): one range input over the whole video with
 * one canvas behind it drawing a marker per volley. No element per marker. The
 * playhead is the range value, which is the presented frame's `mediaTime`,
 * never a seek target; every seek goes through the route's single seek path.
 */
export function TaggerTimeline({
  durationSeconds,
  mediaTime,
  volleyTimes,
  enabled,
  onSeek,
}: {
  durationSeconds: number;
  mediaTime: number;
  volleyTimes: readonly number[];
  enabled: boolean;
  onSeek: (seconds: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [gotoText, setGotoText] = useState<string | null>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    context.clearRect(0, 0, element.width, element.height);
    context.fillStyle = MARKER_COLOR;
    for (const fraction of markerFractions(volleyTimes, durationSeconds)) {
      const x = Math.round(fraction * (element.width - MARKER_WIDTH_PX));
      context.fillRect(x, 0, MARKER_WIDTH_PX, element.height);
    }
  }, [volleyTimes, durationSeconds]);

  const commitGoto = () => {
    const text = gotoText;
    setGotoText(null);
    if (text === null || text.trim() === "") return;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > durationSeconds) return;
    onSeek(value);
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineBar}>
        <canvas
          ref={canvas}
          className={styles.timelineCanvas}
          width={CANVAS_WIDTH_PX}
          height={CANVAS_HEIGHT_PX}
          aria-hidden="true"
        />
        <input
          className={styles.timelineRange}
          type="range"
          aria-label="Timeline"
          min={0}
          max={durationSeconds > 0 ? durationSeconds : 1}
          step="any"
          value={Math.min(mediaTime, durationSeconds > 0 ? durationSeconds : 1)}
          disabled={!enabled || !(durationSeconds > 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
      </div>
      <label className={styles.cellCaption}>
        <small>Go to time (s)</small>
        <input
          className={styles.cellInput}
          type="number"
          step="any"
          aria-label="Go to time"
          disabled={!enabled}
          value={gotoText ?? ""}
          placeholder={mediaTime.toFixed(3)}
          onChange={(event) => setGotoText(event.target.value)}
          onBlur={commitGoto}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </label>
    </div>
  );
}
