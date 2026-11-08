import type { ReactNode, RefObject } from "react";
import type { EncounterView } from "../game/phaser/encounter";
import { PALADIN_STATS } from "../game/config/stats";
import { ConditionList } from "./ConditionList";
import { PhaseLadder, type LadderPhase } from "./PhaseLadder";
import styles from "../App.module.css";

type Props = {
  view: EncounterView;
  displayName: string;
  phases: readonly LadderPhase[];
  phaseOpen: boolean;
  phaseButton: RefObject<HTMLButtonElement | null>;
  onPhases: () => void;
  onResume: () => void;
  onRetry: () => void;
  onHome: () => void;
  onControls: () => void;
  /** The Debug button and Mute checkbox, owned by `App` so refs and handlers match Home. */
  sessionTools: ReactNode;
};

const statusText = (view: EncounterView) =>
  view.status === "ended"
    ? view.result?.outcome === "cleared"
      ? "Boss defeated"
      : "Defeated"
    : view.status === "paused"
      ? "Paused"
      : view.status === "countdown"
        ? "Starting"
        : "Active";

const zoomText = (zoom: number) =>
  zoom.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

/**
 * The live HUD: a left rail from 1100 px up, a compact top band below. Every
 * row has a fixed height so the arena beside or under it never resizes
 * during a session.
 */
export function SessionRail({
  view,
  displayName,
  phases,
  phaseOpen,
  phaseButton,
  onPhases,
  onResume,
  onRetry,
  onHome,
  onControls,
  sessionTools,
}: Props) {
  const hpPercent = Math.max(
    0,
    Math.min(100, (view.healthHp / PALADIN_STATS.healthHp) * 100),
  );
  return (
    <div className={styles.rail} aria-label="Session HUD">
      <div className={styles.railHead}>
        <h1 className={styles.railName}>{displayName}</h1>
        <span role="status" aria-label="Session status">
          {statusText(view)}
        </span>
      </div>
      {view.bossHealthFraction !== null && (
        <div className={styles.bossBar}>
          <meter
            aria-label="Boss progress"
            min={0}
            max={1}
            value={view.bossHealthFraction}
          />
          <span>{Math.ceil(view.bossHealthFraction * 100)}%</span>
        </div>
      )}
      {view.phaseCount > 1 && <PhaseLadder phases={phases} view={view} />}
      <div className={styles.vitals}>
        <span className={styles.health}>
          <span className={styles.hpTrack}>
            <span
              className={styles.hpTrail}
              style={{ width: `${hpPercent}%` }}
              aria-hidden="true"
            />
            <meter
              aria-label="Health"
              min={0}
              max={PALADIN_STATS.healthHp}
              value={view.healthHp}
            />
          </span>
          <span className={styles.hpText}>
            {Math.ceil(view.healthHp)} / {PALADIN_STATS.healthHp} HP
          </span>
        </span>
        <span className={styles.clock}>
          <output aria-label="Survival time" aria-live="off">
            {view.elapsedSeconds.toFixed(1)} s
          </output>
          <span>{view.hitsTaken} hits</span>
        </span>
        <span aria-label="Primary stats" className={styles.stats}>
          <span>{PALADIN_STATS.vitality} VIT</span>
          <span>{PALADIN_STATS.speed} SPD</span>
          <span>{PALADIN_STATS.defense} DEF</span>
        </span>
      </div>
      <div className={styles.railConditions}>
        {view.debug && (
          <span className={styles.debugBadge}>Debug attempt / not saved</span>
        )}
        <ConditionList conditions={view.conditions} showHints />
      </div>
      <p className={styles.zoomReadout}>
        Zoom {zoomText(view.zoom)}x <kbd>O</kbd> <kbd>P</kbd>
      </p>
      <div className={styles.railFooter}>
        <div
          className={`${styles.actions} ${view.result ? styles.hiddenActions : ""}`}
          inert={!!view.result}
          aria-hidden={!!view.result}
        >
          <button
            ref={phaseButton}
            type="button"
            aria-expanded={phaseOpen}
            aria-controls={phaseOpen ? "phase-selector" : undefined}
            onClick={onPhases}
          >
            Phases
          </button>
          <button
            type="button"
            disabled={view.status !== "paused"}
            onClick={onResume}
          >
            Resume
          </button>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
          <button type="button" onClick={onHome}>
            Home
          </button>
          <button type="button" onClick={onControls}>
            Controls
          </button>
        </div>
        <div className={styles.sessionTools}>{sessionTools}</div>
      </div>
    </div>
  );
}
