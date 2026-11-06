/**
 * Pure saved-attack operations (plan V16 phase 61): create, rename, update,
 * delete guard, detach and the "modified" comparison. Results are shaped like
 * `EditResult` so a failure leaves the caller's state unchanged. No React or
 * DOM here.
 */
import {
  TAG_ATTACK_FIELD_KEYS,
  type SavedAttack,
  type SavedAttackCadence,
  type StoredTag,
  type Tag,
  type TagAttackFields,
  type UnlinkedTag,
} from "./tagging";
import {
  conformAttackFields,
  createTag,
  editTag,
  stickyFromTag,
  type EditResult,
  type StickySelection,
  type TagChange,
} from "./taggingOptions";

export type SavedAttackResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: string }>;

function fail<T>(error: string): SavedAttackResult<T> {
  return { ok: false, error };
}

/** The sticky selection's attack fields, as a new tag would take them (S27: no phase). */
export function attackFieldsOfSticky(sticky: StickySelection): TagAttackFields {
  return attackFieldsOf(createTag(0, sticky));
}

/** Only the attack fields of a tag or saved attack, in a stable shape. */
export function attackFieldsOf(source: TagAttackFields): TagAttackFields {
  const fields: Record<string, unknown> = {};
  for (const key of TAG_ATTACK_FIELD_KEYS)
    if (source[key] !== undefined) fields[key] = source[key];
  return conformAttackFields(fields as unknown as TagAttackFields);
}

/** The S28 rule, with the same wording as the schema validator's paths. */
export function cadenceProblem(cadence: SavedAttackCadence): string | null {
  const { shotsPerBurst, shotIntervalSeconds, cooldownAfterLastShotSeconds } = cadence;
  if (!Number.isInteger(shotsPerBurst) || shotsPerBurst < 1)
    return "Shots per burst must be a positive whole number.";
  if (shotsPerBurst > 1) {
    if (
      shotIntervalSeconds === undefined ||
      !Number.isFinite(shotIntervalSeconds) ||
      shotIntervalSeconds <= 0
    )
      return "Shot interval must be above 0 when there is more than one shot per burst.";
  } else if (shotIntervalSeconds !== undefined)
    return "Shot interval does not apply at one shot per burst.";
  if (!Number.isFinite(cooldownAfterLastShotSeconds) || cooldownAfterLastShotSeconds <= 0)
    return "Cooldown after the last shot must be above 0.";
  return null;
}

function nameProblem(
  name: string,
  existing: readonly SavedAttack[],
  exceptId?: string,
): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Give the saved attack a name.";
  if (existing.some((entry) => entry.id !== exceptId && entry.name === trimmed))
    return `A saved attack named "${trimmed}" already exists.`;
  return null;
}

/** The next unused stable id: `attack-1`, `attack-2`, ... (S35: never shown). */
function nextId(existing: readonly SavedAttack[]): string {
  const used = new Set(existing.map((entry) => entry.id));
  let number = 1;
  while (used.has(`attack-${number}`)) number += 1;
  return `attack-${number}`;
}

export function createSavedAttack(
  name: string,
  sticky: StickySelection,
  cadence: SavedAttackCadence,
  existing: readonly SavedAttack[],
): SavedAttackResult<SavedAttack> {
  const problem = nameProblem(name, existing) ?? cadenceProblem(cadence);
  if (problem) return fail(problem);
  return {
    ok: true,
    value: {
      id: nextId(existing),
      name: name.trim(),
      ...attackFieldsOfSticky(sticky),
      cadence: {
        shotsPerBurst: cadence.shotsPerBurst,
        ...(cadence.shotsPerBurst > 1
          ? { shotIntervalSeconds: cadence.shotIntervalSeconds }
          : {}),
        cooldownAfterLastShotSeconds: cadence.cooldownAfterLastShotSeconds,
      },
    },
  };
}

/** S35: the id never changes, so every linked tag still resolves. */
export function renameSavedAttack(
  id: string,
  name: string,
  existing: readonly SavedAttack[],
): SavedAttackResult<readonly SavedAttack[]> {
  if (!existing.some((entry) => entry.id === id)) return fail("That saved attack no longer exists.");
  const problem = nameProblem(name, existing, id);
  if (problem) return fail(problem);
  return {
    ok: true,
    value: existing.map((entry) =>
      entry.id === id ? { ...entry, name: name.trim() } : entry,
    ),
  };
}

/** S33: replaces the attack fields; the id, name and cadence stay. */
export function updateFromSticky(
  attack: SavedAttack,
  sticky: StickySelection,
): SavedAttack {
  return {
    id: attack.id,
    name: attack.name,
    ...attackFieldsOfSticky(sticky),
    cadence: attack.cadence,
  };
}

/** S36: blocked, with a count, while any tag uses the attack. */
export function deleteSavedAttack(
  id: string,
  existing: readonly SavedAttack[],
  tags: readonly StoredTag[],
): SavedAttackResult<readonly SavedAttack[]> {
  const using = tags.filter((entry) => "savedAttackId" in entry && entry.savedAttackId === id).length;
  if (using > 0)
    return fail(
      `${using} tag${using === 1 ? " uses" : "s use"} this saved attack. Detach or delete ${using === 1 ? "it" : "them"} first.`,
    );
  return { ok: true, value: existing.filter((entry) => entry.id !== id) };
}

