import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  createEncounter,
  type EncounterHandle,
  type EncounterView,
} from "../game/phaser/encounter";
import { PALADIN_STATS } from "../game/config/stats";
import {
  primaryArchetype,
  type EncounterConfig,
} from "../game/config/encounter";
import type { AttemptHistory, HistorySnapshot } from "../storage/attempts";
import type { ZoomPreference } from "../storage/zoom";
import { phaseLabel } from "../game/config/drill";
import type { DrillSelection } from "../game/models";
import { DEBUG_RULES_VERSION, type DebugSettings } from "../game/config/debug";
import { PhaseSelector } from "./PhaseSelector";
import { ControlsDialog } from "./ControlsDialog";
import { ResultsPanel } from "./ResultsPanel";
import { SessionRail } from "./SessionRail";
import type { LadderPhase } from "./PhaseLadder";
import styles from "../App.module.css";

/**
 * How long the phase-change banner stays up. Presentation only: it matches
 * the 2 s phase telegraph authored in the monster file under `game/data/enemies/`, and changes no rule.
 */
const PHASE_BANNER_SECONDS = 2;

/** Below this share of full health the playfield edge turns ember. Presentation only. */
const DANGER_HEALTH_FRACTION = 0.25;

/**
 * Optional `?seed=<integer>` pins spawn placement, so a run can be reproduced
 * or shared. Omitted or invalid means a varied opening.
 */
function readSeedFromLocation(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get("seed");
  if (raw === null) return undefined;
  const seed = Number(raw);
  return Number.isFinite(seed) ? Math.trunc(seed) : undefined;
}

