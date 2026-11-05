import { describe, expect, test } from "vitest";
import {
  ENCOUNTER_CONFIGS,
  primaryArchetype,
  type AttackPattern,
  type AttackSpec,
  type EncounterConfig,
  type ProjectileSpec,
} from "../game/config/encounter";
import {
  curvedShardPositionAtAge,
  resolveShardLifetime,
} from "../game/simulation/projectiles";
import { BOMB_EXPLOSION_FRAME_SECONDS } from "../game/phaser/appearance-pixels";
import type { Tag } from "./tagging";
import {
  countUnmatchedTags,
  emitterTilesOf,
  highlightedTagIndices,
  matchTagAttack,
  previewAt,
  selectionAfterDelete,
} from "./previewModel";

const ENCOUNTER_CONFIG = ENCOUNTER_CONFIGS["killer-bee-queen"]!;
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const BASE_PROJECTILE = ENCOUNTER_CONFIG.projectiles["bee-shot"]!;
const APPEARANCE = BASE_PROJECTILE.appearance!;
const EMITTER = emitterTilesOf(ENCOUNTER_CONFIG);

const projectileOf = (
  id: string,
  motion: ProjectileSpec["motion"],
  appearance = { ...APPEARANCE, id },
): ProjectileSpec => ({
  ...BASE_PROJECTILE,
  id,
  speedTilesPerSecond: 4,
  motion,
  appearance,
});

const RING: AttackPattern = {
  kind: "ring",
  arms: 3,
  emitterRadiusTiles: 0.5,
  initialPhaseRadians: 0.25,
  clockwiseDegreesPerSecond: 90,
  perBurstAdvanceDegrees: 10,
};
const SPREAD: AttackPattern = {
  kind: "spread",
  shots: 3,
  arcDegrees: 60,
  aim: "player",
  emitterRadiusTiles: 1,
};
const SCATTER: AttackPattern = {
  kind: "scatter",
  shots: 4,
  coneDegrees: 40,
  aim: "fixed",
  fixedBearingDegrees: 90,
  emitterRadiusTiles: 0,
};

const attackOf = (
  id: string,
  projectileId: string,
  pattern: AttackPattern,
): AttackSpec => ({
  ...primaryArchetype(ENCOUNTER_CONFIG).phases[0]!.attacks[0]!,
  id,
  projectileId,
  pattern,
});

function configOf(
  attacks: readonly AttackSpec[],
  projectiles: readonly ProjectileSpec[],
  secondPhaseAttacks: readonly AttackSpec[] = [],
): EncounterConfig {
  const phase = { ...PRIMARY.phases[0]!, subPhases: null };
  return {
    ...ENCOUNTER_CONFIG,
    projectiles: Object.fromEntries(projectiles.map((p) => [p.id, p])),
    archetypes: {
      [PRIMARY.id]: {
        ...PRIMARY,
        phases: [
          { ...phase, attacks },
          { ...phase, attacks: secondPhaseAttacks },
        ],
      },
    },
  };
}

const tag = (overrides: Partial<Tag> = {}): Tag => ({
  timeSeconds: 10,
  phaseIndex: 0,
  spriteId: "linear-a",
  pattern: "fixed-ring",
  shots: 2,
  ...overrides,
});

const LINEAR = projectileOf("linear-a", { kind: "linear", rangeTiles: 8 });
const CONFIG = configOf(
  [
    attackOf("ring", "linear-a", RING),
    attackOf("spread", "linear-a", SPREAD),
    attackOf("scatter", "linear-a", SCATTER),
  ],
  [LINEAR],
  [attackOf("other-phase", "linear-a", RING)],
);
const PLAYER = { x: EMITTER.x + 5, y: EMITTER.y };

