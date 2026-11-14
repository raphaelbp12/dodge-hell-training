/**
 * Pure timeline preview for the tagger (plan V18 phase 75, plan V20
 * step 86.4): the volleys of a cadence inside a segment window, and one
 * preview frame of a study's tracks, observed or fitted. It runs no simulation
 * and owns no clock; the video's `mediaTime` is the only time it reads (M01, L32).
 */
import {
  attackSpecFromAuthored,
  degreesToRadians,
  type AttackSpec,
  type EncounterConfig,
  type ProjectileSpec,
} from "../game/config/encounter";
import type { AuthoredAttack } from "../game/config/data";
import type { Vector2 } from "../game/models";
import { BOMB_EXPLOSION_FRAME_SECONDS } from "../game/phaser/appearance-pixels";
import { resolveBombDestination } from "../game/simulation/bombs";
import { resolveBearings } from "../game/simulation/patterns";
import { splitGaps } from "./cadenceFit";
import { windowAt, windowsForTrack, type Segment, type SegmentWindow, type StudyV5 } from "./study";
import {
  drawnLifetimeSeconds,
  emitterTilesOf,
  evenDrawsFor,
  poseAtAge,
  type PreviewDetonation,
  type PreviewFrame,
  type PreviewProjectile,
} from "./previewModel";

export type BlockWindow = Readonly<{
  blockId: string;
  anchorSeconds: number;
  /** L20: the anchor plus the block's telegraph. */
  epochSeconds: number;
  /** L19, L34: where the block stops firing. */
  endSeconds: number;
}>;

export type DraftVolley = Readonly<{
  timeSeconds: number;
  /** The burst group `g` of the formula, which the game calls `burstsFired`. */
  burstIndex: number;
  /** The shot `s` inside the burst. */
  volleyIndex: number;
}>;

type Cadence = AuthoredAttack["cadence"];

/**
 * Every volley of `cadence` that fired at or before `timeSeconds`, before the
 * window's end, and is still inside `lifetimeSeconds` of flight. The first
 * relevant burst is found by arithmetic, so cost follows the lifetime and not
 * the distance from the anchor.
 *
 *   volleyTime(g, s) = epoch + initialDelay + g * burstPeriod + s * interval
 */
