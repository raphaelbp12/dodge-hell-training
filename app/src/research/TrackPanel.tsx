import { useState } from "react";
import type { EncounterConfig } from "../game/config/encounter";
import { ProjectileSprite } from "../ui/ProjectileSprite";
import { AttackEditor } from "./AttackEditor";
import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import type { AttackChange } from "./monsterDraft";
import { segmentIdOf, type Segment, type StudyV5 } from "./study";
import styles from "./TaggerRoute.module.css";

/** Tracks at positions 1-9 are selected by their digit key (E10). */
const DIGIT_KEYED_TRACKS = 9;

const seconds = (value: number) => `${value.toFixed(3)} s`;

function SegmentSelect({
  label,
  segments,
  value,
  onChange,
}: Readonly<{
  label: string;
  segments: readonly Segment[];
  value: string;
  onChange: (segmentId: string) => void;
}>) {
  return (
    <select
      className={styles.cellSelect}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {!segments.some((segment) => segment.id === value) && (
        <option value={value}>{value} (unknown)</option>
      )}
      {segments.map((segment) => (
        <option key={segment.id} value={segment.id}>
          {segment.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Plan V20 steps 86.1 and 86.2: the Attacks step's track list, the selected
 * track's definition and marks, and the scratch track. The panel holds no
 * study state; every change goes through the route's callbacks.
 */
export function TrackPanel({
  study,
  segments,
  config,
  selectedTrackId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onReload,
  onEditAttack,
  onSetLocation,
  onSeek,
  onRemoveMark,
  onCreateFromScratch,
}: Readonly<{
  study: StudyV5;
  segments: readonly Segment[];
  config: EncounterConfig;
  selectedTrackId: string | null;
  onSelect: (trackId: string | null) => void;
  onAdd: (id: string, segmentId: string) => boolean;
  onDuplicate: (newId: string) => boolean;
  onDelete: () => void;
  onReload: () => void;
  /** Returns whether the change was accepted, so a refused input restores its text. */
  onEditAttack: (change: AttackChange) => boolean;
  onSetLocation: (segmentId: string) => void;
  onSeek: (seconds: number) => void;
  /** Removes the selected track's mark at this time, or scratch's when none is selected. */
  onRemoveMark: (timeSeconds: number) => void;
  onCreateFromScratch: (markIndices: readonly number[], id: string, segmentId: string) => boolean;
}>) {
  const firstSegmentId = segments[0]?.id ?? "";
  const [newId, setNewId] = useState("");
  const [newSegmentId, setNewSegmentId] = useState(firstSegmentId);
  const [duplicateId, setDuplicateId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [scratchId, setScratchId] = useState("");
  const [scratchSegmentId, setScratchSegmentId] = useState(firstSegmentId);
  const selected = study.tracks.find((track) => track.id === selectedTrackId) ?? null;
  const labelOf = (segmentId: string) =>
    segments.find((segment) => segment.id === segmentId)?.label ?? segmentId;
  const select = (trackId: string | null) => {
    setConfirmingDelete(false);
    onSelect(trackId);
  };
  const marks = selected
    ? [...selected.marks].sort((first, second) => first.timeSeconds - second.timeSeconds)
    : [];
  const liveChecked = [...checked].filter((index) => study.scratch[index] !== undefined);

  return (
    <section className={styles.inspectorPanel} aria-labelledby="tracks-title">
      <div className={styles.headingRow}>
        <h2 id="tracks-title">Attack tracks</h2>
        <HelpMark text={help.HELP_ATTACK_LIST} />
      </div>
      <p className={styles.note}>
        Select a track, then press <kbd>Enter</kbd> on each frame it fires. Keys <kbd>1</kbd>-
        <kbd>9</kbd> select the track at that position, <kbd>0</kbd> the scratch track.
      </p>
      <ol className={styles.attackList} aria-label="Attack tracks">
        {study.tracks.map((track, index) => {
          const projectile = config.projectiles[track.attack.projectile];
          return (
            <li key={track.id}>
              <button
                type="button"
                className={styles.attackChoice}
                aria-pressed={track.id === selectedTrackId}
                onClick={() => select(track.id)}
              >
                <span>{index < DIGIT_KEYED_TRACKS ? index + 1 : "·"}</span>{" "}
                {projectile?.appearance && (
                  <ProjectileSprite projectile={projectile} sizePixels={20} />
                )}{" "}
                <span className={styles.attackId}>{track.id}</span>{" "}
                <small>
                  {labelOf(segmentIdOf(track.location))}, {track.marks.length} marks,{" "}
                  {track.cadenceSource}
                </small>
              </button>
            </li>
          );
        })}
      </ol>
      <div className={styles.addAttack}>
        <label className={styles.field}>
          <span>
            New attack id
            <HelpMark text={help.HELP_NEW_ATTACK_ID} />
          </span>
          <input value={newId} onChange={(event) => setNewId(event.target.value)} />
        </label>
        <SegmentSelect
          label="Segment of the new attack"
          segments={segments}
          value={newSegmentId}
          onChange={setNewSegmentId}
        />
        <button
          type="button"
          onClick={() => {
            if (onAdd(newId.trim(), newSegmentId)) setNewId("");
          }}
        >
          Add attack
        </button>
        <HelpMark text={help.HELP_ADD_ATTACK} />
      </div>
      <div className={styles.addAttack}>
        <button type="button" onClick={onReload}>
          Reload from game
        </button>
      </div>
      {selected && (
        <>
          <div className={styles.addAttack}>
            <label className={styles.field}>
              <span>Copy id</span>
              <input
                aria-label={`Id of the copy of ${selected.id}`}
                value={duplicateId}
                onChange={(event) => setDuplicateId(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (onDuplicate(duplicateId.trim())) setDuplicateId("");
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className={confirmingDelete ? styles.danger : undefined}
              onClick={() => {
                if (confirmingDelete) {
                  setConfirmingDelete(false);
                  onDelete();
                } else setConfirmingDelete(true);
              }}
            >
              {confirmingDelete ? "Confirm delete" : "Delete"}
            </button>
            {confirmingDelete && (
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            )}
            <HelpMark text={help.HELP_DELETE_ATTACK} />
          </div>
          <label className={styles.field}>
            <span>Segment of {selected.id}</span>
            <SegmentSelect
              label={`Segment of ${selected.id}`}
              segments={segments}
              value={segmentIdOf(selected.location)}
              onChange={onSetLocation}
            />
          </label>
          <AttackEditor
            key={selected.id}
            attack={selected.attack}
            config={config}
            apply={onEditAttack}
          />
          <p className={styles.note}>
            {selected.endSeconds === undefined
              ? "No end mark. Press X where the attack visibly stops."
              : `End mark at ${seconds(selected.endSeconds)}; it is never exported.`}
          </p>
          {marks.length === 0 ? (
            <p className={styles.empty}>No marks on {selected.id} yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table
                className={`${styles.table} ${styles.compactTable}`}
                aria-label={`Marks of ${selected.id}`}
              >
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Kind</th>
                    <th scope="col">
                      <span className={styles.visuallyHidden}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map((mark, index) => (
                    <tr key={`${index}-${mark.timeSeconds}`}>
                      <td>
                        <button
                          type="button"
                          aria-label={`Go to mark at ${seconds(mark.timeSeconds)}`}
                          onClick={() => onSeek(mark.timeSeconds)}
                        >
                          {mark.timeSeconds.toFixed(3)}
                        </button>
                      </td>
                      <td>{mark.kind}</td>
                      <td>
                        <button
                          type="button"
                          aria-label={`Remove mark at ${seconds(mark.timeSeconds)}`}
                          onClick={() => onRemoveMark(mark.timeSeconds)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <section aria-labelledby="scratch-title">
        <div className={styles.headingRow}>
          <h3 id="scratch-title">Scratch</h3>
          <button
            type="button"
            aria-pressed={selectedTrackId === null}
            onClick={() => select(null)}
          >
            Select scratch
          </button>
        </div>
        {study.scratch.length === 0 ? (
          <p className={styles.empty}>No scratch marks.</p>
        ) : (
          <ul className={styles.attackList}>
            {study.scratch.map((mark, index) => (
              <li key={`${index}-${mark.timeSeconds}`}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={checked.has(index)}
                    onChange={(event) =>
                      setChecked((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(index);
                        else next.delete(index);
                        return next;
                      })
                    }
                  />
                  {seconds(mark.timeSeconds)}
                </label>{" "}
                <button
                  type="button"
                  aria-label={`Go to scratch mark at ${seconds(mark.timeSeconds)}`}
                  onClick={() => onSeek(mark.timeSeconds)}
                >
                  Go
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.addAttack}>
          <label className={styles.field}>
            <span>Attack id</span>
            <input
              aria-label="Id of the attack from scratch marks"
              value={scratchId}
              onChange={(event) => setScratchId(event.target.value)}
            />
          </label>
          <SegmentSelect
            label="Segment of the attack from scratch marks"
            segments={segments}
            value={scratchSegmentId}
            onChange={setScratchSegmentId}
          />
          <button
            type="button"
            disabled={liveChecked.length === 0}
            onClick={() => {
              if (onCreateFromScratch(liveChecked, scratchId.trim(), scratchSegmentId)) {
                setChecked(new Set());
                setScratchId("");
              }
            }}
          >
            Create attack from selected marks
          </button>
        </div>
      </section>
    </section>
  );
}
