import { useState } from "react";
import { AUTHORED_MONSTER_FILES, type AuthoredAttack } from "../game/config/data";
import type { EncounterConfig } from "../game/config/encounter";
import { ProjectileSprite } from "../ui/ProjectileSprite";
import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import {
  addAttack,
  blockIdOf,
  clearAnchor,
  deleteAttack,
  editAttack,
  loadMonsterDraft,
  monsterFilePath,
  monsterFileText,
  NEW_ATTACK_DEFAULTS,
  type AttackChange,
  type DraftBlock,
  type DraftLocation,
  type MonsterDraft,
} from "./monsterDraft";
import type { PhaseOption } from "./taggingOptions";
import { CommitInput } from "./TypedFieldControls";
import styles from "./TaggerRoute.module.css";

type Props = Readonly<{
  archetypeId: string;
  config: EncounterConfig;
  draft: MonsterDraft | null;
  blocks: readonly DraftBlock[];
  hasVideo: boolean;
  /**
   * The selected monster's phases and the study's one selected phase (J02).
   * The phase is chosen once, in the route's header.
   */
  phases: readonly PhaseOption[];
  phaseIndex: number;
  /** Records the presented frame's `mediaTime` for a block, guarded by the route (T19). */
  onStartsHere: (blockId: string) => void;
  /** Every accepted change; the route marks the study dirty so autosave runs. */
  onChange: (next: MonsterDraft) => void;
}>;

type Selected = Readonly<{ at: DraftLocation; id: string }>;

const KINDS = ["ring", "spread", "scatter"] as const;
const AIMS = ["player", "front", "fixed"] as const;
const ARM_KINDS = ["single", "spread", "scatter", "ring"] as const;
/** Input conveniences for a newly chosen arm pattern, not observations. */
const ARM_DEFAULTS = {
  spread: { kind: "spread", shots: 2, arcDegrees: 30 },
  scatter: { kind: "scatter", shots: 2, coneDegrees: 30 },
  ring: { kind: "ring", arms: 2 },
} as const;
const READ_ONLY_RING_FIELDS = [
  "perBurstAdvanceDegrees",
  "gapSectorsDegrees",
  "armSpreadDegreesPerSecond",
  "maxArmSpreadDegrees",
] as const;

type Pattern = Record<string, unknown>;

const CADENCE_HELP = {
  shotsPerBurst: help.HELP_SHOTS_PER_BURST,
  shotIntervalSeconds: help.HELP_SHOT_INTERVAL,
  cooldownAfterLastShotSeconds: help.HELP_COOLDOWN,
  initialDelaySeconds: help.HELP_INITIAL_DELAY,
} as const;

