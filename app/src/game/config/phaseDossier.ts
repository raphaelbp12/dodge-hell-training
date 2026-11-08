import {
  archetypeOf,
  primaryArchetype,
  projectileOf,
  type AttackSpec,
  type EncounterConfig,
  type PhaseSpawnSpec,
  type ProjectileSpec,
} from "./encounter";
import type { ConditionApplication } from "../simulation/conditions";

export type PhaseDossier = Readonly<{
  projectiles: readonly ProjectileSpec[];
  damageRange: Readonly<{ min: number; max: number }> | null;
  armorPiercing: boolean;
  /** One entry per condition key, holding its longest authored duration. */
  conditions: readonly ConditionApplication[];
  /** "linear", "boomerang", "turning", "wavy" or "bomb", unique. */
  motions: readonly string[];
  minions: readonly Readonly<{ archetypeId: string; count: number }>[];
  subPhaseIds: readonly string[];
}>;

/**
 * What one top-level phase of the primary enemy throws, spawns and cycles
 * through, read straight from authored config (plan V17 3.2). Minions are
 * walked recursively because nests spawn bees.
 */
export function phaseDossier(
  config: EncounterConfig,
  phaseIndex: number,
): PhaseDossier {
  const phase = primaryArchetype(config).phases[phaseIndex];
  const subPhases = phase.subPhases ?? [];
  const attacks: AttackSpec[] = [
    ...phase.attacks,
    ...subPhases.flatMap((subPhase) => subPhase.attacks),
  ];
  const minionCounts = new Map<string, number>();
  const visited = new Set<string>();
  const walkSpawns = (spawns: readonly PhaseSpawnSpec[]) => {
    for (const spawn of spawns) {
      minionCounts.set(
        spawn.archetypeId,
        (minionCounts.get(spawn.archetypeId) ?? 0) + spawn.count,
      );
      if (visited.has(spawn.archetypeId)) continue;
      visited.add(spawn.archetypeId);
      for (const minionPhase of archetypeOf(config, spawn.archetypeId).phases) {
        attacks.push(
          ...minionPhase.attacks,
          ...(minionPhase.subPhases ?? []).flatMap((sub) => sub.attacks),
        );
        walkSpawns([
          ...(minionPhase.spawns ?? []),
          ...(minionPhase.subPhases ?? []).flatMap((sub) => sub.spawns ?? []),
        ]);
      }
    }
  };
  walkSpawns([
    ...(phase.spawns ?? []),
    ...subPhases.flatMap((subPhase) => subPhase.spawns ?? []),
  ]);

  const projectiles: ProjectileSpec[] = [];
  for (const attack of attacks) {
    const projectile = projectileOf(config, attack.projectileId);
    if (!projectiles.some((known) => known.id === projectile.id))
      projectiles.push(projectile);
  }
  const motions = [
    ...new Set(
      projectiles.map((projectile) =>
        projectile.type === "bomb" ? "bomb" : projectile.motion.kind,
      ),
    ),
  ];
  const longest = new Map<ConditionApplication["key"], number>();
  for (const projectile of projectiles)
    for (const condition of projectile.conditions)
      longest.set(
        condition.key,
        Math.max(longest.get(condition.key) ?? 0, condition.seconds),
      );
  const damages = projectiles.map((projectile) => projectile.damageHp);
  return {
    projectiles,
    damageRange: damages.length
      ? { min: Math.min(...damages), max: Math.max(...damages) }
      : null,
    armorPiercing: projectiles.some((projectile) => projectile.armorPiercing),
    conditions: [...longest].map(([key, seconds]) => ({ key, seconds })),
    motions,
    minions: [...minionCounts].map(([archetypeId, count]) => ({
      archetypeId,
      count,
    })),
    subPhaseIds: subPhases.map((subPhase) => subPhase.id),
  };
}
