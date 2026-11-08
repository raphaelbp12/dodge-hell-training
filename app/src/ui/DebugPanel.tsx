import type { RefObject } from "react";
import type { EncounterHandle } from "../game/phaser/encounter";
import {
  DEBUG_GROUPS,
  DEBUG_PARAMETERS,
  DEBUG_TOGGLES,
  DEFAULT_DEBUG_SETTINGS,
  loadSelectedDebugValues,
  updateDebugParameter,
  type DebugSettings,
} from "../game/config/debug";
import styles from "../App.module.css";

export function DebugPanel({
  settings,
  onChange,
  onClose,
  encounterHandle,
}: {
  settings: DebugSettings;
  onChange: (settings: DebugSettings) => void;
  onClose: () => void;
  encounterHandle: RefObject<EncounterHandle | null>;
}) {
  return (
    <aside
      id="debug-tools"
      aria-label="Enemy debug tools"
      data-debug-tools
      className={styles.debugPanel}
    >
      <div className={styles.debugHeading}>
        <h2>Enemy debug</h2>
        <button type="button" onClick={onClose}>
          Close debug
        </button>
      </div>
      <button
        className={styles.debugLoad}
        type="button"
        onClick={() => onChange(loadSelectedDebugValues(settings))}
      >
        Load selected values
      </button>
      {DEBUG_TOGGLES.map((toggle) => (
        <label key={toggle.key} className={styles.debugToggle}>
          <input
            type="checkbox"
            checked={settings[toggle.key]}
            onChange={(event) =>
              onChange({ ...settings, [toggle.key]: event.target.checked })
            }
          />
          {toggle.label}
        </label>
      ))}
      <button
        type="button"
        className={styles.debugLoad}
        onClick={() => encounterHandle.current?.advanceSubPhase()}
      >
        Next sub-phase
      </button>
      {DEBUG_GROUPS.map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {DEBUG_PARAMETERS.filter(
            (parameter) => parameter.group === group,
          ).map((parameter) => (
            <label key={parameter.key} className={styles.debugParameter}>
              <span>{parameter.label}</span>
              <output>
                {Number(settings[parameter.key].toFixed(3))} {parameter.unit}
              </output>
              <input
                type="range"
                aria-label={parameter.label}
                data-debug-parameter={parameter.key}
                min={parameter.min}
                max={parameter.max}
                step={parameter.step}
                value={settings[parameter.key]}
                onChange={(event) =>
                  onChange(
                    updateDebugParameter(
                      settings,
                      parameter.key,
                      Number(event.target.value),
                    ),
                  )
                }
              />
            </label>
          ))}
        </fieldset>
      ))}
      <button type="button" onClick={() => onChange(DEFAULT_DEBUG_SETTINGS)}>
        Reset defaults
      </button>
    </aside>
  );
}
