import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  DEFAULT_ENCOUNTER_ID,
  ENCOUNTER_LIST,
  encounterConfigOf,
  type ProjectileAppearanceSpec,
} from "../game/config/encounter";
import type { Tag } from "./tagging";
import {
  actionForKey,
  buildProvenance,
  COARSE_JUMP_SECONDS,
  FINE_JUMP_SECONDS,
  frameStepSeconds,
  isActivationTarget,
  isEditableTarget,
} from "./taggingRoute";
import {
  appearanceOptions,
  assembleExport,
  createTag,
  phaseOptions,
  pixelGridCells,
  readoutInterval,
  type AppearanceOption,
  type StickySelection,
} from "./taggingOptions";
import styles from "./TaggerRoute.module.css";

const DEFAULT_FRAME_RATE = 60;
const THUMBNAIL_SCALE_PIXELS = 6;

type FrameMetadata = Readonly<{ mediaTime: number }>;

function AppearanceThumbnail({ spec }: { spec: ProjectileAppearanceSpec }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const grid = pixelGridCells(spec.pixels);
    element.width = Math.max(1, grid.width * THUMBNAIL_SCALE_PIXELS);
    element.height = Math.max(1, grid.height * THUMBNAIL_SCALE_PIXELS);
    const context = element.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, element.width, element.height);
    grid.cells.forEach((colour, index) => {
      if (colour === null) return;
      context.fillStyle = colour;
      context.fillRect(
        (index % grid.width) * THUMBNAIL_SCALE_PIXELS,
        Math.floor(index / grid.width) * THUMBNAIL_SCALE_PIXELS,
        THUMBNAIL_SCALE_PIXELS,
        THUMBNAIL_SCALE_PIXELS,
      );
    });
  }, [spec]);
  return <canvas ref={canvas} className={styles.thumbnail} aria-hidden="true" />;
}

function AppearanceChoice({
  option,
  selected,
  onSelect,
}: {
  option: AppearanceOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.appearance} ${selected ? styles.selectedAppearance : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {option.isBomb ? (
        <span
          className={styles.bombSwatch}
          style={{ backgroundColor: option.spec.bomb?.bodyColor }}
          aria-hidden="true"
        />
      ) : (
        <AppearanceThumbnail spec={option.spec} />
      )}
      <span className={styles.appearanceId}>{option.id}</span>
    </button>
  );
}

