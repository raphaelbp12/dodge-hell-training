import {
  useEffect,
  useMemo,
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
import {
  summarizeTags,
  type Tag,
  type TagAim,
  type TagArmPattern,
  type TagPattern,
} from "./tagging";
import {
  actionForKey,
  clampSeekTarget,
  COARSE_JUMP_SECONDS,
  FINE_JUMP_SECONDS,
  frameStepSeconds,
  isActivationTarget,
  isEditableTarget,
  estimateFrameRate,
  parseFrameRate,
  type FrameSample,
} from "./taggingRoute";
import {
  appearanceOptions,
  assembleExport,
  armPatternAllowed,
  armPatternTakesArc,
  assignBurst,
  createTag,
  DEFAULT_ARM_ARC_DEGREES,
  DEFAULT_SHOTS_PER_ARM,
  editTag,
  formatSummaryRow,
  OFFERABLE_PATTERNS,
  patternTakesAim,
  phaseOptions,
  pixelGridCells,
  readoutInterval,
  rotationAllowed,
  shotsLabel,
  sortNewestFirst,
  TAG_AIMS,
  type AppearanceOption,
  type PhaseOption,
  type StickySelection,
  type TagChange,
} from "./taggingOptions";
import {
  currentDuration,
  fileNameMismatch,
  loadDecision,
  parseStudyFile,
  resolveProvenance,
  videoChoiceDecision,
} from "./studyLoad";
import {
  buildDraft,
  restoreSticky,
  shouldWriteDraft,
  TaggerSessions,
  type SessionListEntry,
} from "./taggerSessions";
import type { StudyState } from "./tagging";
import { PreviewPanel } from "./PreviewPanel";
import {
  attackJson,
  authoredAttackFromTag,
  FRONT_EXPORT_NOTE,
} from "./exportAttack";
import {
  PreviewPreference,
  VIDEO_SIZE_PIXELS,
  type PreviewPreferenceValue,
  type PreviewSize,
} from "./previewPreference";
import { highlightedTagIndices, selectionAfterDelete } from "./previewModel";
import styles from "./TaggerRoute.module.css";

const THUMBNAIL_SCALE_PIXELS = 6;

/** Frames kept for the playback frame-rate estimate. */
const FRAME_SAMPLE_WINDOW = 60;

type FrameMetadata = Readonly<{ mediaTime: number; presentedFrames: number }>;

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

type Confirmation = Readonly<{ message: string; onConfirm: () => void }>;

const KNOWN_ENCOUNTER_IDS = ENCOUNTER_LIST.map((entry) => entry.id);

function RawOrKnownSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
}) {
  const known = options.some((option) => option.value === value);
  return (
    <select
      className={styles.cellSelect}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {!known && <option value={value}>{value} (unknown)</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function phaseChoices(phases: readonly PhaseOption[]) {
  return phases.map((phase) => ({
    value: String(phase.index),
    label: `${phase.label} — ${phase.id}`,
  }));
}

/**
 * A number input that commits on blur or Enter and restores its text when the
 * edit is refused, so a rejected value never lingers in the row.
 */
function CommitInput({
  value,
  label,
  onCommit,
  blankAllowed = false,
  step = "1",
}: {
  value: string;
  label: string;
  onCommit: (text: string) => boolean;
  blankAllowed?: boolean;
  step?: string;
}) {
  return (
    <input
      key={value}
      className={styles.cellInput}
      type="number"
      step={step}
      aria-label={label}
      defaultValue={value}
      onBlur={(event) => {
        const text = event.currentTarget.value;
        if (text === value || (blankAllowed && text === "" && value === ""))
          return;
        if (!onCommit(text)) event.currentTarget.value = value;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function ExportBox({
  tagNumber,
  result,
  note,
  onCopy,
  onClose,
}: {
  tagNumber: number;
  result: ReturnType<typeof authoredAttackFromTag>;
  note: string | null;
  onCopy: (text: string) => void;
  onClose: () => void;
}) {
  if (!result)
    return (
      <div className={styles.exportBox} role="status">
        <p>
          Tag {tagNumber} cannot export: no authored attack in its phase fires
          this sprite in this pattern, so the cadence and projectile have
          nothing to come from.
        </p>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    );
  const text = attackJson(result.attack);
  return (
    <div className={styles.exportBox}>
      <label className={styles.field}>
        <span>Attack JSON for tag {tagNumber}</span>
        <textarea
          readOnly
          rows={14}
          value={text}
          aria-label={`Attack JSON for tag ${tagNumber}`}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <p className={styles.note}>
        Paste this into the archetype&apos;s attacks in enemies.json by hand;
        nothing is written for you. Rotation phase is measured at the first
        tag of its group, and cadence is copied from the matched attack.
      </p>
      {result.aimsFront && <p className={styles.note}>{FRONT_EXPORT_NOTE}</p>}
      <button type="button" onClick={() => onCopy(text)}>
        Copy JSON
      </button>{" "}
      <button type="button" onClick={onClose}>
        Close
      </button>
      {note && <span role="status"> {note}</span>}
    </div>
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
    pattern: "rotating-arm",
    aim: "player",
    shots: 1,
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [mediaTime, setMediaTime] = useState(0);
  const [seekPending, setSeekPending] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Z26: the presented rate has no default; it must be typed.
  const [frameRateText, setFrameRateText] = useState("");
  const [sourceUrlText, setSourceUrlText] = useState("");
  const [tags, setTags] = useState<readonly Tag[]>([]);
  const [layoutPreference] = useState(
    () => new PreviewPreference(() => window.localStorage),
  );
  const [layout, setLayout] = useState<PreviewPreferenceValue>(() =>
    layoutPreference.get(),
  );
  const changeLayout = (next: PreviewPreferenceValue) => {
    layoutPreference.set(next);
    setLayout(next);
  };
  const [selectedTagIndex, setSelectedTagIndex] = useState<number | null>(null);
  // N41: the row whose attack JSON is shown in the export box; nothing is written to disk.
  const [exportIndex, setExportIndex] = useState<number | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The loaded or restored study's file name and duration (Z14, Z16).
  const [studyMeta, setStudyMeta] = useState<Readonly<{
    fileName: string;
    durationSeconds: number;
  }> | null>(null);
  // Z15: the first video chosen after a load or restore keeps the tags.
  const [keepTagsOnNextVideo, setKeepTagsOnNextVideo] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  // Z30: a slot is written only after a first tag or edit in this session.
  const [dirty, setDirty] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [sessions] = useState(() => new TaggerSessions(() => window.localStorage));
  const [sessionList, setSessionList] = useState<
    readonly SessionListEntry[] | null
  >(null);
  const [sessionListError, setSessionListError] = useState<string | null>(null);
  const [sessionsDismissed, setSessionsDismissed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const highlighted = useMemo(
    () => highlightedTagIndices(tags, selectedTagIndex),
    [tags, selectedTagIndex],
  );
  // A seek has not yet produced a presented frame, so `mediaTime` still names
  // the previous frame. Recording waits for the callback rather than reading
  // the seek target (T19). The timeout is a safety net for a seek that lands
  // on the frame already displayed and therefore presents no callback.
  const seekPendingRef = useRef(false);
  const seekTimeoutRef = useRef<number | null>(null);
  const detectedFrameRateRef = useRef<((rate: number) => void) | null>(null);
  const [rateDetected, setRateDetected] = useState(false);
  detectedFrameRateRef.current = (rate) => {
    // Fill a blank field only: a typed or restored rate always wins.
    if (frameRateText !== "") return;
    setFrameRateText(String(rate));
    setRateDetected(true);
    if (tags.length > 0) setDirty(true);
  };

  const frameRate = parseFrameRate(frameRateText);
  const selectedPhase = phases[sticky.phaseIndex] ?? phases[0];
  const interval = readoutInterval(tags, sticky);
  const duration = currentDuration(
    durationSeconds,
    studyMeta?.durationSeconds ?? null,
  );
  const mismatch = fileNameMismatch(
    studyMeta?.fileName ?? null,
    videoUrl ? fileName : null,
  );
  const summaryRows = summarizeTags(tags).map((summary) =>
    formatSummaryRow(summary, phases),
  );

  const refreshSessions = () => {
    const result = sessions.list();
    if (result.ok) {
      setSessionList(result.value);
      setSessionListError(null);
    } else {
      setSessionList([]);
      setSessionListError(result.error);
    }
  };

  // Z29: opening the route lists saved sessions.
  useEffect(() => {
    refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Z28/Z30: autosave once the session is dirty and holds a tag. The slot is
  // keyed by the file name in use now, so an accepted mismatched video writes
  // to its own slot and leaves the old one (Z16).
  useEffect(() => {
    if (!shouldWriteDraft({ dirty, tagCount: tags.length })) return;
    const source = videoUrl
      ? { fileName, durationSeconds }
      : studyMeta;
    if (!source || source.fileName.trim().length === 0 || !(source.durationSeconds > 0))
      return;
    const trimmed = sourceUrlText.trim();
    const study: StudyState = {
      encounterId,
      provenance: {
        sourceUrl: trimmed.length === 0 ? null : trimmed,
        fileName: source.fileName.trim(),
        frameRate,
        durationSeconds: source.durationSeconds,
      },
      tags,
    };
    const result = sessions.write(
      buildDraft({ study, sticky, savedAt: new Date().toISOString() }),
    );
    setAutosaveError(result.ok ? null : result.error);
  }, [
    dirty,
    tags,
    sticky,
    sourceUrlText,
    frameRate,
    encounterId,
    videoUrl,
    fileName,
    durationSeconds,
    studyMeta,
    sessions,
  ]);

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
    const samples: FrameSample[] = [];
    const onFrame = (_now: number, metadata: FrameMetadata) => {
      if (cancelled) return;
      if (seekTimeoutRef.current !== null) {
        window.clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      seekPendingRef.current = false;
      setSeekPending(false);
      setMediaTime(metadata.mediaTime);
      if (element.paused) samples.length = 0;
      else {
        samples.push({
          mediaTime: metadata.mediaTime,
          presentedFrames: metadata.presentedFrames,
        });
        if (samples.length > FRAME_SAMPLE_WINDOW) samples.shift();
        const detected = estimateFrameRate(samples);
        if (detected !== null) detectedFrameRateRef.current?.(detected);
      }
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
   * The one seek path (Z22). It changes only the presented frame: the
   * displayed and recorded time still comes from the next frame callback.
   * Reading the seeked value here would reintroduce frame-rate-dependent
   * timestamps (T19).
   */
  const seekTo = (target: number) => {
    const element = video.current;
    if (!element) return;
    element.pause();
    const limit =
      Number.isFinite(element.duration) && element.duration > 0
        ? element.duration
        : durationSeconds;
    clearSeekTimeout();
    seekPendingRef.current = true;
    setSeekPending(true);
    seekTimeoutRef.current = window.setTimeout(() => {
      seekPendingRef.current = false;
      setSeekPending(false);
      seekTimeoutRef.current = null;
    }, 500);
    element.currentTime = clampSeekTarget(target, limit);
  };

  const seekBy = (deltaSeconds: number) => {
    const element = video.current;
    if (!element) return;
    // `currentTime` is read here only to find the seek target of a
    // non-recorded affordance. No tag time is ever derived from it (T19).
    seekTo(element.currentTime + deltaSeconds);
  };

  const stepFrame = (direction: -1 | 1, deltaSeconds?: number) => {
    let delta: number;
    try {
      delta = deltaSeconds ?? frameStepSeconds(frameRate ?? 0);
    } catch {
      setError("Enter the video's presented frame rate before stepping frames.");
      return;
    }
    seekBy(direction * delta);
  };

  const jumpBy = (seconds: number) => seekBy(seconds);

  const recordTag = (mode: "standalone" | "new-burst" | "continue-burst") => {
    if (!videoUrl) {
      setError("Load a video before recording a tag.");
      return;
    }
    if (frameRate === null) {
      setError("Enter the video's presented frame rate before recording.");
      return;
    }
    if (seekPendingRef.current) {
      setError("Wait for the seeked frame to appear before recording.");
      return;
    }
    let burstId: number | undefined;
    if (mode !== "standalone") {
      const assigned = assignBurst(
        tags,
        sticky,
        mode === "new-burst" ? "new" : "continue",
      );
      if (assigned === null) {
        setError(
          "No earlier burst matches this phase, sprite, pattern and aim. Press B to start one.",
        );
        return;
      }
      burstId = assigned;
    }
    setError(null);
    setDirty(true);
    setTags((current) => [...current, createTag(mediaTime, sticky, burstId)]);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (isEditableTarget(target)) return;
      if (isActivationTarget(target, event.key)) return;
      if (
        event.repeat &&
        (event.key === " " ||
          event.key === "Enter" ||
          event.key === "b" ||
          event.key === "B")
      )
        return;
      let action: ReturnType<typeof actionForKey>;
      try {
        action = actionForKey(event.key, frameRate ?? 0, event.shiftKey);
      } catch {
        event.preventDefault();
        setError("Enter the video's presented frame rate before stepping frames.");
        return;
      }
      if (!action) return;
      event.preventDefault();
      if (action.kind === "jump") jumpBy(action.direction * action.seconds);
      else if (action.kind === "frame-step")
        stepFrame(action.direction, action.deltaSeconds);
      else if (action.kind === "play-pause") togglePlayback();
      else if (action.kind === "record") recordTag(action.mode);
      else
        setSticky((current) => ({ ...current, shots: action.shots }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  /** Chooses the sticky arm pattern with the starting values a typed estimate needs. */
  const setStickyArmPattern = (armPattern: TagArmPattern | null) =>
    setSticky((current) => {
      const { armPattern: _removed, ...rest } = current;
      if (armPattern === null) return rest;
      return {
        ...rest,
        armPattern,
        shotsPerArm: current.shotsPerArm ?? DEFAULT_SHOTS_PER_ARM,
        ...(armPatternTakesArc(armPattern)
          ? { armArcDegrees: current.armArcDegrees ?? DEFAULT_ARM_ARC_DEGREES }
          : {}),
      };
    });

  /** A blank field removes a sticky typed value; anything else must be a finite number. */
  const setStickyNumber = (
    field:
      | "shotsPerArm"
      | "armArcDegrees"
      | "clockwiseDegreesPerSecond"
      | "initialPhaseDegrees",
    text: string,
  ) =>
    setSticky((current) => {
      const { [field]: _removed, ...rest } = current;
      if (text.trim() === "") return rest;
      const value = Number(text);
      if (!Number.isFinite(value)) return current;
      if (field === "shotsPerArm") return { ...rest, shotsPerArm: Math.max(1, Math.round(value)) };
      if (field === "armArcDegrees") return { ...rest, armArcDegrees: Math.max(0, value) };
      return { ...rest, [field]: value };
    });

  const resetSeek = () => {
    clearSeekTimeout();
    seekPendingRef.current = false;
    setSeekPending(false);
  };

  const applyVideo = (file: File, keepTags: boolean) => {
    setError(null);
    setFileName(file.name);
    setDurationSeconds(0);
    setMediaTime(0);
    resetSeek();
    if (keepTags) {
      // Z15: tags, sourceUrl and frameRate carry over from the load.
      setKeepTagsOnNextVideo(false);
    } else {
      setSourceUrlText("");
      setFrameRateText("");
      setRateDetected(false);
      setTags([]);
      setSelectedTagIndex(null);
      setStudyMeta(null);
      setDirty(false);
    }
    setVideoUrl(URL.createObjectURL(file));
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const decision = videoChoiceDecision({
      tagCount: tags.length,
      keepTagsOnNextVideo,
    });
    if (decision === "confirm-reset")
      setConfirmation({
        message: `Choosing "${file.name}" clears the ${tags.length} tag(s) in this session. Saved sessions are not affected.`,
        onConfirm: () => applyVideo(file, false),
      });
    else applyVideo(file, decision === "keep");
  };

  const chooseEncounter = (id: string) => {
    setEncounterId(id);
    // One video is one fight (T16): tags recorded under the previous encounter
    // cannot be relabelled by a later selector change.
    setTags([]);
    setSelectedTagIndex(null);
    setStudyMeta(null);
    setKeepTagsOnNextVideo(false);
    setDirty(false);
    resetSeek();
    setError(null);
    setSticky((current) => ({ ...current, phaseIndex: 0 }));
  };

  /** Shared by loading a study file and restoring a saved session. */
  const applyStudy = (
    study: StudyState,
    nextSticky: StickySelection | null,
    notices: readonly string[],
  ) => {
    setEncounterId(study.encounterId);
    setSourceUrlText(study.provenance.sourceUrl ?? "");
    setFrameRateText(
      study.provenance.frameRate === null ? "" : String(study.provenance.frameRate),
    );
    setTags(study.tags);
    setSelectedTagIndex(null);
    setStudyMeta({
      fileName: study.provenance.fileName,
      durationSeconds: study.provenance.durationSeconds,
    });
    setSticky((current) =>
      nextSticky ? nextSticky : { ...current, phaseIndex: 0 },
    );
    setKeepTagsOnNextVideo(true);
    setDirty(false);
    setError(null);
    setNotice(notices.length > 0 ? notices.join(" ") : null);
  };

  const requestApply = (message: string, apply: () => void) => {
    if (loadDecision(tags.length) === "confirm")
      setConfirmation({ message, onConfirm: apply });
    else apply();
  };

  const chooseStudy = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void file.text().then(
      (text) => {
        let study: StudyState;
        try {
          study = parseStudyFile(text, KNOWN_ENCOUNTER_IDS);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          return;
        }
        requestApply(
          `Loading "${file.name}" replaces the ${tags.length} tag(s) in this session.`,
          () => applyStudy(study, null, []),
        );
      },
      () => setError("The study file could not be read."),
    );
  };

  const restoreSession = (key: string) => {
    const result = sessions.read(key);
    if (!result.ok) {
      setError(`The saved session could not be restored: ${result.error}`);
      return;
    }
    const draft = result.value;
    if (!KNOWN_ENCOUNTER_IDS.includes(draft.study.encounterId)) {
      setError(`Unknown encounter "${draft.study.encounterId}".`);
      return;
    }
    const restored = restoreSticky(
      draft.sticky,
      encounterConfigOf(draft.study.encounterId),
    );
    const notices = restored.notices.map((entry) =>
      entry === "sprite-missing"
        ? "The saved sprite no longer exists; the default sprite is selected."
        : "The saved phase no longer exists; the first phase is selected.",
    );
    requestApply(
      `Restoring "${draft.study.provenance.fileName}" replaces the ${tags.length} tag(s) in this session.`,
      () => applyStudy(draft.study, restored.sticky, notices),
    );
  };

  const discardSession = (key: string) => {
    setConfirmation({
      message: "Discard this saved session? This cannot be undone.",
      onConfirm: () => {
        const result = sessions.discard(key);
        if (!result.ok) setError(`Could not discard: ${result.error}`);
        refreshSessions();
      },
    });
  };

  const applyEdit = (index: number, change: TagChange) => {
    const result = editTag(tags[index], change, duration);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setDirty(true);
    setTags((current) =>
      current.map((entry, at) => (at === index ? result.tag : entry)),
    );
    return true;
  };

  const exportTags = () => {
    setError(null);
    try {
      const provenance = resolveProvenance({
        video: videoUrl ? { fileName, durationSeconds } : null,
        study: studyMeta,
        sourceUrlText,
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

  const rows = sortNewestFirst(tags);
  const showSessions =
    !sessionsDismissed &&
    ((sessionList !== null && sessionList.length > 0) || sessionListError);

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

      {confirmation && (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirm">
          <span>{confirmation.message}</span>
          <button
            type="button"
            onClick={() => {
              const { onConfirm } = confirmation;
              setConfirmation(null);
              onConfirm();
            }}
          >
            Confirm
          </button>
          <button type="button" onClick={() => setConfirmation(null)}>
            Cancel
          </button>
        </div>
      )}

      {showSessions && (
        <section className={styles.panel} aria-labelledby="sessions-title">
          <h2 id="sessions-title">Saved sessions</h2>
          {sessionListError && (
            <p className={styles.error} role="alert">
              Saved sessions are unavailable: {sessionListError}
            </p>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Tags</th>
                  <th scope="col">Last saved</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(sessionList ?? []).map((entry) =>
                  entry.readable ? (
                    <tr key={entry.key}>
                      <td>{entry.fileName}</td>
                      <td>{entry.tagCount}</td>
                      <td>{new Date(entry.savedAt).toLocaleString()}</td>
                      <td>
                        <button type="button" onClick={() => restoreSession(entry.key)}>
                          Restore
                        </button>{" "}
                        <button type="button" onClick={() => discardSession(entry.key)}>
                          Discard
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={entry.key}>
                      <td colSpan={3}>Unreadable: {entry.key}</td>
                      <td>
                        <button type="button" onClick={() => discardSession(entry.key)}>
                          Discard
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Sessions are saved automatically per video file name and removed
            only when discarded.
          </p>
          <button type="button" onClick={() => setSessionsDismissed(true)}>
            Dismiss list
          </button>
        </section>
      )}

      <section className={styles.panel} aria-labelledby="source-title">
        <h2 id="source-title">Video</h2>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Local video file</span>
            <input type="file" accept="video/*" onChange={chooseFile} />
          </label>
          <label className={styles.field}>
            <span>Load study (JSON, optional)</span>
            <input type="file" accept="application/json,.json" onChange={chooseStudy} />
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
              onChange={(event) => {
                setSourceUrlText(event.target.value);
                if (tags.length > 0) setDirty(true);
              }}
              placeholder="https://..."
            />
          </label>
          <label className={styles.field}>
            <span>
              Video's presented frame rate (fps, required)
              {rateDetected && " - detected from playback"}
            </span>
            <input
              type="number"
              min="1"
              step="any"
              value={frameRateText}
              onChange={(event) => {
                setFrameRateText(event.target.value);
                setRateDetected(false);
                if (tags.length > 0) setDirty(true);
              }}
            />
          </label>
        </div>
        <p className={styles.meta}>
          {videoUrl
            ? fileName
            : studyMeta
              ? `${studyMeta.fileName} (from study, no video open)`
              : "No file chosen"}{" "}
          · duration {duration > 0 ? `${duration.toFixed(3)} s` : "unknown"}
        </p>
        {mismatch && (
          <p className={styles.warning} role="status">
            The study names "{studyMeta?.fileName}" but the open video is "
            {fileName}". Export will use the open video's file name and
            duration.
          </p>
        )}
        <div className={styles.stage}>
          <div className={styles.stageMain}>
            <div className={styles.sizeControls} role="group" aria-label="Video size">
              <span>Video size</span>
              {(["small", "medium", "large"] as const satisfies readonly PreviewSize[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={`Video size ${option}`}
                    aria-pressed={layout.videoSize === option}
                    onClick={() => changeLayout({ ...layout, videoSize: option })}
                  >
                    {option[0]!.toUpperCase() + option.slice(1)}
                  </button>
                ),
              )}
            </div>
        {videoUrl && (
          <video
            ref={video}
            className={styles.video}
            style={{ width: VIDEO_SIZE_PIXELS[layout.videoSize] }}
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
            Choose a video file to record, step or jump. Without one you can
            still load, edit and export a study. Nothing is uploaded.
          </p>
        )}
          </div>
          <PreviewPanel
            key={encounterId}
            tags={tags}
            mediaTime={mediaTime}
            hasVideo={videoUrl !== null}
            config={config}
            highlightedTagIndices={highlighted}
            layout={layout}
            onLayoutChange={changeLayout}
          />
        </div>
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
          seconds, Enter records a standalone tag, B records a volley that
          starts a new burst, Shift+Enter adds a volley to the latest matching
          burst, and number keys 1-9 set the shot count.
        </p>
      </section>

      <section className={styles.panel} aria-labelledby="tag-title">
        <h2 id="tag-title">Tag</h2>
        <p className={styles.sticky} aria-live="polite">
          Recording: <strong>{sticky.spriteId}</strong> ·{" "}
          {selectedPhase ? selectedPhase.label : "No phase"} ({selectedPhase?.id}
          ) · <strong>{sticky.pattern}</strong>
          {patternTakesAim(sticky.pattern) && (
            <>
              {" "}
              · aim <strong>{sticky.aim}</strong>
            </>
          )}{" "}
          · <strong>{sticky.shots}</strong> {shotsLabel(sticky.pattern)}
          {armPatternAllowed(sticky.pattern) && sticky.armPattern && (
            <>
              {" "}
              · each arm <strong>{sticky.armPattern}</strong>
              {sticky.shotsPerArm !== undefined && <> ×{sticky.shotsPerArm}</>}
            </>
          )}
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
            <legend>Pattern</legend>
            {OFFERABLE_PATTERNS.map((pattern) => (
              <label key={pattern}>
                <input
                  type="radio"
                  name="pattern"
                  checked={sticky.pattern === pattern}
                  onChange={() => setSticky((current) => ({ ...current, pattern }))}
                />
                {pattern}
              </label>
            ))}
          </fieldset>
          {patternTakesAim(sticky.pattern) && (
            <fieldset className={styles.field}>
              <legend>Aim</legend>
              {TAG_AIMS.map((aim) => (
                <label key={aim}>
                  <input
                    type="radio"
                    name="aim"
                    checked={sticky.aim === aim}
                    onChange={() => setSticky((current) => ({ ...current, aim }))}
                  />
                  {aim}
                </label>
              ))}
            </fieldset>
          )}
          <label className={styles.field}>
            <span>{sticky.pattern === "rotating-arm" || sticky.pattern === "fixed-ring" ? "Arms" : "Shots"}</span>
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
          {armPatternAllowed(sticky.pattern) && (
            <fieldset className={styles.field}>
              <legend>Each arm fires</legend>
              {[null, "spread", "scatter", "ring"].map((choice) => (
                <label key={choice ?? "none"}>
                  <input
                    type="radio"
                    name="arm-pattern"
                    checked={(sticky.armPattern ?? null) === choice}
                    onChange={() =>
                      setStickyArmPattern(choice as TagArmPattern | null)
                    }
                  />
                  {choice ?? "single shot"}
                </label>
              ))}
              {sticky.armPattern && (
                <label>
                  <span>Shots per arm</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    aria-label="Shots per arm"
                    value={sticky.shotsPerArm ?? ""}
                    onChange={(event) =>
                      setStickyNumber("shotsPerArm", event.target.value)
                    }
                  />
                </label>
              )}
              {sticky.armPattern && armPatternTakesArc(sticky.armPattern) && (
                <label>
                  <span>Cone width, degrees (typed estimate)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    aria-label="Cone width in degrees"
                    value={sticky.armArcDegrees ?? ""}
                    onChange={(event) =>
                      setStickyNumber("armArcDegrees", event.target.value)
                    }
                  />
                </label>
              )}
              <small className={styles.note}>
                One level of nesting only. The cone is typed by a person, not
                measured from the video.
              </small>
            </fieldset>
          )}
          {rotationAllowed(sticky.pattern) && (
            <fieldset className={styles.field}>
              <legend>Rotation (typed estimates)</legend>
              <label>
                <span>Clockwise degrees per second</span>
                <input
                  type="number"
                  step="any"
                  aria-label="Clockwise degrees per second"
                  value={sticky.clockwiseDegreesPerSecond ?? ""}
                  onChange={(event) =>
                    setStickyNumber("clockwiseDegreesPerSecond", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Initial phase, degrees</span>
                <input
                  type="number"
                  step="any"
                  aria-label="Initial phase in degrees"
                  value={sticky.initialPhaseDegrees ?? ""}
                  onChange={(event) =>
                    setStickyNumber("initialPhaseDegrees", event.target.value)
                  }
                />
              </label>
              <small className={styles.note}>
                Blank keeps the matched attack&apos;s authored value. Negative
                rates turn counter-clockwise.
              </small>
            </fieldset>
          )}
        </div>
        <div className={styles.recordRow}>
          <button
            type="button"
            className={styles.record}
            onClick={() => recordTag("standalone")}
            disabled={!videoUrl || seekPending}
          >
            Record tag
          </button>
          <button
            type="button"
            onClick={() => recordTag("new-burst")}
            disabled={!videoUrl || seekPending}
          >
            Start burst (B)
          </button>
          <button
            type="button"
            onClick={() => recordTag("continue-burst")}
            disabled={!videoUrl || seekPending}
          >
            Add to burst (Shift+Enter)
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
        {autosaveError && (
          <p className={styles.error} role="alert">
            Autosave failed: {autosaveError}. Tagging continues; export to keep
            your work.
          </p>
        )}
        {notice && (
          <p className={styles.warning} role="status">
            {notice}
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

      <section className={styles.panel} aria-labelledby="summary-title">
        <h2 id="summary-title">Summary</h2>
        {summaryRows.length === 0 ? (
          <p className={styles.empty}>No tags to summarise yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Phase</th>
                  <th scope="col">Sprite</th>
                  <th scope="col">Pattern</th>
                  <th scope="col">Aim</th>
                  <th scope="col">Arm pattern</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Samples</th>
                  <th scope="col">Mean</th>
                  <th scope="col">Deviation</th>
                  <th scope="col">Intervals</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={`${row.phase}|${row.sprite}|${row.pattern}|${row.aim}|${row.armPattern}|${row.scope}`}>
                    <td>{row.phase}</td>
                    <td>{row.sprite}</td>
                    <td>{row.pattern}</td>
                    <td>{row.aim}</td>
                    <td>{row.armPattern}</td>
                    <td>{row.scope}</td>
                    <td>{row.sampleCount}</td>
                    <td>{row.mean}</td>
                    <td>{row.deviation}</td>
                    <td className={styles.intervals}>{row.intervals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <th scope="col">Time (s)</th>
                  <th scope="col">Sprite</th>
                  <th scope="col">Phase</th>
                  <th scope="col">Pattern</th>
                  <th scope="col">Aim</th>
                  <th scope="col">Shots / arms</th>
                  <th scope="col">Geometry (typed)</th>
                  <th scope="col">Burst</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ tag, index }) => (
                  <tr
                    key={index}
                    className={
                      selectedTagIndex === index ? styles.selectedRow : undefined
                    }
                    onClick={(event) => {
                      if (
                        (event.target as HTMLElement).closest(
                          "input, select, button, textarea",
                        )
                      )
                        return;
                      setSelectedTagIndex((current) =>
                        current === index ? null : index,
                      );
                      if (videoUrl) seekTo(tag.timeSeconds);
                    }}
                  >
                    <td>
                      <CommitInput
                        label={`Time of tag ${index + 1}`}
                        value={tag.timeSeconds.toFixed(3)}
                        step="0.001"
                        onCommit={(text) =>
                          text.trim() !== "" &&
                          applyEdit(index, {
                            field: "timeSeconds",
                            value: Number(text),
                          })
                        }
                      />
                      {tag.timeSource === "typed" && (
                        <small className={styles.note}> typed</small>
                      )}
                    </td>
                    <td>
                      <RawOrKnownSelect
                        label={`Sprite of tag ${index + 1}`}
                        value={tag.spriteId}
                        options={appearances.map((option) => ({
                          value: option.id,
                          label: option.id,
                        }))}
                        onChange={(value) =>
                          applyEdit(index, { field: "spriteId", value })
                        }
                      />
                    </td>
                    <td>
                      <RawOrKnownSelect
                        label={`Phase of tag ${index + 1}`}
                        value={String(tag.phaseIndex)}
                        options={phaseChoices(phases)}
                        onChange={(value) =>
                          applyEdit(index, {
                            field: "phaseIndex",
                            value: Number(value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <RawOrKnownSelect
                        label={`Pattern of tag ${index + 1}`}
                        value={tag.pattern}
                        options={OFFERABLE_PATTERNS.map((pattern) => ({
                          value: pattern,
                          label: pattern,
                        }))}
                        onChange={(value) =>
                          applyEdit(index, {
                            field: "pattern",
                            value: value as TagPattern,
                          })
                        }
                      />
                    </td>
                    <td>
                      {tag.aim === undefined ? (
                        "—"
                      ) : (
                        <select
                          className={styles.cellSelect}
                          aria-label={`Aim of tag ${index + 1}`}
                          value={tag.aim}
                          onChange={(event) =>
                            applyEdit(index, {
                              field: "aim",
                              value: event.target.value as TagAim,
                            })
                          }
                        >
                          {TAG_AIMS.map((aim) => (
                            <option key={aim} value={aim}>
                              {aim}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <CommitInput
                        label={`Shots of tag ${index + 1}`}
                        value={String(tag.shots)}
                        onCommit={(text) =>
                          text.trim() !== "" &&
                          applyEdit(index, { field: "shots", value: Number(text) })
                        }
                      />
                    </td>
                    <td>
                      {!armPatternAllowed(tag.pattern) &&
                      !rotationAllowed(tag.pattern) ? (
                        "—"
                      ) : (
                        <>
                          {armPatternAllowed(tag.pattern) && (
                            <>
                              <select
                                className={styles.cellSelect}
                                aria-label={`Arm pattern of tag ${index + 1}`}
                                value={tag.armPattern ?? ""}
                                onChange={(event) =>
                                  applyEdit(index, {
                                    field: "armPattern",
                                    value:
                                      event.target.value === ""
                                        ? null
                                        : (event.target.value as TagArmPattern),
                                    ...(event.target.value !== "" &&
                                    event.target.value !== "ring" &&
                                    tag.armArcDegrees === undefined
                                      ? { armArcDegrees: DEFAULT_ARM_ARC_DEGREES }
                                      : {}),
                                  })
                                }
                              >
                                <option value="">single</option>
                                <option value="spread">spread</option>
                                <option value="scatter">scatter</option>
                                <option value="ring">ring</option>
                              </select>
                              {tag.armPattern && (
                                <CommitInput
                                  label={`Shots per arm of tag ${index + 1}`}
                                  value={String(tag.shotsPerArm ?? "")}
                                  onCommit={(text) =>
                                    text.trim() !== "" &&
                                    applyEdit(index, {
                                      field: "shotsPerArm",
                                      value: Number(text),
                                    })
                                  }
                                />
                              )}
                              {tag.armPattern && armPatternTakesArc(tag.armPattern) && (
                                <CommitInput
                                  label={`Cone width of tag ${index + 1}`}
                                  value={String(tag.armArcDegrees ?? "")}
                                  step="any"
                                  onCommit={(text) =>
                                    text.trim() !== "" &&
                                    applyEdit(index, {
                                      field: "armArcDegrees",
                                      value: Number(text),
                                    })
                                  }
                                />
                              )}
                            </>
                          )}
                          {rotationAllowed(tag.pattern) && (
                            <>
                              <CommitInput
                                label={`Rotation rate of tag ${index + 1}`}
                                value={
                                  tag.clockwiseDegreesPerSecond === undefined
                                    ? ""
                                    : String(tag.clockwiseDegreesPerSecond)
                                }
                                step="any"
                                blankAllowed
                                onCommit={(text) =>
                                  applyEdit(index, {
                                    field: "clockwiseDegreesPerSecond",
                                    value: text.trim() === "" ? null : Number(text),
                                  })
                                }
                              />
                              <CommitInput
                                label={`Initial phase of tag ${index + 1}`}
                                value={
                                  tag.initialPhaseDegrees === undefined
                                    ? ""
                                    : String(tag.initialPhaseDegrees)
                                }
                                step="any"
                                blankAllowed
                                onCommit={(text) =>
                                  applyEdit(index, {
                                    field: "initialPhaseDegrees",
                                    value: text.trim() === "" ? null : Number(text),
                                  })
                                }
                              />
                            </>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <CommitInput
                        label={`Burst of tag ${index + 1}`}
                        value={tag.burstId === undefined ? "" : String(tag.burstId)}
                        blankAllowed
                        onCommit={(text) =>
                          applyEdit(index, {
                            field: "burstId",
                            value: text.trim() === "" ? null : Number(text),
                          })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setCopyNote(null);
                          setExportIndex((current) =>
                            current === index ? null : index,
                          );
                        }}
                        aria-label={`Export tag at ${tag.timeSeconds.toFixed(3)} seconds as an attack`}
                      >
                        Export as attack
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => seekTo(tag.timeSeconds)}
                        disabled={!videoUrl}
                        aria-label={`Go to tag at ${tag.timeSeconds.toFixed(3)} seconds`}
                      >
                        Go to
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setDirty(true);
                          setSelectedTagIndex((current) =>
                            selectionAfterDelete(current, index),
                          );
                          setExportIndex((current) =>
                            selectionAfterDelete(current, index),
                          );
                          setTags((current) =>
                            current.filter((_entry, at) => at !== index),
                          );
                        }}
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
        {exportIndex !== null && tags[exportIndex] && (
          <ExportBox
            tagNumber={exportIndex + 1}
            result={authoredAttackFromTag(tags[exportIndex], config)}
            note={copyNote}
            onCopy={(text) => {
              // N41: a failing clipboard only leaves the box for manual copying.
              const clipboard = navigator.clipboard;
              if (!clipboard) {
                setCopyNote("Copy the text above by hand.");
                return;
              }
              clipboard.writeText(text).then(
                () => setCopyNote("Copied."),
                () => setCopyNote("Copy the text above by hand."),
              );
            }}
            onClose={() => setExportIndex(null)}
          />
        )}
        <p className={styles.note}>
          Tags list newest footage first. Edit a row in place or delete it;
          there is no undo. Sessions are saved automatically per video file
          name; load a study JSON above to continue earlier work.
        </p>
      </section>
    </main>
  );
}
