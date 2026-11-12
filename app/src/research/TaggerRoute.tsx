import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  archetypeOf,
  DEFAULT_ENCOUNTER_ID,
  ENCOUNTER_LIST,
  encounterConfigOf,
  type ProjectileAppearanceSpec,
} from "../game/config/encounter";
import {
  summarizeTags,
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
  formatSummaryRow,
  OFFERABLE_PATTERNS,
  patternTakesAim,
  phaseOptions,
  pixelGridCells,
  readoutInterval,
  rotationAllowed,
  shotsLabel,
  sortNewestFirst,
  stickyFromTag,
  TAG_AIMS,
  type AppearanceOption,
  type PhaseOption,
  type StickySelection,
  type TagChange,
  type TypedNumberField,
} from "./taggingOptions";
import {
  currentDuration,
  fileNameMismatch,
  loadDecision,
  monsterSwitchPlan,
  observationFileName,
  parseStudyFile,
  resolveProvenance,
  studyMonsterProblem,
  studySections,
  videoChoiceDecision,
  encounterChangeDecision,
} from "./studyLoad";
import { GlossaryPanel } from "./GlossaryPanel";
import { StepGuidePanel } from "./StepGuidePanel";
import { STEP_GUIDES } from "./stepGuide";
import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import { DraftPanel } from "./DraftPanel";
import {
  blocksOfMonster,
  monstersOfEncounter,
  setAnchor,
  type MonsterDraft,
} from "./monsterDraft";
import {
  buildDraft,
  restoreSticky,
  shouldWriteDraft,
  TaggerSessions,
  type SessionListEntry,
} from "./taggerSessions";
import {
  resolveTags,
  type SavedAttack,
  type SavedAttackCadence,
  type StoredTag,
  type StudyState,
} from "./tagging";
import { PreviewPanel, type TuningProps } from "./PreviewPanel";
import { applyTuning, tunableValuesFor } from "./tuning";
import { SavedAttackPanel } from "./SavedAttackPanel";
import { clearRepeatEnd, endRepeatTarget, setRepeatEnd, volleyTimesOf } from "./repeat";
import {
  createSavedAttack,
  deleteSavedAttack,
  detachTag,
  editStoredTag,
  isStickyModified,
  linkedAttackIdOf,
  recordStoredTag,
  renameSavedAttack,
  stickyFromSavedAttack,
  updateFromSticky,
} from "./savedAttacks";
import {
  CommitInput,
  RowTypedFields,
  StickyTypedFields,
  rowHasTypedFields,
} from "./TypedFieldControls";
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
import { TaggerTimeline } from "./TaggerTimeline";
import { Segmented, StepNav, type StepItem, type TaggerStep } from "./TaggerControls";
import {
  nextVolleyTime,
  previousVolleyTime,
  volleyStepTolerance,
} from "./timelineModel";
import {
  highlightedTagIndices,
  matchesLinearBullet,
  matchStatusText,
  selectionAfterDelete,
  tagMatchStatus,
} from "./previewModel";
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

