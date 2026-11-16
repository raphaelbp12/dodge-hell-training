import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  archetypeOf,
  bodyExtentTiles,
  DEFAULT_ENCOUNTER_ID,
  ENCOUNTER_LIST,
  encounterConfigOf,
} from "../game/config/encounter";
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
  currentDuration,
  fileNameMismatch,
  loadDecision,
  monsterSwitchPlan,
  observationFileName,
  parseStudyFile,
  resolveProvenance,
  studyMonsterProblem,
  videoChoiceDecision,
} from "./studyLoad";
import { GlossaryPanel } from "./GlossaryPanel";
import { StepGuidePanel } from "./StepGuidePanel";
import { STEP_GUIDES } from "./stepGuide";
import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import {
  changedAttack,
  monsterFilePath,
  monstersOfEncounter,
  newAttack,
  type AttackChange,
} from "./monsterDraft";
import { bombVariantOf, monsterFileTextFromStudy, studyExportJson } from "./studyExport";
import { studyWarnings } from "./studyWarnings";
import { ReconcilePanel } from "./ReconcilePanel";
import {
  buildDraft,
  isLegacyDraft,
  markCountOf,
  shouldWriteDraft,
  TaggerSessions,
  type LegacySessionDraft,
  type SessionDraft,
  type SessionListEntry,
} from "./taggerSessions";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import {
  attackIdsInPhaseOf,
  segmentWindows,
  segmentsOfMonster,
  windowsForTrack,
  type AttackTrack,
  type StudyV5,
} from "./study";
import { emptyStudy, studyV5FromLegacy, tracksFromMonsterFile } from "./studyMigrate";
import {
  acceptSegmentValue,
  addBoundary,
  addMark,
  addTrack,
  createTrackFromScratch,
  duplicateTrack,
  reloadTracks,
  removeMarkNear,
  removeTrack,
  setBurstGapThreshold,
  setEndMark,
  setMeasuredRange,
  setProjectileOverride,
  setScale,
  type ProjectileOverride,
  setTrackAttack,
  setTrackLocation,
  removeBoundary,
  removeSpan,
  setBoundarySegment,
  setTelegraphEnd,
  toggleInvulnerable,
  type EditResult,
} from "./studyEdits";
import { StructurePanel } from "./StructurePanel";
import { TrackPanel } from "./TrackPanel";
import { FitPanel, type CadenceField } from "./FitPanel";
import { ScalePanel } from "./ScalePanel";
import { distanceTiles, tileWidthFractionOf, type VideoPoint } from "./scale";
import { predictedTimesInWindows, type DetonationPair } from "./cadenceFit";
import type { StudyState } from "./tagging";
import { PreviewPanel } from "./PreviewPanel";
import {
  PreviewPreference,
  VIDEO_SIZE_PIXELS,
  type PreviewPreferenceValue,
  type PreviewSize,
} from "./previewPreference";
import { TaggerTimeline } from "./TaggerTimeline";
import { StepNav, type StepItem, type TaggerStep } from "./TaggerControls";
import {
  nextVolleyTime,
  previousVolleyTime,
  timelineRows,
  volleyStepTolerance,
} from "./timelineModel";
import styles from "./TaggerRoute.module.css";

/** Frames kept for the playback frame-rate estimate. */
const FRAME_SAMPLE_WINDOW = 60;

type FrameMetadata = Readonly<{ mediaTime: number; presentedFrames: number }>;

type Confirmation = Readonly<{ message: string; onConfirm: () => void }>;

const KNOWN_ENCOUNTER_IDS = ENCOUNTER_LIST.map((entry) => entry.id);

/** Shown once after a study or session from before the timeline converts (E02). */
const LEGACY_CONVERSION_NOTICE =
  "This study was recorded before the timeline and was converted: its tags are now marks on attack tracks. Check its boundaries in the Structure step.";