describe("matchTagAttack", () => {
  test("matches a ring from rotating-arm and fixed-ring", () => {
    for (const pattern of ["rotating-arm", "fixed-ring"] as const) {
      const match = matchTagAttack(tag({ pattern }), CONFIG);
      expect(match?.attack.id).toBe("ring");
    }
  });

  test("matches spread and scatter", () => {
    expect(
      matchTagAttack(tag({ pattern: "spread", aim: "player" }), CONFIG)?.attack.id,
    ).toBe("spread");
    expect(
      matchTagAttack(tag({ pattern: "scatter", aim: "fixed" }), CONFIG)?.attack.id,
    ).toBe("scatter");
  });

  test("the first authored match wins", () => {
    const config = configOf(
      [attackOf("first", "linear-a", RING), attackOf("second", "linear-a", RING)],
      [LINEAR],
    );
    expect(matchTagAttack(tag(), config)?.attack.id).toBe("first");
  });

  test("a matching sprite with the wrong family does not match", () => {
    const config = configOf([attackOf("spread", "linear-a", SPREAD)], [LINEAR]);
    expect(matchTagAttack(tag({ pattern: "rotating-arm" }), config)).toBeNull();
  });

  test("a sprite authored only in another phase does not match", () => {
    const config = configOf(
      [attackOf("a", "other", RING)],
      [LINEAR, projectileOf("other", { kind: "linear", rangeTiles: 3 })],
      [attackOf("b", "linear-a", RING)],
    );
    expect(matchTagAttack(tag({ phaseIndex: 0 }), config)).toBeNull();
    expect(matchTagAttack(tag({ phaseIndex: 1 }), config)?.attack.id).toBe("b");
  });

  test("returns null for an unknown phase, sprite and the volley pattern", () => {
    expect(matchTagAttack(tag({ phaseIndex: 9 }), CONFIG)).toBeNull();
    expect(matchTagAttack(tag({ spriteId: "nope" }), CONFIG)).toBeNull();
    expect(matchTagAttack(tag({ pattern: "volley" }), CONFIG)).toBeNull();
  });

  test("tag shots replace arms and shots, keeping other fields", () => {
    const ring = matchTagAttack(tag({ shots: 7 }), CONFIG)!.pattern;
    expect(ring).toEqual({ ...RING, arms: 7 });
    const spread = matchTagAttack(
      tag({ pattern: "spread", aim: "player", shots: 5 }),
      CONFIG,
    )!.pattern;
    expect(spread).toEqual({ ...SPREAD, shots: 5 });
    const scatter = matchTagAttack(
      tag({ pattern: "scatter", aim: "fixed", shots: 9 }),
      CONFIG,
    )!.pattern;
    expect(scatter).toEqual({ ...SCATTER, shots: 9 });
  });

  test("includes sub-phase attacks in authored order", () => {
    const base = configOf([], [LINEAR]);
    const archetype = base.archetypes[PRIMARY.id]!;
    const phase = archetype.phases[0]!;
    const sub = {
      id: "s",
      durationSeconds: 1,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      movement: null,
      attacks: [attackOf("in-sub", "linear-a", RING)],
      spawns: null,
    };
    const config = {
      ...base,
      archetypes: {
        [PRIMARY.id]: { ...archetype, phases: [{ ...phase, subPhases: [sub] }] },
      },
    };
    expect(matchTagAttack(tag(), config)?.attack.id).toBe("in-sub");
  });
});

describe("countUnmatchedTags", () => {
  test("counts tags with no match", () => {
    expect(
      countUnmatchedTags(
        [tag(), tag({ spriteId: "x" }), tag({ pattern: "volley" })],
        CONFIG,
      ),
    ).toBe(2);
    expect(countUnmatchedTags([], CONFIG)).toBe(0);
  });
});

const frame = (tags: readonly Tag[], timeSeconds: number, config = CONFIG) =>
  previewAt({ tags, timeSeconds, config, playerTiles: PLAYER });

