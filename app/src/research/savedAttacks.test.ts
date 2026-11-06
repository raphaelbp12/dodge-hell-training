import { describe, expect, test } from "vitest";
import {
  createSavedAttack,
  deleteSavedAttack,
  detachTag,
  DETACH_FIRST,
  editStoredTag,
  linkedAttackIdOf,
  recordStoredTag,
  isStickyModified,
  renameSavedAttack,
  stickyFromSavedAttack,
  updateFromSticky,
} from "./savedAttacks";
import {
  resolveTags,
  validateObservationExport,
  type SavedAttack,
  type StoredTag,
} from "./tagging";
import {
  assignBurst,
  createTag,
  readoutInterval,
  type StickySelection,
} from "./taggingOptions";

const STICKY: StickySelection = {
  phaseIndex: 2,
  spriteId: "red-glaive",
  pattern: "rotating-arm",
  aim: "player",
  shots: 4,
  clockwiseDegreesPerSecond: 90,
};
const CADENCE = { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0.4 };

function made(name = "Spiral", existing: readonly SavedAttack[] = []): SavedAttack {
  const result = createSavedAttack(name, STICKY, CADENCE, existing);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function exportOf(
  savedAttacks: readonly SavedAttack[],
  tags: readonly StoredTag[] = [],
): unknown {
  return {
    schemaVersion: 3,
    encounterId: "killer-bee-queen",
    provenance: { sourceUrl: null, fileName: "a.mp4", frameRate: 30, durationSeconds: 100 },
    recordedAt: "2026-11-06T12:00:00.000Z",
    savedAttacks,
    tags,
  };
}

describe("createSavedAttack", () => {
  test("takes the sticky attack fields without the phase and the next stable id", () => {
    const first = made();
    expect(first).toMatchObject({
      id: "attack-1",
      name: "Spiral",
      spriteId: "red-glaive",
      pattern: "rotating-arm",
      shots: 4,
      clockwiseDegreesPerSecond: 90,
      cadence: CADENCE,
    });
    expect(first).not.toHaveProperty("phaseIndex");
    expect(made("Other", [first]).id).toBe("attack-2");
    expect(() => validateObservationExport(exportOf([first]))).not.toThrow();
  });

  test("a gap in ids is reused and a name is trimmed", () => {
    const second = { ...made("B"), id: "attack-2" };
    expect(made("  Ring  ", [second]).id).toBe("attack-1");
    expect(made("  Ring  ", [second]).name).toBe("Ring");
  });

  test("rejects a blank or duplicate name", () => {
    expect(createSavedAttack("  ", STICKY, CADENCE, []).ok).toBe(false);
    expect(createSavedAttack("Spiral", STICKY, CADENCE, [made()]).ok).toBe(false);
  });

  test("applies the cadence rule", () => {
    const bad = [
      { shotsPerBurst: 0, cooldownAfterLastShotSeconds: 1 },
      { shotsPerBurst: 3, cooldownAfterLastShotSeconds: 1 },
      { shotsPerBurst: 3, shotIntervalSeconds: 0, cooldownAfterLastShotSeconds: 1 },
      { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1 },
      { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0 },
    ];
    for (const cadence of bad)
      expect(createSavedAttack("X", STICKY, cadence, []).ok).toBe(false);
    const three = createSavedAttack(
      "Three",
      STICKY,
      { shotsPerBurst: 3, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1 },
      [],
    );
    expect(three.ok && three.value.cadence).toEqual({
      shotsPerBurst: 3,
      shotIntervalSeconds: 0.1,
      cooldownAfterLastShotSeconds: 1,
    });
  });
});

describe("renameSavedAttack", () => {
  test("keeps the id so linked tags still resolve, and rejects duplicates", () => {
    const attack = made();
    const other = made("Other", [attack]);
    const renamed = renameSavedAttack(attack.id, "Renamed", [attack, other]);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    const tags: StoredTag[] = [{ timeSeconds: 1, phaseIndex: 0, savedAttackId: attack.id }];
    expect(() => resolveTags(tags, renamed.value)).not.toThrow();
    expect(renamed.value[0]!.name).toBe("Renamed");
    expect(renameSavedAttack(attack.id, "Other", [attack, other]).ok).toBe(false);
    expect(renameSavedAttack(attack.id, " ", [attack, other]).ok).toBe(false);
    expect(renameSavedAttack(attack.id, "Spiral", [attack, other]).ok).toBe(true);
  });
});

describe("updateFromSticky", () => {
  test("replaces the attack fields and leaves name and cadence", () => {
    const updated = updateFromSticky(made(), { ...STICKY, shots: 7, clockwiseDegreesPerSecond: undefined });
    expect(updated).toMatchObject({ id: "attack-1", name: "Spiral", shots: 7, cadence: CADENCE });
    expect(updated).not.toHaveProperty("clockwiseDegreesPerSecond");
  });
});

describe("deleteSavedAttack", () => {
  test("is blocked with a count while any tag uses it", () => {
    const attack = made();
    const tags: StoredTag[] = [
      { timeSeconds: 1, phaseIndex: 0, savedAttackId: attack.id },
      { timeSeconds: 2, phaseIndex: 0, savedAttackId: attack.id },
    ];
    const blocked = deleteSavedAttack(attack.id, [attack], tags);
    expect(blocked.ok).toBe(false);
    expect(!blocked.ok && blocked.error).toContain("2 tags");
    const freed = deleteSavedAttack(attack.id, [attack], []);
    expect(freed).toEqual({ ok: true, value: [] });
  });
});

describe("stickyFromSavedAttack and isStickyModified", () => {
  test("copies values, keeps the phase, chooses the attack and is then unmodified", () => {
    const attack = made();
    const sticky = stickyFromSavedAttack(attack, { ...STICKY, phaseIndex: 5, shots: 9, clockwiseDegreesPerSecond: 1 });
    expect(sticky).toMatchObject({ phaseIndex: 5, shots: 4, clockwiseDegreesPerSecond: 90, savedAttackId: attack.id });
    expect(isStickyModified(sticky, attack)).toBe(false);
    expect(isStickyModified({ ...sticky, shots: 5 }, attack)).toBe(true);
  });

  test("ignores fields the pattern ignores", () => {
    const attack = made();
    const sticky = stickyFromSavedAttack(attack, STICKY);
    expect(isStickyModified({ ...sticky, coneDegrees: 40, bombRangeTiles: 3 }, attack)).toBe(false);
  });
});

describe("detachTag", () => {
  test("gives an unlinked tag whose resolved values are unchanged", () => {
    const attack = made();
    const linked: StoredTag = { timeSeconds: 3, phaseIndex: 1, savedAttackId: attack.id, burstId: 2 };
    const detached = detachTag(linked, attack);
    expect(detached.ok).toBe(true);
    if (!detached.ok) return;
    expect(detached.value).not.toHaveProperty("savedAttackId");
    const [before] = resolveTags([linked], [attack]);
    const [after] = resolveTags([detached.value], []);
    const { savedAttackId: _link, ...beforeValues } = before!;
    expect(after).toEqual(beforeValues);
  });

  test("is refused on a repeat row and on an unlinked tag", () => {
    const attack = made();
    expect(
      detachTag({ timeSeconds: 3, phaseIndex: 1, savedAttackId: attack.id, repeatEndSeconds: 9 }, attack).ok,
    ).toBe(false);
    expect(detachTag(createTag(1, STICKY), attack).ok).toBe(false);
  });
});

describe("recording and editing linked tags (V16 step 61.2)", () => {
  test("records a linked tag when unmodified and an unlinked one when modified", () => {
    const attack = made();
    const chosen = stickyFromSavedAttack(attack, STICKY);
    expect(recordStoredTag(5, chosen, [attack], 2)).toEqual({
      timeSeconds: 5,
      phaseIndex: 2,
      savedAttackId: attack.id,
      burstId: 2,
    });
    const modified = recordStoredTag(5, { ...chosen, shots: 9 }, [attack]);
    expect(modified).toMatchObject({ shots: 9 });
    expect(modified).not.toHaveProperty("savedAttackId");
    expect(linkedAttackIdOf({ ...chosen, savedAttackId: "gone" }, [attack])).toBeNull();
  });

  test("burst continuation joins linked tags of one attack and not another", () => {
    const first = made("A");
    const second = made("B", [first]);
    const sticky = (attack: SavedAttack) => stickyFromSavedAttack(attack, STICKY);
    const tags = resolveTags(
      [recordStoredTag(1, sticky(first), [first, second], 3)],
      [first, second],
    );
    expect(assignBurst(tags, sticky(first), "continue", first.id)).toBe(3);
    expect(assignBurst(tags, sticky(second), "continue", second.id)).toBeNull();
    expect(assignBurst(tags, STICKY, "continue", null)).toBeNull();
  });

  test("the readout matches an unlinked group's", () => {
    const attack = made();
    const sticky = stickyFromSavedAttack(attack, STICKY);
    const linkedTags = resolveTags(
      [recordStoredTag(1, sticky, [attack]), recordStoredTag(3.5, sticky, [attack])],
      [attack],
    );
    expect(readoutInterval(linkedTags, sticky, attack.id)).toBe(2.5);
    const plain = [createTag(1, STICKY), createTag(3.5, STICKY)];
    expect(readoutInterval(plain, STICKY)).toBe(2.5);
  });

  test("a linked tag edits time, phase and burst but refuses attack fields", () => {
    const attack = made();
    const stored: StoredTag = { timeSeconds: 3, phaseIndex: 1, savedAttackId: attack.id };
    const [resolved] = resolveTags([stored], [attack]);
    const timed = editStoredTag(stored, resolved!, { field: "timeSeconds", value: 4 }, 100);
    expect(timed).toEqual({
      ok: true,
      tag: { ...stored, timeSeconds: 4, timeSource: "typed" },
    });
    expect(editStoredTag(stored, resolved!, { field: "phaseIndex", value: 2 }, 100).ok).toBe(true);
    const burst = editStoredTag(stored, resolved!, { field: "burstId", value: 2 }, 100);
    expect(burst.ok && burst.tag).toMatchObject({ burstId: 2 });
    const refused = editStoredTag(stored, resolved!, { field: "shots", value: 9 }, 100);
    expect(refused).toEqual({ ok: false, error: DETACH_FIRST });
    expect(editStoredTag(stored, resolved!, { field: "timeSeconds", value: 500 }, 100).ok).toBe(false);
  });

  test("an unlinked tag edits as before and gains no link", () => {
    const stored = createTag(1, STICKY);
    const edited = editStoredTag(stored, stored, { field: "shots", value: 6 }, 100);
    expect(edited.ok && edited.tag).toMatchObject({ shots: 6 });
    expect(edited.ok && edited.tag).not.toHaveProperty("savedAttackId");
  });
});

describe("repeat row edits (V16 step 62.1)", () => {
  test("rejects a burst number and a time at or after the end", () => {
    const attack = made();
    const stored: StoredTag = {
      timeSeconds: 3,
      phaseIndex: 1,
      savedAttackId: attack.id,
      repeatEndSeconds: 9,
    };
    const [resolved] = resolveTags([stored], [attack]);
    expect(editStoredTag(stored, resolved!, { field: "burstId", value: 2 }, 100).ok).toBe(false);
    expect(editStoredTag(stored, resolved!, { field: "burstId", value: null }, 100).ok).toBe(true);
    expect(editStoredTag(stored, resolved!, { field: "timeSeconds", value: 9 }, 100).ok).toBe(false);
    expect(editStoredTag(stored, resolved!, { field: "timeSeconds", value: 5 }, 100).ok).toBe(true);
  });
});
