import { useEffect, useMemo, useRef, useState } from "react";
import type { EncounterConfig } from "../game/config/encounter";
import type { Vector2 } from "../game/models";
import { drawPreviewFrame, drawEmptyPreview } from "./previewDraw";
import {
  countUnmatchedTags,
  initialHeadingSliderDegrees,
  previewAt,
} from "./previewModel";
import {
  PREVIEW_SIZE_PIXELS,
  type PreviewPreferenceValue,
  type PreviewSize,
} from "./previewPreference";
import {
  clampView,
  fitView,
  panBy,
  playerSliderRanges,
  zoomAbout,
  type PreviewView,
} from "./previewView";
import type { SavedAttack, Tag } from "./tagging";
import {
  DEFAULT_TUNING_SHOT_INTERVAL_SECONDS,
  TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND,
  type TunableValue,
  type TuningChange,
  type TuningField,
} from "./tuning";
import { CommitInput } from "./TypedFieldControls";
import styles from "./PreviewPanel.module.css";

const PLAYER_SLIDER_STEP_TILES = 0.1;
/** Approved with plan V15 (N20): the heading slider moves in whole degrees. */
const HEADING_SLIDER_STEP_DEGREES = 1;
const SIZES: readonly PreviewSize[] = ["small", "medium", "large"];
const NO_VIDEO_NOTE = "Open a video to see the preview";

/** What the tuning section edits and how (V16 S48, S49). */
export type TuningProps = Readonly<{
  /** "Tuning saved attack ...", "Tuning this tag only", or null with no row selected. */
  target: string | null;
  values: readonly TunableValue[];
  /** Returns whether the change was accepted, so a refused input restores its text. */
  onChange: (change: TuningChange) => boolean;
}>;

const TUNING_LABEL: Readonly<Record<TuningField, string>> = {
  clockwiseDegreesPerSecond: "Rotation rate, degrees per second",
  initialPhaseDegrees: "Initial phase, degrees",
  emitterRadiusTiles: "Emitter radius, tiles",
  shotsPerBurst: "Shots per burst",
  shotIntervalSeconds: "Shot interval, seconds",
  cooldownAfterLastShotSeconds: "Cooldown after the last shot, seconds",
};

/** Optional values may be blanked; the cadence values may not. */
const BLANK_ALLOWED: readonly TuningField[] = [
  "clockwiseDegreesPerSecond",
  "initialPhaseDegrees",
  "emitterRadiusTiles",
];

type Props = Readonly<{
  tags: readonly Tag[];
  /** Needed to expand repeat rows into volleys. */
  savedAttacks: readonly SavedAttack[];
  mediaTime: number;
  hasVideo: boolean;
  config: EncounterConfig;
  highlightedTagIndices: readonly number[];
  tuning: TuningProps;
  /** The persisted layout, owned by the route (shown and size). */
  layout: PreviewPreferenceValue;
  onLayoutChange: (next: PreviewPreferenceValue) => void;
}>;

/**
 * Draws every tagged volley at the presented video time onto a plain 2D
 * canvas (M10). React holds only the inputs; no element exists per projectile.
 */