describe("previewAt", () => {
  test("an empty study and a future tag draw nothing", () => {
    expect(frame([], 5).projectiles).toEqual([]);
    expect(frame([tag()], 9.99).projectiles).toEqual([]);
    expect(frame([tag()], 9.99).emitterTiles).toEqual(EMITTER);
    expect(frame([], 0).playerTiles).toEqual(PLAYER);
  });

  test("at age 0 each shot sits at its emitter-offset spawn point", () => {
    const { projectiles } = frame([tag({ shots: 2 })], 10);
    expect(projectiles).toHaveLength(2);
    projectiles.forEach((p, i) => {
      const bearing = RING.kind === "ring" ? 0.25 + (i * 2 * Math.PI) / 2 : 0;
      expect(p.positionTiles.x).toBeCloseTo(EMITTER.x + Math.cos(bearing) * 0.5, 9);
      expect(p.positionTiles.y).toBeCloseTo(EMITTER.y + Math.sin(bearing) * 0.5, 9);
      expect(p.orientationRadians).toBeCloseTo(bearing, 9);
      expect(p.tagIndex).toBe(0);
    });
  });

  test("a linear shard moves at its speed and disappears at its lifetime", () => {
    const one = tag({ shots: 1 });
    const p = frame([one], 11).projectiles[0]!;
    expect(p.positionTiles.x).toBeCloseTo(EMITTER.x + Math.cos(0.25) * 0.5 + 4 * Math.cos(0.25), 9);
    const { lifetimeSeconds } = resolveShardLifetime(LINEAR);
    expect(frame([one], 10 + lifetimeSeconds - 0.01).projectiles).toHaveLength(1);
    expect(frame([one], 10 + lifetimeSeconds).projectiles).toHaveLength(0);
  });

  test("a ring does not rotate at any time", () => {
    const one = tag({ shots: 1 });
    const early = frame([one], 10).projectiles[0]!;
    const late = frame([one], 11).projectiles[0]!;
    expect(early.orientationRadians).toBe(late.orientationRadians);
  });

  test("a boomerang reverses along the same line", () => {
    const boomerang = projectileOf("boom", {
      kind: "boomerang",
      reversalAgeSeconds: 1,
      lifetimeSeconds: 2,
    });
    const config = configOf([attackOf("b", "boom", RING)], [boomerang]);
    const one = tag({ spriteId: "boom", shots: 1 });
    const spawn = frame([one], 10, config).projectiles[0]!.positionTiles;
    const out = frame([one], 10.5, config).projectiles[0]!.positionTiles;
    const turn = frame([one], 11, config).projectiles[0]!.positionTiles;
    const back = frame([one], 11.5, config).projectiles[0]!.positionTiles;
    expect(Math.hypot(out.x - spawn.x, out.y - spawn.y)).toBeCloseTo(2, 9);
    expect(Math.hypot(turn.x - spawn.x, turn.y - spawn.y)).toBeCloseTo(4, 9);
    expect(back.x).toBeCloseTo(out.x, 9);
    expect(back.y).toBeCloseTo(out.y, 9);
    expect(frame([one], 12, config).projectiles).toHaveLength(0);
  });

  test("turning and wavy shards agree with curvedShardPositionAtAge", () => {
    const motions = [
      { kind: "turning", rangeTiles: 8, turnRateDegreesPerSecond: 40 },
      { kind: "wavy", rangeTiles: 8, amplitudeTiles: 0.5, frequencyHz: 1 },
    ] as const;
    for (const motion of motions) {
      const curved = projectileOf("curved", motion);
      const config = configOf([attackOf("c", "curved", RING)], [curved]);
      const one = tag({ spriteId: "curved", shots: 1 });
      const spawn = {
        x: EMITTER.x + Math.cos(0.25) * 0.5,
        y: EMITTER.y + Math.sin(0.25) * 0.5,
      };
      const p = frame([one], 10.7, config).projectiles[0]!;
      const expected = curvedShardPositionAtAge(motion, 4, spawn, 0.25, 0.7);
      expect(p.positionTiles.x).toBeCloseTo(expected.x, 9);
      expect(p.positionTiles.y).toBeCloseTo(expected.y, 9);
    }
  });

  test("a lob flies to its destination, then detonates for the bomb frames", () => {
    const bomb = {
      ...APPEARANCE,
      id: "bomb",
      bomb: {
        frameOuterPixels: [4, 6, 8],
        borderPixels: 1,
        bodyColor: "#ff0000",
      },
    };
    const lob = projectileOf(
      "bomb",
      { kind: "lob", travelSeconds: 1, detonationRadiusTiles: 2 },
      bomb,
    );
    const config = configOf([attackOf("l", "bomb", { ...SPREAD, shots: 1 })], [lob]);
    const one = tag({ spriteId: "bomb", pattern: "spread", aim: "player", shots: 1 });
    const mid = frame([one], 10.5, config);
    expect(mid.projectiles).toHaveLength(1);
    expect(mid.detonations).toEqual([]);
    const landing = frame([one], 11, config);
    expect(landing.projectiles).toHaveLength(0);
    expect(landing.detonations).toHaveLength(1);
    expect(landing.detonations[0]!.radiusTiles).toBe(2);
    expect(landing.detonations[0]!.positionTiles.x).toBeCloseTo(EMITTER.x + 1 + 4, 9);
    expect(
      frame([one], 11 + 3 * BOMB_EXPLOSION_FRAME_SECONDS - 0.001, config).detonations,
    ).toHaveLength(1);
    expect(
      frame([one], 11 + 3 * BOMB_EXPLOSION_FRAME_SECONDS + 0.001, config).detonations,
    ).toHaveLength(0);
  });

  test("a player-aimed spread points at the moved player", () => {
    const one = tag({ pattern: "spread", aim: "player", shots: 1 });
    const moved = previewAt({
      tags: [one],
      timeSeconds: 10,
      config: CONFIG,
      playerTiles: { x: EMITTER.x, y: EMITTER.y + 5 },
    });
    expect(moved.projectiles[0]!.orientationRadians).toBeCloseTo(Math.PI / 2, 9);
  });

  test("scatter bearings are spread evenly across the cone", () => {
    const { projectiles } = frame(
      [tag({ pattern: "scatter", aim: "fixed", shots: 4 })],
      10,
    );
    const cone = (40 * Math.PI) / 180;
    projectiles.forEach((p, i) => {
      expect(p.orientationRadians).toBeCloseTo(
        Math.PI / 2 + ((i + 0.5) / 4 - 0.5) * cone,
        9,
      );
    });
  });

  test("reports the unmatched count and ignores earlier frames", () => {
    const tags = [tag(), tag({ spriteId: "x" })];
    expect(frame(tags, 10).unmatchedTagCount).toBe(1);
    const first = frame(tags, 10.4);
    frame(tags, 12);
    expect(frame(tags, 10.4)).toEqual(first);
  });
});

