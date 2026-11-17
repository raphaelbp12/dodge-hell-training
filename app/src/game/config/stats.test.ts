import { describe, expect, test } from "vitest";
import {
  assertNonnegative,
  calculateCombatDurationSeconds,
  calculateCombatTriggerHp,
  calculateDamageHp,
  calculateEquippedStats,
  CURSE_DAMAGE_MULTIPLIER,
  derivePlayerStats,
  PALADIN_BASE_STATS,
  PALADIN_DERIVED_STATS,
  PALADIN_EQUIPMENT_BONUSES,
  PALADIN_STATS,
  STAT_RULES,
} from "./stats";

const none = { healthHp: 0, defense: 0, speed: 0, vitality: 0 };

describe("equipped stats", () => {
  test("add every bonus to the base, field by field", () => {
    expect(
      calculateEquippedStats({ healthHp: 10, defense: 2, speed: 3, vitality: 4 }, [
        { healthHp: 1, defense: 1, speed: 1, vitality: 1 },
        { healthHp: 5, defense: 0, speed: 2, vitality: 0 },
      ]),
    ).toEqual({ healthHp: 16, defense: 3, speed: 6, vitality: 5 });
  });

  test("do not change the base they were given", () => {
    const base = { ...none, healthHp: 7 };
    calculateEquippedStats(base, [{ ...none, healthHp: 3 }]);
    expect(base.healthHp).toBe(7);
  });

  test("the paladin is the base plus every equipment bonus", () => {
    const bonuses = Object.values(PALADIN_EQUIPMENT_BONUSES);
    expect(PALADIN_STATS).toEqual({
      healthHp: PALADIN_BASE_STATS.healthHp + bonuses.reduce((sum, bonus) => sum + bonus.healthHp, 0),
      defense: PALADIN_BASE_STATS.defense + bonuses.reduce((sum, bonus) => sum + bonus.defense, 0),
      speed: PALADIN_BASE_STATS.speed + bonuses.reduce((sum, bonus) => sum + bonus.speed, 0),
      vitality: PALADIN_BASE_STATS.vitality + bonuses.reduce((sum, bonus) => sum + bonus.vitality, 0),
    });
  });

  test("reject a negative or non-finite stat, in the base or in a bonus", () => {
    expect(() => calculateEquippedStats({ ...none, speed: -1 }, [])).toThrow(RangeError);
    expect(() => calculateEquippedStats(none, [{ ...none, defense: Number.NaN }])).toThrow(RangeError);
    expect(() => calculateEquippedStats(none, [{ ...none, vitality: Number.POSITIVE_INFINITY }])).toThrow(RangeError);
  });
});

describe("assertNonnegative", () => {
  test("accepts zero and positive finite numbers", () => {
    expect(() => assertNonnegative(0, "x")).not.toThrow();
    expect(() => assertNonnegative(3.5, "x")).not.toThrow();
  });

  test("names the value it rejects", () => {
    expect(() => assertNonnegative(-0.001, "rawDamageHp")).toThrow(/rawDamageHp/);
    expect(() => assertNonnegative(Number.NaN, "x")).toThrow(RangeError);
  });
});

describe("damage", () => {
  test("subtracts defense", () => {
    expect(calculateDamageHp(100, 30)).toBe(70);
  });

  test("never falls below the minimum fraction of the raw damage", () => {
    expect(calculateDamageHp(100, 500)).toBe(Math.ceil(100 * STAT_RULES.damage.minimumFraction));
  });

  test("rounds up", () => {
    expect(calculateDamageHp(10.2, 0)).toBe(11);
  });

  test("zero raw damage stays zero whatever the defense", () => {
    expect(calculateDamageHp(0, -50)).toBe(0);
  });

  test("a curse multiplies the damage before rounding", () => {
    expect(calculateDamageHp(100, 20, true)).toBe(Math.ceil(80 * CURSE_DAMAGE_MULTIPLIER));
  });

  test("negative defense adds to the damage", () => {
    expect(calculateDamageHp(50, -10)).toBe(60);
  });

  test("rejects negative raw damage and a non-finite defense", () => {
    expect(() => calculateDamageHp(-1, 0)).toThrow(RangeError);
    expect(() => calculateDamageHp(1, Number.NaN)).toThrow(/defense/);
  });
});

describe("combat", () => {
  test("the trigger HP walks the defense brackets in order", () => {
    const [first, second] = STAT_RULES.combat.defenseBrackets;
    const defense = first.widthDefense + 4;
    expect(calculateCombatTriggerHp(defense)).toBe(
      Math.floor(first.widthDefense * first.damagePerDefense + 4 * second.damagePerDefense),
    );
  });

  test("is clamped between its minimum and maximum", () => {
    expect(calculateCombatTriggerHp(0)).toBe(STAT_RULES.combat.minimumTriggerHp);
    expect(calculateCombatTriggerHp(100_000)).toBe(STAT_RULES.combat.maximumTriggerHp);
  });

  test("the duration shrinks with vitality down to its floor", () => {
    expect(calculateCombatDurationSeconds(0)).toBe(STAT_RULES.combat.baseDurationSeconds);
    expect(calculateCombatDurationSeconds(10)).toBeCloseTo(
      STAT_RULES.combat.baseDurationSeconds - 10 * STAT_RULES.combat.reductionSecondsPerVitality,
    );
    expect(calculateCombatDurationSeconds(10_000)).toBe(STAT_RULES.combat.minimumDurationSeconds);
  });

  test("reject negative inputs", () => {
    expect(() => calculateCombatTriggerHp(-1)).toThrow(RangeError);
    expect(() => calculateCombatDurationSeconds(-1)).toThrow(RangeError);
  });
});

describe("derived stats", () => {
  test("movement follows the base plus the speed share of the bonus", () => {
    const { movement } = STAT_RULES;
    expect(derivePlayerStats({ ...none, speed: movement.speedDivisor }).speedTilesPerSecond).toBeCloseTo(
      movement.baseTilesPerSecond + movement.bonusTilesPerSecond,
    );
    expect(derivePlayerStats(none).speedTilesPerSecond).toBe(movement.baseTilesPerSecond);
  });

  test("regeneration is the base plus a vitality share, halved in combat", () => {
    const { regeneration } = STAT_RULES;
    const derived = derivePlayerStats({ ...none, vitality: 10 });
    expect(derived.regenerationHpPerSecond).toBeCloseTo(
      regeneration.baseHpPerSecond + 10 * regeneration.hpPerSecondPerVitality,
    );
    expect(derived.inCombatRegenerationHpPerSecond).toBeCloseTo(
      derived.regenerationHpPerSecond * regeneration.inCombatMultiplier,
    );
  });

  test("the combat figures come from defense and vitality", () => {
    const derived = derivePlayerStats({ ...none, defense: 20, vitality: 10 });
    expect(derived.combatTriggerHp).toBe(calculateCombatTriggerHp(20));
    expect(derived.combatDurationSeconds).toBe(calculateCombatDurationSeconds(10));
  });

  test("the paladin's derived stats are derived from the paladin's stats", () => {
    expect(PALADIN_DERIVED_STATS).toEqual(derivePlayerStats(PALADIN_STATS));
  });

  test("a negative stat is rejected", () => {
    expect(() => derivePlayerStats({ ...none, defense: -1 })).toThrow(RangeError);
  });
});
