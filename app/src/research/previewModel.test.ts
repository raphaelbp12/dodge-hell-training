import { describe, expect, test } from "vitest";
import {
  ENCOUNTER_CONFIGS,
  primaryArchetype,
  type AttackPattern,
  type AttackSpec,
  type EncounterConfig,
  type BulletSpec,
  type ProjectileSpec,
  bulletOf,
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
  initialHeadingSliderDegrees,
  matchTagAttack,
  previewAt,
  selectionAfterDelete,
  withTagGeometry,
} from "./previewModel";

const ENCOUNTER_CONFIG = ENCOUNTER_CONFIGS["killer-bee-queen"]!;
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const BASE_PROJECTILE = bulletOf(ENCOUNTER_CONFIG, "bee-shot");
const APPEARANCE = BASE_PROJECTILE.appearance!;
const EMITTER = emitterTilesOf(ENCOUNTER_CONFIG);

const projectileOf = (
  id: string,
  motion: BulletSpec["motion"],
  appearance = { ...APPEARANCE, id },
): BulletSpec => ({
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
    // Plan V15 N37 supersedes M06 for rings: the default tag is a fixed-ring,
    // which has rate 0, so only the rate differs from the authored pattern.
    const ring = matchTagAttack(tag({ shots: 7 }), CONFIG)!.pattern;
    expect(ring).toEqual({ ...RING, arms: 7, clockwiseDegreesPerSecond: 0 });
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

  test("a bomb flies to its destination, then detonates for the bomb frames", () => {
    const bomb = {
      ...APPEARANCE,
      id: "bomb",
      bomb: {
        frameOuterPixels: [4, 6, 8],
        borderPixels: 1,
        bodyColor: "#ff0000",
      },
    };
    const {
      speedTilesPerSecond: _speed,
      motion: _motion,
      type: _type,
      ...bulletBody
    } = BASE_PROJECTILE;
    const lob: ProjectileSpec = {
      ...bulletBody,
      type: "bomb",
      id: "bomb",
      appearance: bomb,
      rangeTiles: 4,
      travelSeconds: 1,
      detonationRadiusTiles: 2,
    };
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

// --- Plan V15 phase 54: the tag wins; rotation, composites, front and targeted bombs. ---

const deg = (value: number): number => (value * Math.PI) / 180;

describe("withTagGeometry", () => {
  test("a rotating-arm tag keeps the authored rate and phase unless it types them, each independently", () => {
    const base = tag({ pattern: "rotating-arm" });
    expect(withTagGeometry(RING, base)).toMatchObject({
      clockwiseDegreesPerSecond: 90,
      initialPhaseRadians: 0.25,
      arms: 2,
    });
    expect(
      withTagGeometry(RING, { ...base, clockwiseDegreesPerSecond: -30 }),
    ).toMatchObject({ clockwiseDegreesPerSecond: -30, initialPhaseRadians: 0.25 });
    const phased = withTagGeometry(RING, { ...base, initialPhaseDegrees: 40 });
    expect(phased).toMatchObject({ clockwiseDegreesPerSecond: 90 });
    expect((phased as { initialPhaseRadians: number }).initialPhaseRadians).toBeCloseTo(deg(40), 12);
  });

  test("a fixed-ring tag has rate 0 even on a rotating attack, and keeps the authored phase", () => {
    expect(withTagGeometry(RING, tag({ pattern: "fixed-ring" }))).toMatchObject({
      clockwiseDegreesPerSecond: 0,
      initialPhaseRadians: 0.25,
    });
  });

  test("a ring's arm pattern comes from the tag", () => {
    const at = (overrides: Partial<Tag>) =>
      (withTagGeometry(RING, tag(overrides)) as { armPattern?: unknown }).armPattern;
    expect(at({})).toBeUndefined();
    expect(at({ armPattern: "spread", shotsPerArm: 3, armArcDegrees: 20 })).toEqual({
      kind: "spread",
      shots: 3,
      arcDegrees: 20,
    });
    expect(at({ armPattern: "scatter", shotsPerArm: 2, armArcDegrees: 35 })).toEqual({
      kind: "scatter",
      shots: 2,
      coneDegrees: 35,
    });
    expect(at({ armPattern: "ring", shotsPerArm: 4 })).toEqual({ kind: "ring", arms: 4 });
  });

  test("a plain tag on a composite attack draws single-shot arms; the tag wins", () => {
    const composite: AttackPattern = {
      ...(RING as Extract<AttackPattern, { kind: "ring" }>),
      armPattern: { kind: "spread", shots: 5, arcDegrees: 10 },
    };
    expect(withTagGeometry(composite, tag())).not.toHaveProperty("armPattern");
  });

  test("a composite tag on a plain ring draws the tag's arms", () => {
    expect(
      withTagGeometry(RING, tag({ armPattern: "ring", shotsPerArm: 2 })),
    ).toMatchObject({ armPattern: { kind: "ring", arms: 2 } });
  });

  test("a spread or scatter takes the tag's shots and its aim override (N39)", () => {
    const player = withTagGeometry(
      { ...SCATTER, aim: "fixed", fixedBearingDegrees: 90 } as AttackPattern,
      tag({ pattern: "scatter", aim: "player", shots: 6 }),
    );
    expect(player).toMatchObject({ shots: 6, aim: "player" });
    expect(player).not.toHaveProperty("fixedBearingDegrees");
    const frontOnPlayerAuthored = withTagGeometry(
      SPREAD,
      tag({ pattern: "spread", aim: "front", shots: 2 }),
    );
    expect(frontOnPlayerAuthored).toMatchObject({ aim: "front", offsetDegrees: 0, shots: 2 });
    const authoredFront: AttackPattern = {
      kind: "spread",
      shots: 3,
      arcDegrees: 30,
      aim: "front",
      offsetDegrees: 180,
      emitterRadiusTiles: 0,
    };
    expect(
      withTagGeometry(authoredFront, tag({ pattern: "spread", aim: "front" })),
    ).toMatchObject({ aim: "front", offsetDegrees: 180 });
    expect(
      withTagGeometry(SPREAD, tag({ pattern: "spread", aim: "fixed", shots: 3 })),
    ).toEqual(SPREAD);
  });

  test("it is pure", () => {
    const before = JSON.stringify(RING);
    withTagGeometry(RING, tag({ pattern: "rotating-arm", initialPhaseDegrees: 3 }));
    expect(JSON.stringify(RING)).toBe(before);
  });
});

describe("previewAt rotation and composites", () => {
  const rotatingTag = (timeSeconds: number, overrides: Partial<Tag> = {}) =>
    tag({ pattern: "rotating-arm", shots: 1, timeSeconds, ...overrides });
  const armBearing = (tags: readonly Tag[], index: number, now: number, config = CONFIG) =>
    frame(tags, now, config).projectiles.find((p) => p.tagIndex === index)!
      .orientationRadians;

  test("the first tag fires on its phase and later tags in the group rotate by rate x elapsed (N37)", () => {
    const tags = [rotatingTag(10), rotatingTag(11), rotatingTag(12.5)];
    // Sampled at each tag's own time, while its shards are still alive.
    expect(armBearing(tags, 0, 10)).toBeCloseTo(0.25, 9);
    expect(armBearing(tags, 1, 11)).toBeCloseTo(0.25 + deg(90) * 1, 9);
    expect(armBearing(tags, 2, 12.5)).toBeCloseTo(0.25 + deg(90) * 2.5, 9);
  });

  test("a typed phase shifts only that tag", () => {
    const tags = [rotatingTag(10), rotatingTag(11, { initialPhaseDegrees: 30 })];
    expect(armBearing(tags, 0, 11)).toBeCloseTo(0.25, 9);
    expect(armBearing(tags, 1, 11)).toBeCloseTo(deg(30) + deg(90) * 1, 9);
  });

  test("a typed rate replaces the authored rate for that tag only", () => {
    const tags = [rotatingTag(10), rotatingTag(11, { clockwiseDegreesPerSecond: -45 })];
    expect(armBearing(tags, 1, 11)).toBeCloseTo(0.25 + deg(-45) * 1, 9);
  });

  test("a fixed-ring tag never rotates, even on a rotating attack", () => {
    const tags = [tag({ shots: 1, timeSeconds: 10 }), tag({ shots: 1, timeSeconds: 14 })];
    expect(armBearing(tags, 1, 14)).toBeCloseTo(0.25, 9);
  });

  test("groups rotate separately: another sprite's first tag is its own epoch", () => {
    const other = projectileOf("linear-b", { kind: "linear", rangeTiles: 8 });
    const config = configOf(
      [attackOf("ring", "linear-a", RING), attackOf("ring-b", "linear-b", RING)],
      [LINEAR, other],
    );
    const tags = [
      rotatingTag(10),
      rotatingTag(20, { spriteId: "linear-b" }),
    ];
    expect(armBearing(tags, 1, 20, config)).toBeCloseTo(0.25, 9);
  });

  test("per-burst advance is excluded: an advancing attack draws every burst at one angle (N38)", () => {
    const advancing: AttackPattern = {
      ...(RING as Extract<AttackPattern, { kind: "ring" }>),
      clockwiseDegreesPerSecond: 0,
      perBurstAdvanceDegrees: 15,
    };
    const config = configOf([attackOf("adv", "linear-a", advancing)], [LINEAR]);
    const tags = [rotatingTag(10, { burstId: 1 }), rotatingTag(11, { burstId: 2 })];
    expect(armBearing(tags, 1, 11, config)).toBeCloseTo(armBearing(tags, 0, 11, config), 9);
  });

  test("a 4-arm ring of 3-shot spreads draws 12 projectiles for its tag", () => {
    const composite = tag({
      shots: 4,
      armPattern: "spread",
      shotsPerArm: 3,
      armArcDegrees: 20,
    });
    const { projectiles } = frame([tag({ spriteId: "nope" }), composite], 10);
    expect(projectiles).toHaveLength(12);
    expect(new Set(projectiles.map((p) => p.tagIndex))).toEqual(new Set([1]));
  });

  test("a nested scatter uses even draws for each final shot", () => {
    const scattered = tag({
      shots: 2,
      armPattern: "scatter",
      shotsPerArm: 2,
      armArcDegrees: 40,
    });
    const { projectiles } = frame([scattered], 10);
    expect(projectiles).toHaveLength(4);
    const cone = deg(40);
    const evenOffsets = [(0.5 / 2 - 0.5) * cone, (1.5 / 2 - 0.5) * cone];
    const arm0 = 0.25;
    const arm1 = 0.25 + Math.PI;
    const expected = [
      arm0 + evenOffsets[0],
      arm0 + evenOffsets[1],
      arm1 + evenOffsets[0],
      arm1 + evenOffsets[1],
    ];
    projectiles.forEach((p, i) => expect(p.orientationRadians).toBeCloseTo(expected[i], 9));
  });
});

describe("previewAt front aim, heading and targeted bombs", () => {
  test("a front tag follows the heading input and ignores the player", () => {
    const front = tag({ pattern: "spread", aim: "front", shots: 1 });
    const at = (headingRadians: number, playerTiles = PLAYER) =>
      previewAt({
        tags: [front],
        timeSeconds: 10,
        config: CONFIG,
        playerTiles,
        headingRadians,
      }).projectiles[0]!.orientationRadians;
    expect(at(0.5)).toBeCloseTo(0.5, 9);
    expect(at(1.5)).toBeCloseTo(1.5, 9);
    expect(at(1.5, { x: EMITTER.x, y: EMITTER.y - 9 })).toBeCloseTo(1.5, 9);
  });

  test("without a heading input the front is 0", () => {
    const front = tag({ pattern: "spread", aim: "front", shots: 1 });
    expect(frame([front], 10).projectiles[0]!.orientationRadians).toBeCloseTo(0, 9);
  });

  const bombAppearance = {
    ...APPEARANCE,
    id: "bomb",
    bomb: { frameOuterPixels: [4, 6, 8], borderPixels: 1, bodyColor: "#ff0000" },
  };
  const bombSpec: ProjectileSpec = {
    ...(({ speedTilesPerSecond: _s, motion: _m, type: _t, ...rest }) => rest)(BASE_PROJECTILE),
    type: "bomb",
    id: "bomb",
    appearance: bombAppearance,
    rangeTiles: 3,
    travelSeconds: 1,
    detonationRadiusTiles: 2,
  };
  const SINGLE: AttackPattern = { ...SPREAD, shots: 1, emitterRadiusTiles: 0 };
  const targetedConfig = configOf(
    [{ ...attackOf("t", "bomb", SINGLE), target: "player" }],
    [bombSpec],
  );
  const bombTag = (overrides: Partial<Tag> = {}) =>
    tag({ spriteId: "bomb", pattern: "spread", aim: "player", shots: 1, ...overrides });

  test("a targeted bomb lands on the player point, in flight and at detonation", () => {
    const mid = frame([bombTag()], 10.5, targetedConfig);
    expect(mid.projectiles[0]!.positionTiles.x).toBeCloseTo(EMITTER.x + (PLAYER.x - EMITTER.x) * 0.5, 9);
    const landed = frame([bombTag()], 11, targetedConfig);
    expect(landed.detonations).toHaveLength(1);
    expect(landed.detonations[0]!.positionTiles.x).toBeCloseTo(PLAYER.x, 9);
    expect(landed.detonations[0]!.positionTiles.y).toBeCloseTo(PLAYER.y, 9);
  });

  test("a multi-shot tag on a targeted attack uses the bomb's range", () => {
    const landed = frame([bombTag({ shots: 3 })], 11, targetedConfig);
    expect(landed.detonations).toHaveLength(3);
    for (const detonation of landed.detonations)
      expect(
        Math.hypot(detonation.positionTiles.x - EMITTER.x, detonation.positionTiles.y - EMITTER.y),
      ).toBeCloseTo(3, 9);
  });

  test("an untargeted bomb still lands at its range", () => {
    const plain = configOf([attackOf("p", "bomb", SINGLE)], [bombSpec]);
    const landed = frame([bombTag()], 11, plain);
    expect(
      Math.hypot(
        landed.detonations[0]!.positionTiles.x - EMITTER.x,
        landed.detonations[0]!.positionTiles.y - EMITTER.y,
      ),
    ).toBeCloseTo(3, 9);
  });
});

describe("initialHeadingSliderDegrees (N20)", () => {
  test("is 0 when the archetype authors no heading", () => {
    expect(initialHeadingSliderDegrees(ENCOUNTER_CONFIG)).toBe(0);
  });

  test("starts at the primary archetype's initialHeadingDegrees, normalised into 0-360", () => {
    const withHeading = (degrees: number): EncounterConfig => ({
      ...ENCOUNTER_CONFIG,
      archetypes: {
        ...ENCOUNTER_CONFIG.archetypes,
        [PRIMARY.id]: { ...PRIMARY, initialHeadingDegrees: degrees },
      },
    });
    expect(initialHeadingSliderDegrees(withHeading(90))).toBe(90);
    expect(initialHeadingSliderDegrees(withHeading(-90))).toBe(270);
    expect(initialHeadingSliderDegrees(withHeading(450))).toBe(90);
  });

  test("the frame carries the heading it was drawn with", () => {
    expect(
      previewAt({
        tags: [],
        timeSeconds: 0,
        config: CONFIG,
        playerTiles: PLAYER,
        headingRadians: 1.25,
      }).headingRadians,
    ).toBe(1.25);
    expect(frame([], 0).headingRadians).toBe(0);
  });
});