describe("highlightedTagIndices", () => {
  const tags = [
    tag({ burstId: 1 }),
    tag({ burstId: 1, spriteId: "other" }),
    tag(),
    tag({ burstId: 2 }),
  ];
  test("nothing without a selection", () => {
    expect(highlightedTagIndices(tags, null)).toEqual([]);
  });
  test("a standalone tag highlights itself", () => {
    expect(highlightedTagIndices(tags, 2)).toEqual([2]);
  });
  test("a burst member highlights the whole burst, across sprites", () => {
    expect(highlightedTagIndices(tags, 1)).toEqual([0, 1]);
  });
});

describe("selectionAfterDelete", () => {
  test("clears when the selected row is deleted", () => {
    expect(selectionAfterDelete(3, 3)).toBeNull();
    expect(selectionAfterDelete(null, 3)).toBeNull();
  });
  test("keeps naming the same tag after an earlier row is deleted", () => {
    expect(selectionAfterDelete(3, 1)).toBe(2);
    expect(selectionAfterDelete(1, 3)).toBe(1);
  });
});

describe("emitterTilesOf", () => {
  test("uses the arena centre under the arena-center spawn rule", () => {
    expect(ENCOUNTER_CONFIG.spawns.placement.rule).toBe("arena-center");
    expect(emitterTilesOf(ENCOUNTER_CONFIG)).toEqual(
      ENCOUNTER_CONFIG.arena.shape.centerTiles,
    );
  });
  test("falls back to the authored spawn for other rules", () => {
    const config = ENCOUNTER_CONFIGS["crystal-worm"]!;
    expect(emitterTilesOf(config)).toEqual(primaryArchetype(config).spawnTiles);
  });
});