export function DraftPanel({
  archetypeId,
  config,
  draft,
  blocks,
  hasVideo,
  phases,
  phaseIndex,
  onStartsHere,
  onChange,
}: Props) {
  const selectedPhase = phases[phaseIndex] ?? phases[0];
  const phaseId = selectedPhase?.id ?? "";
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newIds, setNewIds] = useState<Readonly<Record<string, string>>>({});
  const [copyNote, setCopyNote] = useState<string | null>(null);
  // J01: changing phase, from either select, clears the attack editor's selection.
  const [shownPhaseId, setShownPhaseId] = useState(phaseId);
  if (shownPhaseId !== phaseId) {
    setShownPhaseId(phaseId);
    setSelected(null);
    setConfirmDelete(false);
    setConfirmLoad(false);
    setCopyNote(null);
  }

  const load = () => {
    const { draft: loaded, droppedAnchors } = loadMonsterDraft(
      AUTHORED_MONSTER_FILES[archetypeId],
      draft,
      phaseId,
    );
    onChange(loaded);
    setSelected(null);
    setError(null);
    setConfirmLoad(false);
    setNotice(
      droppedAnchors.length > 0
        ? `Dropped anchors for blocks no longer in the game: ${droppedAnchors.join(", ")}.`
        : null,
    );
  };

  const apply = (at: DraftLocation, id: string, change: AttackChange): boolean => {
    if (!draft) return false;
    const result = editAttack(draft, at, id, change, config);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setNotice(
      result.value.removed.length > 0
        ? `Removed fields that do not apply to the new kind: ${result.value.removed.join(", ")}.`
        : null,
    );
    onChange(result.value.draft);
    return true;
  };

  const locationKey = (at: DraftLocation) => blockIdOf(at.phaseId, at.subPhaseId);

  const add = (at: DraftLocation) => {
    if (!draft) return;
    const id = (newIds[locationKey(at)] ?? "").trim();
    const result = addAttack(draft, at, id, config);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(null);
    onChange(result.value);
    setNewIds((current) => ({ ...current, [locationKey(at)]: "" }));
    setSelected({ at, id });
  };

  const remove = () => {
    if (!draft || !selected) return;
    const result = deleteAttack(draft, selected.at, selected.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(result.value);
    setSelected(null);
    setConfirmDelete(false);
    setError(null);
  };

  const attackLists = (
    at: DraftLocation,
    attacks: readonly AuthoredAttack[],
  ) => (
    <div className={styles.attackGroup}>
      {attacks.length === 0 ? (
        <p className={styles.empty}>No attacks here yet.</p>
      ) : (
        <ul className={styles.attackList}>
          {attacks.map((attack) => (
            <li key={attack.id}>
              <button
                type="button"
                className={styles.attackChoice}
                aria-pressed={selected?.id === attack.id}
                onClick={() => {
                  setSelected(
                    selected?.id === attack.id ? null : { at, id: attack.id },
                  );
                  setConfirmDelete(false);
                }}
              >
                <span className={styles.attackId}>{attack.id}</span>
                <small>
                  {attack.pattern.kind}, {attack.projectile}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.addAttack}>
        <label className={styles.field}>
          <span>
            New attack id
            <HelpMark text={help.HELP_NEW_ATTACK_ID} />
          </span>
          <input
            value={newIds[locationKey(at)] ?? ""}
            onChange={(event) =>
              setNewIds((current) => ({ ...current, [locationKey(at)]: event.target.value }))
            }
          />
        </label>
        <button type="button" onClick={() => add(at)}>
          Add attack
        </button>
        <HelpMark text={help.HELP_ADD_ATTACK} />
      </div>
    </div>
  );

  const editorFor = (at: DraftLocation) =>
    selected &&
    current &&
    locationKey(selected.at) === locationKey(at) && (
      <AttackEditor
        key={`${locationKey(selected.at)}:${selected.id}`}
        attack={current}
        config={config}
        apply={(change) => apply(selected.at, selected.id, change)}
        onDelete={() => (confirmDelete ? remove() : setConfirmDelete(true))}
        confirmingDelete={confirmDelete}
        onCancelDelete={() => setConfirmDelete(false)}
      />
    );

  const exportText = draft
    ? monsterFileText(archetypeId, draft, AUTHORED_MONSTER_FILES[archetypeId], config, phaseId)
    : null;

  const copy = (text: string) => {
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      setCopyNote("Copy the text above by hand.");
      return;
    }
    clipboard.writeText(text).then(
      () => setCopyNote("Copied."),
      () => setCopyNote("Copy the text above by hand."),
    );
  };

  const current = (() => {
    if (!draft || !selected) return null;
    const phase = draft.phases.find((entry) => entry.phaseId === selected.at.phaseId);
    const owner =
      selected.at.subPhaseId === null
        ? phase
        : phase?.subPhases.find((sub) => sub.subPhaseId === selected.at.subPhaseId);
    return owner?.attacks.find((attack) => attack.id === selected.id) ?? null;
  })();

  return (
    <section className={styles.inspectorPanel} aria-labelledby="draft-title">
      <div className={styles.headingRow}>
        <h2 id="draft-title">Monster draft: {archetypeId}</h2>
        <HelpMark text={help.HELP_DRAFT_HEADING} />
      </div>
      <p className={styles.note}>
        A working copy of this monster&apos;s attacks in{" "}
        {selectedPhase?.label ?? "this phase"}. Phase and monster values are
        read-only here; change them by hand in the file.
      </p>
      <div className={draft ? styles.toolbar : styles.emptyState}>
        {!draft && (
          <p>
            Load the game&apos;s attacks to start a draft, then anchor each
            block where it starts in the video.
          </p>
        )}
        <span>
          <button
            type="button"
            className={draft ? undefined : styles.primary}
            onClick={() => (draft ? setConfirmLoad(true) : load())}
          >
            Load from game
          </button>
          <HelpMark text={help.HELP_DRAFT_LOAD} />
        </span>
      </div>
      {confirmLoad && (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirm load">
          <span>
            Loading replaces only the attacks of {phaseId} in this draft with
            the game&apos;s current ones. Other phases and anchors stay.
          </span>
          <button type="button" onClick={load}>
            Confirm
          </button>
          <button type="button" onClick={() => setConfirmLoad(false)}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.warning} role="status">
          {notice}
        </p>
      )}
      {draft && (
        <>
          {draft.phases.filter((phase) => phase.phaseId === phaseId).map((phase) => {
            const phaseBlocks = blocks.filter((block) => block.phaseId === phase.phaseId);
            return (
              <div key={phase.phaseId} className={styles.draftBody}>
                <h3 className={styles.draftStepHead}>{phase.phaseId}</h3>
                <p className={styles.draftStepLead}>
                  Anchor each block: pause on the frame where it is entered,
                  before its telegraph, and press Starts here.
                </p>
                <ul className={styles.blockList}>
                  {phaseBlocks.map((block) => {
                    const anchor = draft.anchors[block.id];
                    return (
                      <li key={block.id} className={styles.blockRow}>
                        <div className={styles.blockText}>
                          <strong>
                            {block.label}
                            <HelpMark text={help.HELP_DRAFT_BLOCK} />
                          </strong>
                          <small className={styles.note}>
                            telegraph {block.telegraphSeconds} s,{" "}
                            {block.durationSeconds === null
                              ? "no authored duration"
                              : `duration ${block.durationSeconds} s`}
                          </small>
                        </div>
                        <div className={styles.blockActions}>
                          {anchor !== undefined ? (
                            <>
                              <output
                                className={styles.anchorTime}
                                aria-label={`Anchor of ${block.label}`}
                              >
                                {anchor.toFixed(3)} s
                              </output>
                              <button
                                type="button"
                                aria-label={`Clear anchor: ${block.label}`}
                                onClick={() => onChange(clearAnchor(draft, block.id))}
                              >
                                Clear
                              </button>
                              <HelpMark text={help.HELP_CLEAR_ANCHOR} />
                            </>
                          ) : (
                            <span className={styles.unanchored}>No anchor</span>
                          )}
                          <button
                            type="button"
                            disabled={!hasVideo}
                            aria-label={`Starts here: ${block.label}`}
                            onClick={() => onStartsHere(block.id)}
                          >
                            Starts here
                          </button>
                          <HelpMark text={help.HELP_STARTS_HERE} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className={styles.draftAttacks}>
                  <p className={styles.draftStepLead}>
                    Edit the attacks. Choose one to open its editor; the
                    preview shows the draft from each anchor.
                    <HelpMark text={help.HELP_ATTACK_LIST} />
                  </p>
                  <h4>Attacks of {phase.phaseId}</h4>
                  {attackLists({ phaseId: phase.phaseId, subPhaseId: null }, phase.attacks)}
                  {editorFor({ phaseId: phase.phaseId, subPhaseId: null })}
                  {phase.subPhases.map((sub) => (
                    <div key={sub.subPhaseId}>
                      <h4>
                        Attacks of {phase.phaseId} / {sub.subPhaseId}
                      </h4>
                      {attackLists(
                        { phaseId: phase.phaseId, subPhaseId: sub.subPhaseId },
                        sub.attacks,
                      )}
                      {editorFor({ phaseId: phase.phaseId, subPhaseId: sub.subPhaseId })}
                    </div>
                  ))}
                  <p className={styles.note}>
                    A new attack starts as a single player-aimed shot every{" "}
                    {NEW_ATTACK_DEFAULTS.cadence.cooldownAfterLastShotSeconds} s:
                    a starting point to edit, not a value from the game.
                  </p>
                </div>
              </div>
            );
          })}
          <div className={styles.exportBox}>
            <p className={styles.draftStepLead}>
              Copy the monster file and paste it over{" "}
              <code>{monsterFilePath(archetypeId)}</code> by hand.
            </p>
            <div className={styles.toolbar}>
              <span>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!exportText?.ok}
                  onClick={() => exportText?.ok && copy(exportText.value)}
                >
                  Copy file
                </button>
                <HelpMark text={help.HELP_COPY_FILE} />
              </span>
              {copyNote && <span role="status">{copyNote}</span>}
            </div>
            <p className={styles.note}>
              Only {phaseId}&apos;s attacks are replaced. Nothing is written
              for you, and anchors are never included. Pasting it changes
              gameplay: the rulesVersion bump and the test updates are a
              separate approved change.
            </p>
            <details className={styles.fileText}>
              <summary>Show the file text</summary>
              <label className={styles.field}>
                <span>
                  File for {monsterFilePath(archetypeId)}
                  <HelpMark text={help.HELP_EXPORT_BOX} />
                </span>
                <textarea
                  readOnly
                  rows={14}
                  aria-label={`File text for ${archetypeId}`}
                  value={exportText?.ok ? exportText.value : (exportText?.error ?? "")}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
            </details>
          </div>
        </>
      )}
    </section>
  );
}

function AttackEditor({
  attack,
  config,
  apply,
  onDelete,
  confirmingDelete,
  onCancelDelete,
}: Readonly<{
  attack: AuthoredAttack;
  config: EncounterConfig;
  apply: (change: AttackChange) => boolean;
  onDelete: () => void;
  confirmingDelete: boolean;
  onCancelDelete: () => void;
}>) {
  const pattern = attack.pattern as unknown as Pattern;
  const kind = pattern.kind as (typeof KINDS)[number];
  const number = (key: string, label: string, helpText: string, optional = false) => (
    <CommitInput
      label={`${label} of ${attack.id}`}
      caption={label}
      help={<HelpMark text={helpText} />}
      value={pattern[key] === undefined ? "" : String(pattern[key])}
      step="any"
      blankAllowed={optional}
      onCommit={(text) => {
        if (text.trim() === "" && !optional) return false;
        return apply({
          field: "pattern",
          key,
          value: text.trim() === "" ? undefined : Number(text),
        });
      }}
    />
  );
  const armPattern = pattern.armPattern as Pattern | undefined;
  const armKind = (armPattern?.kind as string | undefined) ?? "single";
  const armKey = (key: string, label: string, helpText: string) => (
    <CommitInput
      label={`${label} of ${attack.id}`}
      caption={label}
      help={<HelpMark text={helpText} />}
      value={armPattern?.[key] === undefined ? "" : String(armPattern[key])}
      step="any"
      onCommit={(text) =>
        text.trim() !== "" &&
        apply({
          field: "pattern",
          key: "armPattern",
          value: { ...armPattern, [key]: Number(text) },
        })
      }
    />
  );
  const readOnly = READ_ONLY_RING_FIELDS.filter((key) => pattern[key] !== undefined);
  return (
    <fieldset className={styles.attackEditor} aria-label={`Editing ${attack.id}`}>
      <legend>Editing {attack.id}</legend>
      <label>
        <span>Projectile</span>
        <HelpMark text={help.HELP_ATTACK_PROJECTILE} />
        <select
          aria-label={`Projectile of ${attack.id}`}
          value={attack.projectile}
          onChange={(event) => apply({ field: "projectile", value: event.target.value })}
        >
          {Object.keys(config.projectiles).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      {config.projectiles[attack.projectile] && (
        <ProjectileSprite projectile={config.projectiles[attack.projectile]} sizePixels={32} />
      )}
      <label>
        <span>Pattern kind</span>
        <HelpMark text={help.HELP_ATTACK_KIND} />
        <select
          aria-label={`Pattern kind of ${attack.id}`}
          value={kind}
          onChange={(event) =>
            apply({ field: "patternKind", value: event.target.value as (typeof KINDS)[number] })
          }
        >
          {KINDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {kind === "ring" && (
        <>
          {number("arms", "Arms", help.HELP_RING_ARMS)}
          {number("initialPhaseDegrees", "Initial phase °", help.HELP_RING_INITIAL_PHASE)}
          {number("clockwiseDegreesPerSecond", "Rate °/s", help.HELP_RING_RATE)}
          <label>
            <span>Each arm fires</span>
        <HelpMark text={help.HELP_ARM_PATTERN} />
            <select
              aria-label={`Arm pattern of ${attack.id}`}
              value={armKind}
              onChange={(event) => {
                const choice = event.target.value as (typeof ARM_KINDS)[number];
                apply({
                  field: "pattern",
                  key: "armPattern",
                  value: choice === "single" ? undefined : ARM_DEFAULTS[choice],
                });
              }}
            >
              {ARM_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {armKind === "ring" && armKey("arms", "Arm arms", help.HELP_ARM_ARMS)}
          {(armKind === "spread" || armKind === "scatter") && armKey("shots", "Shots per arm", help.HELP_ARM_SHOTS)}
          {armKind === "spread" && armKey("arcDegrees", "Arm arc °", help.HELP_ARM_ARC)}
          {armKind === "scatter" && armKey("coneDegrees", "Arm cone °", help.HELP_ARM_CONE)}
        </>
      )}
      {kind !== "ring" && (
        <>
          {number("shots", "Shots", help.HELP_PATTERN_SHOTS)}
          {kind === "spread" ? number("arcDegrees", "Arc °", help.HELP_PATTERN_ARC) : number("coneDegrees", "Cone °", help.HELP_PATTERN_CONE)}
          <label>
            <span>Aim</span>
        <HelpMark text={help.HELP_PATTERN_AIM} />
            <select
              aria-label={`Aim of ${attack.id}`}
              value={String(pattern.aim)}
              onChange={(event) =>
                apply({ field: "aim", value: event.target.value as (typeof AIMS)[number] })
              }
            >
              {AIMS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {pattern.aim === "front" && number("offsetDegrees", "Offset °", help.HELP_PATTERN_OFFSET)}
          {pattern.aim === "fixed" && number("fixedBearingDegrees", "Bearing °", help.HELP_PATTERN_BEARING)}
        </>
      )}
      {number("emitterRadiusTiles", "Emitter radius (tiles)", help.HELP_EMITTER_RADIUS)}
      <label>
        <input
          type="checkbox"
          aria-label={`Target the player: ${attack.id}`}
          checked={attack.target === "player"}
          onChange={(event) =>
            apply({ field: "target", value: event.target.checked ? "player" : null })
          }
        />
        Lands on the player (bombs only)
        <HelpMark text={help.HELP_TARGET_PLAYER} />
      </label>
      {(
        [
          ["shotsPerBurst", "Shots per burst"],
          ["shotIntervalSeconds", "Shot interval (s)"],
          ["cooldownAfterLastShotSeconds", "Cooldown after last shot (s)"],
          ["initialDelaySeconds", "Initial delay (s)"],
        ] as const
      ).map(([key, label]) => (
        <CommitInput
          key={key}
          label={`${label} of ${attack.id}`}
          caption={label}
          help={<HelpMark text={CADENCE_HELP[key]} />}
          value={String(attack.cadence[key])}
          step="any"
          onCommit={(text) =>
            text.trim() !== "" && apply({ field: "cadence", key, value: Number(text) })
          }
        />
      ))}
      {readOnly.length > 0 && (
        <p className={styles.note}>
          Read-only, kept on export:{" "}
          {readOnly.map((key) => `${key} = ${JSON.stringify(pattern[key])}`).join("; ")}
          <HelpMark text={help.HELP_READ_ONLY_FIELDS} />
        </p>
      )}
      <div className={styles.editorFoot}>
        <button
          type="button"
          className={confirmingDelete ? styles.danger : undefined}
          onClick={onDelete}
        >
          {confirmingDelete ? "Confirm delete" : "Delete"}
        </button>
        <HelpMark text={help.HELP_DELETE_ATTACK} />
        {confirmingDelete && (
          <button type="button" onClick={onCancelDelete}>
            Cancel
          </button>
        )}
      </div>
    </fieldset>
  );
}
