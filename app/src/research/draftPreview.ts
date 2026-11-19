/**
 * Pure timeline preview for the tagger (plan V18 phase 75, plan V20 step 86.4,
 * plan V23 Q17): one preview frame of what the game will fire for a study's
 * tracks. It runs no simulation and owns no clock; the video's `mediaTime` is
 * the only time it reads (M01, L32).
 */
import {
  attackSpecFromAuthored,
  degreesToRadians,
  type AttackSpec,
  type EncounterConfig,
  type ProjectileSpec,
} from "../game/config/encounter";
import type { Vector2 } from "../game/models";
import { BOMB_EXPLOSION_FRAME_SECONDS } from "../game/phaser/appearance-pixels";
import { resolveBombDestination } from "../game/simulation/bombs";
import { markedVolleysBetween } from "../game/simulation/marks";
import { resolveBearings } from "../game/simulation/patterns";
import { measuredRangeTilesOf, measuredTravelSeconds } from "./studyExport";
import { windowAt, windowsForTrack, type AttackTrack, type SegmentWindow, type StudyV6 } from "./study";
import { trackMarksOf, trackWindowsOf } from "./trackMarks";
import {
  drawnLifetimeSeconds,
  emitterTilesOf,
  evenDrawsFor,
  poseAtAge,
  type PreviewDetonation,
  type PreviewFrame,
  type PreviewProjectile,
} from "./previewModel";

export type DraftVolley = Readonly<{
  timeSeconds: number;
  /** The game's `burstsFired`. */
  burstIndex: number;
  /** The shot inside the burst, the game's `volleyIndexInBurst`. */
  volleyIndex: number;
}>;

/** How long a projectile's shot stays drawn: flight, plus a bomb's explosion. */
function explosionSecondsOf(projectile: ProjectileSpec): number {
  const bomb = projectile.appearance?.bomb;
  return bomb ? bomb.frameOuterPixels.length * BOMB_EXPLOSION_FRAME_SECONDS : 0;
}

function lifetimeOf(projectile: ProjectileSpec): number {
  return drawnLifetimeSeconds(projectile, explosionSecondsOf(projectile));
}

/**
 * Plan V20 step 86.4: one volley of one attack at one age, as the projectiles
 * in flight and the detonations showing. `epochSeconds` is the volley's
 * window epoch, which the ring phase and `secondsSinceEpoch` count from.
 */
export function projectilesOfVolley(input: {
  attack: AttackSpec;
  projectile: ProjectileSpec;
  volley: DraftVolley;
  ageSeconds: number;
  epochSeconds: number;
  emitterTiles: Vector2;
  playerTiles: Vector2;
  headingRadians: number;
  tagIndex: number;
}): Readonly<{ projectiles: PreviewProjectile[]; detonations: PreviewDetonation[] }> {
  const {
    attack,
    projectile,
    volley,
    ageSeconds,
    emitterTiles,
    playerTiles,
    headingRadians,
    tagIndex,
    epochSeconds,
  } = input;
  const appearance = projectile.appearance;
  const projectiles: PreviewProjectile[] = [];
  const detonations: PreviewDetonation[] = [];
  if (!appearance) return { projectiles, detonations };
  const explosionSeconds = explosionSecondsOf(projectile);
  const targetTiles = attack.target === "player" ? playerTiles : undefined;
  const { pattern } = attack;
  const sinceEpochSeconds = Math.max(0, volley.timeSeconds - epochSeconds);
  // L14: the game's own inputs, so per-burst advance and arm spread show.
  const bearings = resolveBearings(pattern, {
    enemyPositionTiles: emitterTiles,
    playerPositionTiles: playerTiles,
    enemyHeadingRadians: headingRadians,
    ringPhaseRadians:
      pattern.kind === "ring"
        ? pattern.initialPhaseRadians +
          degreesToRadians(pattern.clockwiseDegreesPerSecond) *
            (volley.timeSeconds - epochSeconds)
        : 0,
    volleyIndexInBurst: volley.volleyIndex,
    burstsFired: volley.burstIndex,
    secondsSinceEpoch: sinceEpochSeconds,
    drawnUnitRandoms: evenDrawsFor(pattern),
  });
  for (const bearing of bearings) {
    const spawnTiles = {
      x: emitterTiles.x + Math.cos(bearing.bearingRadians) * bearing.emitterRadiusTiles,
      y: emitterTiles.y + Math.sin(bearing.bearingRadians) * bearing.emitterRadiusTiles,
    };
    const pose = poseAtAge(
      projectile,
      spawnTiles,
      bearing.bearingRadians,
      ageSeconds,
      targetTiles,
    );
    if (pose) {
      projectiles.push({ tagIndex, appearance, ...pose });
      continue;
    }
    if (projectile.type !== "bomb" || !appearance.bomb) continue;
    const sinceLandingSeconds = ageSeconds - projectile.travelSeconds;
    if (sinceLandingSeconds >= 0 && sinceLandingSeconds < explosionSeconds)
      detonations.push({
        tagIndex,
        positionTiles: resolveBombDestination(
          projectile,
          spawnTiles,
          bearing.bearingRadians,
          targetTiles,
        ),
        radiusTiles: projectile.detonationRadiusTiles,
      });
  }
  return { projectiles, detonations };
}

