import { describe, expect, test } from "vitest";
import { encounterConfigOf, primaryArchetype } from "./encounter";
import { phaseDossier } from "./phaseDossier";

const queen = encounterConfigOf("killer-bee-queen");
const worm = encounterConfigOf("crystal-worm");

describe("phaseDossier", () => {
  test("lists the Queen's sub-phases and projectiles", () => {
    const dossier = phaseDossier(queen, 1);
    expect(dossier.subPhaseIds).toEqual(["red", "blue", "yellow"]);
    expect(dossier.projectiles.length).toBeGreaterThan(0);
  });

  test("counts the nests of the Queen's phase 6", () => {
    const ids = phaseDossier(queen, 5).minions.map(
      (minion) => minion.archetypeId,
    );
    expect(ids.filter((id) => id.startsWith("killer-bee-nest-"))).toHaveLength(3);
    for (const minion of phaseDossier(queen, 5).minions.filter((m) =>
      m.archetypeId.startsWith("killer-bee-nest-"),
    ))
      expect(minion.count).toBe(1);
  });

  test("the Worm's first phase has unique projectiles", () => {
    const dossier = phaseDossier(worm, 0);
    const ids = dossier.projectiles.map((projectile) => projectile.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every projectile exists in the catalog and damage ranges are ordered", () => {
    for (const config of [queen, worm])
      primaryArchetype(config).phases.forEach((_phase, index) => {
        const dossier = phaseDossier(config, index);
        for (const projectile of dossier.projectiles)
          expect(config.projectiles[projectile.id]).toBeDefined();
        if (dossier.damageRange)
          expect(dossier.damageRange.min).toBeLessThanOrEqual(
            dossier.damageRange.max,
          );
      });
  });
});
