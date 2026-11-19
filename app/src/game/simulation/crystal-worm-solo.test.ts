import { describe, expect, test } from "vitest";
import { ENCOUNTER_LIST, encounterConfigOf } from "../config/encounter";
import type { SimulationInput } from "../models";
import { convexBodyFitsArenaShape, transformBodyVertices } from "./geometry";
import { advanceSimulation, createSimulation } from "./simulation";

// Plan V24, phase 101: the Crystal Worm is a single worm in an arena sized from
// its attack's reach (DC-V24-1 to DC-V24-10).
const config = encounterConfigOf("crystal-worm");
const primary = config.archetypes[config.primaryArchetypeId];
const attack = primary.phases[0].attacks[0];
const projectile = config.projectiles[attack.projectileId];
const shape = config.arena.shape;
const seed = 20261119;
const stepSeconds = config.simulation.fixedStepSeconds;
const runSeconds = 60;

/** Cycles the player through every direction so it chases and meets walls. */
function inputAt(seconds: number): SimulationInput {
  const leg = Math.floor(seconds / 2.5) % 4;
  return {
    north: leg === 0,
    east: leg === 1,
    south: leg === 2,
    west: leg === 3,
  };
}

describe("Crystal Worm reach-sized arena (DC-V24-1, DC-V24-2, DC-V24-4)", () => {
  test("the arena radius is 70 percent of the shard's maximum reach", () => {
    if (attack.pattern.kind !== "ring") throw new Error("expected a ring");
    if (projectile.type !== "bullet" || projectile.motion.kind !== "boomerang")
      throw new Error("expected a boomerang bullet");
    if (shape.kind !== "circle") throw new Error("expected a circle arena");
    const reachTiles =
      attack.pattern.emitterRadiusTiles +
      projectile.speedTilesPerSecond * projectile.motion.reversalAgeSeconds;
    expect(Math.abs(shape.radiusTiles - 0.7 * reachTiles)).toBeLessThan(1e-9);
  });

  test("the arena radius is the authored 8.645 tiles", () => {
    if (shape.kind !== "circle") throw new Error("expected a circle arena");
    expect(shape.radiusTiles).toBe(8.645);
  });
});

describe("Crystal Worm single spawn (DC-V24-5 to DC-V24-7)", () => {
  test("the spawn rule is one worm at t = 0, never repeated", () => {
    expect(config.spawns.firstSpawnSeconds).toBe(0);
    expect(config.spawns.everySeconds).toBeNull();
    expect(config.spawns.maxConcurrent).toBe(1);
  });

  test("the opening worm spawns 7.29421875 tiles from the arena centre", () => {
    const state = createSimulation(config, seed);
    const [worm] = state.enemies;
    const distance = Math.hypot(
      worm.positionTiles.x - shape.centerTiles.x,
      worm.positionTiles.y - shape.centerTiles.y,
    );
    expect(Math.abs(distance - 7.29421875)).toBeLessThan(1e-9);
  });

  test("the archetype spawn point is the ring point due north and fits the arena", () => {
    expect(primary.spawnTiles).toEqual({ x: 0, y: -7.29421875 });
    expect(
      convexBodyFitsArenaShape(
        transformBodyVertices(primary.verticesTiles, primary.spawnTiles),
        shape,
      ),
    ).toBe(true);
  });

  test("for 60 seconds exactly the opening worm exists and every body stays inside", () => {
    const state = createSimulation(config, seed);
    // God mode keeps the clock running for the whole minute; a death would
    // stop it and end the run before a repeat spawn could appear.
    state.debugSettings = { ...state.debugSettings, godMode: true };
    expect(state.enemies).toHaveLength(1);
    const openingId = state.enemies[0].id;
    const steps = Math.round(runSeconds / stepSeconds);
    for (let step = 0; step < steps; step++) {
      advanceSimulation(state, stepSeconds, inputAt(step * stepSeconds));
      expect(state.enemies.map((enemy) => enemy.id)).toEqual([openingId]);
      expect(
        convexBodyFitsArenaShape(
          transformBodyVertices(
            config.player.verticesTiles,
            state.player.positionTiles,
          ),
          shape,
        ),
      ).toBe(true);
      expect(
        convexBodyFitsArenaShape(
          transformBodyVertices(
            primary.verticesTiles,
            state.enemies[0].positionTiles,
          ),
          shape,
        ),
      ).toBe(true);
    }
  });
});

describe("Crystal Worm identity (DC-V24-9, DC-V24-10)", () => {
  test("the rules version is the solo v1 slug", () => {
    expect(config.rulesVersion).toBe("crystal-worm-child-solo-paladin-v1");
  });

  test("the encounter list names it Crystal Worm", () => {
    expect(
      ENCOUNTER_LIST.find((entry) => entry.id === "crystal-worm")?.displayName,
    ).toBe("Crystal Worm");
  });
});
