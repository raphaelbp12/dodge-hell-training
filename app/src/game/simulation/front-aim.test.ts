import { expect, test } from "vitest";
import {
  ENCOUNTER_CONFIG,
  ENCOUNTER_CONFIGS,
  primaryArchetype,
  type AttackPattern,
  type EncounterConfig,
  type MovementSpec,
  type ProjectileSpec,
} from "../config/encounter";
import type { SimulationInput } from "../models";
import { advanceSimulation, createSimulation } from "./simulation";

const idle: SimulationInput = { north: false, south: false, east: false, west: false };
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const PHASE = PRIMARY.phases[0];
const stepSeconds = ENCOUNTER_CONFIG.simulation.fixedStepSeconds;

const FRONT: AttackPattern = {
  kind: "spread",
  shots: 1,
  arcDegrees: 0,
  aim: "front",
  offsetDegrees: 180,
  emitterRadiusTiles: 0,
};

function frontConfig(
  movement: MovementSpec,
  projectiles: Readonly<Record<string, ProjectileSpec>> = ENCOUNTER_CONFIG.projectiles,
  projectileId = PHASE.attacks[0].projectileId,
): EncounterConfig {
  return {
    ...ENCOUNTER_CONFIG,
    projectiles,
    archetypes: {
      [PRIMARY.id]: {
        ...PRIMARY,
        initialHeadingDegrees: 90,
        phases: [
          {
            ...PHASE,
            movement,
            attacks: [
              {
                id: "front-shot",
                projectileId,
                tuningSource: "trainer-authored",
                pattern: FRONT,
                cadence: {
                  shotsPerBurst: 1,
                  shotIntervalSeconds: 1,
                  cooldownAfterLastShotSeconds: 0.5,
                  initialDelaySeconds: 0,
                },
              },
            ],
          },
        ],
      },
    },
  };
}

test("a stationary enemy fires behind its initial heading", () => {
  const state = createSimulation(frontConfig({ kind: "stationary" }), 1);
  advanceSimulation(state, stepSeconds, idle);
  // Heading 90 degrees (down the screen); 180 behind is -90 degrees (up).
  const bearing = state.shards[0].orientationRadians;
  expect(Math.cos(bearing)).toBeCloseTo(0, 12);
  expect(Math.sin(bearing)).toBeCloseTo(-1, 12);
});

test("the bearing follows the heading as the enemy moves", () => {
  const state = createSimulation(
    frontConfig({ kind: "move-to-point", target: "arena-center", speedTilesPerSecond: 0.5 }),
    1,
  );
  const [enemy] = state.enemies;
  enemy.positionTiles = {
    x: state.config.arena.shape.centerTiles.x - 5,
    y: state.config.arena.shape.centerTiles.y,
  };
  advanceSimulation(state, stepSeconds, idle);
  // Moving east (heading 0): behind is pi.
  expect(Math.cos(state.shards[0].orientationRadians)).toBeLessThan(-0.999);
});

test("a front-aimed bomb lands at rangeTiles along that bearing", () => {
  const queen = ENCOUNTER_CONFIGS["killer-bee-queen"];
  const state = createSimulation(
    frontConfig({ kind: "stationary" }, queen.projectiles, "white-bomb-v1"),
    1,
  );
  advanceSimulation(state, stepSeconds, idle);
  const bomb = state.bombs[0];
  const origin = state.enemies[0].positionTiles;
  expect(bomb.detonationTargetTiles.x).toBeCloseTo(origin.x, 9);
  expect(bomb.detonationTargetTiles.y).toBeCloseTo(origin.y - 1.8, 9);
});
