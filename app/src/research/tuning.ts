/**
 * Pure mapping from the selected tag row to the values the preview's tuning
 * controls edit (plan V16 phase 63, S47-S50). These are a study's typed
 * estimates only: nothing here reads or writes game data, and nothing imports a
 * game data writer.
 */
import {
  attackFieldsOf,
  cadenceProblem,
} from "./savedAttacks";
import type { SavedAttack, SavedAttackCadence, StoredTag, Tag } from "./tagging";
import { editTag } from "./taggingOptions";

/**
 * The bound of the rotation-rate slider, in degrees per second. An input
 * convenience approved in S50 with no gameplay meaning: a typed number may
 * exceed it.
 */
export const TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND = 720;

/**
 * A starting shot interval offered when a person raises shots per burst from
 * one and has typed none yet. An input convenience labelled as an estimate, not
 * a measurement and not a gameplay value.
 */
export const DEFAULT_TUNING_SHOT_INTERVAL_SECONDS = 0.1;

export type TuningField =
  | "clockwiseDegreesPerSecond"
  | "initialPhaseDegrees"
  | "emitterRadiusTiles"
  | "shotsPerBurst"
  | "shotIntervalSeconds"
  | "cooldownAfterLastShotSeconds";

export type TunableValue = Readonly<{ field: TuningField; value: number | undefined }>;

/** The S49 values that apply to a row, in display order. Empty when nothing applies. */
export function tunableValuesFor(
  tag: Tag,
  attack: SavedAttack | undefined,
): readonly TunableValue[] {
  const values: TunableValue[] = [];
  if (tag.pattern === "rotating-arm") {
    values.push({ field: "clockwiseDegreesPerSecond", value: tag.clockwiseDegreesPerSecond });
    values.push({ field: "initialPhaseDegrees", value: tag.initialPhaseDegrees });
  }
  if (tag.pattern === "rotating-arm" || tag.pattern === "fixed-ring")
    values.push({ field: "emitterRadiusTiles", value: tag.emitterRadiusTiles });
  if (attack) {
    values.push({ field: "shotsPerBurst", value: attack.cadence.shotsPerBurst });
    if (attack.cadence.shotsPerBurst > 1)
      values.push({ field: "shotIntervalSeconds", value: attack.cadence.shotIntervalSeconds });
    values.push({
      field: "cooldownAfterLastShotSeconds",
      value: attack.cadence.cooldownAfterLastShotSeconds,
    });
  }
  return values;
}

export type TuningStudy = Readonly<{
  tags: readonly StoredTag[];
  savedAttacks: readonly SavedAttack[];
}>;

export type TuningChange = Readonly<{
  field: TuningField;
  /** Null removes an optional typed value (a blank field). */
  value: number | null;
  /** Raising shots per burst above one needs an interval; supply it here (S28). */
  shotIntervalSeconds?: number;
}>;

export type TuningResult =
  | Readonly<{ ok: true; study: TuningStudy }>
  | Readonly<{ ok: false; error: string }>;

const ATTACK_FIELDS = [
  "clockwiseDegreesPerSecond",
  "initialPhaseDegrees",
  "emitterRadiusTiles",
] as const;
type AttackTuningField = (typeof ATTACK_FIELDS)[number];

function isAttackField(field: TuningField): field is AttackTuningField {
  return (ATTACK_FIELDS as readonly string[]).includes(field);
}

function withCadence(
  attack: SavedAttack,
  change: TuningChange,
): { ok: true; attack: SavedAttack } | { ok: false; error: string } {
  const { value } = change;
  if (value === null) return { ok: false, error: "That value cannot be blank." };
  let cadence: SavedAttackCadence;
  const current = attack.cadence;
  if (change.field === "shotsPerBurst") {
    if (value <= 1) {
      cadence = {
        shotsPerBurst: value,
        cooldownAfterLastShotSeconds: current.cooldownAfterLastShotSeconds,
      };
    } else {
      const interval = change.shotIntervalSeconds ?? current.shotIntervalSeconds;
      if (interval === undefined)
        return {
          ok: false,
          error: "Type a shot interval before raising shots per burst above one.",
        };
      cadence = {
        shotsPerBurst: value,
        shotIntervalSeconds: interval,
        cooldownAfterLastShotSeconds: current.cooldownAfterLastShotSeconds,
      };
    }
  } else if (change.field === "shotIntervalSeconds") {
    cadence = { ...current, shotIntervalSeconds: value };
  } else {
    cadence = { ...current, cooldownAfterLastShotSeconds: value };
  }
  const problem = cadenceProblem(cadence);
  if (problem) return { ok: false, error: problem };
  return { ok: true, attack: { ...attack, cadence } };
}

/** Routes a typed change to the saved attack or to the one row (S48). */
export function applyTuning(
  study: TuningStudy,
  tagIndex: number,
  change: TuningChange,
): TuningResult {
  const stored = study.tags[tagIndex];
  if (!stored) return { ok: false, error: "Select a tag row to tune." };
  if ("savedAttackId" in stored) {
    const attack = study.savedAttacks.find((entry) => entry.id === stored.savedAttackId);
    if (!attack) return { ok: false, error: "That tag's saved attack no longer exists." };
    let updated: SavedAttack;
    if (isAttackField(change.field)) {
      const pseudo = { ...attackFieldsOf(attack), timeSeconds: 0, phaseIndex: 0 } as Tag;
      const result = editTag(pseudo, { field: change.field, value: change.value }, 0);
      if (!result.ok) return result;
      updated = {
        id: attack.id,
        name: attack.name,
        ...attackFieldsOf(result.tag),
        cadence: attack.cadence,
      };
    } else {
      const result = withCadence(attack, change);
      if (!result.ok) return result;
      updated = result.attack;
    }
    return {
      ok: true,
      study: {
        tags: study.tags,
        savedAttacks: study.savedAttacks.map((entry) =>
          entry.id === attack.id ? updated : entry,
        ),
      },
    };
  }
  if (!isAttackField(change.field))
    return { ok: false, error: "Cadence belongs to a saved attack; this tag is unlinked." };
  const result = editTag(
    stored as Tag,
    { field: change.field, value: change.value },
    Number.POSITIVE_INFINITY,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    study: {
      tags: study.tags.map((entry, at) => (at === tagIndex ? result.tag : entry)),
      savedAttacks: study.savedAttacks,
    },
  };
}
