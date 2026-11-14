/**
 * Pure draft preview for the tagger (plan V18 phase 75): the window
 * each anchored block runs in, the volleys of a cadence inside that window, and
 * one preview frame of a monster's draft. It runs no simulation and owns no
 * clock; the video's `mediaTime` is the only time it reads (M01, L32).
 */
import {
  attackSpecFromAuthored,
  degreesToRadians,
  type EncounterConfig,
} from "../game/config/encounter";
import type { AuthoredAttack } from "../game/config/data";
import type { Vector2 } from "../game/models";
import { BOMB_EXPLOSION_FRAME_SECONDS } from "../game/phaser/appearance-pixels";
import { resolveBombDestination } from "../game/simulation/bombs";
import { resolveBearings } from "../game/simulation/patterns";
import { activeDraftAttacks, type DraftBlock, type MonsterDraft } from "./monsterDraft";
import {
  drawnLifetimeSeconds,
  emitterTilesOf,
  evenDrawsFor,
  poseAtAge,
  type PreviewDetonation,
  type PreviewFrame,
  type PreviewProjectile,
} from "./previewModel";

/** A draft shot belongs to no tag, so the tag highlight never matches it. */
export const NO_TAG_INDEX = -1;

export type BlockWindow = Readonly<{
  blockId: string;
  anchorSeconds: number;
  /** L20: the anchor plus the block's telegraph. */
  epochSeconds: number;
  /** L19, L34: where the block stops firing. */
  endSeconds: number;
}>;

/**
 * The window of every anchored block. The end is the earliest of the anchor
 * plus the authored duration, the monster's next anchor, and the video end.
 * Blocks anchored at the same time resolve in authored order: the later one
 * wins, so the earlier ones end at once and fire nothing.
 */
export function blockWindows(
  blocks: readonly DraftBlock[],
  anchors: Readonly<Record<string, number>>,
  videoEndSeconds: number,
): readonly BlockWindow[] {
  const anchored = blocks
    .map((block, order) => ({ block, order, anchor: anchors[block.id] }))
    .filter((entry): entry is typeof entry & { anchor: number } => entry.anchor !== undefined)
    .sort((first, second) => first.anchor - second.anchor || first.order - second.order);
  return anchored.map(({ block, anchor }, index) => {
    const nextAnchor = anchored[index + 1]?.anchor ?? Infinity;
    const ownEnd =
      block.durationSeconds === null ? Infinity : anchor + block.durationSeconds;
    return {
      blockId: block.id,
      anchorSeconds: anchor,
      epochSeconds: anchor + block.telegraphSeconds,
      endSeconds: Math.min(ownEnd, nextAnchor, videoEndSeconds),
    };
  });
}

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

export type DraftFrame = Readonly<{
  frame: PreviewFrame;
  /** L36: attacks whose projectile has no sprite, so nothing of them is drawn. */
  undrawnAttackIds: readonly string[];
}>;

/** One frame of the draft at `timeSeconds`, drawn from each volley's own age. */
export function draftPreviewAt(input: {
  draft: MonsterDraft;
  /** Every block of the monster, so any phase's anchor still ends a window. */
  blocks: readonly DraftBlock[];
  /** J06: only this phase's blocks are drawn. */
  phaseId: string;
  config: EncounterConfig;
  timeSeconds: number;
  videoEndSeconds: number;
  playerTiles: Vector2;
  headingRadians: number;
}): DraftFrame {
  const {
    draft,
    blocks,
    phaseId,
    config,
    timeSeconds,
    videoEndSeconds,
    playerTiles,
    headingRadians,
  } = input;
  const drawnBlockIds = new Set(
    blocks.filter((block) => block.phaseId === phaseId).map((block) => block.id),
  );
  const emitterTiles = emitterTilesOf(config);
  const projectiles: PreviewProjectile[] = [];
  const detonations: PreviewDetonation[] = [];
  const undrawn = new Set<string>();
  for (const window of blockWindows(blocks, draft.anchors, videoEndSeconds)) {
    if (window.anchorSeconds > timeSeconds || !drawnBlockIds.has(window.blockId)) continue;
    for (const authored of activeDraftAttacks(draft, window.blockId)) {
      const attack = attackSpecFromAuthored(authored);
      const projectile = config.projectiles[attack.projectileId];
      const appearance = projectile?.appearance;
      if (!projectile || !appearance) {
        undrawn.add(authored.id);
        continue;
      }
      const explosionSeconds = appearance.bomb
        ? appearance.bomb.frameOuterPixels.length * BOMB_EXPLOSION_FRAME_SECONDS
        : 0;
      const lifetime = drawnLifetimeSeconds(projectile, explosionSeconds);
      const targetTiles = attack.target === "player" ? playerTiles : undefined;
      const { pattern } = attack;
      for (const volley of draftVolleysLiveAt(attack.cadence, window, timeSeconds, lifetime)) {
        const ageSeconds = timeSeconds - volley.timeSeconds;
        const sinceEpochSeconds = Math.max(0, volley.timeSeconds - window.epochSeconds);
        // L14: the game's own inputs, so per-burst advance and arm spread show.
        const bearings = resolveBearings(pattern, {
          enemyPositionTiles: emitterTiles,
          playerPositionTiles: playerTiles,
          enemyHeadingRadians: headingRadians,
          ringPhaseRadians:
            pattern.kind === "ring"
              ? pattern.initialPhaseRadians +
                degreesToRadians(pattern.clockwiseDegreesPerSecond) *
                  (volley.timeSeconds - window.epochSeconds)
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
            projectiles.push({ tagIndex: NO_TAG_INDEX, appearance, ...pose });
            continue;
          }
          if (projectile.type !== "bomb" || !appearance.bomb) continue;
          const sinceLandingSeconds = ageSeconds - projectile.travelSeconds;
          if (sinceLandingSeconds >= 0 && sinceLandingSeconds < explosionSeconds)
            detonations.push({
              tagIndex: NO_TAG_INDEX,
              positionTiles: resolveBombDestination(
                projectile,
                spawnTiles,
                bearing.bearingRadians,
                targetTiles,
              ),
              radiusTiles: projectile.detonationRadiusTiles,
            });
        }
      }
    }
  }
  return {
    frame: {
      timeSeconds,
      arena: config.arena.shape,
      emitterTiles,
      playerTiles,
      headingRadians,
      projectiles,
      detonations,
      unmatchedTagCount: 0,
    },
    undrawnAttackIds: [...undrawn],
  };
}