function ExportBox({
  tagNumber,
  result,
  statusText,
  linked,
  note,
  onCopy,
  onClose,
}: {
  tagNumber: number;
  result: ReturnType<typeof authoredAttackFromTag>;
  /** The same sentence the Tag panel and row badge show (S18). */
  statusText: string;
  /** The tag links to a saved attack, so its cadence is typed (S45). */
  linked: boolean;
  note: string | null;
  onCopy: (text: string) => void;
  onClose: () => void;
}) {
  if (!result)
    return (
      <div className={styles.exportBox} role="status">
        <p>
          Tag {tagNumber} cannot export. {statusText}. Its cadence and
          projectile have nothing to come from until it previews.
        </p>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    );
  const text = attackJson(result.attack);
  const variantText = result.projectileVariant
    ? JSON.stringify({ [result.projectileVariant.id]: result.projectileVariant.entry }, null, 2)
    : null;
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
        Paste this into the archetype&apos;s attacks in its file under game/data/enemies/ by hand;
        nothing is written for you. Rotation phase is taken at the first tag
        of its group.{" "}
        {linked
          ? "The cadence is typed in the saved attack, not measured, and the phase is at its first volley (a repeat counts once, at its first volley)."
          : "The cadence is copied from the matched attack."}
      </p>
      {result.aimsFront && <p className={styles.note}>{FRONT_EXPORT_NOTE}</p>}
      <button type="button" onClick={() => onCopy(text)}>
        Copy JSON
      </button>{" "}
      {variantText !== null && (
        <>
          <label className={styles.field}>
            <span>Projectile JSON for tag {tagNumber}</span>
            <textarea
              readOnly
              rows={12}
              value={variantText}
              aria-label={`Projectile JSON for tag ${tagNumber}`}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <p className={styles.note}>
            Paste this under <code>projectiles</code> in projectiles.json by
            hand, beside the attack that references it. Its values are typed
            estimates, and no speed is calculated or written for a bomb.
          </p>
          <button type="button" onClick={() => onCopy(variantText)}>
            Copy projectile JSON
          </button>{" "}
        </>
      )}
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
  // V18 L06/L07: one study per monster; the primary monster is the default.
  const [archetypeId, setArchetypeId] = useState(
    () => encounterConfigOf(initialEncounter).primaryArchetypeId,
  );
  const [monsterDraft, setMonsterDraft] = useState<MonsterDraft | null>(null);
  // View state only (L15): not saved, and moves to the draft when one loads.
  const [previewSource, setPreviewSource] = useState<"draft" | "tags">("tags");
  const sections = studySections(previewSource);
  const monsterIds = monstersOfEncounter(config);
  const draftBlocks = blocksOfMonster(archetypeOf(config, archetypeId));
  const phases = phaseOptions(config, archetypeId);
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
  // V16 S29: the study stores tags as written; every reader gets them resolved.
  const [storedTags, setTags] = useState<readonly StoredTag[]>([]);
  const [savedAttacks, setSavedAttacks] = useState<readonly SavedAttack[]>([]);
  const tags = useMemo(
    () => resolveTags(storedTags, savedAttacks),
    [storedTags, savedAttacks],
  );
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
  // View state only: which working step the page shows. Every panel stays
  // mounted, so switching steps never loses a half-typed value.
  const [step, setStep] = useState<TaggerStep>("setup");
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
  const linkedAttackId = linkedAttackIdOf(sticky, savedAttacks);
  const chosenAttack =
    savedAttacks.find((entry) => entry.id === sticky.savedAttackId) ?? null;
  const interval = readoutInterval(tags, sticky, linkedAttackId);
  const phaseName = (index: number) => phases[index]?.label ?? `phase ${index + 1}`;
  const stickyShowsBullet = matchesLinearBullet(createTag(0, sticky), config, archetypeId);
  const duration = currentDuration(
    durationSeconds,
    studyMeta?.durationSeconds ?? null,
  );
  const mismatch = fileNameMismatch(
    studyMeta?.fileName ?? null,
    videoUrl ? fileName : null,
  );
  const summaryRows = summarizeTags(tags).map((summary) =>
    formatSummaryRow(summary, phases, savedAttacks),
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
    if (
      !shouldWriteDraft({
        dirty,
        tagCount: tags.length,
        hasDraft: monsterDraft !== null,
      })
    )
      return;
    const source = videoUrl
      ? { fileName, durationSeconds }
      : studyMeta;
    if (!source || source.fileName.trim().length === 0 || !(source.durationSeconds > 0))
      return;
    const trimmed = sourceUrlText.trim();
    const study: StudyState = {
      encounterId,
      archetypeId,
      monsterDraft,
      provenance: {
        sourceUrl: trimmed.length === 0 ? null : trimmed,
        fileName: source.fileName.trim(),
        frameRate,
        durationSeconds: source.durationSeconds,
      },
      savedAttacks,
      tags: storedTags,
    };
    const result = sessions.write(
      buildDraft({ study, sticky, savedAt: new Date().toISOString() }),
      config.primaryArchetypeId,
    );
    setAutosaveError(result.ok ? null : result.error);
  }, [
    archetypeId,
    monsterDraft,
    config.primaryArchetypeId,
    dirty,
    tags.length,
    storedTags,
    savedAttacks,
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

  /** Every volley's time, for the timeline markers and `[` / `]` (V16 S16, S17). */
  const volleyTimes = useMemo(
    () =>
      tags.flatMap((entry) =>
        volleyTimesOf(
          entry,
          savedAttacks.find((attack) => attack.id === entry.savedAttackId)?.cadence,
        ),
      ),
    [tags, savedAttacks],
  );

  /** Seeks to the previous or next volley from the presented frame; a no-op at the ends. */
  const stepVolley = (direction: -1 | 1) => {
    const tolerance = volleyStepTolerance(frameRate);
    const target =
      direction === 1
        ? nextVolleyTime(volleyTimes, mediaTime, tolerance)
        : previousVolleyTime(volleyTimes, mediaTime, tolerance);
    if (target !== null && videoUrl) seekTo(target);
  };

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
        linkedAttackId,
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
    setTags((current) => [
      ...current,
      recordStoredTag(mediaTime, sticky, savedAttacks, burstId),
    ]);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // The setup step shows no video controls, so its keys stay ordinary keys.
      if (step === "setup") return;
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
      else if (action.kind === "step-volley") stepVolley(action.direction);
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

  /** A blank field removes a sticky typed estimate; anything else must be a finite number. */
  const setStickyTyped = (field: TypedNumberField, text: string) =>
    setSticky((current) => {
      const { [field]: _removed, ...rest } = current;
      if (text.trim() === "") return rest;
      const value = Number(text);
      return Number.isFinite(value) ? { ...rest, [field]: value } : current;
    });

  const setStickyTarget = (targeted: boolean) =>
    setSticky((current) => {
      const { target: _removed, ...rest } = current;
      return targeted ? { ...rest, target: "player" } : rest;
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
      setSavedAttacks([]);
      setMonsterDraft(null);
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
      hasDraft: monsterDraft !== null,
    });
    if (decision === "confirm-reset")
      setConfirmation({
        message: `Choosing "${file.name}" clears the ${tags.length} tag(s)${monsterDraft ? " and the monster draft" : ""} in this session. Saved sessions are not affected.`,
        onConfirm: () => applyVideo(file, false),
      });
    else applyVideo(file, decision === "keep");
  };

  const chooseEncounter = (id: string) => {
    if (id === encounterId) return;
    if (
      encounterChangeDecision({
        tagCount: tags.length,
        savedAttackCount: savedAttacks.length,
        hasDraft: monsterDraft !== null,
      }) === "confirm"
    ) {
      setConfirmation({
        message: `Changing encounter clears the ${tags.length} tag(s)${monsterDraft ? ", the monster draft" : ""} and ${savedAttacks.length} saved attack(s) in this session. Saved sessions are not affected.`,
        onConfirm: () => applyEncounter(id),
      });
      return;
    }
    applyEncounter(id);
  };

  const applyEncounter = (id: string) => {
    setEncounterId(id);
    setArchetypeId(encounterConfigOf(id).primaryArchetypeId);
    setMonsterDraft(null);
    setPreviewSource("tags");
    // One video is one fight (T16): tags recorded under the previous encounter
    // cannot be relabelled by a later selector change.
    setTags([]);
    setSavedAttacks([]);
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
    setArchetypeId(
      study.archetypeId ?? encounterConfigOf(study.encounterId).primaryArchetypeId,
    );
    setMonsterDraft(study.monsterDraft);
    setPreviewSource(study.monsterDraft ? "draft" : "tags");
    setSourceUrlText(study.provenance.sourceUrl ?? "");
    setFrameRateText(
      study.provenance.frameRate === null ? "" : String(study.provenance.frameRate),
    );
    setTags(study.tags);
    setSavedAttacks(study.savedAttacks);
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
    if (loadDecision(tags.length, monsterDraft !== null) === "confirm")
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
        const problem = studyMonsterProblem(
          study,
          encounterConfigOf(study.encounterId).primaryArchetypeId,
          monstersOfEncounter(encounterConfigOf(study.encounterId)),
        );
        if (problem) {
          setError(problem);
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
    const problem = studyMonsterProblem(
      draft.study,
      encounterConfigOf(draft.study.encounterId).primaryArchetypeId,
      monstersOfEncounter(encounterConfigOf(draft.study.encounterId)),
    );
    if (problem) {
      setError(problem);
      return;
    }
    const restored = restoreSticky(
      draft.sticky,
      encounterConfigOf(draft.study.encounterId),
      draft.study.archetypeId ??
        encounterConfigOf(draft.study.encounterId).primaryArchetypeId,
      draft.study.savedAttacks,
    );
    const notices = restored.notices.map((entry) =>
      entry === "sprite-missing"
        ? "The saved sprite no longer exists; the default sprite is selected."
        : entry === "attack-missing"
          ? "The saved attack no longer exists; no attack is selected."
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
    const result = editStoredTag(storedTags[index], tags[index], change, duration);
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

  /** S32: choosing an attack copies its values into the sticky controls. */
  const chooseAttack = (id: string | null) => {
    const attack = savedAttacks.find((entry) => entry.id === id);
    setSticky((current) => {
      if (!attack) {
        const { savedAttackId: _removed, ...rest } = current;
        return rest;
      }
      return stickyFromSavedAttack(attack, current);
    });
  };

  const saveAttack = (name: string, cadence: SavedAttackCadence) => {
    const result = createSavedAttack(name, sticky, cadence, savedAttacks);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setDirty(true);
    setSavedAttacks((current) => [...current, result.value]);
    setSticky((current) => ({ ...current, savedAttackId: result.value.id }));
    return true;
  };

  const updateAttack = () => {
    if (!chosenAttack) return;
    setError(null);
    setDirty(true);
    setSavedAttacks((current) =>
      current.map((entry) =>
        entry.id === chosenAttack.id ? updateFromSticky(entry, sticky) : entry,
      ),
    );
  };

  const renameAttack = (name: string) => {
    if (!chosenAttack) return false;
    const result = renameSavedAttack(chosenAttack.id, name, savedAttacks);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setDirty(true);
    setSavedAttacks(result.value);
    return true;
  };

  const deleteAttack = () => {
    if (!chosenAttack) return;
    const result = deleteSavedAttack(chosenAttack.id, savedAttacks, storedTags);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setDirty(true);
    setSavedAttacks(result.value);
    setSticky((current) => {
      const { savedAttackId: _removed, ...rest } = current;
      return rest;
    });
  };

  const detachRow = (index: number) => {
    const stored = storedTags[index];
    const attack =
      "savedAttackId" in stored
        ? savedAttacks.find((entry) => entry.id === stored.savedAttackId)
        : undefined;
    if (!attack) return;
    const result = detachTag(stored, attack);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setDirty(true);
    setTags((current) =>
      current.map((entry, at) => (at === index ? result.value : entry)),
    );
  };

  /** Applies a repeat-end change to a stored row; every refusal reports through `error`. */
  const applyRepeatEnd = (
    index: number,
    next: (stored: StoredTag) => ReturnType<typeof setRepeatEnd> | StoredTag,
  ) => {
    const result = next(storedTags[index]);
    const tag = "ok" in result ? (result.ok ? result.tag : null) : result;
    if (tag === null) {
      setError("ok" in result && !result.ok ? result.error : null);
      return false;
    }
    setError(null);
    setDirty(true);
    setTags((current) => current.map((entry, at) => (at === index ? tag : entry)));
    return true;
  };

  /** S40: ends a repeat at the presented frame, with no key. */
  const endRepeatHere = () => {
    if (!videoUrl) {
      setError("Load a video before ending a repeat.");
      return;
    }
    if (frameRate === null) {
      setError("Enter the video's presented frame rate before ending a repeat.");
      return;
    }
    if (seekPendingRef.current) {
      setError("Wait for the seeked frame to appear before ending a repeat.");
      return;
    }
    const target = endRepeatTarget(
      storedTags,
      selectedTagIndex,
      sticky.savedAttackId ?? null,
      mediaTime,
    );
    if (target === null) {
      setError(
        "No repeat to end: select a linked tag, or choose its saved attack and move past its first tag.",
      );
      return;
    }
    applyRepeatEnd(target, (stored) => setRepeatEnd(stored, mediaTime, "frame"));
  };

  /** V16 S48: the selected row tunes its saved attack when linked, otherwise only itself. */
  const selectedTag = selectedTagIndex === null ? undefined : tags[selectedTagIndex];
  const selectedAttack = savedAttacks.find(
    (entry) => entry.id === selectedTag?.savedAttackId,
  );
  const tuning: TuningProps = {
    target:
      selectedTag === undefined
        ? null
        : selectedAttack
          ? `Tuning saved attack "${selectedAttack.name}": ${
              tags.filter((entry) => entry.savedAttackId === selectedAttack.id).length
            } tag(s)`
          : "Tuning this tag only",
    values: selectedTag ? tunableValuesFor(selectedTag, selectedAttack) : [],
    onChange: (change) => {
      if (selectedTagIndex === null) return false;
      const result = applyTuning({ tags: storedTags, savedAttacks }, selectedTagIndex, change);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setError(null);
      setDirty(true);
      setTags(result.study.tags);
      setSavedAttacks(result.study.savedAttacks);
      return true;
    },
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
        archetypeId,
        provenance,
        savedAttacks,
        tags: storedTags,
        monsterDraft,
        recordedAt: new Date().toISOString(),
      });
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = observationFileName(
        encounterId,
        archetypeId,
        config.primaryArchetypeId,
      );
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

  /** The study as the autosave would write it, or null with no source yet. */
  const currentStudy = (): StudyState | null => {
    const source = videoUrl ? { fileName, durationSeconds } : studyMeta;
    if (!source || source.fileName.trim().length === 0 || !(source.durationSeconds > 0))
      return null;
    const trimmed = sourceUrlText.trim();
    return {
      encounterId,
      archetypeId,
      monsterDraft,
      provenance: {
        sourceUrl: trimmed.length === 0 ? null : trimmed,
        fileName: source.fileName.trim(),
        frameRate,
        durationSeconds: source.durationSeconds,
      },
      savedAttacks,
      tags: storedTags,
    };
  };

  /** L08: switching monsters keeps the video and its time and swaps the study. */
  const applyMonsterSwitch = (
    id: string,
    plan: ReturnType<typeof monsterSwitchPlan>,
  ) => {
    const study = currentStudy();
    if (plan.writeCurrent && study) {
      const result = sessions.write(
        buildDraft({ study, sticky, savedAt: new Date().toISOString() }),
        config.primaryArchetypeId,
      );
      setAutosaveError(result.ok ? null : result.error);
    }
    const slot =
      plan.open === "slot" && study
        ? sessions.read(
            TaggerSessions.keyFor(
              study.provenance.fileName,
              id === config.primaryArchetypeId ? null : id,
            ),
          )
        : null;
    setArchetypeId(id);
    setSelectedTagIndex(null);
    setExportIndex(null);
    setDirty(false);
    setError(null);
    if (slot?.ok) {
      const restored = restoreSticky(
        slot.value.sticky,
        config,
        id,
        slot.value.study.savedAttacks,
      );
      setTags(slot.value.study.tags);
      setSavedAttacks(slot.value.study.savedAttacks);
      setMonsterDraft(slot.value.study.monsterDraft);
      setPreviewSource(slot.value.study.monsterDraft ? "draft" : "tags");
      setSticky(restored.sticky);
      setNotice(null);
      return;
    }
    // An empty study keeps sourceUrl and frameRate, and never the video.
    setTags([]);
    setSavedAttacks([]);
    setMonsterDraft(null);
    setPreviewSource("tags");
    setSticky((current) => ({ ...current, phaseIndex: 0 }));
    setNotice(null);
  };

  const chooseMonster = (id: string) => {
    if (id === archetypeId) return;
    const source = videoUrl ? fileName.trim() : (studyMeta?.fileName.trim() ?? "");
    const slotExists =
      source.length > 0 &&
      sessions.read(
        TaggerSessions.keyFor(source, id === config.primaryArchetypeId ? null : id),
      ).ok;
    const plan = monsterSwitchPlan({
      hasVideo: videoUrl !== null,
      unsaved: dirty,
      autosaveFailing: autosaveError !== null,
      slotExists,
    });
    if (plan.confirmFirst) {
      setConfirmation({
        message: `Autosave is failing, so switching monster would lose the unsaved ${tags.length} tag(s)${monsterDraft ? " and monster draft" : ""} of this study. Export first, or confirm to switch anyway.`,
        onConfirm: () => applyMonsterSwitch(id, { ...plan, writeCurrent: false }),
      });
      return;
    }
    applyMonsterSwitch(id, plan);
  };

  /** L17: records the presented frame's time for a block, guarded like a tag (T19). */
  const startBlockHere = (blockId: string) => {
    if (!videoUrl) {
      setError("Load a video before anchoring a block.");
      return;
    }
    if (seekPendingRef.current) {
      setError("Wait for the seeked frame to appear before anchoring a block.");
      return;
    }
    if (!monsterDraft) return;
    setError(null);
    setDirty(true);
    setMonsterDraft(setAnchor(monsterDraft, blockId, mediaTime));
  };

  const changeDraft = (next: MonsterDraft) => {
    setMonsterDraft(next);
    setDirty(true);
    if (monsterDraft === null) setPreviewSource("draft");
  };

  const messages = (
    <>
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
    </>
  );

  const rows = sortNewestFirst(tags);
  const showSessions =
    !sessionsDismissed &&
    ((sessionList !== null && sessionList.length > 0) || sessionListError);
  const encounterName =
    ENCOUNTER_LIST.find((entry) => entry.id === encounterId)?.displayName ?? encounterId;
  const stickyStatus = tagMatchStatus(createTag(0, sticky), config, archetypeId);
  const phaseBlocks = draftBlocks.filter((block) => block.phaseId === selectedPhase?.id);
  const anchoredCount = monsterDraft
    ? phaseBlocks.filter((block) => monsterDraft.anchors[block.id] !== undefined).length
    : 0;
  const steps: readonly StepItem[] = [
    {
      id: "setup",
      name: STEP_GUIDES.setup.name,
      status: videoUrl
        ? frameRate === null
          ? "Frame rate missing"
          : `${fileName}, ${frameRate} fps`
        : studyMeta
          ? "Study loaded, no video"
          : "Choose a video",
      done: videoUrl !== null && frameRate !== null,
    },
    {
      id: "tag",
      name: STEP_GUIDES.tag.name,
      status: tags.length === 1 ? "1 tag" : `${tags.length} tags`,
    },
    {
      id: "review",
      name: STEP_GUIDES.review.name,
      status: tags.length === 0 ? "Nothing yet" : "Check, edit, export",
    },
    {
      id: "draft",
      name: STEP_GUIDES.draft.name,
      status: monsterDraft
        ? `${anchoredCount} of ${phaseBlocks.length} blocks anchored`
        : "Optional",
    },
  ];
  const canRecord = videoUrl !== null && !seekPending;

  return (
    <main className={styles.shell} data-tagger-route data-step={step}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>{encounterName} tagger</h1>
          <p className={styles.subtitle}>
            Monster <strong>{archetypeId}</strong>. A development tool: the
            video never leaves this computer.
          </p>
        </div>
        <label className={styles.phaseControl}>
          <span>Phase</span>
          <HelpMark text={help.HELP_DRAFT_PHASE} />
          <select
            aria-label="Phase"
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
                {phase.label}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.headerActions}>
          <button type="button" onClick={exportTags}>
            Export study JSON
          </button>
          <StepGuidePanel step={step} />
          <GlossaryPanel />
        </div>
      </header>

      <StepNav steps={steps} current={step} onChoose={setStep} />

      <div className={styles.messages}>
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
        {messages}
      </div>

      <div className={styles.setup} hidden={step !== "setup"}>
      {showSessions && (
        <section className={styles.card} aria-labelledby="sessions-title">
          <div className={styles.headingRow}>
            <h2 id="sessions-title">Continue a saved session</h2>
            <HelpMark text={help.HELP_SECTION_SESSIONS} />
          </div>
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
                  <th scope="col">Monster</th>
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
                      <td>{entry.archetypeId ?? "primary"}</td>
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
                      <td colSpan={4}>Unreadable: {entry.key}</td>
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
          <div className={styles.cardFoot}>
            <p className={styles.note}>
              Sessions save automatically per video file name and stay until
              you discard them.
            </p>
            <button type="button" onClick={() => setSessionsDismissed(true)}>
              Dismiss list
            </button>
          </div>
        </section>
      )}

      <section className={styles.card} aria-labelledby="source-title">
        <div className={styles.headingRow}>
          <h2 id="source-title">Start a study</h2>
          <HelpMark text={help.HELP_SECTION_VIDEO} />
        </div>
        <ol className={styles.setupList}>
          <li>
            <h3>Open the video</h3>
            <div className={styles.setupBody}>
              <div className={styles.fileRow}>
                <label className={styles.fileButton}>
                  <input
                    className={styles.fileInput}
                    type="file"
                    accept="video/*"
                    onChange={chooseFile}
                  />
                  <span>{videoUrl ? "Choose another video" : "Choose video file"}</span>
                </label>
                <p className={styles.meta}>
                  {videoUrl
                    ? fileName
                    : studyMeta
                      ? `${studyMeta.fileName} (from the study, no video open)`
                      : "No video chosen"}
                  {duration > 0 && `, ${duration.toFixed(3)} s long`}
                </p>
              </div>
              {mismatch && (
                <p className={styles.warning} role="status">
                  The study names "{studyMeta?.fileName}" but the open video is "
                  {fileName}". Export will use the open video's file name and
                  duration.
                </p>
              )}
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span>
                    Presented frame rate, fps (required)
                    {rateDetected && <em className={styles.detected}> detected from playback</em>}
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
              </div>
              <p className={styles.note}>
                Frame steps and tag times need the rate. Leave it blank and
                press Play: playback fills it in.
              </p>
            </div>
          </li>
          <li>
            <h3>Choose the monster</h3>
            <div className={styles.setupBody}>
              <div className={styles.fieldGrid}>
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
                <label className={styles.field}>
                  <span>Monster</span>
                  <select
                    aria-label="Monster"
                    value={archetypeId}
                    onChange={(event) => chooseMonster(event.target.value)}
                  >
                    {monsterIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className={styles.note}>
                One study covers one monster. Pick the phase at the top of
                the page.
              </p>
            </div>
          </li>
          <li>
            <h3>Continue earlier work (optional)</h3>
            <div className={styles.setupBody}>
              <div className={styles.fileRow}>
                <label className={styles.fileButton}>
                  <input
                    className={styles.fileInput}
                    type="file"
                    accept="application/json,.json"
                    onChange={chooseStudy}
                  />
                  <span>Load study JSON</span>
                </label>
                <p className={styles.meta}>
                  A study exported earlier with Export study JSON.
                </p>
              </div>
            </div>
          </li>
        </ol>
        <div className={styles.cardFoot}>
          <span />
          <button
            type="button"
            className={styles.primary}
            onClick={() => setStep("tag")}
          >
            Start tagging
          </button>
        </div>
      </section>
      </div>

      <div className={styles.workspace} data-step={step} hidden={step === "setup"}>
        <div className={styles.stage}>
          <div className={styles.viewer}>
            <div
              className={styles.videoColumn}
              style={{ maxWidth: VIDEO_SIZE_PIXELS[layout.videoSize] }}
            >
              <div className={styles.toolbar} role="group" aria-label="Video size">
                <span className={styles.toolbarLabel}>Video</span>
                <span className={styles.segmentedButtons}>
                  {(["small", "medium", "large"] as const satisfies readonly PreviewSize[]).map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        aria-label={`Video size ${option}`}
                        aria-pressed={layout.videoSize === option}
                        onClick={() => changeLayout({ ...layout, videoSize: option })}
                      >
                        {option[0]!.toUpperCase()}
                      </button>
                    ),
                  )}
                </span>
              </div>
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
          <div className={styles.videoEmpty}>
            <p>No video open.</p>
            <p className={styles.note}>
              Open one to record, step or jump. Without one you can still
              load, edit and export a study.
            </p>
            <button type="button" onClick={() => setStep("setup")}>
              Open a video
            </button>
          </div>
        )}
        <div className={styles.transport}>
          <output className={styles.timecode} aria-label="Current frame time">
            {mediaTime.toFixed(3)} s
          </output>
          <span className={styles.duration}>
            of {duration > 0 ? `${duration.toFixed(3)} s` : "unknown"}
          </span>
          <div className={styles.transportButtons}>
            <button
              type="button"
              className={styles.playButton}
              onClick={togglePlayback}
              disabled={!videoUrl}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <span className={styles.buttonGroup}>
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
            </span>
            <span className={styles.buttonGroup}>
              <button type="button" onClick={() => stepFrame(-1)} disabled={!videoUrl}>
                Previous frame
              </button>
              <button type="button" onClick={() => stepFrame(1)} disabled={!videoUrl}>
                Next frame
              </button>
            </span>
            <span className={styles.buttonGroup}>
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
            </span>
          </div>
        </div>
        <TaggerTimeline
          durationSeconds={duration}
          mediaTime={mediaTime}
          volleyTimes={volleyTimes}
          enabled={videoUrl !== null}
          onSeek={seekTo}
        />
        {step === "tag" && (
          <div className={styles.recordBar}>
            <button
              type="button"
              className={styles.record}
              onClick={() => recordTag("standalone")}
              disabled={!canRecord}
            >
              <span className={styles.recordDot} aria-hidden="true" />
              Record tag
              <kbd aria-hidden="true">Enter</kbd>
            </button>
            <button
              type="button"
              onClick={() => recordTag("new-burst")}
              disabled={!canRecord}
            >
              Start burst (B)
            </button>
            <button
              type="button"
              onClick={() => recordTag("continue-burst")}
              disabled={!canRecord}
            >
              Add to burst (Shift+Enter)
            </button>
            <button type="button" onClick={endRepeatHere} disabled={!canRecord}>
              End repeat here
            </button>
            <output className={styles.readout} aria-label="Interval since previous tag">
              {seekPending
                ? "Waiting for the seeked frame"
                : interval === null
                  ? "No previous tag in this group"
                  : `${interval.toFixed(3)} s since previous`}
            </output>
          </div>
        )}
        <details className={styles.shortcuts}>
          <summary>Keyboard shortcuts</summary>
          <dl>
            <div><dt><kbd>Space</kbd></dt><dd>Play or pause</dd></div>
            <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>One frame back or forward</dd></div>
            <div><dt><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd></dt><dd>Jump {FINE_JUMP_SECONDS} s</dd></div>
            <div><dt><kbd>PageUp</kbd> <kbd>PageDown</kbd></dt><dd>Jump {COARSE_JUMP_SECONDS} s</dd></div>
            <div><dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous or next volley</dd></div>
            <div><dt><kbd>Enter</kbd></dt><dd>Record a standalone tag</dd></div>
            <div><dt><kbd>B</kbd></dt><dd>Record a volley that starts a new burst</dd></div>
            <div><dt><kbd>Shift</kbd> + <kbd>Enter</kbd></dt><dd>Add a volley to the latest matching burst</dd></div>
            <div><dt><kbd>1</kbd>–<kbd>9</kbd></dt><dd>Set the shot count</dd></div>
          </dl>
        </details>
            </div>
          <PreviewPanel
            key={encounterId}
            draftSource={
              monsterDraft && previewSource === "draft"
                ? {
                    draft: monsterDraft,
                    blocks: draftBlocks,
                    phaseId: selectedPhase?.id ?? "",
                    videoEndSeconds: duration > 0 ? duration : Infinity,
                  }
                : null
            }
            sourceSwitch={
              sections.sourceSwitch
                ? { value: previewSource, onChange: setPreviewSource }
                : undefined
            }
            showTuning={sections.previewTuning}
            tags={tags}
            savedAttacks={savedAttacks}
            mediaTime={mediaTime}
            hasVideo={videoUrl !== null}
            config={config}
            archetypeId={archetypeId}
            highlightedTagIndices={highlighted}
            tuning={tuning}
            layout={layout}
            onLayoutChange={changeLayout}
          />
          </div>
        </div>

        <div className={styles.inspector} hidden={step === "review"}>
      <section
        className={styles.inspectorPanel}
        aria-labelledby="tag-title"
        hidden={step !== "tag"}
      >
        <div className={styles.headingRow}>
          <h2 id="tag-title">Next tag</h2>
          <HelpMark text={help.HELP_SECTION_TAG} />
        </div>
        <div className={styles.nextTag} aria-live="polite">
          <p className={styles.nextTagChips}>
            <span className={styles.visuallyHidden}>Recording: </span>
            {chosenAttack && <span className={styles.chip}>{chosenAttack.name}</span>}
            <span className={styles.chip}>{sticky.spriteId}</span>
            <span className={styles.chip}>{sticky.pattern}</span>
            {patternTakesAim(sticky.pattern) && (
              <span className={styles.chip}>aim {sticky.aim}</span>
            )}
            <span className={styles.chip}>
              {sticky.shots} {shotsLabel(sticky.pattern)}
            </span>
            {armPatternAllowed(sticky.pattern) && sticky.armPattern && (
              <span className={styles.chip}>
                each arm {sticky.armPattern}
                {sticky.shotsPerArm !== undefined && <> ×{sticky.shotsPerArm}</>}
              </span>
            )}
          </p>
          <p
            className={styles.matchStatus}
            data-kind={stickyStatus.kind}
            role="status"
            aria-label="Match status"
          >
            {matchStatusText(stickyStatus, phaseName)}
          </p>
        </div>

        <fieldset className={styles.formRow}>
          <legend className={styles.formLabel}>
            Sprite
            <HelpMark text={help.HELP_SECTION_SPRITE} />
          </legend>
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
        </fieldset>

        <Segmented
          legend="Pattern"
          name="pattern"
          options={OFFERABLE_PATTERNS}
          value={sticky.pattern}
          onChange={(pattern) => setSticky((current) => ({ ...current, pattern }))}
        />
        {patternTakesAim(sticky.pattern) && (
          <Segmented
            legend="Aim"
            name="aim"
            options={TAG_AIMS}
            value={sticky.aim}
            onChange={(aim) => setSticky((current) => ({ ...current, aim }))}
          />
        )}
        <label className={styles.formRow}>
          <span className={styles.formLabel}>
            {sticky.pattern === "rotating-arm" || sticky.pattern === "fixed-ring"
              ? "Arms"
              : "Shots"}
          </span>
          <span className={styles.inlineInput}>
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
              Or press <kbd>1</kbd>–<kbd>9</kbd>.
            </small>
          </span>
        </label>
        {armPatternAllowed(sticky.pattern) && (
          <div className={styles.formGroup}>
            <Segmented
              legend="Each arm fires"
              name="arm-pattern"
              options={["single", "spread", "scatter", "ring"] as const}
              value={sticky.armPattern ?? "single"}
              label={(choice) => (choice === "single" ? "single shot" : choice)}
              onChange={(choice) =>
                setStickyArmPattern(choice === "single" ? null : choice)
              }
            />
            {sticky.armPattern && (
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
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
                {armPatternTakesArc(sticky.armPattern) && (
                  <label className={styles.field}>
                    <span>Cone width, degrees</span>
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
              </div>
            )}
            <small className={styles.note}>
              One level of nesting only. The cone is a typed estimate, not
              measured from the video.
            </small>
          </div>
        )}
        {rotationAllowed(sticky.pattern) && (
          <fieldset className={styles.formGroup}>
            <legend className={styles.formLabel}>Rotation (typed estimates)</legend>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
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
              <label className={styles.field}>
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
            </div>
            <small className={styles.note}>
              Blank keeps the matched attack&apos;s authored value. Negative
              rates turn counter-clockwise.
            </small>
          </fieldset>
        )}
        <StickyTypedFields
          sticky={sticky}
          showBullet={stickyShowsBullet}
          onNumber={setStickyTyped}
          onTarget={setStickyTarget}
        />
        <SavedAttackPanel
          savedAttacks={savedAttacks}
          chosen={chosenAttack}
          modified={chosenAttack !== null && isStickyModified(sticky, chosenAttack)}
          onChoose={chooseAttack}
          onSave={saveAttack}
          onUpdate={updateAttack}
          onRename={renameAttack}
          onDelete={deleteAttack}
        />
      </section>

      <div hidden={step !== "draft"}>
        <DraftPanel
          key={archetypeId}
          archetypeId={archetypeId}
          config={config}
          draft={monsterDraft}
          blocks={draftBlocks}
          hasVideo={videoUrl !== null}
          phases={phases}
          phaseIndex={sticky.phaseIndex}
          onStartsHere={startBlockHere}
          onChange={changeDraft}
        />
      </div>
        </div>

      <div className={styles.review} hidden={step !== "review"}>
      <section className={styles.card} aria-labelledby="tags-title">
        <div className={styles.cardHead}>
          <div className={styles.headingRow}>
            <h2 id="tags-title">Tags ({tags.length})</h2>
            <HelpMark text={help.HELP_SECTION_TAGS} />
          </div>
          <p className={styles.note}>
            Newest footage first. Click a row to jump there and tune it in the
            preview. Edits apply at once; there is no undo.
          </p>
        </div>
        {tags.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No tags recorded yet.</p>
            <button type="button" onClick={() => setStep("tag")}>
              Tag volleys
            </button>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.compactTable}`}>
              <thead>
                <tr>
                  <th scope="col">Time (s)</th>
                  <th scope="col">Sprite</th>
                  <th scope="col">Phase</th>
                  <th scope="col">Attack</th>
                  <th scope="col">Pattern</th>
                  <th scope="col">Aim</th>
                  <th scope="col">Shots / arms</th>
                  <th scope="col">Geometry (typed)</th>
                  <th scope="col">Burst</th>
                  <th scope="col">Repeat end (s)</th>
                  <th scope="col">Preview</th>
                  <th scope="col" className={styles.stickyActions}>
                    <span className={styles.visuallyHidden}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ tag, index }) => {
                  const stored = storedTags[index];
                  const linked = "savedAttackId" in stored;
                  const repeats = linked && stored.repeatEndSeconds !== undefined;
                  return (
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
<fieldset disabled={linked} className={styles.cellFieldset}>
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
                    </fieldset>
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
                      {linked
                        ? (savedAttacks.find((entry) => entry.id === stored.savedAttackId)?.name ?? stored.savedAttackId)
                        : "—"}
                    </td>
                    <td>
<fieldset disabled={linked} className={styles.cellFieldset}>
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
                    </fieldset>
</td>
                    <td>
<fieldset disabled={linked} className={styles.cellFieldset}>
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
                    </fieldset>
</td>
                    <td>
<fieldset disabled={linked} className={styles.cellFieldset}>
                      <CommitInput
                        label={`Shots of tag ${index + 1}`}
                        value={String(tag.shots)}
                        onCommit={(text) =>
                          text.trim() !== "" &&
                          applyEdit(index, { field: "shots", value: Number(text) })
                        }
                      />
                    </fieldset>
</td>
                    <td>
<fieldset disabled={linked} className={styles.cellFieldset}>
                      {!armPatternAllowed(tag.pattern) &&
                      !rotationAllowed(tag.pattern) &&
                      !rowHasTypedFields(tag, matchesLinearBullet(tag, config, archetypeId)) ? (
                        "—"
                      ) : (
                        <>
                          <RowTypedFields
                            tag={tag}
                            index={index}
                            showBullet={matchesLinearBullet(tag, config, archetypeId)}
                            onEdit={(change) => applyEdit(index, change)}
                          />
                          {armPatternAllowed(tag.pattern) && (
                            <>
                              <small className={styles.cellCaptionText}>Arm</small>
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
                                  caption="Per arm"
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
                                  caption="Cone °"
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
                                  caption="Rate °/s"
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
                                  caption="Phase °"
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
                    </fieldset>
</td>
                    <td>
                      <fieldset disabled={repeats} className={styles.cellFieldset}>
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
                    </fieldset>
                    </td>
                    <td>
                      {linked ? (
                        <fieldset
                          disabled={stored.burstId !== undefined}
                          className={styles.cellFieldset}
                        >
                          <CommitInput
                            label={`Repeat end of tag ${index + 1}`}
                            value={
                              stored.repeatEndSeconds === undefined
                                ? ""
                                : stored.repeatEndSeconds.toFixed(3)
                            }
                            step="0.001"
                            blankAllowed
                            onCommit={(text) =>
                              applyRepeatEnd(index, (current) =>
                                text.trim() === ""
                                  ? clearRepeatEnd(current)
                                  : setRepeatEnd(current, Number(text), "typed"),
                              )
                            }
                          />
                          {stored.repeatEndSource === "typed" && (
                            <small className={styles.note}> typed</small>
                          )}
                        </fieldset>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {(() => {
                        const status = tagMatchStatus(tag, config, archetypeId);
                        return (
                          <span className={styles.rowStatus} data-kind={status.kind}>
                            {matchStatusText(status, phaseName)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className={styles.stickyActions}>
                      <button
                        type="button"
                        onClick={() => {
                          setSticky((current) => stickyFromTag(tag, current));
                          setSelectedTagIndex(index);
                        }}
                        aria-label={`Use the settings of tag ${index + 1}`}
                      >
                        Use these settings
                      </button>{" "}
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
                      {linked && (
                        <>
                          <button
                            type="button"
                            onClick={() => detachRow(index)}
                            disabled={repeats}
                            title={repeats ? "Clear the repeat end or delete the row first." : undefined}
                            aria-label={`Detach tag ${index + 1} from its saved attack`}
                          >
                            Detach
                          </button>{" "}
                        </>
                      )}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {exportIndex !== null && tags[exportIndex] && (
          <ExportBox
            tagNumber={exportIndex + 1}
            result={authoredAttackFromTag(
              tags[exportIndex],
              config,
              archetypeId,
              savedAttacks.find((entry) => entry.id === tags[exportIndex].savedAttackId),
            )}
            linked={tags[exportIndex].savedAttackId !== undefined}
            statusText={matchStatusText(tagMatchStatus(tags[exportIndex], config, archetypeId), phaseName)}
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
      </section>

      <section className={styles.card} aria-labelledby="summary-title">
        <div className={styles.cardHead}>
          <div className={styles.headingRow}>
            <h2 id="summary-title">Summary</h2>
            <HelpMark text={help.HELP_SECTION_SUMMARY} />
          </div>
          <p className={styles.note}>
            A repeat counts once, at its first volley. Intervals between rows
            come from video times; a saved attack&apos;s cadence is typed and
            is never measured here.
          </p>
        </div>
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
                  <th scope="col">Target</th>
                  <th scope="col">Attack</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Samples</th>
                  <th scope="col">Mean</th>
                  <th scope="col">Deviation</th>
                  <th scope="col">Intervals</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={`${row.phase}|${row.sprite}|${row.pattern}|${row.aim}|${row.armPattern}|${row.target}|${row.attack}|${row.scope}`}>
                    <td>{row.phase}</td>
                    <td>{row.sprite}</td>
                    <td>{row.pattern}</td>
                    <td>{row.aim}</td>
                    <td>{row.armPattern}</td>
                    <td>{row.target}</td>
                    <td>{row.attack}</td>
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
      </div>
      </div>
    </main>
  );
}