/** S32: copies the attack's values into the sticky selection, keeps its phase and chooses the attack. */
export function stickyFromSavedAttack(
  attack: SavedAttack,
  sticky: StickySelection,
): StickySelection {
  const pseudoTag: Tag = {
    ...attackFieldsOf(attack),
    timeSeconds: 0,
    phaseIndex: sticky.phaseIndex,
    savedAttackId: attack.id,
  } as Tag;
  return stickyFromTag(pseudoTag, sticky);
}

/** S32: whether the sticky attack fields differ from the chosen attack, ignoring fields the pattern ignores. */
export function isStickyModified(
  sticky: StickySelection,
  attack: SavedAttack,
): boolean {
  const left = attackFieldsOfSticky(sticky) as Record<string, unknown>;
  const right = attackFieldsOf(attack) as Record<string, unknown>;
  return TAG_ATTACK_FIELD_KEYS.some((key) => left[key] !== right[key]);
}

/** S34, S43: an unlinked tag with the attack's values, refused on a repeat row. */
export function detachTag(
  tag: StoredTag,
  attack: SavedAttack,
): SavedAttackResult<UnlinkedTag> {
  if (!("savedAttackId" in tag)) return fail("This tag is not linked to a saved attack.");
  if (tag.repeatEndSeconds !== undefined)
    return fail("Clear this repeat's end or delete the row before detaching, so no volleys vanish.");
  const { savedAttackId: _link, repeatEndSeconds: _end, repeatEndSource: _source, ...common } = tag;
  return { ok: true, value: { ...common, ...attackFieldsOf(attack) } as UnlinkedTag };
}

/**
 * The saved attack a new tag would link to: the chosen one while the sticky
 * still matches it, otherwise null (S32).
 */
export function linkedAttackIdOf(
  sticky: StickySelection,
  savedAttacks: readonly SavedAttack[],
): string | null {
  const chosen = savedAttacks.find((entry) => entry.id === sticky.savedAttackId);
  return chosen && !isStickyModified(sticky, chosen) ? chosen.id : null;
}

/** S32: a linked tag when the chosen attack is unmodified, an unlinked one otherwise. */
export function recordStoredTag(
  mediaTimeSeconds: number,
  sticky: StickySelection,
  savedAttacks: readonly SavedAttack[],
  burstId?: number,
): StoredTag {
  const attackId = linkedAttackIdOf(sticky, savedAttacks);
  if (attackId === null) return createTag(mediaTimeSeconds, sticky, burstId);
  return {
    timeSeconds: mediaTimeSeconds,
    phaseIndex: sticky.phaseIndex,
    savedAttackId: attackId,
    ...(burstId === undefined ? {} : { burstId }),
  };
}

export const DETACH_FIRST = "Detach this tag first.";

export type StoredEditResult =
  | Readonly<{ ok: true; tag: StoredTag }>
  | Readonly<{ ok: false; error: string }>;

const LINKED_EDITABLE = ["timeSeconds", "phaseIndex", "burstId"] as const;

/**
 * Edits a stored tag (S34). An unlinked tag edits as before and cannot gain a
 * saved attack. On a linked tag only time, phase and burst edit; any attack
 * field is refused with "Detach this tag first", so a linked tag never stores
 * attack values. `resolved` is the same row through `resolveTags`.
 */
export function editStoredTag(
  stored: StoredTag,
  resolved: Tag,
  change: TagChange,
  durationSeconds: number,
): StoredEditResult {
  if (!("savedAttackId" in stored)) {
    const result: EditResult = editTag(stored as Tag, change, durationSeconds);
    return result;
  }
  if (!(LINKED_EDITABLE as readonly string[]).includes(change.field))
    return { ok: false, error: DETACH_FIRST };
  const repeatEnd = stored.repeatEndSeconds;
  if (repeatEnd !== undefined) {
    // S42: the cadence already defines a repeat's bursts; a time must precede the end.
    if (change.field === "burstId" && change.value !== null)
      return { ok: false, error: "A repeat row cannot have a burst number; clear its repeat end first." };
    if (change.field === "timeSeconds" && change.value >= repeatEnd)
      return {
        ok: false,
        error: `Time must be before the repeat end (${repeatEnd.toFixed(3)} s).`,
      };
  }
  const result = editTag(resolved, change, durationSeconds);
  if (!result.ok) return result;
  const { timeSeconds, timeSource, phaseIndex, burstId } = result.tag;
  const { burstId: _burst, timeSource: _source, ...rest } = stored;
  return {
    ok: true,
    tag: {
      ...rest,
      timeSeconds,
      phaseIndex,
      ...(timeSource === undefined ? {} : { timeSource }),
      ...(burstId === undefined ? {} : { burstId }),
    },
  };
}
