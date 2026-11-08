import type { CSSProperties } from "react";
import type { TelegraphColorName } from "../game/config/data";
import type { EncounterView } from "../game/phaser/encounter";
import {
  ladderRowState,
  splitPhaseLabel,
  subPhaseWords,
} from "./phaseLadderModel";
import type { PhaseOption } from "./PhaseSelector";
import styles from "../App.module.css";

export type LadderPhase = PhaseOption & {
  telegraphColor: TelegraphColorName;
};

/** Presentation only: the sub-phase ids that name a telegraph colour. */
const SUB_PHASE_SWATCHES: Readonly<Record<string, string>> = {
  red: "var(--telegraph-red)",
  yellow: "var(--telegraph-amber)",
  blue: "var(--telegraph-cyan)",
};

export function PhaseLadder({
  phases,
  view,
}: {
  phases: readonly LadderPhase[];
  view: EncounterView;
}) {
  const swatch = view.subPhaseId ? SUB_PHASE_SWATCHES[view.subPhaseId] : undefined;
  return (
    <div className={styles.ladder}>
      <ol aria-label="Fight progress">
        {phases.map((phase) => {
          const state = ladderRowState(phase.index, view.phaseIndex, view.drill);
          const { number, name } = splitPhaseLabel(phase.label);
          return (
            <li
              key={phase.id}
              className={styles.ladderRow}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              style={
                {
                  "--phase-color": `var(--telegraph-${phase.telegraphColor})`,
                } as CSSProperties
              }
            >
              <span className={styles.ladderText}>
                <span className={styles.ladderMark} aria-hidden="true" />
                {number && <b>{number}</b>} {name}
              </span>
              {state === "current" && (
                <span className={styles.ladderDetail}>
                  <span
                    className={styles.ladderBar}
                    aria-hidden="true"
                    style={{ width: `${view.phaseProgress * 100}%` }}
                  />
                  {view.phaseEndsAtFraction !== null && (
                    <small>
                      Ends at {Math.round(view.phaseEndsAtFraction * 100)}%
                    </small>
                  )}
                  {view.phaseTimedSeconds !== null && (
                    <small>Timed, {view.phaseTimedSeconds} s</small>
                  )}
                  {view.subPhaseId && (
                    <small>
                      {swatch && (
                        <span
                          className={styles.swatch}
                          style={{ background: swatch }}
                          aria-hidden="true"
                        />
                      )}
                      {subPhaseWords(view.subPhaseId)}
                    </small>
                  )}
                  {view.drill?.loop && <small>Looping</small>}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className={styles.ladderNow} aria-hidden="true">
        {view.phaseLabel}
      </p>
    </div>
  );
}
