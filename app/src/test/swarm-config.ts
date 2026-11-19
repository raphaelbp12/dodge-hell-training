import {
  ENCOUNTER_CONFIG,
  primaryArchetype,
  validateEncounterConfig,
  type EncounterConfig,
} from "../game/config/encounter";

/**
 * The pre-V24 Crystal Worm swarm as a synthetic fixture: the shipped worm in
 * a 19.2-tile circle, spawning on a 16.2-tile ring at 0, 10, 20 and 30 s up to
 * four at once. Plan V24 made the shipped encounter a single worm in an
 * 8.645-tile arena (DC-V24-5), so periodic-spawn and large-arena coverage
 * lives here instead (DC-V24-12).
 */
const primary = primaryArchetype(ENCOUNTER_CONFIG);
if (ENCOUNTER_CONFIG.arena.shape.kind !== "circle")
  throw new RangeError("The Crystal Worm arena must stay circular");

export const SWARM_ARENA_RADIUS_TILES = 19.2;
export const SWARM_SPAWN_RING_TILES = 16.2;

export const SWARM_CONFIG: EncounterConfig = {
  ...ENCOUNTER_CONFIG,
  arena: {
    shape: { ...ENCOUNTER_CONFIG.arena.shape, radiusTiles: SWARM_ARENA_RADIUS_TILES },
    hazards: [],
  },
  spawns: {
    ...ENCOUNTER_CONFIG.spawns,
    firstSpawnSeconds: 10,
    everySeconds: 10,
    maxConcurrent: 4,
    placement: {
      rule: "farthest-from-player",
      ringRadiusTiles: SWARM_SPAWN_RING_TILES,
    },
  },
  archetypes: {
    ...ENCOUNTER_CONFIG.archetypes,
    [primary.id]: { ...primary, spawnTiles: { x: 0, y: -SWARM_SPAWN_RING_TILES } },
  },
};
validateEncounterConfig(SWARM_CONFIG);
