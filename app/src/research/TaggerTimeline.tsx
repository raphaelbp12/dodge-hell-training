import { useEffect, useRef, useState, type MouseEvent } from "react";
import { TIMELINE_ROW_HEIGHT_PX, type TimelineRow } from "./timelineModel";
import styles from "./TaggerRoute.module.css";

/** Canvas width used until the element reports its own layout width. */
const FALLBACK_WIDTH_PX = 1200;
const MARK_COLOR = "#ffd479";
const BOUNDARY_COLOR = "#7fd1ff";
const BAR_COLOR = "rgba(255, 120, 120, 0.45)";
const LABEL_COLOR = "rgba(255, 255, 255, 0.75)";
const SELECTED_ROW_COLOR = "rgba(255, 255, 255, 0.08)";
const ROW_RULE_COLOR = "rgba(255, 255, 255, 0.1)";
const PLAYHEAD_COLOR = "#ffffff";
/** E20: a predicted volley is drawn at 40 % alpha. */
const FAINT_ALPHA = 0.4;
const TICK_WIDTH_PX = 2;
const LABEL_FONT = "10px sans-serif";
const LABEL_INSET_PX = 4;
const BOUNDARY_LABEL_GAP_PX = 3;

function drawRows(
  element: HTMLCanvasElement,
  rows: readonly TimelineRow[],
  selectedRowId: string | null,
  playheadFraction: number | null,
) {
  const context = element.getContext("2d");
  if (!context) return;
  const { width } = element;
  const span = width - TICK_WIDTH_PX;
  context.clearRect(0, 0, width, element.height);
  context.font = LABEL_FONT;
  context.textBaseline = "middle";
  rows.forEach((row, index) => {
    const top = index * TIMELINE_ROW_HEIGHT_PX;
    const middle = top + TIMELINE_ROW_HEIGHT_PX / 2;
    if (row.id === selectedRowId) {
      context.fillStyle = SELECTED_ROW_COLOR;
      context.fillRect(0, top, width, TIMELINE_ROW_HEIGHT_PX);
    }
    context.fillStyle = ROW_RULE_COLOR;
    context.fillRect(0, top + TIMELINE_ROW_HEIGHT_PX - 1, width, 1);
    context.fillStyle = BAR_COLOR;
    for (const bar of row.bars) {
      const from = Math.round(bar.fromFraction * span);
      context.fillRect(from, top + 2, Math.max(1, Math.round(bar.toFraction * span) - from), TIMELINE_ROW_HEIGHT_PX - 4);
    }
    for (const tick of row.ticks) {
      const x = Math.round(tick.fraction * span);
      if (tick.style === "boundary") {
        context.fillStyle = BOUNDARY_COLOR;
        context.fillRect(x, 0, TICK_WIDTH_PX, element.height);
      } else if (tick.style === "hollow") {
        context.strokeStyle = MARK_COLOR;
        context.lineWidth = 1;
        context.strokeRect(x + 0.5, top + 2.5, TICK_WIDTH_PX + 1, TIMELINE_ROW_HEIGHT_PX - 5);
      } else {
        context.globalAlpha = tick.style === "faint" ? FAINT_ALPHA : 1;
        context.fillStyle = MARK_COLOR;
        context.fillRect(x, top + 1, TICK_WIDTH_PX, TIMELINE_ROW_HEIGHT_PX - 2);
        context.globalAlpha = 1;
      }
    }
    context.fillStyle = BOUNDARY_COLOR;
    for (const label of row.labels)
      context.fillText(label.text, Math.round(label.fraction * span) + TICK_WIDTH_PX + BOUNDARY_LABEL_GAP_PX, middle);
    context.fillStyle = LABEL_COLOR;
    context.fillText(row.label, LABEL_INSET_PX, middle);
  });
  if (playheadFraction !== null) {
    context.fillStyle = PLAYHEAD_COLOR;
    context.fillRect(Math.round(playheadFraction * span), 0, 1, element.height);
  }
}

/**
 * The timeline (plan V20 E20): one canvas with one row per track, and the
 * scrub bar under it. No element per mark. A click in a row's band selects
 * that row; the scrub bar and the goto field seek. The playhead is the
 * presented frame's `mediaTime`, never a seek target; every seek goes through
 * the route's single seek path.
 */
export function TaggerTimeline({
  durationSeconds,
  mediaTime,
  rows,
  selectedRowId,
  onSelectRow,
  enabled,
  onSeek,
}: {
  durationSeconds: number;
  mediaTime: number;
  rows: readonly TimelineRow[];
  selectedRowId: string | null;
  onSelectRow: (id: string) => void;
  enabled: boolean;
  onSeek: (seconds: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [gotoText, setGotoText] = useState<string | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(FALLBACK_WIDTH_PX);
  const heightPx = rows.length * TIMELINE_ROW_HEIGHT_PX;
  const hasRows = rows.length > 0;

  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth > 0) setLayoutWidth(Math.round(element.clientWidth));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasRows]);

  const playheadFraction =
    durationSeconds > 0 ? Math.min(1, Math.max(0, mediaTime / durationSeconds)) : null;
  useEffect(() => {
    const element = canvas.current;
    if (element) drawRows(element, rows, selectedRowId, playheadFraction);
  }, [rows, selectedRowId, playheadFraction, layoutWidth, heightPx]);

  const selectAt = (event: MouseEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientY - box.top) / box.height) * rows.length);
    const row = rows[index];
    if (row) onSelectRow(row.id);
  };

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
      {rows.length > 0 && (
        <canvas
          ref={canvas}
          className={styles.timelineRows}
          width={layoutWidth}
          height={heightPx}
          style={{ height: `${heightPx}px` }}
          aria-label="Timeline tracks"
          data-selected-row={selectedRowId ?? undefined}
          onClick={selectAt}
        />
      )}
      <div className={styles.timelineBar}>
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
