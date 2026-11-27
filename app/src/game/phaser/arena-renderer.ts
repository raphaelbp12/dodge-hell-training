import Phaser from "phaser";
import { uprightOrientation } from "./camera-upright";
import {
  archetypeOf,
  bombOf,
  projectileOf,
  type EncounterConfig,
  type ProjectileAppearanceSpec,
} from "../config/encounter";
import { transformBodyVertices } from "../simulation/geometry";
import { currentPhaseOf } from "../simulation/phases";
import type { DetonationEvent, SimulationState } from "../simulation/simulation";
import type { ShardState, Vector2 } from "../models";
import { bombExplosionFrameIndex } from "./appearance-pixels";
import { octagonStaircaseRows } from "./arena-staircase";
import { hazardOutlinesOf } from "./terrain-art";
import {
  createAppearanceTextures,
  destroyAppearanceTextures,
  type AppearanceTextureKeys,
} from "./projectile-textures";
import { pixelsPerTile, presentation } from "./presentation";

function hexColourToNumber(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function projectileAppearances(
  config: EncounterConfig,
): readonly ProjectileAppearanceSpec[] {
  const appearances = new Map<string, ProjectileAppearanceSpec>();
  for (const projectile of Object.values(config.projectiles)) {
    if (projectile.appearance)
      appearances.set(projectile.appearance.id, projectile.appearance);
  }
  return [...appearances.values()];
}

/**
 * Draws the arena floor, bodies, projectiles and bomb explosions for one
 * simulation (plan V17 H02). Shared by the live encounter and the Home phase
 * preview so the two can never look different. It reads state through
 * `getState` because a retry replaces the simulation object.
 */
export class ArenaRenderer {
  private readonly scene: Phaser.Scene;
  private readonly getState: () => SimulationState;
  private ground: Phaser.GameObjects.Graphics;
  private bodies: Phaser.GameObjects.Graphics;
  private projectiles: Phaser.GameObjects.Graphics;
  private appearanceTextures: ReadonlyMap<string, AppearanceTextureKeys>;
  private shardImagePools = new Map<string, Phaser.GameObjects.Image[]>();
  private shardImageUse = new Map<string, number>();
  private bombExplosions: {
    position: Vector2;
    radiusTiles: number;
    ageSeconds: number;
    appearance: ProjectileAppearanceSpec;
  }[] = [];
  private bombsDetonated = 0;
  private bombExplosionFramesDrawn = 0;
  private fallbackShardDraws = 0;

  // tsconfig sets erasableSyntaxOnly, so fields are assigned by hand.
  constructor(scene: Phaser.Scene, getState: () => SimulationState) {
    this.scene = scene;
    this.getState = getState;
    this.ground = scene.add.graphics().setDepth(0);
    this.bodies = scene.add.graphics().setDepth(1);
    this.projectiles = scene.add.graphics().setDepth(2);
    this.appearanceTextures = createAppearanceTextures(
      scene,
      projectileAppearances(getState().config),
    );
  }

  get counters() {
    return {
      bombsDetonated: this.bombsDetonated,
      bombExplosionsActive: this.bombExplosions.length,
      bombExplosionFramesDrawn: this.bombExplosionFramesDrawn,
      fallbackShards: this.fallbackShardDraws,
    };
  }

  clearExplosions(): void {
    this.bombExplosions = [];
  }

  resetCounters(): void {
    this.bombsDetonated = 0;
    this.bombExplosionFramesDrawn = 0;
  }

  /** Ages explosions by the active seconds of one update and drops finished ones. */
  advanceExplosions(activeSeconds: number): void {
    this.bombExplosions = this.bombExplosions.filter((effect) => {
      effect.ageSeconds += activeSeconds;
      return (
        effect.ageSeconds <
        presentation.bombExplosion.frameSeconds *
          effect.appearance.bomb!.frameOuterPixels.length
      );
    });
  }

  /** Draws the ground, grid and boundary for a circular arena - unchanged
   * behaviour from before shaped arenas existed (P38). */
  private drawCircleGround(
    shape: Extract<EncounterConfig["arena"]["shape"], { kind: "circle" }>,
  ): void {
    const { radiusTiles, centerTiles } = shape;
    const centerX = centerTiles.x * pixelsPerTile;
    const centerY = centerTiles.y * pixelsPerTile;
    const radius = radiusTiles * pixelsPerTile;
    this.ground
      .fillStyle(presentation.ground)
      .fillCircle(centerX, centerY, radius);
    this.drawHoneycomb(
      centerX,
      centerY,
      (tileX, tileY) => {
        const dx = tileX + 0.5 - centerTiles.x;
        const dy = tileY + 0.5 - centerTiles.y;
        return Math.hypot(dx, dy) <= radiusTiles;
      },
      radiusTiles,
    );
    this.drawHazards(centerX, centerY, this.getState().config.arena.hazards);
    this.ground.lineStyle(1, presentation.grid);
    for (let tile = -radiusTiles + 1; tile < radiusTiles; tile++) {
      const extent =
        Math.sqrt(radiusTiles * radiusTiles - tile * tile) * pixelsPerTile;
      this.ground.lineBetween(
        centerX + tile * pixelsPerTile,
        centerY - extent,
        centerX + tile * pixelsPerTile,
        centerY + extent,
      );
      this.ground.lineBetween(
        centerX - extent,
        centerY + tile * pixelsPerTile,
        centerX + extent,
        centerY + tile * pixelsPerTile,
      );
    }
    this.ground
      .lineStyle(3, presentation.boundary)
      .strokeCircle(centerX, centerY, radius);
  }

  /** Draws the ground, grid and stepped-tile boundary for an octagonal
   * arena, deriving the staircase at draw time (P38, step 38.4): no
   * rasterised outline is stored anywhere. */
  private drawOctagonGround(
    shape: Extract<EncounterConfig["arena"]["shape"], { kind: "octagon" }>,
  ): void {
    const centerX = shape.centerTiles.x * pixelsPerTile;
    const centerY = shape.centerTiles.y * pixelsPerTile;
    const rows = octagonStaircaseRows(shape);
    this.ground.fillStyle(presentation.ground);
    for (const row of rows) {
      this.ground.fillRect(
        centerX - row.halfWidthTiles * pixelsPerTile,
        centerY + (row.rowCenterTiles - 0.5) * pixelsPerTile,
        row.halfWidthTiles * 2 * pixelsPerTile,
        pixelsPerTile,
      );
    }
    this.drawHoneycomb(
      centerX,
      centerY,
      (tileX, tileY) => {
        const row = rows.find(
          (candidate) => candidate.rowCenterTiles === tileY,
        );
        return !!row && Math.abs(tileX + 0.5) <= row.halfWidthTiles;
      },
      Math.max(
        ...rows.map((row) =>
          Math.max(row.halfWidthTiles, Math.abs(row.rowCenterTiles)),
        ),
        0,
      ),
    );
    this.drawHazards(centerX, centerY, this.getState().config.arena.hazards);
    this.ground.lineStyle(1, presentation.grid);
    for (const row of rows) {
      const left = centerX - row.halfWidthTiles * pixelsPerTile;
      const right = centerX + row.halfWidthTiles * pixelsPerTile;
      const top = centerY + (row.rowCenterTiles - 0.5) * pixelsPerTile;
      const bottom = top + pixelsPerTile;
      for (
        let tileX = Math.ceil(left / pixelsPerTile) * pixelsPerTile;
        tileX < right;
        tileX += pixelsPerTile
      )
        this.ground.lineBetween(tileX, top, tileX, bottom);
      this.ground.lineBetween(left, top, right, top);
    }
    this.ground.lineStyle(3, presentation.boundary);
    for (const row of rows) {
      const left = centerX - row.halfWidthTiles * pixelsPerTile;
      const right = centerX + row.halfWidthTiles * pixelsPerTile;
      const top = centerY + (row.rowCenterTiles - 0.5) * pixelsPerTile;
      const bottom = top + pixelsPerTile;
      const above = rows.find(
        (candidate) => candidate.rowCenterTiles === row.rowCenterTiles - 1,
      );
      const aboveHalfWidthTiles = above?.halfWidthTiles ?? 0;
      if (aboveHalfWidthTiles !== row.halfWidthTiles) {
        this.ground.lineBetween(
          left,
          top,
          centerX - aboveHalfWidthTiles * pixelsPerTile,
          top,
        );
        this.ground.lineBetween(
          right,
          top,
          centerX + aboveHalfWidthTiles * pixelsPerTile,
          top,
        );
      }
      this.ground.lineBetween(left, top, left, bottom);
      this.ground.lineBetween(right, top, right, bottom);
      const below = rows.find(
        (candidate) => candidate.rowCenterTiles === row.rowCenterTiles + 1,
      );
      if (!below) this.ground.lineBetween(left, bottom, right, bottom);
    }
  }

  drawGround(): void {
    const { shape } = this.getState().config.arena;
    if (shape.kind === "circle") this.drawCircleGround(shape);
    else this.drawOctagonGround(shape);
  }

  /**
   * Procedural two-tone honeycomb cell motif over the safe floor (P39, step
   * 39.4): one small hexagon per tile cell whose centre `cellTest` accepts,
   * shaded light or dark by tile-coordinate parity. No asset, no authored
   * grid - generated at draw time from the tile bounds alone, and drawn once
   * at create/resize, never per frame.
   */
  private drawHoneycomb(
    centerX: number,
    centerY: number,
    cellInsideShape: (tileX: number, tileY: number) => boolean,
    boundsRadiusTiles: number,
  ): void {
    const hexRadiusCssPixels = pixelsPerTile * 0.42;
    const bound = Math.ceil(boundsRadiusTiles) + 1;
    for (let tileY = -bound; tileY < bound; tileY++) {
      for (let tileX = -bound; tileX < bound; tileX++) {
        if (!cellInsideShape(tileX, tileY)) continue;
        const cellCenterX = centerX + (tileX + 0.5) * pixelsPerTile;
        const cellCenterY = centerY + (tileY + 0.5) * pixelsPerTile;
        const shade =
          (tileX + tileY) % 2 === 0
            ? presentation.groundHoneycombLight
            : presentation.groundHoneycombDark;
        const points: Phaser.Math.Vector2[] = [];
        for (let corner = 0; corner < 6; corner++) {
          const angleRadians = (Math.PI / 3) * corner + Math.PI / 6;
          points.push(
            new Phaser.Math.Vector2(
              cellCenterX + hexRadiusCssPixels * Math.cos(angleRadians),
              cellCenterY + hexRadiusCssPixels * Math.sin(angleRadians),
            ),
          );
        }
        this.ground.fillStyle(shade).fillPoints(points, true);
      }
    }
  }

  /**
   * Draws each hazard region as its exact shape (P39, step 39.4): a diamond
   * pond as a diamond, an annulus pond as a true ring - never approximated
   * as a circle or a square, since that would misinform the player about
   * where honey actually is. `hazardOutlinesOf` (terrain-art.ts) is the pure,
   * separately tested region-to-outline conversion this draws from.
   */
  private drawHazards(
    centerX: number,
    centerY: number,
    hazards: EncounterConfig["arena"]["hazards"],
  ): void {
    for (const outline of hazardOutlinesOf(hazards)) {
      if (outline.kind === "diamond") {
        const points = outline.verticesTiles.map(
          (vertex) =>
            new Phaser.Math.Vector2(
              centerX + vertex.x * pixelsPerTile,
              centerY + vertex.y * pixelsPerTile,
            ),
        );
        this.ground.fillStyle(presentation.honey).fillPoints(points, true);
        this.ground
          .lineStyle(2, presentation.honeyRim)
          .strokePoints(points, true);
      } else {
        const innerRadius = outline.innerRadiusTiles * pixelsPerTile;
        const outerRadius = outline.outerRadiusTiles * pixelsPerTile;
        // Phaser has no built-in ring fill; approximate the annulus as a
        // thick stroked circle at its midline, whose line width exactly
        // spans inner to outer radius.
        this.ground
          .lineStyle(outerRadius - innerRadius, presentation.honey)
          .strokeCircle(centerX, centerY, (innerRadius + outerRadius) / 2);
        this.ground
          .lineStyle(2, presentation.honeyRim)
          .strokeCircle(centerX, centerY, innerRadius)
          .strokeCircle(centerX, centerY, outerRadius);
      }
    }
  }

  /**
   * Draws bodies, projectiles and explosions. Zoom only scales line widths.
   * Entity sprites stay upright under the rotated camera (D-28-4); a
   * sprite's own heading is turned by the camera angle (D-28-6). The arena
   * floor, walls and boundary are drawn elsewhere and keep rotating.
   */
  drawWorld(zoom: number, cameraRotation = 0): void {
    this.cameraRotation = cameraRotation;
    const state = this.getState();
    const { player, enemies, shards, bombs } = state;
    this.bodies.clear();
    const draw = (
      graphics: Phaser.GameObjects.Graphics,
      vertices: readonly Vector2[],
      position: Vector2,
      color: number,
      heading?: number,
    ) => {
      const orientation = this.uprightOrientation(heading);
      const points = transformBodyVertices(vertices, position, orientation).map(
        (vertex) =>
          new Phaser.Math.Vector2(
            vertex.x * pixelsPerTile,
            vertex.y * pixelsPerTile,
          ),
      );
      graphics.fillStyle(color).fillPoints(points, true);
    };
    for (const enemy of enemies) {
      const archetype = archetypeOf(state.config, enemy.archetypeId);
      const phase = currentPhaseOf(archetype, enemy);
      const isTelegraphing =
        state.elapsedSeconds <
        enemy.phaseEnteredAtSeconds + phase.telegraphSeconds;
      draw(
        this.bodies,
        archetype.verticesTiles,
        enemy.positionTiles,
        isTelegraphing
          ? presentation.telegraphColors[phase.telegraphColor]
          : presentation.enemy,
      );
    }
    draw(
      this.bodies,
      state.config.player.verticesTiles,
      player.positionTiles,
      presentation.player,
    );
    this.projectiles.clear();
    this.shardImageUse.clear();
    this.fallbackShardDraws = 0;
    for (const shard of shards) {
      const projectile = projectileOf(state.config, shard.projectileId);
      const appearance = projectile.appearance;
      const hasShardTexture = Boolean(
        appearance &&
          !appearance.bomb &&
          this.appearanceTextures.has(appearance.id),
      );
      if (hasShardTexture) {
        this.drawShardImage(appearance!, shard);
      } else {
        if (appearance && !appearance.bomb) this.fallbackShardDraws++;
        draw(
          this.projectiles,
          projectile.verticesTiles,
          shard.positionTiles,
          appearance?.bomb
            ? hexColourToNumber(appearance.bomb.bodyColor)
            : shard.hasHitPlayer
              ? presentation.spentShard
              : presentation.shard,
          shard.orientationRadians,
        );
      }
    }
    // Bombs draw in their own pass (N22): the body in flight, then the red
    // telegraph circle at the destination once the lead-in window opens.
    const telegraphSeconds = state.config.presentation.lobTelegraphSeconds;
    for (const bomb of bombs) {
      const projectile = bombOf(state.config, bomb.projectileId);
      const appearance = projectile.appearance;
      draw(
        this.projectiles,
        projectile.verticesTiles,
        bomb.positionTiles,
        appearance?.bomb
          ? hexColourToNumber(appearance.bomb.bodyColor)
          : bomb.hasHitPlayer
            ? presentation.spentShard
            : presentation.shard,
        bomb.orientationRadians,
      );
      // A light keyline keeps dark bomb bodies readable on the dark floor and
      // the honey. It strokes the same polygon the hitbox uses (plan V17 2.2).
      const keyline = transformBodyVertices(
        projectile.verticesTiles,
        bomb.positionTiles,
        this.uprightOrientation(bomb.orientationRadians),
      ).map(
        (vertex) =>
          new Phaser.Math.Vector2(
            vertex.x * pixelsPerTile,
            vertex.y * pixelsPerTile,
          ),
      );
      this.projectiles
        .lineStyle(
          presentation.bombKeyline.widthCssPixels / zoom,
          presentation.bombKeyline.color,
        )
        .strokePoints(keyline, true);
      if (bomb.ageSeconds >= bomb.lifetimeSeconds - telegraphSeconds) {
        this.projectiles
          .lineStyle(
            presentation.lobTelegraph.lineWidthCssPixels,
            presentation.lobTelegraph.color,
          )
          .strokeCircle(
            bomb.detonationTargetTiles.x * pixelsPerTile,
            bomb.detonationTargetTiles.y * pixelsPerTile,
            projectile.detonationRadiusTiles * pixelsPerTile,
          );
      }
    }
    for (const [key, pool] of this.shardImagePools) {
      const used = this.shardImageUse.get(key) ?? 0;
      for (let index = used; index < pool.length; index++)
        pool[index]!.setVisible(false);
    }
    this.drawBombExplosions();
  }

  private cameraRotation = 0;

  /** Drawn rotation of a sprite with world `heading`: counter-rotated, then given its on-screen heading. */
  private uprightOrientation(heading?: number): number {
    return uprightOrientation(this.cameraRotation, heading);
  }

  private drawShardImage(
    appearance: ProjectileAppearanceSpec,
    shard: ShardState,
  ): void {
    const keys = this.appearanceTextures.get(appearance.id);
    if (!keys) return;
    const key = shard.hasHitPlayer ? keys.spent : keys.normal;
    const index = this.shardImageUse.get(key) ?? 0;
    let pool = this.shardImagePools.get(key);
    if (!pool) {
      pool = [];
      this.shardImagePools.set(key, pool);
    }
    let image = pool[index];
    if (!image) {
      image = this.scene.add
        .image(0, 0, key)
        .setDepth(1.9)
        .setOrigin(0.5, 0.5);
      pool.push(image);
    }
    image
      .setTexture(key)
      .setPosition(
        shard.positionTiles.x * pixelsPerTile,
        shard.positionTiles.y * pixelsPerTile,
      )
      .setRotation(this.uprightOrientation(shard.orientationRadians))
      .setScale(pixelsPerTile / appearance.pixelsPerTile)
      .setVisible(true);
    this.shardImageUse.set(key, index + 1);
  }

  addBombExplosion(event: DetonationEvent): void {
    const projectile = projectileOf(this.getState().config, event.projectileId);
    const appearance = projectile.appearance;
    if (!appearance?.bomb) return;
    this.bombsDetonated++;
    this.bombExplosions.push({
      position: { ...event.positionTiles },
      radiusTiles: event.radiusTiles,
      ageSeconds: 0,
      appearance,
    });
  }

  private drawBombExplosions(): void {
    for (const effect of this.bombExplosions) {
      const bomb = effect.appearance.bomb;
      if (!bomb) continue;
      this.bombExplosionFramesDrawn++;
      const frameIndex = bombExplosionFrameIndex(
        effect.ageSeconds,
        presentation.bombExplosion.frameSeconds,
        bomb.frameOuterPixels.length,
      );
      const outerPixels = bomb.frameOuterPixels[frameIndex]!;
      const finalOuterPixels =
        bomb.frameOuterPixels[bomb.frameOuterPixels.length - 1]!;
      const tilesPerNativePixel =
        (effect.radiusTiles * 2) /
        (finalOuterPixels / effect.appearance.pixelsPerTile);
      const sizeCssPixels =
        (outerPixels / effect.appearance.pixelsPerTile) *
        tilesPerNativePixel *
        pixelsPerTile;
      const borderCssPixels =
        (bomb.borderPixels / effect.appearance.pixelsPerTile) *
        tilesPerNativePixel *
        pixelsPerTile;
      const left = effect.position.x * pixelsPerTile - sizeCssPixels / 2;
      const top = effect.position.y * pixelsPerTile - sizeCssPixels / 2;
      this.projectiles
        .fillStyle(hexColourToNumber(effect.appearance.palette.A!))
        .fillRect(left, top, sizeCssPixels, sizeCssPixels)
        .fillStyle(hexColourToNumber(effect.appearance.palette.B!))
        .fillRect(
          left + borderCssPixels,
          top + borderCssPixels,
          sizeCssPixels - borderCssPixels * 2,
          sizeCssPixels - borderCssPixels * 2,
        );
    }
  }

  destroy(): void {
    this.bombExplosions = [];
    for (const pool of this.shardImagePools.values())
      for (const image of pool) image.destroy();
    this.shardImagePools.clear();
    destroyAppearanceTextures(this.scene, this.appearanceTextures);
  }
}
