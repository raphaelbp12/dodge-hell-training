import { useEffect, useMemo, useRef, useState } from "react";
import type { EncounterConfig } from "../game/config/encounter";
import type { Vector2 } from "../game/models";
import { fittedPreviewAt, observedPreviewAt } from "./draftPreview";
import { HelpMark } from "./HelpMark";
import { HELP_SECTION_PREVIEW } from "./helpText";
import { drawPreviewFrame, drawEmptyPreview } from "./previewDraw";
import { initialHeadingSliderDegrees, type PreviewFrame } from "./previewModel";
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
import type { Segment, SegmentWindow, StudyV5 } from "./study";
import { Segmented } from "./TaggerControls";
import styles from "./PreviewPanel.module.css";

const PLAYER_SLIDER_STEP_TILES = 0.1;
/** Approved with plan V15 (N20): the heading slider moves in whole degrees. */
const HEADING_SLIDER_STEP_DEGREES = 1;
const SIZES: readonly PreviewSize[] = ["small", "medium", "large"];
const NO_VIDEO_NOTE = "Open a video to see the preview";

/** E12: what the preview draws. */
const PREVIEW_MODES = ["Observed", "Fitted", "Both"] as const;
type PreviewMode = (typeof PREVIEW_MODES)[number];

type Props = Readonly<{
  study: StudyV5 | null;
  segments: readonly Segment[];
  windows: readonly SegmentWindow[];
  mediaTime: number;
  hasVideo: boolean;
  config: EncounterConfig;
  /** The selected track's index in the study, highlighted; null for none. */
  selectedTrackIndex: number | null;
  /** The persisted layout, owned by the route (shown and size). */
  layout: PreviewPreferenceValue;
  onLayoutChange: (next: PreviewPreferenceValue) => void;
}>;

/**
 * Draws the study's observed volleys, its fitted volleys as ghosts, or both,
 * at the presented video time onto a plain 2D canvas (M10, E12). React holds
 * only the inputs; no element exists per projectile.
 */
export function PreviewPanel({
  study,
  segments,
  windows,
  mediaTime,
  hasVideo,
  config,
  selectedTrackIndex,
  layout,
  onLayoutChange,
}: Props) {
  const shape = config.arena.shape;
  const { shown, size } = layout;
  const canvasPixels = PREVIEW_SIZE_PIXELS[size];
  const [view, setView] = useState<PreviewView>(() => fitView(shape));
  const [mode, setMode] = useState<PreviewMode>("Both");
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

  const result = useMemo(() => {
    if (study === null) return null;
    const input = {
      study,
      segments,
      windows,
      config,
      timeSeconds: mediaTime,
      playerTiles,
      headingRadians: (headingDegrees * Math.PI) / 180,
    };
    const observed = mode === "Fitted" ? null : observedPreviewAt(input);
    const fitted = mode === "Observed" ? null : fittedPreviewAt(input);
    const base = (observed ?? fitted)!;
    const frame: PreviewFrame = {
      ...base.frame,
      projectiles: [
        ...(fitted?.frame.projectiles ?? []),
        ...(observed?.frame.projectiles ?? []),
      ],
      detonations: [
        ...(fitted?.frame.detonations ?? []),
        ...(observed?.frame.detonations ?? []),
      ],
    };
    return { frame, undrawnAttackIds: base.undrawnAttackIds };
  }, [study, segments, windows, config, mediaTime, playerTiles, headingDegrees, mode]);
  const highlighted = useMemo(
    () => (selectedTrackIndex === null ? [] : [selectedTrackIndex]),
    [selectedTrackIndex],
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
    if (!hasVideo || result === null) {
      drawEmptyPreview(context, canvasPixels);
      return;
    }
    drawPreviewFrame(context, result.frame, view, canvasPixels, highlighted);
  }, [shown, hasVideo, result, view, canvasPixels, highlighted]);

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
      <Segmented
        legend="Draw"
        name="preview-mode"
        options={PREVIEW_MODES}
        value={mode}
        onChange={setMode}
      />
      <div className={styles.controls}>
        <button
          type="button"
          aria-pressed={shown}
          onClick={() => onLayoutChange({ ...layout, shown: !shown })}
        >
          {shown ? "Hide preview" : "Show preview"}
        </button>
        <HelpMark text={HELP_SECTION_PREVIEW} />
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
          {result && (
            <p className={styles.note} role="status">
              Observed volleys are the marks; fitted volleys, drawn faint, are
              each track&apos;s cadence in its windows. One fixed emitter, no
              movement, and only the selected monster.
            </p>
          )}
          {result && result.undrawnAttackIds.length > 0 && (
            <p className={styles.note} role="status">
              No sprite for: {result.undrawnAttackIds.join(", ")}. These
              attacks can be edited and exported but not seen.
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
        </>
      )}
    </aside>
  );
}
