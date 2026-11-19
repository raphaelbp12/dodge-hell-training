import type { CadencedAuthoredAttack } from "../game/config/data";
import type { EncounterConfig } from "../game/config/encounter";
import { ProjectileSprite } from "../ui/ProjectileSprite";
import { CommitInput } from "./CommitInput";
import { HelpMark } from "./HelpMark";
import * as help from "./helpText";
import type { AttackChange } from "./monsterDraft";
import styles from "./TaggerRoute.module.css";

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

/**
 * Plan V20 step 86.1: the editor of one `CadencedAuthoredAttack`, moved from
 * `DraftPanel.tsx` unchanged except that the delete button shows only when
 * `onDelete` is given.
 */
export function AttackEditor({
  attack,
  config,
  apply,
  onDelete,
  confirmingDelete,
  onCancelDelete,
}: Readonly<{
  attack: CadencedAuthoredAttack;
  config: EncounterConfig;
  apply: (change: AttackChange) => boolean;
  onDelete?: () => void;
  confirmingDelete?: boolean;
  onCancelDelete?: () => void;
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
      {onDelete && (
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
      )}
    </fieldset>
  );
}