export function PreviewPanel({
  tags,
  savedAttacks,
  mediaTime,
  hasVideo,
  config,
  highlightedTagIndices,
  tuning,
  layout,
  onLayoutChange,
}: Props) {
  const shape = config.arena.shape;
  const { shown, size } = layout;
  const canvasPixels = PREVIEW_SIZE_PIXELS[size];
  const [view, setView] = useState<PreviewView>(() => fitView(shape));
  const [playerTiles, setPlayerTiles] = useState<Vector2>(
    config.player.spawnTiles,
  );
  // N20: one value for the whole study, starting at the primary archetype's
  // initial heading. It is view state only: it never joins the persisted
  // preference (M24) and resets on reload.
  const [headingDegrees, setHeadingDegrees] = useState(() =>
    initialHeadingSliderDegrees(config),
  );
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Vector2 | null>(null);
  const ranges = playerSliderRanges(shape);
  const unmatchedCount = useMemo(
    () => countUnmatchedTags(tags, config),
    [tags, config],
  );

  const chooseSize = (next: PreviewSize) => {
    onLayoutChange({ ...layout, size: next });
    setView((current) =>
      clampView(current, shape, PREVIEW_SIZE_PIXELS[next]),
    );
  };

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!shown || !context) return;
    if (!hasVideo) {
      drawEmptyPreview(context, canvasPixels);
      return;
    }
    drawPreviewFrame(
      context,
      previewAt({
        tags,
        savedAttacks,
        timeSeconds: mediaTime,
        config,
        playerTiles,
        headingRadians: (headingDegrees * Math.PI) / 180,
      }),
      view,
      canvasPixels,
      highlightedTagIndices,
    );
  }, [
    shown,
    hasVideo,
    tags,
    savedAttacks,
    mediaTime,
    config,
    playerTiles,
    headingDegrees,
    view,
    canvasPixels,
    highlightedTagIndices,
  ]);

  // React's onWheel is passive, so the page-scroll guard needs a native listener.
  useEffect(() => {
    const element = canvas.current;
    if (!shown || !element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const point = {
        x: ((event.clientX - bounds.left) / bounds.width) * canvasPixels,
        y: ((event.clientY - bounds.top) / bounds.height) * canvasPixels,
      };
      const direction = event.deltaY < 0 ? 1 : -1;
      setView((current) =>
        zoomAbout(current, direction, point, shape, canvasPixels),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [shown, canvasPixels, shape]);

  return (
    <aside className={styles.panel} aria-label="Tag preview">
      <div className={styles.controls}>
        <button
          type="button"
          aria-pressed={shown}
          onClick={() => onLayoutChange({ ...layout, shown: !shown })}
        >
          {shown ? "Hide preview" : "Show preview"}
        </button>
        {shown && (
          <>
            {SIZES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={size === option}
                onClick={() => chooseSize(option)}
              >
                {option[0]!.toUpperCase() + option.slice(1)}
              </button>
            ))}
            <button type="button" onClick={() => setView(fitView(shape))}>
              Reset view
            </button>
          </>
        )}
      </div>
      {shown && (
        <>
          <canvas
            ref={canvas}
            className={styles.canvas}
            aria-label="Tag preview canvas"
            width={canvasPixels}
            height={canvasPixels}
            style={{ width: canvasPixels, height: canvasPixels }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerMove={(event) => {
              const last = drag.current;
              if (!last) return;
              drag.current = { x: event.clientX, y: event.clientY };
              const delta = { x: event.clientX - last.x, y: event.clientY - last.y };
              setView((current) => panBy(current, delta, shape, canvasPixels));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          />
          {!hasVideo && (
            <p className={styles.note} role="status">
              {NO_VIDEO_NOTE}
            </p>
          )}
          {unmatchedCount > 0 && (
            <p className={styles.note} role="status">
              {unmatchedCount} {unmatchedCount === 1 ? "tag" : "tags"} not
              previewed
            </p>
          )}
          {(["x", "y"] as const).map((axis) => (
            <label key={axis} className={styles.slider}>
              <span>Player {axis} (tiles)</span>
              <input
                type="range"
                min={ranges[axis][0]}
                max={ranges[axis][1]}
                step={PLAYER_SLIDER_STEP_TILES}
                value={playerTiles[axis]}
                onChange={(event) =>
                  setPlayerTiles((current) => ({
                    ...current,
                    [axis]: Number(event.target.value),
                  }))
                }
              />
              <output>{playerTiles[axis].toFixed(1)}</output>
            </label>
          ))}
          <label className={styles.slider}>
            <span>Enemy heading (degrees)</span>
            <input
              type="range"
              min={0}
              max={360}
              step={HEADING_SLIDER_STEP_DEGREES}
              value={headingDegrees}
              onChange={(event) => setHeadingDegrees(Number(event.target.value))}
            />
            <output>{headingDegrees.toFixed(0)}</output>
          </label>
          <TuningSection tuning={tuning} />
        </>
      )}
    </aside>
  );
}

/**
 * The tuning controls (V16 S47-S50): number fields for the selected row's typed
 * estimates, plus a rate slider. They edit only the study, never game data, and
 * redraw through the one preview effect.
 */
function TuningSection({ tuning }: Readonly<{ tuning: TuningProps }>) {
  if (tuning.target === null)
    return (
      <p className={styles.note}>
        Select a tag row to tune its typed estimates while watching the
        preview.
      </p>
    );
  const spb = tuning.values.find((entry) => entry.field === "shotsPerBurst")?.value;
  const hasInterval = tuning.values.some((entry) => entry.field === "shotIntervalSeconds");
  return (
    <fieldset className={styles.tuning}>
      <legend>Tuning (typed estimates)</legend>
      <p className={styles.note}>{tuning.target}</p>
      {tuning.values.length === 0 && (
        <p className={styles.note}>Nothing on this tag can be tuned here.</p>
      )}
      {tuning.values.map(({ field, value }) => (
        <div key={field} className={styles.tuningRow}>
          <CommitInput
            label={`Tune ${TUNING_LABEL[field].toLowerCase()}`}
            caption={`${TUNING_LABEL[field]} (typed estimate)`}
            value={value === undefined ? "" : String(value)}
            step="any"
            blankAllowed={BLANK_ALLOWED.includes(field)}
            onCommit={(text) => {
              const blank = text.trim() === "";
              const next = blank ? null : Number(text);
              const raisesBurst =
                field === "shotsPerBurst" && next !== null && next > 1 && !hasInterval;
              return tuning.onChange({
                field,
                value: next,
                ...(raisesBurst && spb !== undefined
                  ? { shotIntervalSeconds: DEFAULT_TUNING_SHOT_INTERVAL_SECONDS }
                  : {}),
              });
            }}
          />
          {field === "clockwiseDegreesPerSecond" && (
            <input
              type="range"
              aria-label="Rotation rate slider"
              min={-TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND}
              max={TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND}
              step={1}
              value={Math.max(
                -TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND,
                Math.min(TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND, value ?? 0),
              )}
              onChange={(event) =>
                tuning.onChange({ field, value: Number(event.target.value) })
              }
            />
          )}
        </div>
      ))}
    </fieldset>
  );
}