export function draftVolleysLiveAt(
  cadence: Cadence,
  window: BlockWindow,
  timeSeconds: number,
  lifetimeSeconds: number,
): readonly DraftVolley[] {
  const { shotsPerBurst, shotIntervalSeconds, cooldownAfterLastShotSeconds } = cadence;
  const burstPeriod =
    (shotsPerBurst - 1) * shotIntervalSeconds + cooldownAfterLastShotSeconds;
  const base = window.epochSeconds + cadence.initialDelaySeconds;
  const burstSpan = (shotsPerBurst - 1) * shotIntervalSeconds;
  const lastBurst = Math.floor((timeSeconds - base) / burstPeriod);
  if (lastBurst < 0) return [];
  const firstBurst = Math.max(
    0,
    Math.floor((timeSeconds - lifetimeSeconds - base - burstSpan) / burstPeriod),
  );
  const volleys: DraftVolley[] = [];
  for (let burstIndex = firstBurst; burstIndex <= lastBurst; burstIndex += 1)
    for (let volleyIndex = 0; volleyIndex < shotsPerBurst; volleyIndex += 1) {
      const volleyTime =
        base + burstIndex * burstPeriod + volleyIndex * shotIntervalSeconds;
      if (volleyTime > timeSeconds || volleyTime >= window.endSeconds) continue;
      if (timeSeconds - volleyTime >= lifetimeSeconds) continue;
      volleys.push({ timeSeconds: volleyTime, burstIndex, volleyIndex });
    }
  return volleys;
}

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
  ghost?: boolean;
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
  const ghost = input.ghost ? { ghost: true } : {};
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
      projectiles.push({ tagIndex, appearance, ...pose, ...ghost });
      continue;
    }
    if (projectile.type !== "bomb" || !appearance.bomb) continue;
    const sinceLandingSeconds = ageSeconds - projectile.travelSeconds;
    if (sinceLandingSeconds >= 0 && sinceLandingSeconds < explosionSeconds)
      detonations.push({
        tagIndex,
        ...ghost,
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

/** Plan V20 step 86.4: a segment window as the block window `draftVolleysLiveAt` reads. */
export function windowsFromBoundaries(windows: readonly SegmentWindow[]): readonly BlockWindow[] {
  return windows.map((window) => ({
    blockId: window.segmentId,
    anchorSeconds: window.startSeconds,
    epochSeconds: window.epochSeconds,
    endSeconds: window.endSeconds,
  }));
}

type TimelinePreviewInput = Readonly<{
  study: StudyV5;
  segments: readonly Segment[];
  windows: readonly SegmentWindow[];
  config: EncounterConfig;
  timeSeconds: number;
  playerTiles: Vector2;
  headingRadians: number;
}>;

/**
 * Plan V20 step 87.1: a bomb track's measured flight time and range replace
 * the catalog's, so an observed bomb explodes where the marks say.
 */
function withProjectileOverride(
  projectile: ProjectileSpec,
  track: StudyV5["tracks"][number],
): ProjectileSpec {
  const override = track.projectileOverride;
  if (projectile.type !== "bomb" || override === undefined) return projectile;
  return {
    ...projectile,
    ...(override.travelSeconds === undefined ? {} : { travelSeconds: override.travelSeconds }),
    ...(override.rangeTiles === undefined ? {} : { rangeTiles: override.rangeTiles }),
  };
}

/**
 * Draws one volley list per track into a frame. A projectile's `tagIndex` is
 * its track's index in the study, so the selected track can be highlighted.
 */
function timelineFrame(
  input: TimelinePreviewInput,
  ghost: boolean,
  withOverride: boolean,
  volleysOf: (
    track: StudyV5["tracks"][number],
    lifetimeSeconds: number,
  ) => readonly Readonly<{ volley: DraftVolley; epochSeconds: number }>[],
): DraftFrame {
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
    const projectile = withOverride ? withProjectileOverride(catalog, track) : catalog;
    for (const { volley, epochSeconds } of volleysOf(track, lifetimeOf(projectile))) {
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
        ghost,
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

/** E12: every track's accepted cadence in its windows, as ghosts. */
export function fittedPreviewAt(input: TimelinePreviewInput): DraftFrame {
  return timelineFrame(input, true, false, (track, lifetimeSeconds) =>
    windowsFromBoundaries(windowsForTrack(input.windows, track.location))
      .filter((window) => window.anchorSeconds <= input.timeSeconds)
      .flatMap((window) =>
        draftVolleysLiveAt(track.attack.cadence, window, input.timeSeconds, lifetimeSeconds).map(
          (volley) => ({ volley, epochSeconds: window.epochSeconds }),
        ),
      ),
  );
}

/**
 * E12: every volley mark fired as its track's attack. A mark's burst and shot
 * indices come from `splitGaps` over the marks of its window (0 outside every
 * window); a detonation mark draws nothing on its own.
 */
export function observedPreviewAt(input: TimelinePreviewInput): DraftFrame {
  return timelineFrame(input, false, true, (track, lifetimeSeconds) => {
    const trackWindows = windowsForTrack(input.windows, track.location);
    const times = track.marks
      .filter((mark) => mark.kind === "volley")
      .map((mark) => mark.timeSeconds)
      .sort((first, second) => first - second);
    const groups = new Map<SegmentWindow | null, number[]>();
    for (const time of times) {
      const window = windowAt(trackWindows, time);
      groups.set(window, [...(groups.get(window) ?? []), time]);
    }
    const drawn: { volley: DraftVolley; epochSeconds: number }[] = [];
    for (const [window, group] of groups) {
      const gaps = group.slice(1).map((time, index) => time - group[index]);
      const { classes } =
        window === null
          ? { classes: [] }
          : splitGaps(gaps, track.burstGapThresholdSeconds);
      let burstIndex = 0;
      let volleyIndex = 0;
      group.forEach((time, index) => {
        if (index > 0) {
          if (window !== null && classes[index - 1] === "cooldown") {
            burstIndex += 1;
            volleyIndex = 0;
          } else if (window !== null) volleyIndex += 1;
        }
        const ageSeconds = input.timeSeconds - time;
        if (ageSeconds < 0 || ageSeconds >= lifetimeSeconds) return;
        drawn.push({
          volley: { timeSeconds: time, burstIndex, volleyIndex },
          epochSeconds: window?.epochSeconds ?? time,
        });
      });
    }
    return drawn;
  });
}
