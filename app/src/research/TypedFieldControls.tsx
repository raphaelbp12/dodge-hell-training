import {
  attackFieldApplies,
  isBombSprite,
  patternTakesAim,
  type StickySelection,
  type TagChange,
  type TypedNumberField,
} from "./taggingOptions";
import type { Tag } from "./tagging";
import styles from "./TaggerRoute.module.css";

/**
 * A number input that commits on blur or Enter and restores its text when the
 * edit is refused, so a rejected value never lingers in the row.
 */
export function CommitInput({
  value,
  label,
  onCommit,
  blankAllowed = false,
  step = "1",
  caption,
}: {
  value: string;
  label: string;
  onCommit: (text: string) => boolean;
  blankAllowed?: boolean;
  step?: string;
  /** A short visible name; the `label` stays the accessible name (V16 S20). */
  caption?: string;
}) {
  const input = (
    <input
      key={value}
      className={styles.cellInput}
      type="number"
      step={step}
      aria-label={label}
      defaultValue={value}
      onBlur={(event) => {
        const text = event.currentTarget.value;
        if (text === value || (blankAllowed && text === "" && value === ""))
          return;
        if (!onCommit(text)) event.currentTarget.value = value;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
  if (caption === undefined) return input;
  return (
    <label className={styles.cellCaption}>
      <small>{caption}</small>
      {input}
    </label>
  );
}


/** Visible and accessible names for the typed estimate fields (V16 S22-S25, S11, S24). */
const FIELD_TEXT: Readonly<
  Record<TypedNumberField, { caption: string; sticky: string; row: string }>
> = {
  coneDegrees: {
    caption: "Cone °",
    sticky: "Volley cone width, degrees (typed estimate)",
    row: "Volley cone width",
  },
  fixedBearingDegrees: {
    caption: "Bearing °",
    sticky: "Fixed bearing, degrees (typed estimate)",
    row: "Fixed bearing",
  },
  frontOffsetDegrees: {
    caption: "Offset °",
    sticky: "Front offset, degrees (typed estimate)",
    row: "Front offset",
  },
  emitterRadiusTiles: {
    caption: "Radius",
    sticky: "Emitter radius, tiles (typed estimate)",
    row: "Emitter radius",
  },
  bombRangeTiles: {
    caption: "Range",
    sticky: "Bomb range, tiles (typed estimate)",
    row: "Bomb range",
  },
  bombTravelSeconds: {
    caption: "Time s",
    sticky: "Bomb flight time, seconds (typed estimate)",
    row: "Bomb flight time",
  },
  bulletSpeedTilesPerSecond: {
    caption: "Speed",
    sticky: "Bullet speed, tiles per second (typed estimate)",
    row: "Bullet speed",
  },
  bulletRangeTiles: {
    caption: "Range",
    sticky: "Bullet range, tiles (typed estimate)",
    row: "Bullet range",
  },
};

const FIELD_ORDER: readonly TypedNumberField[] = [
  "coneDegrees",
  "fixedBearingDegrees",
  "frontOffsetDegrees",
  "emitterRadiusTiles",
  "bombRangeTiles",
  "bombTravelSeconds",
  "bulletSpeedTilesPerSecond",
  "bulletRangeTiles",
];

const TARGET_DISABLED_REASON =
  'Needs a bomb sprite fired as a one-shot spread with aim "player".';

/**
 * The typed fields a field applies to, in display order. A bullet field also
 * needs the matched projectile to be a `linear` bullet (`showBullet`, S24), and
 * a targeted bomb ignores its range (S12).
 */
function visibleFields(
  shape: Pick<Tag, "pattern" | "aim" | "shots" | "spriteId" | "target">,
  showBullet: boolean,
): readonly TypedNumberField[] {
  return FIELD_ORDER.filter((field) => {
    if (!attackFieldApplies(field, shape)) return false;
    if (field === "bulletSpeedTilesPerSecond" || field === "bulletRangeTiles")
      return showBullet;
    return true;
  });
}

/** The sticky selection's typed estimate controls, shown only where they apply. */
export function StickyTypedFields({
  sticky,
  showBullet,
  onNumber,
  onTarget,
}: {
  sticky: StickySelection;
  showBullet: boolean;
  onNumber: (field: TypedNumberField, text: string) => void;
  onTarget: (targeted: boolean) => void;
}) {
  const shape = {
    pattern: sticky.pattern,
    aim: patternTakesAim(sticky.pattern) ? sticky.aim : undefined,
    shots: sticky.shots,
    spriteId: sticky.spriteId,
    target: sticky.target,
  };
  const bomb = isBombSprite(sticky.spriteId);
  const targetable = attackFieldApplies("target", shape);
  const targeted = targetable && sticky.target === "player";
  const fields = visibleFields(shape, showBullet);
  if (!bomb && fields.length === 0) return null;
  return (
    <fieldset className={styles.field}>
      <legend>Typed estimates (not measurements)</legend>
      {bomb && (
        <label>
          <input
            type="checkbox"
            checked={targeted}
            disabled={!targetable}
            onChange={(event) => onTarget(event.target.checked)}
          />
          Targets the player
        </label>
      )}
      {bomb && !targetable && (
        <small className={styles.note}>{TARGET_DISABLED_REASON}</small>
      )}
      {fields.map((field) => (
        <label key={field}>
          <span>{FIELD_TEXT[field].sticky}</span>
          <input
            type="number"
            step="any"
            aria-label={FIELD_TEXT[field].sticky}
            disabled={field === "bombRangeTiles" && targeted}
            value={targeted && field === "bombRangeTiles" ? "" : (sticky[field] ?? "")}
            onChange={(event) => onNumber(field, event.target.value)}
          />
        </label>
      ))}
      {targeted && (
        <small className={styles.note}>
          A targeted bomb lands on the player at any distance, so range does not
          apply. Flight time still does.
        </small>
      )}
      {bomb && (
        <small className={styles.note}>
          Blank keeps the matched projectile&apos;s value. Speed is calculated
          from range and time and is never shown.
        </small>
      )}
    </fieldset>
  );
}

/** A tag row's typed estimate inputs, each labelled and only where it applies. */
export function RowTypedFields({
  tag,
  index,
  showBullet,
  onEdit,
}: {
  tag: Tag;
  index: number;
  showBullet: boolean;
  onEdit: (change: TagChange) => boolean;
}) {
  const targeted = tag.target === "player";
  const fields = visibleFields(tag, showBullet).filter(
    (field) => !(field === "bombRangeTiles" && targeted),
  );
  return (
    <>
      {isBombSprite(tag.spriteId) && (
        <label className={styles.cellCaption}>
          <small>Targets</small>
          <input
            type="checkbox"
            aria-label={`Targets the player of tag ${index + 1}`}
            checked={targeted}
            disabled={!attackFieldApplies("target", tag)}
            title={attackFieldApplies("target", tag) ? undefined : TARGET_DISABLED_REASON}
            onChange={(event) =>
              onEdit({ field: "target", value: event.target.checked })
            }
          />
        </label>
      )}
      {fields.map((field) => (
        <CommitInput
          key={field}
          label={`${FIELD_TEXT[field].row} of tag ${index + 1}`}
          caption={FIELD_TEXT[field].caption}
          value={tag[field] === undefined ? "" : String(tag[field])}
          step="any"
          blankAllowed
          onCommit={(text) =>
            onEdit({ field, value: text.trim() === "" ? null : Number(text) })
          }
        />
      ))}
    </>
  );
}

/** Whether a row has any typed estimate control, so the geometry cell shows a dash otherwise. */
export function rowHasTypedFields(tag: Tag, showBullet: boolean): boolean {
  return isBombSprite(tag.spriteId) || visibleFields(tag, showBullet).length > 0;
}
