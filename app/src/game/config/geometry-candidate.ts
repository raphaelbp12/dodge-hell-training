import type { Vector2 } from "../models";
import {
  convexContactDistance,
  deriveShardTiming,
} from "../simulation/geometry.ts";

type CandidateBody = Readonly<{
  sourceWidthPixels: number;
  sourceHeightPixels: number;
  dimensionToleranceSourcePixels: Readonly<{ width: number; height: number }>;
  anchor: "body-center";
  orientation: "upright" | "initial-firing-axis";
  verticesTiles: readonly Vector2[];
}>;

const arenaRadiusTiles = 19.2;
const sourcePixelsPerTile = 435.118 / arenaRadiusTiles;
const shardSpeedTilesPerSecond = 8;
const emitterHeadWidthFraction = 0.1;
const enemyCenterWallMarginTiles = 3;
const groupPeriodSeconds = 2.5;
const shardsPerGroup = 44;

const beveledOutline = [
  [-0.3, -0.5],
  [0.3, -0.5],
  [0.5, -0.3],
  [0.5, 0.3],
  [0.3, 0.5],
  [-0.3, 0.5],
  [-0.5, 0.3],
  [-0.5, -0.3],
] as const;

const shardOutline = [
  [0.5, 0],
  [0.25, 0.5],
  [-0.25, 0.5],
  [-0.5, 0],
  [-0.25, -0.5],
  [0.25, -0.5],
] as const;

function createBody(
  measurements: Omit<CandidateBody, "anchor" | "verticesTiles">,
  normalizedVertices: readonly (readonly [number, number])[],
): CandidateBody {
  return {
    ...measurements,
    anchor: "body-center",
    verticesTiles: normalizedVertices.map(([horizontal, vertical]) => ({
      x: (horizontal * measurements.sourceWidthPixels) / sourcePixelsPerTile,
      y: (vertical * measurements.sourceHeightPixels) / sourcePixelsPerTile,
    })),
  };
}

const bodies = {
  player: createBody(
    {
      sourceWidthPixels: 36,
      sourceHeightPixels: 33,
      dimensionToleranceSourcePixels: { width: 2, height: 2 },
      orientation: "upright",
    },
    beveledOutline,
  ),
  head: createBody(
    {
      sourceWidthPixels: 42,
      sourceHeightPixels: 55,
      dimensionToleranceSourcePixels: { width: 2, height: 7 },
      orientation: "upright",
    },
    beveledOutline,
  ),
  shard: createBody(
    {
      sourceWidthPixels: 56.576,
      sourceHeightPixels: 34.66,
      dimensionToleranceSourcePixels: { width: 1, height: 1 },
      orientation: "initial-firing-axis",
    },
    shardOutline,
  ),
} as const;

const emitterOffsetTiles =
  (emitterHeadWidthFraction * bodies.head.sourceWidthPixels) /
  sourcePixelsPerTile;
const {
  maximumCenterDistanceTiles: maximumShardCenterDistanceTiles,
  reversalAgeSeconds,
  lifetimeSeconds,
} = deriveShardTiming(
  bodies.shard.verticesTiles,
  { x: 1, y: 0 },
  arenaRadiusTiles,
  emitterOffsetTiles,
  shardSpeedTilesPerSecond,
);

export const V2_GEOMETRY_CANDIDATE = {
  approval: "approved",
  source: "docs/mechanics.md step 8.2; G01-G04 approved 2026-10-25",
  sourcePixelsPerTile,
  arenaRadiusTiles,
  shardSpeedTilesPerSecond,
  emitterHeadWidthFraction,
  groupPeriodSeconds,
  shardsPerGroup,
  bodies,
  emitterOffsetTiles,
  maximumShardCenterDistanceTiles,
  reversalAgeSeconds,
  lifetimeSeconds,
  enemySpawnTiles: {
    x: 0,
    y: -(arenaRadiusTiles - enemyCenterWallMarginTiles),
  },
  conservativeLiveShardBound:
    shardsPerGroup * Math.ceil(lifetimeSeconds / groupPeriodSeconds),
  pursuit: {
    extraGapTiles: 0,
    eastSeparationTiles: convexContactDistance(
      bodies.player.verticesTiles,
      bodies.head.verticesTiles,
      { x: 1, y: 0 },
    ),
    southSeparationTiles: convexContactDistance(
      bodies.player.verticesTiles,
      bodies.head.verticesTiles,
      { x: 0, y: 1 },
    ),
  },
} as const;
