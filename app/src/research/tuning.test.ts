import { describe, expect, test } from "vitest";
import {
  applyTuning,
  TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND,
  tunableValuesFor,
  type TuningStudy,
} from "./tuning";
import { resolveTags, type SavedAttack, type StoredTag, type Tag } from "./tagging";

const ATTACK: SavedAttack = {
  id: "a1",
  name: "Spiral",
  spriteId: "red-glaive",
  pattern: "rotating-arm",
  shots: 4,
  clockwiseDegreesPerSecond: 90,
  cadence: { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0.4 },
};
const OTHER: SavedAttack = { ...ATTACK, id: "a2", name: "Other" };
const linked = (savedAttackId: string, timeSeconds: number): StoredTag => ({
  timeSeconds,
  phaseIndex: 0,
  savedAttackId,
});
const loose: StoredTag = {
  timeSeconds: 1,
  phaseIndex: 0,
  spriteId: "red-glaive",
  pattern: "rotating-arm",
  shots: 2,
};
const study = (): TuningStudy => ({
  tags: [linked("a1", 2), linked("a1", 5), linked("a2", 6), loose],
  savedAttacks: [ATTACK, OTHER],
});
const resolved = (value: TuningStudy) => resolveTags(value.tags, value.savedAttacks);

describe("tunableValuesFor", () => {
  const tag = (overrides: Partial<Tag> = {}): Tag => ({
    timeSeconds: 0,
    phaseIndex: 0,
    spriteId: "red-glaive",
    pattern: "rotating-arm",
    shots: 2,
    ...overrides,
  });

  test("a rotating arm tunes rate, phase and radius; a fixed ring has no rate", () => {
    expect(tunableValuesFor(tag(), undefined).map((entry) => entry.field)).toEqual([
      "clockwiseDegreesPerSecond",
      "initialPhaseDegrees",
      "emitterRadiusTiles",
    ]);
    expect(tunableValuesFor(tag({ pattern: "fixed-ring" }), undefined).map((entry) => entry.field)).toEqual([
      "emitterRadiusTiles",
    ]);
  });

  test("a spread has nothing to tune on an unlinked row", () => {
    expect(tunableValuesFor(tag({ pattern: "spread", aim: "player" }), undefined)).toEqual([]);
  });

  test("cadence appears only for a linked row, with the interval only above one shot", () => {
    const one = tunableValuesFor(tag(), ATTACK).map((entry) => entry.field);
    expect(one).toContain("shotsPerBurst");
    expect(one).not.toContain("shotIntervalSeconds");
    const three = tunableValuesFor(tag(), {
      ...ATTACK,
      cadence: { shotsPerBurst: 3, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1 },
    }).map((entry) => entry.field);
    expect(three).toContain("shotIntervalSeconds");
  });
});

describe("applyTuning", () => {
  test("a linked edit reaches every resolved tag of that attack and no other", () => {
    const result = applyTuning(study(), 0, { field: "clockwiseDegreesPerSecond", value: 200 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tags = resolved(result.study);
    expect(tags[0]!.clockwiseDegreesPerSecond).toBe(200);
    expect(tags[1]!.clockwiseDegreesPerSecond).toBe(200);
    expect(tags[2]!.clockwiseDegreesPerSecond).toBe(90);
    expect(tags[3]!.clockwiseDegreesPerSecond).toBeUndefined();
    expect(result.study.tags).toEqual(study().tags);
  });

  test("an unlinked edit reaches one row", () => {
    const result = applyTuning(study(), 3, { field: "initialPhaseDegrees", value: 45 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resolved(result.study)[3]!.initialPhaseDegrees).toBe(45);
    expect(result.study.savedAttacks).toEqual(study().savedAttacks);
  });

  test("a blank rate removes the typed value", () => {
    const result = applyTuning(study(), 0, { field: "clockwiseDegreesPerSecond", value: null });
    expect(result.ok && resolved(result.study)[0]!.clockwiseDegreesPerSecond).toBeUndefined();
  });

  test("a rejected value leaves the study unchanged", () => {
    const before = JSON.stringify(study());
    const bad = applyTuning(study(), 0, { field: "emitterRadiusTiles", value: -1 });
    expect(bad.ok).toBe(false);
    expect(applyTuning(study(), 0, { field: "cooldownAfterLastShotSeconds", value: 0 }).ok).toBe(false);
    expect(applyTuning(study(), 3, { field: "cooldownAfterLastShotSeconds", value: 1 }).ok).toBe(false);
    expect(applyTuning(study(), 9, { field: "emitterRadiusTiles", value: 1 }).ok).toBe(false);
    expect(JSON.stringify(study())).toBe(before);
  });

  test("raising shots per burst from one needs an interval", () => {
    expect(applyTuning(study(), 0, { field: "shotsPerBurst", value: 3 }).ok).toBe(false);
    const result = applyTuning(study(), 0, { field: "shotsPerBurst", value: 3, shotIntervalSeconds: 0.2 });
    expect(result.ok && result.study.savedAttacks[0]!.cadence).toEqual({
      shotsPerBurst: 3,
      shotIntervalSeconds: 0.2,
      cooldownAfterLastShotSeconds: 0.4,
    });
    if (!result.ok) return;
    const back = applyTuning(result.study, 0, { field: "shotsPerBurst", value: 1 });
    expect(back.ok && back.study.savedAttacks[0]!.cadence).toEqual({
      shotsPerBurst: 1,
      cooldownAfterLastShotSeconds: 0.4,
    });
  });

  test("values beyond the slider's bound are accepted", () => {
    const value = TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND * 3;
    const result = applyTuning(study(), 0, { field: "clockwiseDegreesPerSecond", value });
    expect(result.ok && resolved(result.study)[0]!.clockwiseDegreesPerSecond).toBe(value);
  });
});