export function TaggerRoute() {
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
  // Plan V20 E02: one v5 study and the selected attack track; null before a video or monster.
  const [study, setStudy] = useState<StudyV5 | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const monsterIds = monstersOfEncounter(config);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [mediaTime, setMediaTime] = useState(0);
  const [seekPending, setSeekPending] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Z26: the presented rate has no default; it must be typed.
  const [frameRateText, setFrameRateText] = useState("");
  const [sourceUrlText, setSourceUrlText] = useState("");
  const segments = useMemo(
    () => segmentsOfMonster(archetypeOf(config, archetypeId)),
    [config, archetypeId],
  );
  const markCount = study ? markCountOf(study) : 0;
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The loaded or restored study's file name and duration (Z14, Z16).
  const [studyMeta, setStudyMeta] = useState<Readonly<{
    fileName: string;
    durationSeconds: number;
  }> | null>(null);
  // Z15: the first video chosen after a load or restore keeps the study.
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
    if (markCount > 0) setDirty(true);
  };

  const frameRate = parseFrameRate(frameRateText);
  const duration = currentDuration(
    durationSeconds,
    studyMeta?.durationSeconds ?? null,
  );
  const mismatch = fileNameMismatch(
    studyMeta?.fileName ?? null,
    videoUrl ? fileName : null,
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

  /** The study as the autosave and export write it: provenance from the video in use now. */
  const currentStudy = (): StudyV5 | null => {
    const source = videoUrl ? { fileName, durationSeconds } : studyMeta;
    if (!study || !source || source.fileName.trim().length === 0 || !(source.durationSeconds > 0))
      return null;
    const trimmed = sourceUrlText.trim();
    return {
      ...study,
      provenance: {
        sourceUrl: trimmed.length === 0 ? null : trimmed,
        fileName: source.fileName.trim(),
        frameRate,
        durationSeconds: source.durationSeconds,
      },
    };
  };

  // Z28/Z30, amended by E14: autosave once the session is dirty and the study
  // holds a mark or a boundary. The slot is keyed by the file name in use now,
  // so an accepted mismatched video writes to its own slot and leaves the old
  // one (Z16).
  useEffect(() => {
    if (
      !shouldWriteDraft({
        dirty,
        markCount,
        boundaryCount: study?.boundaries.length ?? 0,
      })
    )
      return;
    const saved = currentStudy();
    if (!saved) return;
    const result = sessions.write(
      buildDraft({ study: saved, selectedTrackId, savedAt: new Date().toISOString() }),
      config.primaryArchetypeId,
    );
    setAutosaveError(result.ok ? null : result.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    study,
    selectedTrackId,
    config.primaryArchetypeId,
    dirty,
    markCount,
    sourceUrlText,
    frameRate,
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

  /**
   * The marks `[` and `]` step between (V16 S17, step 86.2): the selected
   * track's, or every mark of every track and scratch with none selected.
   */
  const volleyTimes = useMemo(() => {
    if (!study) return [];
    const chosen = study.tracks.find((track) => track.id === selectedTrackId);
    const marks = chosen
      ? chosen.marks
      : [...study.tracks.flatMap((track) => track.marks), ...study.scratch];
    return marks.map((mark) => mark.timeSeconds);
  }, [study, selectedTrackId]);

  /** Seeks to the previous or next volley from the presented frame; a no-op at the ends. */
  const stepVolley = (direction: -1 | 1) => {
    const tolerance = volleyStepTolerance(frameRate);
    const target =
      direction === 1
        ? nextVolleyTime(volleyTimes, mediaTime, tolerance)
        : previousVolleyTime(volleyTimes, mediaTime, tolerance);
    if (target !== null && videoUrl) seekTo(target);
  };

  /**
   * The guard every mark at the presented frame passes (T19): a video, a frame
   * rate, and no seek still waiting for its frame.
   */
  const presentedFrameProblem = (what: string): string | null => {
    if (!videoUrl) return `Load a video before ${what}.`;
    if (frameRate === null) return `Enter the video's presented frame rate before ${what}.`;
    if (seekPendingRef.current) return `Wait for the seeked frame to appear before ${what}.`;
    return null;
  };

  /** Every study edit goes through `studyEdits.ts`; the route only applies the result. */
  const applyStudyEdit = (edit: (current: StudyV5) => EditResult<StudyV5>): boolean => {
    if (!study) {
      setError("Choose the monster or open a video before editing the study.");
      return false;
    }
    const result = edit(study);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setStudy(result.value);
    setDirty(true);
    return true;
  };

  const markAtFrame = (
    what: string,
    edit: (current: StudyV5, timeSeconds: number) => EditResult<StudyV5>,
  ) => {
    const problem = presentedFrameProblem(what);
    if (problem) {
      setError(problem);
      return;
    }
    applyStudyEdit((current) => edit(current, mediaTime));
  };

  const segmentStartsHere = () =>
    markAtFrame("marking a boundary", (current, time) => addBoundary(current, time, segments));
  const telegraphEndsHere = () =>
    markAtFrame("marking a telegraph end", setTelegraphEnd);
  const invulnerableHere = () =>
    markAtFrame("marking an invulnerable span", toggleInvulnerable);

  const selectedTrack = study?.tracks.find((track) => track.id === selectedTrackId) ?? null;
  const isBombTrack = (trackId: string) => {
    const track = study?.tracks.find((entry) => entry.id === trackId);
    return track !== undefined && config.projectiles[track.attack.projectile]?.type === "bomb";
  };

  /** E08: E adds a detonation mark on the selected bomb track; elsewhere the edit refuses. */
  const recordDetonation = () =>
    markAtFrame("adding a detonation mark", (current, time) =>
      addMark(current, selectedTrackId, { timeSeconds: time, kind: "detonation" }, isBombTrack),
    );

  /**
   * E09: what the next pointer gesture on the video overlay records. The
   * overlay is mounted only while this is not null, so the video's own
   * controls work otherwise.
   */
  const [overlayArm, setOverlayArm] = useState<
    | null
    | Readonly<{ kind: "scale" }>
    | Readonly<{ kind: "range-throw"; trackId: string; pairIndex: number; pair: DetonationPair }>
    | Readonly<{
        kind: "range-detonation";
        trackId: string;
        pairIndex: number;
        from: VideoPoint;
      }>
  >(null);
  const dragStartRef = useRef<VideoPoint | null>(null);

  const overlayPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      point: {
        xFraction: (event.clientX - rect.left) / rect.width,
        yFraction: (event.clientY - rect.top) / rect.height,
      },
      aspectRatio: rect.height / rect.width,
    };
  };

  const onOverlayPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartRef.current = overlayPoint(event).point;
  };

  const onOverlayPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const arm = overlayArm;
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!arm) return;
    const { point, aspectRatio } = overlayPoint(event);
    const measure = (compute: () => number): number | null => {
      try {
        return compute();
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : String(problem));
        return null;
      }
    };
    if (arm.kind === "scale") {
      if (!study || !start) return;
      const fraction = measure(() =>
        tileWidthFractionOf(
          start,
          point,
          // The authored `body.widthTiles`: `bodyVertices` scales the outline to it.
          bodyExtentTiles(archetypeOf(config, study.archetypeId).verticesTiles, "x"),
          aspectRatio,
        ),
      );
      setOverlayArm(null);
      if (fraction !== null) applyStudyEdit((current) => setScale(current, fraction));
      return;
    }
    if (arm.kind === "range-throw") {
      setOverlayArm({ kind: "range-detonation", trackId: arm.trackId, pairIndex: arm.pairIndex, from: point });
      seekTo(arm.pair.detonationSeconds);
      return;
    }
    const scale = study?.scale?.tileWidthFraction;
    setOverlayArm(null);
    if (scale === undefined) return;
    const tiles = measure(() => distanceTiles(arm.from, point, scale, aspectRatio));
    if (tiles !== null)
      applyStudyEdit((current) => setMeasuredRange(current, arm.trackId, arm.pairIndex, tiles));
  };

  const overlayPrompt =
    overlayArm === null
      ? null
      : overlayArm.kind === "scale"
        ? "Drag across the monster's body."
        : overlayArm.kind === "range-throw"
          ? "Click the monster's centre at this throw frame."
          : "Click the explosion's centre at this detonation frame.";

  const acceptOverride = (fields: ProjectileOverride) => {
    if (!selectedTrack) return;
    applyStudyEdit((current) =>
      setProjectileOverride(current, selectedTrack.id, {
        ...selectedTrack.projectileOverride,
        ...fields,
      }),
    );
  };

  const selectedBomb = (() => {
    if (!selectedTrack) return undefined;
    const projectile = config.projectiles[selectedTrack.attack.projectile];
    return projectile?.type === "bomb"
      ? { travelSeconds: projectile.travelSeconds, rangeTiles: projectile.rangeTiles }
      : undefined;
  })();

  /** E10: Enter adds a volley mark on the selected track, or on scratch with none (E16). */
  const recordVolley = () =>
    markAtFrame("adding a mark", (current, time) =>
      addMark(current, selectedTrackId, { timeSeconds: time, kind: "volley" }, isBombTrack),
    );
  /** E07: X sets the selected track's end mark at the presented frame. */
  const endMarkHere = () => {
    if (selectedTrackId === null) {
      setError("Select an attack track before setting its end mark.");
      return;
    }
    markAtFrame("setting an end mark", (current, time) =>
      setEndMark(current, selectedTrackId, time),
    );
  };
  /** E10: Delete removes the selected track's mark within one frame of the playhead. */
  const removeMarkHere = () =>
    markAtFrame("removing a mark", (current, time) =>
      removeMarkNear(current, selectedTrackId, time, 2 * volleyStepTolerance(frameRate)),
    );
  /** E10: 1-9 select the track at that position, 0 the scratch track. */
  const selectTrackAt = (position: number) => {
    if (position === 0) setSelectedTrackId(null);
    else {
      const track = study?.tracks[position - 1];
      if (track) setSelectedTrackId(track.id);
    }
  };

  /** A track with the new-attack conveniences, at a segment's attack list (step 86.1). */
  const newTrack = (current: StudyV5, id: string, segmentId: string): AttackTrack | string => {
    const segment = segments.find((entry) => entry.id === segmentId);
    if (!segment) return "Choose the segment the attack belongs to.";
    if (id.length === 0) return "An attack track needs a name.";
    const attack = newAttack(id, current.tracks.map((track) => track.id), config);
    if (!attack.ok) return attack.error;
    return { id, location: segment.ref, attack: attack.value, cadenceSource: "typed", marks: [] };
  };
  const addAttackTrack = (id: string, segmentId: string): boolean => {
    const added = applyStudyEdit((current) => {
      const track = newTrack(current, id, segmentId);
      return typeof track === "string" ? { ok: false, error: track } : addTrack(current, track);
    });
    if (added) setSelectedTrackId(id);
    return added;
  };
  const createFromScratch = (
    markIndices: readonly number[],
    id: string,
    segmentId: string,
  ): boolean => {
    const created = applyStudyEdit((current) => {
      const track = newTrack(current, id, segmentId);
      return typeof track === "string"
        ? { ok: false, error: track }
        : createTrackFromScratch(current, markIndices, track);
    });
    if (created) setSelectedTrackId(id);
    return created;
  };
  /** Step 86.1: tracks with marks stay; every other track comes back from the file. */
  const reloadFromGame = () => {
    if (!study) return;
    const { study: next, keptCount } = reloadTracks(
      study,
      tracksFromMonsterFile(AUTHORED_MONSTER_FILES[study.archetypeId]),
    );
    setStudy(next);
    setDirty(true);
    setError(null);
    if (!next.tracks.some((track) => track.id === selectedTrackId)) setSelectedTrackId(null);
    setNotice(
      `Reloaded the attacks from the game; kept ${keptCount} track${keptCount === 1 ? "" : "s"} with marks.`,
    );
  };
  /** E06: a typed cadence field makes the cadence typed; any other edit keeps its source. */
  const editSelectedAttack = (change: AttackChange): boolean => {
    if (!selectedTrack) return false;
    const result = changedAttack(
      selectedTrack.attack,
      change,
      attackIdsInPhaseOf(study!, selectedTrack),
      config,
    );
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    if (result.value.removed.length > 0)
      setNotice(
        `Removed fields that do not apply to the new kind: ${result.value.removed.join(", ")}.`,
      );
    return applyStudyEdit((current) =>
      setTrackAttack(
        current,
        selectedTrack.id,
        result.value.attack,
        change.field === "cadence" ? "typed" : selectedTrack.cadenceSource,
      ),
    );
  };
  /** E06: accepting fitted values writes them into the cadence as fitted. */
  const acceptFit = (values: Partial<Record<CadenceField, number>>) => {
    if (!selectedTrack) return;
    applyStudyEdit((current) =>
      setTrackAttack(
        current,
        selectedTrack.id,
        { ...selectedTrack.attack, cadence: { ...selectedTrack.attack.cadence, ...values } },
        "fitted",
      ),
    );
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
          event.key === "x" ||
          event.key === "X" ||
          event.key === "s" ||
          event.key === "S" ||
          event.key === "t" ||
          event.key === "T" ||
          event.key === "i" ||
          event.key === "I")
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
      else if (action.kind === "step-volley") stepVolley(action.direction);
      else if (action.kind === "boundary") segmentStartsHere();
      else if (action.kind === "telegraph-end") telegraphEndsHere();
      else if (action.kind === "invulnerable") invulnerableHere();
      else if (action.kind === "record") recordVolley();
      else if (action.kind === "end-mark") endMarkHere();
      else if (action.kind === "remove-mark") removeMarkHere();
      else if (action.kind === "select-track") selectTrackAt(action.position);
      else if (action.kind === "detonation") recordDetonation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const resetSeek = () => {
    clearSeekTimeout();
    seekPendingRef.current = false;
    setSeekPending(false);
  };

  /** A new study of a monster, its tracks loaded from the monster's file (E03). */
  const freshStudy = (
    nextEncounterId: string,
    nextArchetypeId: string,
    provenance: StudyV5["provenance"],
  ): StudyV5 =>
    emptyStudy({
      encounterId: nextEncounterId,
      archetypeId: nextArchetypeId,
      provenance,
      recordedAt: new Date().toISOString(),
      rawFile: AUTHORED_MONSTER_FILES[nextArchetypeId],
    });

  /** The provenance of the video in use now, for a new study. */
  const provenanceNow = (
    source: Readonly<{ fileName: string; durationSeconds: number }>,
  ): StudyV5["provenance"] => {
    const trimmed = sourceUrlText.trim();
    return {
      sourceUrl: trimmed.length === 0 ? null : trimmed,
      fileName: source.fileName,
      frameRate,
      durationSeconds: source.durationSeconds,
    };
  };

  /** E02: a legacy study converts in memory; each notice is shown once. */
  const v5Of = (
    loaded: StudyState | StudyV5,
  ): Readonly<{ study: StudyV5; notices: readonly string[] }> => {
    if ("schemaVersion" in loaded) return { study: loaded, notices: [] };
    const loadedConfig = encounterConfigOf(loaded.encounterId);
    const id = loaded.archetypeId ?? loadedConfig.primaryArchetypeId;
    const converted = studyV5FromLegacy({
      legacy: loaded,
      config: loadedConfig,
      archetypeId: id,
      rawFile: AUTHORED_MONSTER_FILES[id],
      recordedAt: new Date().toISOString(),
    });
    return {
      study: converted.study,
      notices: [LEGACY_CONVERSION_NOTICE, ...converted.notices],
    };
  };

  const v5OfDraft = (draft: SessionDraft | LegacySessionDraft) =>
    isLegacyDraft(draft)
      ? { ...v5Of(draft.study), selectedTrackId: null }
      : { study: draft.study, notices: [], selectedTrackId: draft.selectedTrackId };

  const applyVideo = (file: File, keepStudy: boolean) => {
    setError(null);
    setFileName(file.name);
    setDurationSeconds(0);
    setMediaTime(0);
    resetSeek();
    if (keepStudy) {
      // Z15: the study, sourceUrl and frameRate carry over from the load.
      setKeepTagsOnNextVideo(false);
    } else {
      setSourceUrlText("");
      setFrameRateText("");
      setRateDetected(false);
      setStudy(
        freshStudy(encounterId, archetypeId, {
          sourceUrl: null,
          fileName: file.name,
          frameRate: null,
          durationSeconds: 0,
        }),
      );
      setSelectedTrackId(null);
      setStudyMeta(null);
      setDirty(false);
    }
    setVideoUrl(URL.createObjectURL(file));
  };

  const studyHasWork = markCount > 0 || (study?.boundaries.length ?? 0) > 0;
  const workText = `${markCount} mark(s) and ${study?.boundaries.length ?? 0} boundary(ies)`;

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const decision = videoChoiceDecision({
      tagCount: markCount + (study?.boundaries.length ?? 0),
      keepTagsOnNextVideo,
    });
    if (decision === "confirm-reset")
      setConfirmation({
        message: `Choosing "${file.name}" clears the ${workText} in this study. Saved sessions are not affected.`,
        onConfirm: () => applyVideo(file, false),
      });
    else applyVideo(file, decision === "keep" && study !== null);
  };

  const chooseEncounter = (id: string) => {
    if (id === encounterId) return;
    if (studyHasWork) {
      setConfirmation({
        message: `Changing encounter clears the ${workText} in this study. Saved sessions are not affected.`,
        onConfirm: () => applyEncounter(id),
      });
      return;
    }
    applyEncounter(id);
  };

  const applyEncounter = (id: string) => {
    const primary = encounterConfigOf(id).primaryArchetypeId;
    setEncounterId(id);
    setArchetypeId(primary);
    // One video is one fight (T16): marks recorded under the previous
    // encounter cannot be relabelled by a later selector change.
    setStudy(
      freshStudy(id, primary, provenanceNow(videoUrl ? { fileName, durationSeconds } : {
        fileName: studyMeta?.fileName ?? "",
        durationSeconds: studyMeta?.durationSeconds ?? 0,
      })),
    );
    setSelectedTrackId(null);
    setStudyMeta(null);
    setKeepTagsOnNextVideo(false);
    setDirty(false);
    resetSeek();
    setError(null);
  };

  /** Shared by loading a study file and restoring a saved session. */
  const applyStudy = (
    next: StudyV5,
    nextSelectedTrackId: string | null,
    notices: readonly string[],
  ) => {
    setEncounterId(next.encounterId);
    setArchetypeId(next.archetypeId);
    setSourceUrlText(next.provenance.sourceUrl ?? "");
    setFrameRateText(
      next.provenance.frameRate === null ? "" : String(next.provenance.frameRate),
    );
    setStudy(next);
    setSelectedTrackId(
      next.tracks.some((track) => track.id === nextSelectedTrackId) ? nextSelectedTrackId : null,
    );
    setStudyMeta({
      fileName: next.provenance.fileName,
      durationSeconds: next.provenance.durationSeconds,
    });
    setKeepTagsOnNextVideo(true);
    setDirty(false);
    setError(null);
    setNotice(notices.length > 0 ? notices.join(" ") : null);
  };

  const requestApply = (message: string, apply: () => void) => {
    if (loadDecision(markCount + (study?.boundaries.length ?? 0)) === "confirm")
      setConfirmation({ message, onConfirm: apply });
    else apply();
  };

  const chooseStudy = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void file.text().then(
      (text) => {
        let loaded: ReturnType<typeof v5Of>;
        try {
          const parsed = parseStudyFile(text, KNOWN_ENCOUNTER_IDS);
          const problem = studyMonsterProblem(
            parsed,
            encounterConfigOf(parsed.encounterId).primaryArchetypeId,
            monstersOfEncounter(encounterConfigOf(parsed.encounterId)),
          );
          if (problem) {
            setError(problem);
            return;
          }
          loaded = v5Of(parsed);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          return;
        }
        requestApply(
          `Loading "${file.name}" replaces the ${workText} in this study.`,
          () => applyStudy(loaded.study, null, loaded.notices),
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
    let restored: ReturnType<typeof v5OfDraft>;
    try {
      restored = v5OfDraft(draft);
    } catch (cause) {
      setError(`The saved session could not be restored: ${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }
    requestApply(
      `Restoring "${draft.study.provenance.fileName}" replaces the ${workText} in this study.`,
      () => applyStudy(restored.study, restored.selectedTrackId, restored.notices),
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

  /** E02: the export writes the v5 study with `recordedAt` refreshed. */
  const exportStudy = () => {
    setError(null);
    try {
      if (!study) throw new Error("Load a video or a study before exporting.");
      const provenance = resolveProvenance({
        video: videoUrl ? { fileName, durationSeconds } : null,
        study: studyMeta,
        sourceUrlText,
        frameRate,
      });
      const text = studyExportJson({ ...study, provenance }, new Date().toISOString());
      const blob = new Blob([text], {
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

  /** L08: switching monsters keeps the video and its time and swaps the study. */
  const applyMonsterSwitch = (
    id: string,
    plan: ReturnType<typeof monsterSwitchPlan>,
  ) => {
    const saved = currentStudy();
    if (plan.writeCurrent && saved) {
      const result = sessions.write(
        buildDraft({ study: saved, selectedTrackId, savedAt: new Date().toISOString() }),
        config.primaryArchetypeId,
      );
      setAutosaveError(result.ok ? null : result.error);
    }
    const source = videoUrl
      ? { fileName: fileName.trim(), durationSeconds }
      : { fileName: studyMeta?.fileName.trim() ?? "", durationSeconds: studyMeta?.durationSeconds ?? 0 };
    const slot =
      plan.open === "slot" && source.fileName.length > 0
        ? sessions.read(
            TaggerSessions.keyFor(source.fileName, id === config.primaryArchetypeId ? null : id),
          )
        : null;
    setArchetypeId(id);
    setDirty(false);
    setError(null);
    if (slot?.ok) {
      try {
        const restored = v5OfDraft(slot.value);
        setStudy(restored.study);
        setSelectedTrackId(restored.selectedTrackId);
        setNotice(restored.notices.length > 0 ? restored.notices.join(" ") : null);
        return;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }
    // An empty study keeps sourceUrl and frameRate, and never the video.
    setStudy(freshStudy(encounterId, id, provenanceNow(source)));
    setSelectedTrackId(null);
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
        message: `Autosave is failing, so switching monster would lose the unsaved ${workText} of this study. Export first, or confirm to switch anyway.`,
        onConfirm: () => applyMonsterSwitch(id, { ...plan, writeCurrent: false }),
      });
      return;
    }
    applyMonsterSwitch(id, plan);
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

  const showSessions =
    !sessionsDismissed &&
    ((sessionList !== null && sessionList.length > 0) || sessionListError);
  const encounterName =
    ENCOUNTER_LIST.find((entry) => entry.id === encounterId)?.displayName ?? encounterId;
  const boundaryCount = study?.boundaries.length ?? 0;
  const tracksWithMarks = study?.tracks.filter((track) => track.marks.length > 0).length ?? 0;
  const windows = study ? segmentWindows(study.boundaries, segments, duration) : [];
  // Step 86.3: each track's predicted volleys are the timeline's faint ticks.
  const predicted = study
    ? Object.fromEntries(
        study.tracks.map((track) => [
          track.id,
          predictedTimesInWindows(windowsForTrack(windows, track.location), track.attack.cadence),
        ]),
      )
    : {};
  const rowsOfTimeline = study
    ? timelineRows({ study, segments, durationSeconds: duration, predicted })
    : [];
  // Step 88.1: the Reconcile step's warnings and export, derived on render.
  const warnings = study
    ? studyWarnings({
        study,
        segments,
        videoEndSeconds: duration,
        frameToleranceSeconds: volleyStepTolerance(frameRate),
      })
    : [];
  const fileText = study
    ? monsterFileTextFromStudy({
        archetypeId,
        study,
        currentRawFile: AUTHORED_MONSTER_FILES[archetypeId],
        config,
      })
    : null;
  const variants = study
    ? study.tracks.flatMap((track) => {
        const variant = bombVariantOf(track);
        return variant ? [variant] : [];
      })
    : [];
  /** E20: a track row selects its track, the scratch row selects scratch (null). */
  const selectRow = (id: string) => {
    if (id === "scratch") setSelectedTrackId(null);
    else if (study?.tracks.some((track) => track.id === id)) setSelectedTrackId(id);
  };
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
      id: "structure",
      name: STEP_GUIDES.structure.name,
      status: boundaryCount === 1 ? "1 boundary" : `${boundaryCount} boundaries`,
    },
    {
      id: "attacks",
      name: STEP_GUIDES.attacks.name,
      status: `${markCount} marks on ${tracksWithMarks} tracks`,
    },
    {
      id: "reconcile",
      name: STEP_GUIDES.reconcile.name,
      status: study ? (warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`) : "not yet checked",
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
        <div className={styles.headerActions}>
          <button type="button" onClick={exportStudy}>
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
                  <th scope="col">Marks</th>
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
                      <td>{entry.markCount}</td>
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
                      if (studyHasWork) setDirty(true);
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
                      if (studyHasWork) setDirty(true);
                    }}
                    placeholder="https://..."
                  />
                </label>
              </div>
              <p className={styles.note}>
                Frame steps and mark times need the rate. Leave it blank and
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
                One study covers one monster. Its attacks load as attack
                tracks automatically.
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
            onClick={() => setStep("structure")}
          >
            Start the structure
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
          <div className={styles.videoFrame}>
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
          {overlayArm && (
            <div
              className={styles.videoOverlay}
              role="application"
              aria-label={overlayPrompt ?? undefined}
              data-testid="video-overlay"
              onPointerDown={onOverlayPointerDown}
              onPointerUp={onOverlayPointerUp}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOverlayArm(null);
              }}
            />
          )}
          </div>
        )}
        {overlayPrompt && (
          <p className={styles.note} role="status">
            {overlayPrompt}{" "}
            <button type="button" onClick={() => setOverlayArm(null)}>
              Cancel
            </button>
          </p>
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
          rows={rowsOfTimeline}
          selectedRowId={selectedTrackId ?? "scratch"}
          onSelectRow={selectRow}
          enabled={videoUrl !== null}
          onSeek={seekTo}
        />
        <details className={styles.shortcuts}>
          <summary>Keyboard shortcuts</summary>
          <dl>
            <div><dt><kbd>Space</kbd></dt><dd>Play or pause</dd></div>
            <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>One frame back or forward</dd></div>
            <div><dt><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd></dt><dd>Jump {FINE_JUMP_SECONDS} s</dd></div>
            <div><dt><kbd>PageUp</kbd> <kbd>PageDown</kbd></dt><dd>Jump {COARSE_JUMP_SECONDS} s</dd></div>
            <div><dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous or next volley</dd></div>
            <div><dt><kbd>S</kbd></dt><dd>Segment starts here</dd></div>
            <div><dt><kbd>T</kbd></dt><dd>Telegraph ends here</dd></div>
            <div><dt><kbd>I</kbd></dt><dd>Invulnerable starts here, or ends here</dd></div>
            <div><dt><kbd>Enter</kbd></dt><dd>Add a volley mark to the selected attack</dd></div>
            <div><dt><kbd>X</kbd></dt><dd>Set the selected attack&apos;s end mark</dd></div>
            <div><dt><kbd>Delete</kbd></dt><dd>Remove the selected attack&apos;s mark at this frame</dd></div>
            <div><dt><kbd>1</kbd>-<kbd>9</kbd> <kbd>0</kbd></dt><dd>Select an attack track, or scratch</dd></div>
          </dl>
        </details>
            </div>
          <PreviewPanel
            key={encounterId}
            study={study}
            segments={segments}
            windows={windows}
            mediaTime={mediaTime}
            hasVideo={videoUrl !== null}
            config={config}
            selectedTrackIndex={
              selectedTrack && study ? study.tracks.indexOf(selectedTrack) : null
            }
            layout={layout}
            onLayoutChange={changeLayout}
          />
          </div>
        </div>

        <div className={styles.inspector} hidden={step === "reconcile"}>
      <div hidden={step !== "structure"}>
        {study ? (
          <StructurePanel
            study={study}
            segments={segments}
            windows={windows}
            mediaTime={mediaTime}
            frameRate={frameRate}
            hasVideo={canRecord}
            onSegmentStartsHere={segmentStartsHere}
            onTelegraphEndsHere={telegraphEndsHere}
            onToggleInvulnerable={invulnerableHere}
            onSetBoundarySegment={(index, segmentId) =>
              applyStudyEdit((current) => setBoundarySegment(current, index, segmentId))
            }
            onRemoveBoundary={(index) => applyStudyEdit((current) => removeBoundary(current, index))}
            onRemoveSpan={(index) => applyStudyEdit((current) => removeSpan(current, index))}
            onSeek={(time) => {
              if (videoUrl) seekTo(time);
            }}
          />
        ) : (
          <p className={styles.note}>Open a video or choose the monster to start a study.</p>
        )}
        {study && (
          <ScalePanel
            tileWidthFraction={study.scale?.tileWidthFraction ?? null}
            armed={overlayArm?.kind === "scale"}
            hasVideo={Boolean(videoUrl)}
            onCalibrate={() => {
              video.current?.pause();
              setOverlayArm({ kind: "scale" });
            }}
            onClear={() => applyStudyEdit((current) => setScale(current, undefined))}
          />
        )}
      </div>
      <div hidden={step !== "attacks"}>
        {study ? (
          <>
            <TrackPanel
              study={study}
              segments={segments}
              config={config}
              selectedTrackId={selectedTrackId}
              onSelect={setSelectedTrackId}
              onAdd={addAttackTrack}
              onDuplicate={(newId) =>
                selectedTrackId !== null &&
                applyStudyEdit((current) => duplicateTrack(current, selectedTrackId, newId))
              }
              onDelete={() => {
                if (selectedTrackId === null) return;
                if (applyStudyEdit((current) => removeTrack(current, selectedTrackId)))
                  setSelectedTrackId(null);
              }}
              onReload={reloadFromGame}
              onEditAttack={editSelectedAttack}
              onSetLocation={(segmentId) => {
                const segment = segments.find((entry) => entry.id === segmentId);
                if (selectedTrackId !== null && segment)
                  applyStudyEdit((current) => setTrackLocation(current, selectedTrackId, segment.ref));
              }}
              onSeek={(time) => {
                if (videoUrl) seekTo(time);
              }}
              onRemoveMark={(time) =>
                applyStudyEdit((current) => removeMarkNear(current, selectedTrackId, time, 0))
              }
              onCreateFromScratch={createFromScratch}
            />
            {selectedTrack && (
              <FitPanel
                track={selectedTrack}
                windows={windows}
                frameRate={frameRate}
                onAccept={(field, value) => acceptFit({ [field]: value })}
                onAcceptAll={acceptFit}
                onSetThreshold={(seconds) =>
                  applyStudyEdit((current) =>
                    setBurstGapThreshold(current, selectedTrack.id, seconds),
                  )
                }
                bomb={selectedBomb}
                tileWidthFraction={study.scale?.tileWidthFraction ?? null}
                onAcceptOverride={acceptOverride}
                onMeasurePair={(pairIndex, pair) => {
                  if (!videoUrl) {
                    setError("Load a video before measuring a range.");
                    return;
                  }
                  seekTo(pair.throwSeconds);
                  setOverlayArm({ kind: "range-throw", trackId: selectedTrack.id, pairIndex, pair });
                }}
              />
            )}
          </>
        ) : (
          <p className={styles.note}>Open a video or choose the monster to start a study.</p>
        )}
      </div>
        </div>

      <div className={styles.review} hidden={step !== "reconcile"}>
        {study && fileText ? (
          <ReconcilePanel
            study={study}
            segments={segments}
            videoEndSeconds={duration}
            frameSeconds={2 * volleyStepTolerance(frameRate)}
            warnings={warnings}
            fileText={fileText}
            fileName={monsterFilePath(archetypeId)}
            variants={variants}
            onAccept={(segmentId, field, value) =>
              applyStudyEdit((current) => acceptSegmentValue(current, segmentId, field, value))
            }
            onSeek={(time) => {
              if (videoUrl) seekTo(time);
            }}
            onExportStudy={exportStudy}
          />
        ) : (
          <p className={styles.note}>Open a video or choose the monster to start a study.</p>
        )}
      </div>
      </div>
    </main>
  );
}
