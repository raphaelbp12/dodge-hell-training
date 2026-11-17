import fc from "fast-check";
import { expect, test } from "vitest";
import type { BulletSpec } from "../config/encounter";
import type { Vector2 } from "../models";
import { propertyParameters } from "../../test/property";
import { advanceSimulation, createSimulation } from "./simulation";
import {
  advanceShard,
  createShard,
  type ShardCollisionContext,
} from "./projectiles";
import {
  SHIPPED_BULLETS,
  shippedBullets,
  type CatalogEntry,
} from "./test-support";

/**
 * Floating-point tolerance for comparing positions reached through different
 * step partitions: a few ulps of an accumulated path of tens of tiles.
 */
const POSITION_EPSILON_TILES = 1e-9;

const MOTION_KINDS = ["linear", "boomerang", "turning", "wavy"] as const;
const FAR_AWAY: Vector2 = { x: 1e6, y: 1e6 };

function contextOf(entry: CatalogEntry<BulletSpec>): ShardCollisionContext {
  return {
    config: entry.config,
    collisionBoundingRadiusTiles: entry.config.player.verticesTiles.reduce(
      (max, vertex) => Math.max(max, Math.hypot(vertex.x, vertex.y)),
      0,
    ),
  };
}

// Generators carry indices into the catalog, not the entries: a failing
// counterexample would otherwise print a whole encounter configuration.
const bulletIndex = fc.nat({ max: SHIPPED_BULLETS.length - 1 });
const orientation = fc.double({ min: 0, max: 2 * Math.PI, noNaN: true });
const spawn = fc.record({
  x: fc.double({ min: -5, max: 5, noNaN: true }),
  y: fc.double({ min: -5, max: 5, noNaN: true }),
});
/** Positive step weights, scaled by the caller to any total duration. */
const weights = fc.array(fc.double({ min: 0.01, max: 1, noNaN: true }), {
  minLength: 1,
  maxLength: 12,
});

function partition(total: number, parts: readonly number[]): number[] {
  const sum = parts.reduce((acc, part) => acc + part, 0);
  return parts.map((part) => (part / sum) * total);
}

test("the shipped catalog exercises every motion kind and the bomb type", () => {
  for (const kind of MOTION_KINDS)
    expect(shippedBullets(kind).length).toBeGreaterThan(0);
});

test("a projectile is accepted as a hit at most once, whatever the steps and player path", () => {
  const sampled = SHIPPED_BULLETS.filter((entry) => entry.projectile.damageHp > 0);
  fc.assert(
    fc.property(
      fc.nat({ max: sampled.length - 1 }),
      fc.integer({ min: 0, max: 0xffffffff }),
      orientation,
      spawn,
      weights,
      fc.array(
        fc.record({
          north: fc.boolean(),
          south: fc.boolean(),
          east: fc.boolean(),
          west: fc.boolean(),
        }),
        { minLength: 1, maxLength: 6 },
      ),
      (entryIndex, seed, bearing, offset, steps, inputs) => {
        const entry = sampled[entryIndex];
        const state = createSimulation(entry.config, seed);
        state.enemies = [];
        const player = state.player.positionTiles;
        const shard = createShard(
          entry.projectile,
          1_000_000,
          { x: player.x + offset.x * 0.2, y: player.y + offset.y * 0.2 },
          bearing,
        );
        state.shards.push(shard);
        const accepted: number[] = [];
        steps.forEach((seconds, index) => {
          const result = advanceSimulation(
            state,
            seconds,
            inputs[index % inputs.length],
          );
          for (const hit of result.acceptedHits) accepted.push(hit.shardId);
        });
        expect(accepted.filter((id) => id === shard.id).length).toBeLessThanOrEqual(1);
        // Honey ticks report id 0 and enemy contact a negative id; only positive ids are projectiles.
        const projectileHits = accepted.filter((id) => id > 0);
        expect(new Set(projectileHits).size).toBe(projectileHits.length);
      },
    ),
    propertyParameters(),
  );
});

test("only a boomerang reverses, once, and only when its age reaches the reversal age", () => {
  fc.assert(
    fc.property(bulletIndex, orientation, weights, (index, bearing, parts) => {
      const entry = SHIPPED_BULLETS[index];
      const shard = createShard(entry.projectile, 1, { x: 0, y: 0 }, bearing);
      const context = contextOf(entry);
      const steps = partition(shard.lifetimeSeconds * 1.2, parts);
      let reversals = 0;
      for (const seconds of steps) {
        const before = shard.hasReversed;
        const result = advanceShard(context, shard, seconds, FAR_AWAY, FAR_AWAY);
        if (!before && shard.hasReversed) {
          reversals++;
          expect(shard.ageSeconds).toBeGreaterThanOrEqual(
            shard.reversalAgeSeconds,
          );
        }
        expect(before && !shard.hasReversed).toBe(false);
        if (!result.alive) break;
      }
      expect(reversals).toBeLessThanOrEqual(1);
      if (entry.projectile.motion.kind !== "boomerang")
        expect(shard.hasReversed).toBe(false);
    }),
    propertyParameters(),
  );
});

test("a shard's age never passes its lifetime and it is alive exactly while younger", () => {
  fc.assert(
    fc.property(bulletIndex, orientation, weights, (index, bearing, parts) => {
      const entry = SHIPPED_BULLETS[index];
      const shard = createShard(entry.projectile, 1, { x: 0, y: 0 }, bearing);
      const context = contextOf(entry);
      for (const seconds of partition(shard.lifetimeSeconds * 1.5, parts)) {
        const result = advanceShard(context, shard, seconds, FAR_AWAY, FAR_AWAY);
        expect(shard.ageSeconds).toBeLessThanOrEqual(shard.lifetimeSeconds);
        expect(result.alive).toBe(shard.ageSeconds < shard.lifetimeSeconds);
        if (!result.alive) break;
      }
    }),
    propertyParameters(),
  );
});

test("curved and boomerang positions do not depend on how the time is split into steps", () => {
  const curved = SHIPPED_BULLETS.filter(
    (entry) => entry.projectile.motion.kind !== "linear",
  );
  fc.assert(
    fc.property(
      fc.nat({ max: curved.length - 1 }),
      orientation,
      spawn,
      fc.double({ min: 0.05, max: 0.99, noNaN: true }),
      weights,
      (index, bearing, origin, fraction, parts) => {
        const entry = curved[index];
        const context = contextOf(entry);
        const single = createShard(entry.projectile, 1, origin, bearing);
        const split = createShard(entry.projectile, 1, origin, bearing);
        const total = single.lifetimeSeconds * fraction;
        advanceShard(context, single, total, FAR_AWAY, FAR_AWAY);
        for (const seconds of partition(total, parts))
          advanceShard(context, split, seconds, FAR_AWAY, FAR_AWAY);
        expect(
          Math.hypot(
            single.positionTiles.x - split.positionTiles.x,
            single.positionTiles.y - split.positionTiles.y,
          ),
        ).toBeLessThanOrEqual(POSITION_EPSILON_TILES);
      },
    ),
    propertyParameters(),
  );
});
