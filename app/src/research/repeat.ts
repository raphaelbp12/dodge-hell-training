/**
 * Pure repeat arithmetic (plan V16 phase 62): the volley times a repeat row
 * expands to, the end rules and which row "End repeat here" targets. No React
 * or DOM here.
 */
import type { SavedAttackCadence, StoredTag } from "./tagging";

/**
 * A guard on a pathological cadence (a cooldown of nearly zero), not a game
 * value: a repeat expands to at most this many volleys.
 */
export const MAX_REPEAT_VOLLEYS = 5000;

/** Absorbs the float error in comparing a computed volley time to a typed end. */
const END_TOLERANCE_SECONDS = 1e-9;

/** S39: the time of volley `index`, computed directly so error never accumulates. */
export function volleyTime(
  startSeconds: number,
  cadence: SavedAttackCadence,
  index: number,
): number {
  const perBurst = cadence.shotsPerBurst;
  const interval = cadence.shotIntervalSeconds ?? 0;
  const burstPeriod = (perBurst - 1) * interval + cadence.cooldownAfterLastShotSeconds;
  return (
    startSeconds +
    Math.floor(index / perBurst) * burstPeriod +
    (index % perBurst) * interval
  );
}

/**
 * A row's own time when it has no end, otherwise every volley of its saved
 * attack's cadence from the row's time up to and including the end (S38, S39).
 */
export function volleyTimesOf(
  tag: Readonly<{ timeSeconds: number; repeatEndSeconds?: number }>,
  cadence: SavedAttackCadence | undefined,
): readonly number[] {
  if (tag.repeatEndSeconds === undefined || cadence === undefined)
    return [tag.timeSeconds];
  const times: number[] = [];
  for (let index = 0; index < MAX_REPEAT_VOLLEYS; index += 1) {
    const time = volleyTime(tag.timeSeconds, cadence, index);
    if (time > tag.repeatEndSeconds + END_TOLERANCE_SECONDS) break;
    times.push(time);
  }
  return times;
}

export type RepeatResult =
  | Readonly<{ ok: true; tag: StoredTag }>
  | Readonly<{ ok: false; error: string }>;

/**
 * S40, S41: sets a linked row's repeat end. A frame-derived end removes the
 * `typed` mark and a typed one sets it. Refused on an unlinked row, a row with
 * a burst number (S42), and an end not after the row's time.
 */
export function setRepeatEnd(
  tag: StoredTag,
  seconds: number,
  source: "frame" | "typed",
): RepeatResult {
  if (!("savedAttackId" in tag))
    return { ok: false, error: "Only a tag linked to a saved attack can repeat." };
  if (tag.burstId !== undefined)
    return { ok: false, error: "A tag with a burst number cannot repeat; clear its burst first." };
  if (!Number.isFinite(seconds) || seconds <= tag.timeSeconds)
    return {
      ok: false,
      error: `The repeat must end after the tag's time (${tag.timeSeconds.toFixed(3)} s).`,
    };
  const { repeatEndSource: _source, ...rest } = tag;
  return {
    ok: true,
    tag: {
      ...rest,
      repeatEndSeconds: seconds,
      ...(source === "typed" ? { repeatEndSource: "typed" as const } : {}),
    },
  };
}

/** Removes both repeat fields. */
export function clearRepeatEnd(tag: StoredTag): StoredTag {
  if (!("savedAttackId" in tag)) return tag;
  const { repeatEndSeconds: _end, repeatEndSource: _source, ...rest } = tag;
  return rest;
}

/**
 * S40: the row "End repeat here" ends: the selected row if it is linked,
 * otherwise the latest linked row of the chosen attack before the current
 * frame, otherwise null. Returns an index into `tags`.
 */
export function endRepeatTarget(
  tags: readonly StoredTag[],
  selectedIndex: number | null,
  chosenAttackId: string | null,
  currentSeconds: number,
): number | null {
  const selected = selectedIndex === null ? undefined : tags[selectedIndex];
  if (selected && "savedAttackId" in selected) return selectedIndex;
  if (chosenAttackId === null) return null;
  let best: number | null = null;
  tags.forEach((entry, index) => {
    if (!("savedAttackId" in entry) || entry.savedAttackId !== chosenAttackId) return;
    if (entry.timeSeconds >= currentSeconds) return;
    if (best === null || entry.timeSeconds >= tags[best].timeSeconds) best = index;
  });
  return best;
}
