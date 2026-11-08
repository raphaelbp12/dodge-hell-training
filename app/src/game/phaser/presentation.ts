import { ENCOUNTER_CONFIG } from "../config/encounter";
import { hexToNumber, palette } from "../config/palette";
import { BOMB_EXPLOSION_FRAME_SECONDS } from "./appearance-pixels";

export const presentation = {
  hudIntervalMilliseconds: 100,
  millisecondsPerSecond: 1000,
  background: hexToNumber(palette.arena.background),
  ground: hexToNumber(palette.arena.ground),
  // Two shades of the ground colour for the procedural honeycomb floor
  // motif (P39, step 39.4) - no asset, generated per tile at draw time.
  groundHoneycombLight: hexToNumber(palette.arena.groundCellLight),
  groundHoneycombDark: hexToNumber(palette.arena.groundCellDark),
  grid: hexToNumber(palette.arena.grid),
  boundary: hexToNumber(palette.arena.boundary),
  honey: hexToNumber(palette.arena.honey),
  honeyRim: hexToNumber(palette.arena.honeyRim),
  player: hexToNumber(palette.entity.player),
  enemy: hexToNumber(palette.entity.enemy),
  telegraphColors: {
    white: hexToNumber(palette.telegraph.white),
    amber: hexToNumber(palette.telegraph.amber),
    red: hexToNumber(palette.telegraph.red),
    violet: hexToNumber(palette.telegraph.violet),
    cyan: hexToNumber(palette.telegraph.cyan),
  },
  shard: hexToNumber(palette.entity.shard),
  spentShard: hexToNumber(palette.entity.spentShard),
  lobTelegraph: {
    color: hexToNumber(palette.entity.lobTelegraph),
    lineWidthCssPixels: 2,
  },
  bombKeyline: {
    widthCssPixels: 1.5,
    color: hexToNumber(palette.arena.bombKeyline),
  },
  bombExplosion: {
    frameSeconds: BOMB_EXPLOSION_FRAME_SECONDS,
  },
  hitNumbers: {
    lifetimeSeconds: 0.9,
    riseCssPixels: 28,
    gapCssPixels: 12,
    laneWidthCssPixels: 54,
    lanes: 7,
    fontSizeCssPixels: 20,
    maxVisible: 16,
    color: palette.hitNumber.fill,
    stroke: palette.hitNumber.stroke,
    strokeCssPixels: 3,
  },
  healthBar: {
    widthCssPixels: 48,
    heightCssPixels: 6,
    gapCssPixels: 6,
    borderCssPixels: 1,
    fill: hexToNumber(palette.health.fill),
    empty: hexToNumber(palette.health.empty),
    border: hexToNumber(palette.health.border),
  },
  conditionChip: {
    gapAboveHealthBarCssPixels: 4,
    gapBetweenCssPixels: 3,
    heightCssPixels: 14,
    horizontalPaddingCssPixels: 5,
    fontSizeCssPixels: 10,
    activeFill: hexToNumber(palette.conditionChip.activeFill),
    inertFill: hexToNumber(palette.conditionChip.inertFill),
    activeTextColor: palette.conditionChip.activeText,
    inertTextColor: palette.conditionChip.inertText,
  },
} as const;

export const pixelsPerTile = ENCOUNTER_CONFIG.camera.cssPixelsPerTile;
