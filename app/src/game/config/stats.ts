import type { DerivedPlayerStats, PrimaryStats } from "../models";

export const PALADIN_BASE_STATS = {
  healthHp: 675,
  defense: 10,
  speed: 41,
  vitality: 42,
} as const satisfies PrimaryStats;

export const PALADIN_EQUIPMENT_BONUSES = {
  archonSword: { healthHp: 0, defense: 0, speed: 0, vitality: 0 },
  vengeanceArmor: { healthHp: 0, defense: 22, speed: 0, vitality: 0 },
  sealOfTheDivine: { healthHp: 0, defense: 0, speed: 0, vitality: 0 },
  ringOfParamountHealth: { healthHp: 100, defense: 0, speed: 0, vitality: 0 },
} as const satisfies Record<string, PrimaryStats>;

export const STAT_RULES = {
  movement: {
    baseTilesPerSecond: 4,
    bonusTilesPerSecond: 5.6,
    speedDivisor: 75,
  },
  regeneration: {
    baseHpPerSecond: 2,
    hpPerSecondPerVitality: 0.2407,
    inCombatMultiplier: 0.5,
  },
  damage: { minimumFraction: 0.1 },
  combat: {
    baseDurationSeconds: 7,
    reductionSecondsPerVitality: 0.04,
    minimumDurationSeconds: 1,
    minimumTriggerHp: 1,
    maximumTriggerHp: 60,
    defenseBrackets: [
      { widthDefense: 15, damagePerDefense: 1 },
      { widthDefense: 20, damagePerDefense: 0.75 },
      { widthDefense: 30, damagePerDefense: 0.5 },
      { widthDefense: 60, damagePerDefense: 0.25 },
    ],
  },
} as const;

export function assertNonnegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and nonnegative`);
  }
}

function validateStats(stats: PrimaryStats): void {
  for (const [name, value] of Object.entries(stats)) {
    assertNonnegative(value, name);
  }
}

export function calculateEquippedStats(
  base: PrimaryStats,
  bonuses: readonly PrimaryStats[],
): PrimaryStats {
  validateStats(base);
  const equipped = bonuses.reduce(
    (totals, bonus) => {
      validateStats(bonus);
      return {
        healthHp: totals.healthHp + bonus.healthHp,
        defense: totals.defense + bonus.defense,
        speed: totals.speed + bonus.speed,
        vitality: totals.vitality + bonus.vitality,
      };
    },
    { ...base },
  );
  validateStats(equipped);
  return equipped;
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

/** Sourced from the status-effects wiki page (Curse: "+25% incoming damage"). */
export const CURSE_DAMAGE_MULTIPLIER = 1.25;

export function calculateDamageHp(
  rawDamageHp: number,
  defense: number,
  cursed = false,
): number {
  assertNonnegative(rawDamageHp, "rawDamageHp");
  assertFinite(defense, "defense");
  if (rawDamageHp === 0) return 0;
  let damage = Math.max(
    rawDamageHp - defense,
    rawDamageHp * STAT_RULES.damage.minimumFraction,
  );
  if (cursed) damage *= CURSE_DAMAGE_MULTIPLIER;
  return Math.ceil(damage);
}

export function calculateCombatTriggerHp(defense: number): number {
  assertNonnegative(defense, "defense");
  let remainingDefense = defense;
  let triggerHp = 0;
  for (const bracket of STAT_RULES.combat.defenseBrackets) {
    const contribution = Math.min(remainingDefense, bracket.widthDefense);
    triggerHp += contribution * bracket.damagePerDefense;
    remainingDefense -= contribution;
  }
  return Math.min(
    STAT_RULES.combat.maximumTriggerHp,
    Math.max(STAT_RULES.combat.minimumTriggerHp, Math.floor(triggerHp)),
  );
}

export function calculateCombatDurationSeconds(vitality: number): number {
  assertNonnegative(vitality, "vitality");
  return Math.max(
    STAT_RULES.combat.minimumDurationSeconds,
    STAT_RULES.combat.baseDurationSeconds -
      STAT_RULES.combat.reductionSecondsPerVitality * vitality,
  );
}

export function derivePlayerStats(stats: PrimaryStats): DerivedPlayerStats {
  validateStats(stats);
  const regenerationHpPerSecond =
    STAT_RULES.regeneration.baseHpPerSecond +
    STAT_RULES.regeneration.hpPerSecondPerVitality * stats.vitality;
  return {
    speedTilesPerSecond:
      STAT_RULES.movement.baseTilesPerSecond +
      (STAT_RULES.movement.bonusTilesPerSecond * stats.speed) /
        STAT_RULES.movement.speedDivisor,
    regenerationHpPerSecond,
    inCombatRegenerationHpPerSecond:
      regenerationHpPerSecond * STAT_RULES.regeneration.inCombatMultiplier,
    combatDurationSeconds: calculateCombatDurationSeconds(stats.vitality),
    combatTriggerHp: calculateCombatTriggerHp(stats.defense),
  };
}

export const PALADIN_STATS = calculateEquippedStats(
  PALADIN_BASE_STATS,
  Object.values(PALADIN_EQUIPMENT_BONUSES),
);
export const PALADIN_DERIVED_STATS = derivePlayerStats(PALADIN_STATS);