// crypto.randomUUID exists only in secure contexts; plain HTTP pages lack it.
function createRuntimeId(): string {
  const source = typeof crypto === "undefined" ? undefined : crypto;
  if (typeof source?.randomUUID === "function") return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof source?.getRandomValues === "function") source.getRandomValues(bytes);
  // Last resort: the id is only a history key, not security-sensitive.
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function EncounterScreen({
  zoomPreference,
  zoomStorage,
  muted,
  debugSettings,
  onHome,
  history,
  historySnapshot,
  onHistoryChange,
  encounterHandle,
  config,
  displayName,
  drill,
  onDrillChange,
  debugOpen,
  onDebugOpenChange,
  sessionTools,
}: {
  zoomPreference: RefObject<number>;
  zoomStorage: ZoomPreference;
  muted: boolean;
  debugSettings: DebugSettings;
  onHome: () => void;
  history: AttemptHistory;
  historySnapshot: HistorySnapshot;
  onHistoryChange: (snapshot: HistorySnapshot) => void;
  encounterHandle: RefObject<EncounterHandle | null>;
  config: EncounterConfig;
  displayName: string;
  drill: DrillSelection | null;
  onDrillChange: (drill: DrillSelection | null) => void;
  debugOpen: boolean;
  onDebugOpenChange: (open: boolean) => void;
  sessionTools: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const phaseButton = useRef<HTMLButtonElement>(null);
  const runtime = encounterHandle;
  const [controlsOpen, setControlsOpen] = useState(false);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const initialMuted = useRef(muted);
  const initialDebugSettings = useRef(debugSettings);
  // The launch selection is fixed for this runtime; live Apply updates the
  // session and the shared selector via the App-owned drill state.
  const initialDrill = useRef(drill);
  const phases: LadderPhase[] = primaryArchetype(config).phases.map(
    (phase, index) => ({
      index,
      id: phase.id,
      label: phaseLabel(phase.id, index),
      telegraphColor: phase.telegraphColor,
    }),
  );
  const initialPhaseIndex = drill?.phaseIndices[0] ?? 0;
  const [view, setView] = useState<EncounterView>({
    healthHp: PALADIN_STATS.healthHp,
    elapsedSeconds: 0,
    hitsTaken: 0,
    status: "countdown",
    countdownRemainingSeconds: config.session.startCountdownSeconds,
    zoom: zoomPreference.current,
    result: null,
    phaseIndex: initialPhaseIndex,
    phaseLabel: phases[initialPhaseIndex]?.label ?? phases[0].label,
    phaseCount: phases.length,
    drill,
    bossHealthFraction: null,
    phaseProgress: 0,
    phaseEndsAtFraction: null,
    phaseTimedSeconds: null,
    subPhaseId: null,
    conditions: [],
  });
  const [banner, setBanner] = useState<{
    label: string;
    colour: string;
  } | null>(null);
  const lastPhaseIndex = useRef(view.phaseIndex);
  useEffect(() => {
    if (view.result) resultHeading.current?.focus();
  }, [view.result]);
  useEffect(() => {
    if (view.result) setPhaseOpen(false);
  }, [view.result]);
  useEffect(() => {
    // A Debug aside opened from the header closes the live phase panel and
    // resumes the attempt, so the two asides never stack.
    if (!debugOpen || !phaseOpen) return;
    setPhaseOpen(false);
    runtime.current?.resume();
  }, [debugOpen, phaseOpen, runtime]);
  useEffect(() => {
    if (view.phaseIndex === lastPhaseIndex.current) return;
    lastPhaseIndex.current = view.phaseIndex;
    if (view.status !== "running") return;
    const phase = phases.find((candidate) => candidate.index === view.phaseIndex);
    setBanner({
      label: view.phaseLabel,
      colour: `var(--telegraph-${phase?.telegraphColor ?? "white"})`,
    });
  }, [view.phaseIndex, view.phaseLabel, view.status]);
  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), PHASE_BANNER_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [banner]);
  useEffect(() => {
    let active = true;
    const runtimeId = createRuntimeId();
    const recordedAttempts = new Set<number>();
    const handle = createEncounter(
      host.current!,
      (nextView) => {
        if (!active) return;
        zoomPreference.current = nextView.zoom;
        setView(nextView);
      },
      {
        config,
        seed: readSeedFromLocation(),
        drill: { drill: initialDrill.current },
        initialZoom: zoomPreference.current,
        initialMuted: initialMuted.current,
        initialDebugSettings: initialDebugSettings.current,
        onZoomChange: (zoom) => {
          if (!active) return;
          zoomPreference.current = zoom;
          zoomStorage.set(zoom);
        },
        onResult: (result) => {
          if (result.rulesVersion === DEBUG_RULES_VERSION) return;
          if (!active || recordedAttempts.has(result.attemptId)) return;
          recordedAttempts.add(result.attemptId);
          const { attemptId, ...metrics } = result;
          onHistoryChange(
            history.save({ id: `${runtimeId}:${attemptId}`, ...metrics }),
          );
        },
      },
    );
    runtime.current = handle;
    return () => {
      active = false;
      runtime.current = null;
      handle.destroy();
    };
  }, [zoomPreference, zoomStorage, history, onHistoryChange]);
  useEffect(() => {
    runtime.current?.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    runtime.current?.setDebugSettings(debugSettings);
  }, [debugSettings]);
  const openPhasePanel = () => {
    runtime.current?.setControlsOpen(false);
    setControlsOpen(false);
    onDebugOpenChange(false);
    runtime.current?.pause();
    setPhaseOpen(true);
  };
  const closePhasePanel = () => {
    setPhaseOpen(false);
    runtime.current?.resume();
  };
  const retryAttempt = () => {
    setPhaseOpen(false);
    runtime.current?.retry();
  };
  const dangerous =
    view.status === "running" &&
    view.healthHp / PALADIN_STATS.healthHp < DANGER_HEALTH_FRACTION;
  return (
    <div className={styles.sessionGrid}>
      <SessionRail
        view={view}
        displayName={displayName}
        phases={phases}
        phaseOpen={phaseOpen}
        phaseButton={phaseButton}
        onPhases={() => {
          if (phaseOpen) closePhasePanel();
          else openPhasePanel();
        }}
        onResume={() => {
          if (phaseOpen) closePhasePanel();
          else runtime.current?.resume();
        }}
        onRetry={retryAttempt}
        onHome={onHome}
        onControls={() => {
          setPhaseOpen(false);
          runtime.current?.setControlsOpen(true);
          setControlsOpen(true);
        }}
        sessionTools={sessionTools}
      />
      <div className={styles.liveLayout}>
        <div className={styles.playfield}>
          <div
            ref={host}
            tabIndex={0}
            role="region"
            aria-label="Encounter"
            className={styles.arena}
          />
          {view.status === "running" && view.hitsTaken > 0 && (
            <div
              key={view.hitsTaken}
              className={styles.hitFlash}
              aria-hidden="true"
            />
          )}
          {dangerous && <div className={styles.danger} aria-hidden="true" />}
          {banner && !view.result && (
            <div
              className={styles.phaseBanner}
              style={{ borderBottomColor: banner.colour }}
              aria-hidden="true"
            >
              {banner.label}
            </div>
          )}
          {view.status === "countdown" && (
            <div className={styles.countdown} aria-hidden="true">
              <span>{Math.ceil(view.countdownRemainingSeconds)}</span>
              <small>{view.phaseLabel}</small>
              <small>
                <kbd>WASD</kbd> to move
              </small>
            </div>
          )}
          {view.status === "paused" && (
            <div
              className={`${styles.countdown} ${styles.paused}`}
              aria-label="Paused overlay"
            >
              <span>Paused</span>
              <small>{view.phaseLabel}</small>
              <small>Press Esc to resume</small>
            </div>
          )}
          {view.result && (
            <ResultsPanel
              view={view}
              config={config}
              displayName={displayName}
              historySnapshot={historySnapshot}
              heading={resultHeading}
              onRetry={() => runtime.current?.retry()}
              onHome={onHome}
            />
          )}
        </div>
        {phaseOpen && (
          <PhaseSelector
            mode="live"
            phases={phases}
            drill={drill}
            activePhaseIndex={view.phaseIndex}
            activePhaseLabel={view.phaseLabel}
            onChange={onDrillChange}
            onApply={() => runtime.current?.applyDrill(drill)}
            onClose={closePhasePanel}
          />
        )}
      </div>
      {controlsOpen && (
        <ControlsDialog
          onClose={() => {
            runtime.current?.setControlsOpen(false);
            setControlsOpen(false);
          }}
        />
      )}
    </div>
  );
}
