import { useState } from "react";
import type { SavedAttack, SavedAttackCadence } from "./tagging";
import styles from "./TaggerRoute.module.css";

/**
 * The Attack controls of the Tag panel (plan V16 S31-S36): choose a saved
 * attack, save the sticky selection as one, and update, rename or delete the
 * chosen one. Every refusal is reported by the route through its one `error`
 * line, so each callback only says whether it accepted the change.
 */
export function SavedAttackPanel({
  savedAttacks,
  chosen,
  modified,
  onChoose,
  onSave,
  onUpdate,
  onRename,
  onDelete,
}: {
  savedAttacks: readonly SavedAttack[];
  chosen: SavedAttack | null;
  /** The sticky attack fields differ from the chosen attack (S32). */
  modified: boolean;
  onChoose: (id: string | null) => void;
  onSave: (name: string, cadence: SavedAttackCadence) => boolean;
  onUpdate: () => void;
  onRename: (name: string) => boolean;
  onDelete: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [shotsPerBurst, setShotsPerBurst] = useState("1");
  const [interval, setIntervalText] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [renameText, setRenameText] = useState<string | null>(null);

  const perBurst = Number(shotsPerBurst);
  const showInterval = Number.isFinite(perBurst) && perBurst > 1;

  const submit = () => {
    const cadence: SavedAttackCadence = {
      shotsPerBurst: perBurst,
      ...(showInterval ? { shotIntervalSeconds: Number(interval) } : {}),
      cooldownAfterLastShotSeconds: Number(cooldown),
    };
    if (onSave(name, cadence)) {
      setSaving(false);
      setName("");
    }
  };

  return (
    <fieldset className={styles.field}>
      <legend>Attack</legend>
      <label>
        <span>Saved attack</span>
        <select
          aria-label="Saved attack"
          value={chosen?.id ?? ""}
          onChange={(event) => onChoose(event.target.value || null)}
        >
          <option value="">None</option>
          {savedAttacks.map((attack) => (
            <option key={attack.id} value={attack.id}>
              {attack.name}
            </option>
          ))}
        </select>
      </label>
      <small className={styles.note} role="status">
        {chosen === null
          ? "No saved attack: the next tag is unlinked."
          : modified
            ? `Modified: the next tag will be unlinked until you use Update from sticky or Save as attack.`
            : `The next tag links to "${chosen.name}".`}
      </small>
      <div className={styles.row}>
        <button type="button" onClick={() => setSaving((open) => !open)}>
          Save as attack
        </button>
        {chosen && (
          <>
            <button type="button" onClick={onUpdate}>
              Update from sticky
            </button>
            <button type="button" onClick={onDelete}>
              Delete saved attack
            </button>
          </>
        )}
      </div>
      {saving && (
        <div className={styles.row}>
          <label>
            <span>Name</span>
            <input
              type="text"
              aria-label="Saved attack name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>Shots per burst</span>
            <input
              type="number"
              min="1"
              step="1"
              aria-label="Saved attack shots per burst"
              value={shotsPerBurst}
              onChange={(event) => setShotsPerBurst(event.target.value)}
            />
          </label>
          {showInterval && (
            <label>
              <span>Shot interval, seconds (typed estimate)</span>
              <input
                type="number"
                step="any"
                aria-label="Saved attack shot interval in seconds"
                value={interval}
                onChange={(event) => setIntervalText(event.target.value)}
              />
            </label>
          )}
          <label>
            <span>Cooldown after the last shot, seconds (typed estimate)</span>
            <input
              type="number"
              step="any"
              aria-label="Saved attack cooldown in seconds"
              value={cooldown}
              onChange={(event) => setCooldown(event.target.value)}
            />
          </label>
          <button type="button" onClick={submit}>
            Save
          </button>
          <button type="button" onClick={() => setSaving(false)}>
            Cancel
          </button>
        </div>
      )}
      {chosen && (
        <div className={styles.row}>
          <label>
            <span>Rename</span>
            <input
              type="text"
              aria-label="Rename saved attack"
              value={renameText ?? chosen.name}
              onChange={(event) => setRenameText(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (onRename(renameText ?? chosen.name)) setRenameText(null);
            }}
          >
            Rename saved attack
          </button>
        </div>
      )}
      <small className={styles.note}>
        A saved attack keeps the sticky attack fields and a typed cadence. Its
        values are estimates, never measured from tag times.
      </small>
    </fieldset>
  );
}