export type DraftFrame = Readonly<{
  frame: PreviewFrame;
  /** L36: attacks whose projectile has no sprite, so nothing of them is drawn. */
  undrawnAttackIds: readonly string[];
}>;

export type TimelinePreviewInput = Readonly<{
  study: StudyV6;
  windows: readonly SegmentWindow[];
  config: EncounterConfig;
  timeSeconds: number;
  playerTiles: Vector2;
  headingRadians: number;
}>;

/**
 * Plan V23 Q14: a bomb track fires its measured variant, so its measured
 * flight time and range replace the catalog's, as export writes them.
 */
function withMeasuredBomb(projectile: ProjectileSpec, track: AttackTrack): ProjectileSpec {
  if (projectile.type !== "bomb") return projectile;
  const travelSeconds = measuredTravelSeconds(track);
  const rangeTiles = track.attack.target === "player" ? null : measuredRangeTilesOf(track);
  return {
    ...projectile,
    ...(travelSeconds === null ? {} : { travelSeconds }),
    ...(rangeTiles === null ? {} : { rangeTiles }),
  };
}

/**
 * Plan V23 Q04, Q17: each window of the track replays the volleys
 * `markedVolleysBetween` gives for the track's exported marks, from the
 * window's start, while still drawn and before the window's end. Each volley's
 * epoch is the epoch of the segment window it falls in.
 */
export function previewVolleysOf(
  track: AttackTrack,
  windows: readonly SegmentWindow[],
  timeSeconds: number,
  lifetimeSeconds: number,
): readonly Readonly<{ volley: DraftVolley; epochSeconds: number }>[] {
  const marks = trackMarksOf(track, windows);
  if (marks === null) return [];
  const segmentWindowsOfTrack = windowsForTrack(windows, track.location);
  return trackWindowsOf(track, windows)
    .filter((window) => window.startSeconds <= timeSeconds)
    .flatMap((window) =>
      markedVolleysBetween(
        marks,
        timeSeconds - window.startSeconds - lifetimeSeconds,
        timeSeconds - window.startSeconds,
      ).flatMap((volley) => {
        const volleySeconds = window.startSeconds + volley.offsetSeconds;
        if (volleySeconds >= window.endSeconds) return [];
        return [
          {
            volley: {
              timeSeconds: volleySeconds,
              burstIndex: volley.burstIndex,
              volleyIndex: volley.shotIndex,
            },
            epochSeconds: (windowAt(segmentWindowsOfTrack, volleySeconds) ?? window).epochSeconds,
          },
        ];
      }),
    );
}

/**
 * Plan V23 Q17: one frame of what the game will fire. A projectile's
 * `tagIndex` is its track's index in the study, so the selected track can be
 * highlighted. A track export drops draws nothing.
 */
export function previewAt(input: TimelinePreviewInput): DraftFrame {
  const { study, config, timeSeconds, playerTiles, headingRadians } = input;
  const emitterTiles = emitterTilesOf(config);
  const projectiles: PreviewProjectile[] = [];
  const detonations: PreviewDetonation[] = [];
  const undrawn = new Set<string>();
  study.tracks.forEach((track, tagIndex) => {
    const attack = attackSpecFromAuthored(track.attack);
    const catalog = config.projectiles[attack.projectileId];
    if (!catalog?.appearance) {
      undrawn.add(track.id);
      return;
    }
    const projectile = withMeasuredBomb(catalog, track);
    for (const { volley, epochSeconds } of previewVolleysOf(
      track,
      input.windows,
      timeSeconds,
      lifetimeOf(projectile),
    )) {
      const drawn = projectilesOfVolley({
        attack,
        projectile,
        volley,
        ageSeconds: timeSeconds - volley.timeSeconds,
        epochSeconds,
        emitterTiles,
        playerTiles,
        headingRadians,
        tagIndex,
      });
      projectiles.push(...drawn.projectiles);
      detonations.push(...drawn.detonations);
    }
  });
  return {
    frame: {
      timeSeconds,
      arena: config.arena.shape,
      emitterTiles,
      playerTiles,
      headingRadians,
      projectiles,
      detonations,
    },
    undrawnAttackIds: [...undrawn],
  };
}
