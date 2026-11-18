import { expect, test } from "vitest";
import { CONDITION_KEYS } from "../simulation/conditions";
import {
  encounterConfigOf,
  primaryArchetype,
  type AttackSpec,
  type EncounterConfig,
  type EnemyArchetype,
  type PhaseSpawnSpec,
  type PhaseSpec,
  type ProjectileSpec,
  type SubPhaseSpec,
} from "./encounter";
import { phaseDossier } from "./phaseDossier";

const worm = encounterConfigOf("crystal-worm");
const queen = encounterConfigOf("killer-bee-queen");
const primary = primaryArchetype(worm);
const basePhase = primary.phases[0];
const baseAttack = basePhase.attacks[0];
const baseBullet = Object.values(worm.projectiles).find(
  (projectile) => projectile.type === "bullet",
) as Extract<ProjectileSpec, { type: "bullet" }>;
const baseBomb = Object.values(queen.projectiles).find(
  (projectile) => projectile.type === "bomb",
) as Extract<ProjectileSpec, { type: "bomb" }>;
const [keyOne, keyTwo] = CONDITION_KEYS;

function attack(projectileId: string): AttackSpec {
  return { ...baseAttack, id: `attack-${projectileId}`, projectileId };
}

function spawn(archetypeId: string, count: number): PhaseSpawnSpec {
  return {
    archetypeId,
    count,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 1 },
  };
}

function phase(overrides: Partial<PhaseSpec>): PhaseSpec {
  return { ...basePhase, attacks: [], subPhases: null, spawns: null, ...overrides };
}

function sub(id: string, overrides: Partial<SubPhaseSpec>): SubPhaseSpec {
  return {
    id,
    durationSeconds: 1,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    movement: null,
    attacks: [],
    spawns: null,
    ...overrides,
  };
}

function archetype(id: string, phases: PhaseSpec[]): EnemyArchetype {
  return { ...primary, id, phases };
}

const projectiles: Record<string, ProjectileSpec> = {
  pA: {
    ...baseBullet,
    id: "pA",
    damageHp: 10,
    armorPiercing: false,
    conditions: [{ key: keyOne, seconds: 2 }],
    motion: { kind: "linear" },
  } as ProjectileSpec,
  pB: {
    ...baseBullet,
    id: "pB",
    damageHp: 30,
    armorPiercing: true,
    conditions: [
      { key: keyOne, seconds: 5 },
      { key: keyTwo, seconds: 1 },
    ],
    motion: { ...baseBullet.motion, kind: "wavy" },
  } as ProjectileSpec,
  pC: {
    ...baseBomb,
    id: "pC",
    damageHp: 20,
    armorPiercing: false,
    conditions: [{ key: keyOne, seconds: 3 }],
  },
};

// Top phase throws pA (twice, once via a sub-phase) and spawns m1 from the
// phase and again from a sub-phase. m1 reaches m2 only through a sub-phase
// spawn, and m2 spawns m1 back, which would recurse forever without the
// visited guard.
const synthetic: EncounterConfig = {
  ...worm,
  projectiles,
  archetypes: {
    ...worm.archetypes,
    [worm.primaryArchetypeId]: archetype(worm.primaryArchetypeId, [
      phase({
        attacks: [attack("pA")],
        spawns: [spawn("m1", 1)],
        subPhases: [
          sub("s1", { attacks: [attack("pA")], spawns: [spawn("m1", 2)] }),
        ],
      }),
      phase({}),
    ]),
    m1: archetype("m1", [
      phase({
        attacks: [attack("pB")],
        subPhases: [
          sub("m1-a", { attacks: [attack("pC")], spawns: [spawn("m2", 2)] }),
          sub("m1-b", {}),
        ],
      }),
    ]),
    m2: archetype("m2", [
      phase({ attacks: [attack("pA")], spawns: [spawn("m1", 1)] }),
    ]),
  },
};

test("walks minions through phase and sub-phase spawns without revisiting", () => {
  const dossier = phaseDossier(synthetic, 0);
  const counts = Object.fromEntries(
    dossier.minions.map((minion) => [minion.archetypeId, minion.count]),
  );
  expect(counts).toEqual({ m1: 4, m2: 2 });
  expect(dossier.subPhaseIds).toEqual(["s1"]);
});

test("collects unique projectiles from the phase, sub-phases and minions", () => {
  const dossier = phaseDossier(synthetic, 0);
  expect(dossier.projectiles.map((projectile) => projectile.id)).toEqual([
    "pA",
    "pB",
    "pC",
  ]);
  expect(dossier.motions).toEqual(["linear", "wavy", "bomb"]);
});

test("summarises damage, armour piercing and longest conditions", () => {
  const dossier = phaseDossier(synthetic, 0);
  expect(dossier.damageRange).toEqual({ min: 10, max: 30 });
  expect(dossier.armorPiercing).toBe(true);
  expect(dossier.conditions).toEqual([
    { key: keyOne, seconds: 5 },
    { key: keyTwo, seconds: 1 },
  ]);
});

test("a phase that throws nothing has an empty summary", () => {
  const dossier = phaseDossier(synthetic, 1);
  expect(dossier.projectiles).toEqual([]);
  expect(dossier.damageRange).toBeNull();
  expect(dossier.armorPiercing).toBe(false);
  expect(dossier.conditions).toEqual([]);
  expect(dossier.motions).toEqual([]);
  expect(dossier.minions).toEqual([]);
  expect(dossier.subPhaseIds).toEqual([]);
});
