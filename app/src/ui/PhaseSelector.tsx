import {
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import type { DrillSelection } from "../game/models";
import styles from "./PhaseSelector.module.css";

export type PhaseOption = Readonly<{ index: number; id: string; label: string }>;

export type PhaseSelectorProps = Readonly<{
  mode: "home" | "live";
  phases: readonly PhaseOption[];
  drill: DrillSelection | null;
  activePhaseIndex?: number;
  /** The live view's already-derived active label; falls back to the phase list. */
  activePhaseLabel?: string;
  onChange: (drill: DrillSelection | null) => void;
  onApply?: () => void;
  onClose: () => void;
}>;

/**
 * The shared, presentational phase selector (R01, R02, R12, R15, R17). It
 * renders only from props: Home owns the selection and Start launches it,
 * while the live encounter adds Apply and the read-only active row. The phase
 * set is always stored sorted and unique, and Loop defaults on the first time
 * a phase is selected.
 */
export function PhaseSelector({
  mode,
  phases,
  drill,
  activePhaseIndex,
  activePhaseLabel,
  onChange,
  onApply,
  onClose,
}: PhaseSelectorProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // The live panel is opened from the HUD, so move focus into it for keyboard
    // users; Home already has focus on its Phases button.
    if (mode === "live") heading.current?.focus();
  }, [mode]);
  const togglePhase = (index: number, checked: boolean) => {
    const current = drill?.phaseIndices ?? [];
    const next = checked
      ? [...current, index]
      : current.filter((selected) => selected !== index);
    if (next.length === 0) {
      onChange(null);
      return;
    }
    onChange({
      phaseIndices: [...new Set(next)].sort((first, second) => first - second),
      loop: drill?.loop ?? true,
    });
  };
  const activePhase = phases.find(
    (phase) => phase.index === activePhaseIndex,
  );
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (mode !== "live" || event.key !== "Escape") return;
    event.preventDefault();
    // The scene listens on window for Escape to pause/resume; closing the
    // panel here must not also resume the attempt behind it.
    event.stopPropagation();
    onClose();
  };
  return (
    <aside
      id="phase-selector"
      aria-label="Phase selection"
      className={`${styles.panel} ${mode === "live" ? styles.live : ""}`}
      onKeyDown={onKeyDown}
    >
      <div className={styles.heading}>
        <h2 ref={heading} tabIndex={mode === "live" ? -1 : undefined}>
          Phases
        </h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <fieldset className={styles.options}>
        <legend>Phase selection</legend>
        <label className={styles.choice}>
          <input
            type="radio"
            name="phase-selection"
            value=""
            checked={drill === null}
            onChange={() => onChange(null)}
          />
          Full fight
        </label>
        {phases.map((phase) => (
          <label key={phase.id} className={styles.choice}>
            <input
              type="checkbox"
              value={phase.index}
              checked={drill?.phaseIndices.includes(phase.index) ?? false}
              onChange={(event) =>
                togglePhase(phase.index, event.target.checked)
              }
            />
            {phase.label}
          </label>
        ))}
      </fieldset>
      <label className={styles.choice}>
        <input
          type="checkbox"
          checked={drill?.loop ?? false}
          disabled={drill === null}
          onChange={(event) => {
            if (drill)
              onChange({ ...drill, loop: event.target.checked });
          }}
        />
        Loop
      </label>
      {mode === "live" && (
        <p className={styles.nowPlaying} aria-label="Now playing">
          <span>Now playing</span>
          <strong>{activePhaseLabel ?? activePhase?.label ?? "None"}</strong>
        </p>
      )}
      {mode === "live" && onApply && (
        <div className={styles.actions}>
          <button type="button" onClick={onApply}>
            Apply
          </button>
        </div>
      )}
    </aside>
  );
}