export function TaggerRoute() {
  const appearances = appearanceOptions();
  const initialEncounter = ENCOUNTER_LIST.some(
    (entry) => entry.id === DEFAULT_ENCOUNTER_ID,
  )
    ? DEFAULT_ENCOUNTER_ID
    : ENCOUNTER_LIST[0].id;
  const [encounterId, setEncounterId] = useState(initialEncounter);
  const config = encounterConfigOf(encounterId);
  const phases = phaseOptions(config);
  const [sticky, setSticky] = useState<StickySelection>({
    phaseIndex: 0,
    spriteId: appearances[0].id,
    kind: "volley",
    shots: 1,
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [mediaTime, setMediaTime] = useState(0);
  const [seekPending, setSeekPending] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [frameRateText, setFrameRateText] = useState(String(DEFAULT_FRAME_RATE));
  const [sourceUrlText, setSourceUrlText] = useState("");
  const [tags, setTags] = useState<readonly Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  // A seek has not yet produced a presented frame, so `mediaTime` still names
  // the previous frame. Recording waits for the callback rather than reading
  // the seek target (T19). The timeout is a safety net for a seek that lands
  // on the frame already displayed and therefore presents no callback.
  const seekPendingRef = useRef(false);
  const seekTimeoutRef = useRef<number | null>(null);

  const frameRate = Number(frameRateText);
  const selectedPhase = phases[sticky.phaseIndex] ?? phases[0];
  const interval = readoutInterval(tags, sticky);

  // T17: the video only ever enters through a file picker, and its object URL
  // is revoked when the file changes or the route unmounts.
  useEffect(() => {
    if (!videoUrl) return;
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  // T19: `mediaTime` is the presentation timestamp of the frame actually on
  // screen. Re-register after every frame and cancel on unmount.
  useEffect(() => {
    const element = video.current;
    if (!element || !videoUrl) return;
    let cancelled = false;
    let handle: number | null = null;
    const onFrame = (_now: number, metadata: FrameMetadata) => {
      if (cancelled) return;
      if (seekTimeoutRef.current !== null) {
        window.clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      seekPendingRef.current = false;
      setSeekPending(false);
      setMediaTime(metadata.mediaTime);
      handle = element.requestVideoFrameCallback(onFrame);
    };
    handle = element.requestVideoFrameCallback(onFrame);
    return () => {
      cancelled = true;
      if (handle !== null) element.cancelVideoFrameCallback(handle);
    };
  }, [videoUrl]);

  const clearSeekTimeout = () => {
    if (seekTimeoutRef.current !== null) {
      window.clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  };

  useEffect(
    () => () => {
      if (seekTimeoutRef.current !== null)
        window.clearTimeout(seekTimeoutRef.current);
    },
    [],
  );

  const togglePlayback = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) {
      void element
        .play()
        .catch(() => setError("The browser could not play this file."));
    } else element.pause();
  };

  /**
   * A transport seek, whether a frame step or a coarse jump, changes only the
   * presented frame. The displayed and recorded time still comes from the next
   * frame callback. Reading the seeked value here would reintroduce
   * frame-rate-dependent timestamps (T19).
   */
  const seekBy = (deltaSeconds: number) => {
    const element = video.current;
    if (!element) return;
    element.pause();
    const limit =
      Number.isFinite(element.duration) && element.duration > 0
        ? element.duration
        : durationSeconds;
    // `currentTime` is read here only to find the seek target of a
    // non-recorded affordance. No tag time is ever derived from it (T19).
    const target = element.currentTime + deltaSeconds;
    clearSeekTimeout();
    seekPendingRef.current = true;
    setSeekPending(true);
    seekTimeoutRef.current = window.setTimeout(() => {
      seekPendingRef.current = false;
      setSeekPending(false);
      seekTimeoutRef.current = null;
    }, 500);
    element.currentTime =
      limit > 0 ? Math.min(Math.max(0, target), limit) : Math.max(0, target);
  };

  const stepFrame = (direction: -1 | 1, deltaSeconds?: number) => {
    let delta: number;
    try {
      delta = deltaSeconds ?? frameStepSeconds(frameRate);
    } catch {
      setError("Enter a positive frame rate before stepping frames.");
      return;
    }
    seekBy(direction * delta);
  };

  const jumpBy = (seconds: number) => seekBy(seconds);

  const recordTag = () => {
    if (!videoUrl) {
      setError("Load a video before recording a tag.");
      return;
    }
    if (seekPendingRef.current) {
      setError("Wait for the seeked frame to appear before recording.");
      return;
    }
    setError(null);
    setTags((current) => [...current, createTag(mediaTime, sticky)]);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (isEditableTarget(target)) return;
      if (isActivationTarget(target, event.key)) return;
      if (event.repeat && (event.key === " " || event.key === "Enter")) return;
      let action: ReturnType<typeof actionForKey>;
      try {
        action = actionForKey(event.key, frameRate, event.shiftKey);
      } catch {
        return;
      }
      if (!action) return;
      event.preventDefault();
      if (action.kind === "jump") jumpBy(action.direction * action.seconds);
      else if (action.kind === "frame-step")
        stepFrame(action.direction, action.deltaSeconds);
      else if (action.kind === "play-pause") togglePlayback();
      else if (action.kind === "record") recordTag();
      else
        setSticky((current) => ({ ...current, shots: action.shots }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setDurationSeconds(0);
    setMediaTime(0);
    setSourceUrlText("");
    setFrameRateText(String(DEFAULT_FRAME_RATE));
    clearSeekTimeout();
    seekPendingRef.current = false;
    setSeekPending(false);
    setTags([]);
    setVideoUrl(URL.createObjectURL(file));
  };

  const chooseEncounter = (id: string) => {
    setEncounterId(id);
    // One video is one fight (T16): tags recorded under the previous encounter
    // cannot be relabelled by a later selector change.
    setTags([]);
    clearSeekTimeout();
    seekPendingRef.current = false;
    setSeekPending(false);
    setError(null);
    setSticky((current) => ({ ...current, phaseIndex: 0 }));
  };

  const exportTags = () => {
    setError(null);
    try {
      if (!videoUrl) throw new Error("Load a video before exporting.");
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
        throw new Error("Wait until the video's duration is known.");
      const provenance = buildProvenance({
        fileName,
        durationSeconds,
        sourceUrl: sourceUrlText,
        frameRate,
      });
      const exported = assembleExport({
        encounterId,
        provenance,
        tags,
        recordedAt: new Date().toISOString(),
      });
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${encounterId}-observations.json`;
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Revoking in the same task can cancel the download in some engines.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const newestFirst = tags
    .map((tag, index) => ({ tag, index }))
    .reverse();

  return (
    <main className={styles.shell} data-tagger-route>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Development only</span>
          <h1>Killer Bee Queen tagger</h1>
        </div>
        <p className={styles.note}>
          Tag spawns at the presented frame. The video is never uploaded or
          committed.
        </p>
      </header>

      <section className={styles.panel} aria-labelledby="source-title">
        <h2 id="source-title">Video</h2>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Local video file</span>
            <input type="file" accept="video/*" onChange={chooseFile} />
          </label>
          <label className={styles.field}>
            <span>Encounter</span>
            <select
              value={encounterId}
              onChange={(event) => chooseEncounter(event.target.value)}
            >
              {ENCOUNTER_LIST.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Source URL (blank for a local recording)</span>
            <input
              type="url"
              value={sourceUrlText}
              onChange={(event) => setSourceUrlText(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className={styles.field}>
            <span>Frame rate (steps only)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={frameRateText}
              onChange={(event) => setFrameRateText(event.target.value)}
            />
          </label>
        </div>
        <p className={styles.meta}>
          {fileName || "No file chosen"} · duration{" "}
          {durationSeconds > 0 ? `${durationSeconds.toFixed(3)} s` : "unknown"}
        </p>
        {videoUrl && (
          <video
            ref={video}
            className={styles.video}
            src={videoUrl}
            playsInline
            onLoadedMetadata={() => {
              const element = video.current;
              if (
                element &&
                Number.isFinite(element.duration) &&
                element.duration > 0
              )
                setDurationSeconds(element.duration);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
        {!videoUrl && (
          <p className={styles.empty}>
            Choose a video file to begin. Nothing is uploaded.
          </p>
        )}
        <div className={styles.transport}>
          <button type="button" onClick={togglePlayback} disabled={!videoUrl}>
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            aria-label={`Jump back ${COARSE_JUMP_SECONDS} seconds`}
            onClick={() => jumpBy(-COARSE_JUMP_SECONDS)}
            disabled={!videoUrl}
          >
            −{COARSE_JUMP_SECONDS} s
          </button>
          <button
            type="button"
            aria-label={`Jump back ${FINE_JUMP_SECONDS} seconds`}
            onClick={() => jumpBy(-FINE_JUMP_SECONDS)}
            disabled={!videoUrl}
          >
            −{FINE_JUMP_SECONDS} s
          </button>
          <button type="button" onClick={() => stepFrame(-1)} disabled={!videoUrl}>
            Previous frame
          </button>
          <button type="button" onClick={() => stepFrame(1)} disabled={!videoUrl}>
            Next frame
          </button>
          <button
            type="button"
            aria-label={`Jump forward ${FINE_JUMP_SECONDS} seconds`}
            onClick={() => jumpBy(FINE_JUMP_SECONDS)}
            disabled={!videoUrl}
          >
            +{FINE_JUMP_SECONDS} s
          </button>
          <button
            type="button"
            aria-label={`Jump forward ${COARSE_JUMP_SECONDS} seconds`}
            onClick={() => jumpBy(COARSE_JUMP_SECONDS)}
            disabled={!videoUrl}
          >
            +{COARSE_JUMP_SECONDS} s
          </button>
          <output className={styles.time} aria-label="Current frame time">
            {mediaTime.toFixed(3)} s
          </output>
        </div>
        <p className={styles.note}>
          Space plays or pauses, arrows step one frame, Shift+arrows jump{" "}
          {FINE_JUMP_SECONDS} seconds, PageUp/PageDown jump {COARSE_JUMP_SECONDS}{" "}
          seconds, Enter records, and number keys 1-9 set the shot count.
        </p>
      </section>

      <section className={styles.panel} aria-labelledby="tag-title">
        <h2 id="tag-title">Tag</h2>
        <p className={styles.sticky} aria-live="polite">
          Recording: <strong>{sticky.spriteId}</strong> ·{" "}
          {selectedPhase ? selectedPhase.label : "No phase"} ({selectedPhase?.id}
          ) · <strong>{sticky.kind}</strong> · <strong>{sticky.shots}</strong>{" "}
          {sticky.kind === "volley" ? "shots" : "arms"}
        </p>
        <div className={styles.controls}>
          <label className={styles.field}>
            <span>Phase</span>
            <select
              value={sticky.phaseIndex}
              onChange={(event) =>
                setSticky((current) => ({
                  ...current,
                  phaseIndex: Number(event.target.value),
                }))
              }
            >
              {phases.map((phase) => (
                <option key={phase.id} value={phase.index}>
                  {phase.label} — {phase.id}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={styles.field}>
            <legend>Kind</legend>
            <label>
              <input
                type="radio"
                name="kind"
                checked={sticky.kind === "volley"}
                onChange={() =>
                  setSticky((current) => ({ ...current, kind: "volley" }))
                }
              />
              Volley
            </label>
            <label>
              <input
                type="radio"
                name="kind"
                checked={sticky.kind === "rotating-arm"}
                onChange={() =>
                  setSticky((current) => ({ ...current, kind: "rotating-arm" }))
                }
              />
              Rotating arm
            </label>
          </fieldset>
          <label className={styles.field}>
            <span>Shots / arms</span>
            <input
              type="number"
              min="1"
              step="1"
              value={sticky.shots}
              onChange={(event) => {
                const shots = Number(event.target.value);
                setSticky((current) => ({
                  ...current,
                  shots: Number.isFinite(shots)
                    ? Math.max(1, Math.round(shots))
                    : 1,
                }));
              }}
            />
            <small className={styles.note}>
              Type any count; number keys 1-9 set it directly.
            </small>
          </label>
        </div>
        <div className={styles.recordRow}>
          <button
            type="button"
            className={styles.record}
            onClick={recordTag}
            disabled={!videoUrl || seekPending}
          >
            Record tag
          </button>
          <output className={styles.readout} aria-label="Interval since previous tag">
            {seekPending
              ? "Waiting for the seeked frame"
              : interval === null
                ? "No previous tag in this group"
                : `${interval.toFixed(3)} s since previous`}
          </output>
          <button type="button" onClick={exportTags}>
            Export JSON
          </button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="sprite-title">
        <h2 id="sprite-title">Sprite</h2>
        <div className={styles.appearanceGrid}>
          {appearances.map((option) => (
            <AppearanceChoice
              key={option.id}
              option={option}
              selected={sticky.spriteId === option.id}
              onSelect={() =>
                setSticky((current) => ({ ...current, spriteId: option.id }))
              }
            />
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="tags-title">
        <h2 id="tags-title">Tags ({tags.length})</h2>
        {tags.length === 0 ? (
          <p className={styles.empty}>No tags recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Sprite</th>
                  <th scope="col">Phase</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Shots / arms</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map(({ tag, index }) => (
                  <tr key={`${index}-${tag.timeSeconds}`}>
                    <td>{tag.timeSeconds.toFixed(3)} s</td>
                    <td>{tag.spriteId}</td>
                    <td>{phases[tag.phaseIndex]?.label ?? tag.phaseIndex}</td>
                    <td>{tag.kind}</td>
                    <td>{tag.shots}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setTags((current) =>
                            current.filter((_entry, at) => at !== index),
                          )
                        }
                        aria-label={`Delete tag at ${tag.timeSeconds.toFixed(3)} seconds`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.note}>
          Delete the newest row to undo a double-tap. There is no other undo,
          import or resume.
        </p>
      </section>
    </main>
  );
}
