import { describe, expect, test } from "vitest";
import { unsafeFixture } from "../../test/fixture";
import {
  ENCOUNTER_CONFIG,
  attackShardBound,
  bodyExtentTiles,
  bombOf,
  bulletOf,
  encounterConfigOf,
  liveCollisionPartBoundForEncounter,
  liveShardBoundForEncounter,
  liveShardBoundPerEnemy,
  movementSpeedTilesPerSecond,
  resolveProgression,
  validateAttackSpec,
  validateEncounterConfig,
  validateShippedEncounter,
  type AttackSpec,
  type EncounterConfig,
  type MovementSpec,
  type PhaseSpec,
  type Progression,
} from "./encounter";

type Mut<T> = { -readonly [K in keyof T]: Mut<T[K]> };
type Cfg = Mut<EncounterConfig>;

// The Queen's static config carries every archetype against its own arena, so
// it is not valid as a whole; borrow its projectiles (bombs) for the
// debug-tunable config, which validates.
const queen = encounterConfigOf("killer-bee-queen");
const base: EncounterConfig = {
  ...ENCOUNTER_CONFIG,
  projectiles: { ...ENCOUNTER_CONFIG.projectiles, ...queen.projectiles },
};
const clone = (): Cfg => structuredClone(base) as unknown as Cfg;
const edited = (fn: (c: Cfg) => void): EncounterConfig => {
  const c = clone();
  fn(c);
  return c as unknown as EncounterConfig;
};
const primary = (c: Cfg) => c.archetypes[c.primaryArchetypeId];
const phase0 = (c: Cfg) => primary(c).phases[0];

const rejects = (fn: (c: Cfg) => void) =>
  expect(() => validateEncounterConfig(edited(fn))).toThrow(RangeError);
const accepts = (fn: (c: Cfg) => void) =>
  expect(() => validateEncounterConfig(edited(fn))).not.toThrow();

const anyBullet = Object.values(base.projectiles).find(
  (p) => p.type === "bullet",
)!;
const bulletId = Object.keys(base.projectiles).find(
  (id) => base.projectiles[id] === anyBullet,
)!;
const bombId = Object.keys(base.projectiles).find(
  (id) => base.projectiles[id].type === "bomb",
)!;

const cadence = {
  shotsPerBurst: 1,
  shotIntervalSeconds: 0.1,
  cooldownAfterLastShotSeconds: 1,
  initialDelaySeconds: 0,
};
const ringAttack = (pattern: object, over: object = {}): AttackSpec =>
  unsafeFixture<AttackSpec>({
    id: "t",
    projectileId: bulletId,
    tuningSource: "t",
    cadence,
    pattern: {
      kind: "ring",
      arms: 4,
      emitterRadiusTiles: 0,
      initialPhaseRadians: 0,
      clockwiseDegreesPerSecond: 0,
      ...pattern,
    },
    ...over,
  });
const spreadAttack = (pattern: object, over: object = {}): AttackSpec =>
  unsafeFixture<AttackSpec>({
    id: "t",
    projectileId: bulletId,
    tuningSource: "t",
    cadence,
    pattern: {
      kind: "spread",
      shots: 1,
      arcDegrees: 0,
      aim: "player",
      emitterRadiusTiles: 0,
      ...pattern,
    },
    ...over,
  });
const scatterAttack = (pattern: object): AttackSpec =>
  unsafeFixture<AttackSpec>({
    id: "t",
    projectileId: bulletId,
    tuningSource: "t",
    cadence,
    pattern: {
      kind: "scatter",
      shots: 3,
      coneDegrees: 90,
      aim: "player",
      emitterRadiusTiles: 0,
      ...pattern,
    },
  });

const attackRejects = (a: AttackSpec) =>
  expect(() => validateAttackSpec(base, a)).toThrow(RangeError);
const attackAccepts = (a: AttackSpec) =>
  expect(() => validateAttackSpec(base, a)).not.toThrow();

describe("shipped configs", () => {
  test("the merged base validates and its shipped rules hold", () => {
    expect(() => validateEncounterConfig(base)).not.toThrow();
    expect(() => validateShippedEncounter(base)).not.toThrow();
  });
});

describe("shipped-rule pursuit", () => {
  test("rejects a chase at or above the Paladin speed, accepts below", () => {
    const speed = (v: number) => (c: Cfg) => {
      phase0(c).movement = { kind: "chase", speedTilesPerSecond: v };
    };
    expect(() => validateShippedEncounter(edited(speed(100)))).toThrow(
      RangeError,
    );
    expect(() => validateShippedEncounter(edited(speed(0.1)))).not.toThrow();
    // Structural validation alone allows a fast chase (debug-panel rule).
    expect(() => validateEncounterConfig(edited(speed(100)))).not.toThrow();
  });
});

describe("encounter-level validation", () => {
  test("rulesVersion", () => {
    rejects((c) => (c.rulesVersion = "   "));
    rejects((c) => (c.rulesVersion = ""));
  });
  test("positive fields", () => {
    rejects((c) => (c.simulation.fixedStepSeconds = 0));
    rejects((c) => (c.simulation.maxStepsPerUpdate = 0));
    rejects((c) => (c.camera.cssPixelsPerTile = 0));
    rejects((c) => (c.camera.minZoom = 0));
    rejects((c) => (c.camera.zoomStep = 0));
    rejects((c) => (c.session.historyLimit = 0));
    rejects((c) => (c.presentation.lobTelegraphSeconds = 0));
    rejects((c) => (c.simulation.fixedStepSeconds = -1));
  });
  test("safe integer counts", () => {
    rejects((c) => (c.simulation.maxStepsPerUpdate = 2.5));
    rejects((c) => (c.session.historyLimit = 2.5));
  });
  test("countdowns are nonnegative, zero allowed", () => {
    rejects((c) => (c.session.startCountdownSeconds = -1));
    rejects((c) => (c.session.retryCountdownSeconds = -1));
    accepts((c) => (c.session.startCountdownSeconds = 0));
    accepts((c) => (c.session.retryCountdownSeconds = 0));
  });
  test("zoom ordering", () => {
    rejects((c) => {
      c.camera.minZoom = 2;
      c.camera.maxZoom = 1;
      c.camera.defaultZoom = 1.5;
    });
    rejects((c) => (c.camera.defaultZoom = c.camera.minZoom / 2));
    rejects((c) => (c.camera.defaultZoom = c.camera.maxZoom * 2));
    accepts((c) => (c.camera.defaultZoom = c.camera.minZoom));
    accepts((c) => (c.camera.defaultZoom = c.camera.maxZoom));
  });
  test("non-finite points", () => {
    rejects((c) => (c.arena.shape.centerTiles.x = Number.NaN));
    rejects((c) => (c.player.spawnTiles.y = Number.POSITIVE_INFINITY));
    rejects((c) => (c.player.spawnTiles.x = Number.NaN));
  });
  test("player body must fit the arena", () => {
    rejects((c) => (c.player.spawnTiles = { x: 1e6, y: 1e6 }));
  });
  test("spawn cadence", () => {
    rejects((c) => (c.spawns.firstSpawnSeconds = -1));
    accepts((c) => (c.spawns.firstSpawnSeconds = 0));
    accepts((c) => (c.spawns.everySeconds = null));
    rejects((c) => (c.spawns.everySeconds = 0));
    rejects((c) => (c.spawns.everySeconds = -3));
    accepts((c) => (c.spawns.everySeconds = 5));
  });
  test("max concurrent counts", () => {
    rejects((c) => (c.spawns.maxConcurrent = 0));
    rejects((c) => (c.spawns.maxConcurrent = 1.5));
    rejects((c) => (c.maxConcurrentMinions = 0));
    rejects((c) => (c.maxConcurrentMinions = 1.5));
  });
  test("goldenAngleRadians must be finite", () => {
    rejects((c) => (c.spawns.goldenAngleRadians = Number.NaN));
    rejects((c) => (c.spawns.goldenAngleRadians = Number.POSITIVE_INFINITY));
    accepts((c) => (c.spawns.goldenAngleRadians = 0));
  });
  test("spawn archetype must exist", () => {
    rejects((c) => (c.spawns.archetypeId = "nope"));
  });
  test("primary archetype must exist; at least one archetype", () => {
    rejects((c) => (c.primaryArchetypeId = "nope"));
    rejects((c) => {
      c.archetypes = {};
    });
  });
});

describe("spawn placement", () => {
  const ringConfig =
    base.spawns.placement.rule === "farthest-from-player" ? base : undefined;
  const centreConfig = edited((c) => {
    c.spawns.placement = { rule: "arena-center" };
  });

  test("farthest-from-player ring radius bounds", () => {
    if (!ringConfig) return;
    const make = (r: number) => {
      const c = structuredClone(ringConfig) as unknown as Cfg;
      c.spawns.placement = { rule: "farthest-from-player", ringRadiusTiles: r };
      return c as unknown as EncounterConfig;
    };
    expect(() => validateEncounterConfig(make(0))).toThrow(RangeError);
    expect(() => validateEncounterConfig(make(-1))).toThrow(RangeError);
    expect(() => validateEncounterConfig(make(1e6))).toThrow(RangeError);
    expect(() => validateEncounterConfig(make(1))).not.toThrow();
  });

  test("ring at the inradius is rejected, body must not poke out", () => {
    if (!ringConfig) return;
    const c0 = ringConfig.spawns.placement;
    if (c0.rule !== "farthest-from-player") return;
    // binary search the largest accepted radius: just past it must fail
    let lo = 0.01;
    let hi = 1e6;
    const ok = (r: number) => {
      const c = structuredClone(ringConfig) as unknown as Cfg;
      c.spawns.placement = { rule: "farthest-from-player", ringRadiusTiles: r };
      try {
        validateEncounterConfig(c as unknown as EncounterConfig);
        return true;
      } catch {
        return false;
      }
    };
    expect(ok(lo)).toBe(true);
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid;
      else hi = mid;
    }
    expect(ok(lo)).toBe(true);
    expect(ok(hi)).toBe(false);
  });

  test("arena-centre placement must fit the body in the arena", () => {
    expect(() => validateEncounterConfig(centreConfig)).not.toThrow();
    const c = structuredClone(centreConfig) as unknown as Cfg;
    const arch = c.archetypes[c.spawns.archetypeId];
    arch.verticesTiles = arch.verticesTiles.map((v) => ({
      x: v.x * 1e4,
      y: v.y * 1e4,
    }));
    expect(() =>
      validateEncounterConfig(c as unknown as EncounterConfig),
    ).toThrow(RangeError);
  });
});

describe("archetype validation", () => {
  test("initialHeadingDegrees must be finite when present", () => {
    rejects((c) => (primary(c).initialHeadingDegrees = Number.NaN));
    rejects(
      (c) => (primary(c).initialHeadingDegrees = Number.POSITIVE_INFINITY),
    );
    accepts((c) => (primary(c).initialHeadingDegrees = 0));
  });
  test("front-aimed attack requires an initial heading", () => {
    const front = spreadAttack({ aim: "front", offsetDegrees: 0 });
    rejects((c) => {
      delete (primary(c) as { initialHeadingDegrees?: number })
        .initialHeadingDegrees;
      phase0(c).attacks = [front as never];
    });
    rejects((c) => {
      delete (primary(c) as { initialHeadingDegrees?: number })
        .initialHeadingDegrees;
      phase0(c).attacks = [
        scatterAttack({ aim: "front", offsetDegrees: 0 }) as never,
      ];
    });
    rejects((c) => {
      delete (primary(c) as { initialHeadingDegrees?: number })
        .initialHeadingDegrees;
      phase0(c).attacks = [];
      phase0(c).subPhases = [
        {
          id: "s",
          durationSeconds: 1,
          telegraphSeconds: 0,
          invulnerableOnEnterSeconds: 0,
          movement: null,
          attacks: [front as never],
          spawns: null,
        },
      ] as never;
    });
    accepts((c) => {
      primary(c).initialHeadingDegrees = 0;
      phase0(c).attacks = [front as never];
    });
    // a non-front aim without a heading is fine
    accepts((c) => {
      delete (primary(c) as { initialHeadingDegrees?: number })
        .initialHeadingDegrees;
      phase0(c).attacks = [spreadAttack({}) as never];
    });
  });
  test("health validation", () => {
    rejects((c) => {
      primary(c).health = {
        maxHealthHp: 0,
        progression: { kind: "none" },
      };
    });
    rejects((c) => {
      primary(c).health = {
        maxHealthHp: 10,
        progression: { kind: "simulated-dps", hpPerSecond: 0 },
      };
    });
    rejects((c) => {
      primary(c).health = {
        maxHealthHp: 10,
        progression: unsafeFixture<never>({ kind: "bogus" }),
      };
    });
    accepts((c) => {
      primary(c).health = {
        maxHealthHp: 10,
        progression: { kind: "simulated-dps", hpPerSecond: 1 },
      };
    });
  });
  test("blocking is not approved", () => {
    rejects((c) => (primary(c).blocksPlayer = true));
  });
  test("spawn point must be finite and inside the arena", () => {
    rejects((c) => (primary(c).spawnTiles = { x: Number.NaN, y: 0 }));
    rejects((c) => (primary(c).spawnTiles = { x: 0, y: Number.NaN }));
    rejects((c) => (primary(c).spawnTiles = { x: 1e6, y: 0 }));
  });
});

describe("phase list validation", () => {
  const second = (c: Cfg): Mut<PhaseSpec> => {
    const phases = primary(c).phases;
    if (phases.length < 2) {
      phases.push({ ...structuredClone(phases[0]), id: "second" });
      phases[0].enterAtHpFraction = 1;
      phases[1].enterAtHpFraction = 0.5;
    }
    return phases[1];
  };
  test("empty phases rejected", () => {
    rejects((c) => (primary(c).phases = []));
  });
  test("first phase enters at exactly 1", () => {
    rejects((c) => (phase0(c).enterAtHpFraction = 0.9));
  });
  test("fraction range", () => {
    rejects((c) => {
      second(c).enterAtHpFraction = 0;
    });
    rejects((c) => {
      second(c).enterAtHpFraction = -0.5;
    });
    rejects((c) => {
      second(c).enterAtHpFraction = 1.5;
    });
    accepts((c) => {
      second(c).enterAtHpFraction = 0.0001;
    });
  });
  test("strictly descending, with a duration-exit exception", () => {
    rejects((c) => {
      const p = second(c);
      phase0(c).exitAfterSeconds = null;
      p.enterAtHpFraction = 1;
    });
    rejects((c) => {
      const p = second(c);
      phase0(c).exitAfterSeconds = null;
      phase0(c).enterAtHpFraction = 1;
      p.enterAtHpFraction = 1;
    });
    accepts((c) => {
      const p = second(c);
      phase0(c).exitAfterSeconds = 5;
      p.enterAtHpFraction = 1;
    });
    // ascending is rejected even after a duration exit
    rejects((c) => {
      const third = { ...structuredClone(second(c)), id: "third" };
      second(c).enterAtHpFraction = 0.4;
      second(c).exitAfterSeconds = 5;
      third.enterAtHpFraction = 0.5;
      primary(c).phases.push(third);
    });
    accepts((c) => {
      second(c).enterAtHpFraction = 0.5;
    });
  });
});

describe("phase spec validation", () => {
  test("timings", () => {
    rejects((c) => (phase0(c).telegraphSeconds = -1));
    accepts((c) => (phase0(c).telegraphSeconds = 0));
    rejects((c) => (phase0(c).invulnerableOnEnterSeconds = -1));
    accepts((c) => (phase0(c).invulnerableOnEnterSeconds = 0));
    rejects((c) => (phase0(c).exitAfterSeconds = 0));
    rejects((c) => (phase0(c).exitAfterSeconds = -1));
    accepts((c) => (phase0(c).exitAfterSeconds = 1));
  });
  test("telegraph colour", () => {
    rejects((c) => (phase0(c).telegraphColor = "no-such-colour" as never));
  });
  test("progression override", () => {
    rejects((c) => (phase0(c).progression = unsafeFixture<never>({ kind: "bogus" })));
    rejects(
      (c) =>
        (phase0(c).progression = { kind: "simulated-dps", hpPerSecond: 0 }),
    );
    accepts((c) => (phase0(c).progression = { kind: "none" }));
    accepts(
      (c) =>
        (phase0(c).progression = { kind: "simulated-dps", hpPerSecond: 2 }),
    );
  });
  test("empty subPhases / spawns arrays rejected", () => {
    rejects((c) => (phase0(c).subPhases = []));
    rejects((c) => (phase0(c).spawns = []));
  });
});

describe("spawn spec validation", () => {
  const minionId = (c: Cfg) => c.primaryArchetypeId;
  const spawn = (c: Cfg, over: object = {}) => ({
    archetypeId: minionId(c),
    count: 1,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
    ...over,
  });
  const withSpawn = (over: object) => (c: Cfg) => {
    c.maxConcurrentMinions = 5;
    phase0(c).spawns = [spawn(c, over)] as never;
  };
  test("valid spawn accepted", () => {
    accepts(withSpawn({}));
    accepts(withSpawn({ count: 5 }));
  });
  test("count", () => {
    rejects(withSpawn({ count: 0 }));
    rejects(withSpawn({ count: -1 }));
    rejects(withSpawn({ count: 1.5 }));
    rejects(withSpawn({ count: 6 }));
  });
  test("archetype and start phase index", () => {
    rejects(withSpawn({ archetypeId: "nope" }));
    rejects(withSpawn({ startPhaseIndex: -1 }));
    rejects(withSpawn({ startPhaseIndex: 0.5 }));
    rejects((c) => {
      withSpawn({ startPhaseIndex: primary(c).phases.length })(c);
    });
    accepts((c) => {
      withSpawn({ startPhaseIndex: primary(c).phases.length - 1 })(c);
    });
  });
  test("placement", () => {
    rejects(
      withSpawn({ placement: { kind: "ring-around-owner", radiusTiles: 0 } }),
    );
    rejects(
      withSpawn({ placement: { kind: "arena-ring", ringRadiusFraction: 0 } }),
    );
    rejects(
      withSpawn({ placement: { kind: "arena-ring", ringRadiusFraction: 1 } }),
    );
    rejects(
      withSpawn({ placement: { kind: "arena-ring", ringRadiusFraction: 2 } }),
    );
    accepts(
      withSpawn({
        placement: { kind: "arena-ring", ringRadiusFraction: 0.99 },
      }),
    );
  });
  test("sub-phase spawns, durations and movement", () => {
    const sub = (over: object) => (c: Cfg) => {
      c.maxConcurrentMinions = Math.max(c.maxConcurrentMinions, 5);
      phase0(c).subPhases = [
        {
          id: "s",
          durationSeconds: 1,
          telegraphSeconds: 0,
          invulnerableOnEnterSeconds: 0,
          movement: null,
          attacks: [],
          spawns: null,
          ...over,
        },
      ] as never;
    };
    accepts(sub({}));
    rejects(sub({ durationSeconds: 0 }));
    rejects(sub({ telegraphSeconds: -1 }));
    accepts(sub({ telegraphSeconds: 0 }));
    rejects(sub({ invulnerableOnEnterSeconds: -1 }));
    accepts(sub({ invulnerableOnEnterSeconds: 0 }));
    rejects(sub({ spawns: [] }));
    rejects((c) =>
      sub({ spawns: [spawn(c, { count: 0 })] })(c),
    );
    accepts((c) => sub({ spawns: [spawn(c)] })(c));
    rejects(sub({ movement: { kind: "orbit", radiusTiles: 0 } }));
    accepts(sub({ movement: { kind: "stationary" } }));
    rejects(sub({ attacks: [spreadAttack({ shots: 0 })] }));
  });
});

const orbit = (over: object) => ({
  kind: "orbit",
  radiusTiles: 2,
  degreesPerSecond: 10,
  direction: "cw",
  approachSpeedTilesPerSecond: 1,
  ...over,
});

describe("movement validation", () => {
  const move = (m: unknown) => (c: Cfg) => {
    phase0(c).movement = m as never;
  };
  test("chase / move-to-point speed is nonnegative", () => {
    accepts(move({ kind: "chase", speedTilesPerSecond: 0 }));
    rejects(move({ kind: "chase", speedTilesPerSecond: -1 }));
    accepts(
      move({
        kind: "move-to-point",
        target: "arena-center",
        speedTilesPerSecond: 0,
      }),
    );
    rejects(
      move({
        kind: "move-to-point",
        target: "arena-center",
        speedTilesPerSecond: -1,
      }),
    );
    rejects(
      move({
        kind: "move-to-point",
        target: "elsewhere",
        speedTilesPerSecond: 1,
      }),
    );
    // a chase kind has no target to check
    accepts(move({ kind: "chase", speedTilesPerSecond: 1, target: "x" }));
  });
  test("orbit fields", () => {
    accepts(move(orbit({})));
    accepts(move(orbit({ direction: "ccw" })));
    rejects(move(orbit({ radiusTiles: 0 })));
    rejects(move(orbit({ degreesPerSecond: 0 })));
    rejects(move(orbit({ approachSpeedTilesPerSecond: 0 })));
    rejects(move(orbit({ radiusTiles: -1 })));
    rejects(move(orbit({ direction: "sideways" })));
  });
  test("orbit tangential speed must stay below the Paladin", () => {
    rejects(move(orbit({ radiusTiles: 100, degreesPerSecond: 360 })));
    accepts(move(orbit({ radiusTiles: 0.5, degreesPerSecond: 1 })));
  });
  test("wander fields", () => {
    const wander = (over: object) => ({
      kind: "wander",
      speedTilesPerSecond: 1,
      retargetSeconds: 1,
      radiusTiles: 1,
      ...over,
    });
    accepts(move(wander({})));
    rejects(move(wander({ speedTilesPerSecond: 0 })));
    rejects(move(wander({ retargetSeconds: 0 })));
    rejects(move(wander({ radiusTiles: 0 })));
  });
  test("stationary accepted, unknown kind rejected", () => {
    accepts(move({ kind: "stationary" }));
    rejects(move({ kind: "teleport" }));
  });
  test("movementSpeedTilesPerSecond", () => {
    expect(
      movementSpeedTilesPerSecond({
        kind: "chase",
        speedTilesPerSecond: 3,
      }),
    ).toBe(3);
    expect(
      movementSpeedTilesPerSecond({
        kind: "move-to-point",
        target: "arena-center",
        speedTilesPerSecond: 4,
      }),
    ).toBe(4);
    expect(
      movementSpeedTilesPerSecond({
        kind: "wander",
        speedTilesPerSecond: 5,
        retargetSeconds: 1,
        radiusTiles: 1,
      }),
    ).toBe(5);
    expect(
      movementSpeedTilesPerSecond(orbit({ approachSpeedTilesPerSecond: 6 }) as MovementSpec),
    ).toBe(6);
    expect(movementSpeedTilesPerSecond({ kind: "stationary" })).toBe(0);
  });
});

describe("resolveProgression", () => {
  const arch = primary(clone()) as unknown as Parameters<
    typeof resolveProgression
  >[0];
  test("override wins, then archetype health, then none", () => {
    const over: Progression = { kind: "simulated-dps", hpPerSecond: 9 };
    expect(resolveProgression(arch, over)).toBe(over);
    const withHealth: typeof arch = {
      ...arch,
      health: {
        maxHealthHp: 5,
        progression: { kind: "simulated-dps", hpPerSecond: 3 },
      },
    };
    expect(resolveProgression(withHealth, null)).toEqual({
      kind: "simulated-dps",
      hpPerSecond: 3,
    });
    expect(resolveProgression(withHealth)).toEqual({
      kind: "simulated-dps",
      hpPerSecond: 3,
    });
    const noHealth = unsafeFixture<typeof arch>({ ...arch, health: undefined });
    expect(resolveProgression(noHealth)).toEqual({ kind: "none" });
    expect(resolveProgression(noHealth, null)).toEqual({ kind: "none" });
    expect(resolveProgression(noHealth, { kind: "none" })).toEqual({
      kind: "none",
    });
  });
});

describe("projectile validation (through attacks)", () => {
  const withProjectile = (over: object) => (c: Cfg) => {
    const id = bulletId;
    c.projectiles[id] = unsafeFixture<never>({ ...c.projectiles[id], ...over });
    phase0(c).attacks = [spreadAttack({}) as never];
  };
  test("damage nonnegative", () => {
    rejects(withProjectile({ damageHp: -1 }));
    accepts(withProjectile({ damageHp: 0 }));
  });
  test("expiration and hit policy", () => {
    rejects(withProjectile({ expiration: "on-collision" }));
    rejects(withProjectile({ hitPolicy: "every-frame" }));
  });
  test("speed nonnegative", () => {
    rejects(withProjectile({ speedTilesPerSecond: -1 }));
  });
  test("boomerang motion", () => {
    const motion = (o: object) =>
      withProjectile({
        speedTilesPerSecond: 1,
        motion: { kind: "boomerang", reversalAgeSeconds: 1, lifetimeSeconds: 2, ...o },
      });
    accepts(motion({}));
    rejects(motion({ reversalAgeSeconds: 0 }));
    rejects(motion({ lifetimeSeconds: 0 }));
    rejects(motion({ reversalAgeSeconds: 2, lifetimeSeconds: 2 }));
    rejects(motion({ reversalAgeSeconds: 3, lifetimeSeconds: 2 }));
  });
  test("non-boomerang motion needs positive range", () => {
    const motion = (range: number) =>
      withProjectile({
        speedTilesPerSecond: 1,
        motion: { kind: "linear", rangeTiles: range },
      });
    accepts(motion(1));
    rejects(motion(0));
    rejects(motion(-1));
  });
  test("bomb fields", () => {
    const bomb = (o: object) => (c: Cfg) => {
      c.projectiles[bombId] = unsafeFixture<never>({ ...c.projectiles[bombId], ...o });
      phase0(c).attacks = [
        spreadAttack({}, { projectileId: bombId }) as never,
      ];
    };
    accepts(bomb({}));
    rejects(bomb({ rangeTiles: 0 }));
    rejects(bomb({ travelSeconds: 0 }));
    rejects(bomb({ detonationRadiusTiles: 0 }));
    rejects(bomb({ damageHp: -1 }));
    rejects(bomb({ expiration: "x" }));
    rejects(bomb({ hitPolicy: "x" }));
  });
  test("projectile geometry is validated", () => {
    rejects(
      withProjectile({
        verticesTiles: [{ x: Number.NaN, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
      }),
    );
  });
});

describe("validateAttackSpec: cadence and counts", () => {
  test("positive cadence values", () => {
    const withCadence = (o: object) =>
      spreadAttack({}, { cadence: { ...cadence, ...o } });
    attackAccepts(withCadence({}));
    attackRejects(withCadence({ shotsPerBurst: 0 }));
    attackRejects(withCadence({ shotIntervalSeconds: 0 }));
    attackRejects(withCadence({ cooldownAfterLastShotSeconds: 0 }));
    attackRejects(withCadence({ initialDelaySeconds: -1 }));
    attackAccepts(withCadence({ initialDelaySeconds: 0 }));
  });
  test("counts must be safe integers", () => {
    attackRejects(spreadAttack({ shots: 1.5 }));
    attackRejects(spreadAttack({}, { cadence: { ...cadence, shotsPerBurst: 1.5 } }));
    attackRejects(spreadAttack({ shots: 0 }));
  });
  test("unknown projectile rejected", () => {
    attackRejects(spreadAttack({}, { projectileId: "no-such-projectile" }));
  });
});

describe("validateAttackSpec: target", () => {
  const bombAttack = (over: object) =>
    spreadAttack({ aim: "player", shots: 1 }, { projectileId: bombId, ...over });
  test("player target on a bomb passes", () => {
    attackAccepts(bombAttack({ target: "player" }));
  });
  test("non-player target rejected", () => {
    attackRejects(bombAttack({ target: "enemy" }));
  });
  test("target on a bullet rejected", () => {
    attackRejects(spreadAttack({}, { target: "player" }));
  });
  test("target needs a single-shot spread aimed at the player", () => {
    attackRejects(
      {
        ...scatterAttack({ aim: "player" }),
        projectileId: bombId,
        target: "player",
      },
    );
    attackRejects(
      spreadAttack({ shots: 2 }, { projectileId: bombId, target: "player" }),
    );
    attackRejects(
      spreadAttack(
        { aim: "front", offsetDegrees: 0 },
        { projectileId: bombId, target: "player" },
      ),
    );
  });
});

describe("validateAttackSpec: ring", () => {
  test("base ring accepted", () => attackAccepts(ringAttack({})));
  test("emitter radius nonnegative", () => {
    attackRejects(ringAttack({ emitterRadiusTiles: -1 }));
    attackAccepts(ringAttack({ emitterRadiusTiles: 0 }));
  });
  test("rotation and phase finite", () => {
    attackRejects(ringAttack({ clockwiseDegreesPerSecond: Number.NaN }));
    attackRejects(
      ringAttack({ clockwiseDegreesPerSecond: Number.POSITIVE_INFINITY }),
    );
    attackRejects(ringAttack({ initialPhaseRadians: Number.NaN }));
    attackRejects(ringAttack({ initialPhaseRadians: Number.POSITIVE_INFINITY }));
    attackAccepts(ringAttack({ clockwiseDegreesPerSecond: -30 }));
  });
  test("perBurstAdvanceDegrees finite", () => {
    attackRejects(ringAttack({ perBurstAdvanceDegrees: Number.NaN }));
    attackRejects(
      ringAttack({ perBurstAdvanceDegrees: Number.POSITIVE_INFINITY }),
    );
    attackAccepts(ringAttack({ perBurstAdvanceDegrees: 10 }));
  });
  test("gap sectors", () => {
    attackAccepts(ringAttack({ gapSectorsDegrees: [[0, 30]] }));
    attackAccepts(ringAttack({ gapSectorsDegrees: [] }));
    attackRejects(ringAttack({ gapSectorsDegrees: "x" }));
    attackRejects(ringAttack({ gapSectorsDegrees: [[0]] }));
    attackRejects(ringAttack({ gapSectorsDegrees: [[0, 1, 2]] }));
    attackRejects(ringAttack({ gapSectorsDegrees: ["ab"] }));
    attackRejects(ringAttack({ gapSectorsDegrees: [["0", 30]] }));
    attackRejects(ringAttack({ gapSectorsDegrees: [[0, "30"]] }));
    attackRejects(ringAttack({ gapSectorsDegrees: [[Number.NaN, 30]] }));
    attackRejects(
      ringAttack({ gapSectorsDegrees: [[0, Number.POSITIVE_INFINITY]] }),
    );
    attackRejects(ringAttack({ gapSectorsDegrees: [[0, 360]] }));
    attackRejects(
      ringAttack({
        gapSectorsDegrees: [
          [0, 200],
          [180, 380],
        ],
      }),
    );
    attackAccepts(
      ringAttack({
        gapSectorsDegrees: [
          [0, 100],
          [200, 300],
        ],
      }),
    );
  });
  test("arm spread options", () => {
    attackRejects(ringAttack({ armSpreadDegreesPerSecond: Number.NaN }));
    attackRejects(
      ringAttack({ armSpreadDegreesPerSecond: 0, maxArmSpreadDegrees: Number.NaN }),
    );
    attackRejects(ringAttack({ maxArmSpreadDegrees: -1 }));
    attackAccepts(ringAttack({ maxArmSpreadDegrees: 0 }));
    // four arms first collide at 360 / (4 * 3) = 30 degrees spread
    attackRejects(ringAttack({ arms: 4, maxArmSpreadDegrees: 30 }));
    attackRejects(ringAttack({ arms: 4, maxArmSpreadDegrees: 500 }));
    attackAccepts(ringAttack({ arms: 4, maxArmSpreadDegrees: 29.9 }));
    // one arm cannot collide with itself
    attackAccepts(ringAttack({ arms: 1, maxArmSpreadDegrees: 500 }));
    // nonzero rate needs a maximum
    attackRejects(ringAttack({ armSpreadDegreesPerSecond: 5 }));
    attackAccepts(
      ringAttack({ armSpreadDegreesPerSecond: 5, maxArmSpreadDegrees: 20 }),
    );
    attackAccepts(ringAttack({ armSpreadDegreesPerSecond: 0 }));
  });
});

describe("validateAttackSpec: arm patterns", () => {
  const arm = (armPattern: object) => ringAttack({ armPattern });
  test("single and ring", () => {
    attackAccepts(arm({ kind: "single" }));
    attackAccepts(arm({ kind: "ring", arms: 2 }));
    attackRejects(arm({ kind: "ring", arms: 0 }));
    attackRejects(arm({ kind: "ring", arms: 2, phaseOffsetDegrees: Number.NaN }));
    attackAccepts(arm({ kind: "ring", arms: 2, phaseOffsetDegrees: 15 }));
    attackRejects(
      arm({ kind: "ring", arms: 2, armPattern: { kind: "ring", arms: 0 } }),
    );
    attackAccepts(
      arm({ kind: "ring", arms: 2, armPattern: { kind: "single" } }),
    );
  });
  test("spread", () => {
    attackAccepts(arm({ kind: "spread", shots: 2, arcDegrees: 30 }));
    attackRejects(arm({ kind: "spread", shots: 0, arcDegrees: 30 }));
    attackRejects(arm({ kind: "spread", shots: 2, arcDegrees: -1 }));
    attackRejects(arm({ kind: "spread", shots: 2, arcDegrees: 360 }));
    attackRejects(arm({ kind: "spread", shots: 2, arcDegrees: 400 }));
    attackAccepts(arm({ kind: "spread", shots: 2, arcDegrees: 359 }));
    attackAccepts(arm({ kind: "spread", shots: 2, arcDegrees: 0 }));
  });
  test("scatter", () => {
    attackAccepts(arm({ kind: "scatter", shots: 2, coneDegrees: 360 }));
    attackRejects(arm({ kind: "scatter", shots: 0, coneDegrees: 30 }));
    attackRejects(arm({ kind: "scatter", shots: 2, coneDegrees: 0 }));
    attackRejects(arm({ kind: "scatter", shots: 2, coneDegrees: 361 }));
  });
  test("unknown kind rejected", () => {
    attackRejects(arm({ kind: "zigzag" }));
  });
});

describe("validateAttackSpec: spread and scatter", () => {
  test("spread", () => {
    attackRejects(spreadAttack({ emitterRadiusTiles: -1 }));
    attackRejects(spreadAttack({ arcDegrees: -1 }));
    attackRejects(spreadAttack({ arcDegrees: 360 }));
    attackRejects(spreadAttack({ arcDegrees: 500 }));
    attackAccepts(spreadAttack({ arcDegrees: 359 }));
    attackRejects(
      spreadAttack({ aim: "fixed", fixedBearingDegrees: Number.NaN }),
    );
    attackRejects(
      spreadAttack({ aim: "fixed", fixedBearingDegrees: Number.POSITIVE_INFINITY }),
    );
    attackAccepts(spreadAttack({ aim: "fixed", fixedBearingDegrees: 45 }));
    attackRejects(spreadAttack({ aim: "front", offsetDegrees: Number.NaN }));
    attackRejects(
      spreadAttack({ aim: "front", offsetDegrees: Number.POSITIVE_INFINITY }),
    );
    attackAccepts(spreadAttack({ aim: "front", offsetDegrees: 10 }));
    // other aims ignore the bearing/offset fields
    attackAccepts(spreadAttack({ aim: "player", fixedBearingDegrees: Number.NaN }));
    attackAccepts(
      spreadAttack({
        aim: "fixed",
        fixedBearingDegrees: 0,
        offsetDegrees: Number.NaN,
      }),
    );
    attackAccepts(
      spreadAttack({
        aim: "front",
        offsetDegrees: 0,
        fixedBearingDegrees: Number.NaN,
      }),
    );
  });
  test("scatter", () => {
    attackAccepts(scatterAttack({}));
    attackRejects(scatterAttack({ emitterRadiusTiles: -1 }));
    attackRejects(scatterAttack({ coneDegrees: 0 }));
    attackRejects(scatterAttack({ coneDegrees: 361 }));
    attackAccepts(scatterAttack({ coneDegrees: 360 }));
    attackRejects(
      scatterAttack({ aim: "fixed", fixedBearingDegrees: Number.NaN }),
    );
    attackRejects(
      scatterAttack({ aim: "fixed", fixedBearingDegrees: Number.POSITIVE_INFINITY }),
    );
    attackAccepts(scatterAttack({ aim: "fixed", fixedBearingDegrees: 1 }));
    attackRejects(scatterAttack({ aim: "front", offsetDegrees: Number.NaN }));
    attackRejects(
      scatterAttack({ aim: "front", offsetDegrees: Number.POSITIVE_INFINITY }),
    );
    attackAccepts(scatterAttack({ aim: "front", offsetDegrees: 1 }));
    attackAccepts(
      scatterAttack({
        aim: "fixed",
        fixedBearingDegrees: 0,
        offsetDegrees: Number.NaN,
      }),
    );
    attackAccepts(
      scatterAttack({
        aim: "front",
        offsetDegrees: 0,
        fixedBearingDegrees: Number.NaN,
      }),
    );
  });
});

describe("bounds and resolvers", () => {
  test("bulletOf / bombOf reject the wrong type and unknown ids", () => {
    expect(() => bulletOf(base, bombId)).toThrow(RangeError);
    expect(() => bombOf(base, bulletId)).toThrow(RangeError);
    expect(() => bulletOf(base, "nope")).toThrow(RangeError);
    expect(bulletOf(base, bulletId).type).toBe("bullet");
    expect(bombOf(base, bombId).type).toBe("bomb");
  });
  test("attackShardBound arithmetic", () => {
    const b = bulletOf(base, bulletId);
    const life =
      b.motion.kind === "boomerang"
        ? b.motion.lifetimeSeconds
        : b.motion.rangeTiles / b.speedTilesPerSecond;
    const a = ringAttack(
      { arms: 3 },
      {
        cadence: {
          shotsPerBurst: 2,
          shotIntervalSeconds: 0.5,
          cooldownAfterLastShotSeconds: 1.5,
          initialDelaySeconds: 0,
        },
      },
    );
    expect(attackShardBound(base, a)).toBe(3 * 2 * Math.ceil(life / 2));
    // nested arm pattern multiplies the volley
    const nested = ringAttack({
      arms: 3,
      armPattern: { kind: "ring", arms: 2, armPattern: { kind: "spread", shots: 5, arcDegrees: 10 } },
    });
    expect(attackShardBound(base, nested)).toBe(
      3 * 2 * 5 * Math.ceil(life / 1),
    );
    expect(
      attackShardBound(base, ringAttack({ arms: 3, armPattern: { kind: "single" } })),
    ).toBe(3 * Math.ceil(life / 1));
    expect(
      attackShardBound(
        base,
        ringAttack({ arms: 3, armPattern: { kind: "scatter", shots: 4, coneDegrees: 10 } }),
      ),
    ).toBe(12 * Math.ceil(life / 1));
    expect(attackShardBound(base, spreadAttack({ shots: 7 }))).toBe(
      7 * Math.ceil(life / 1),
    );
    const bomb = bombOf(base, bombId);
    expect(
      attackShardBound(base, spreadAttack({ shots: 2 }, { projectileId: bombId })),
    ).toBe(2 * Math.ceil(bomb.travelSeconds / 1));
  });
  test("liveShardBoundPerEnemy sums attacks plus the worst sub-phase", () => {
    const c = edited((x) => {
      const p = phase0(x);
      p.attacks = [spreadAttack({ shots: 2 }), spreadAttack({ shots: 3 })] as never;
      p.subPhases = [
        {
          id: "a",
          durationSeconds: 1,
          telegraphSeconds: 0,
          invulnerableOnEnterSeconds: 0,
          movement: null,
          attacks: [spreadAttack({ shots: 4 })],
          spawns: null,
        },
        {
          id: "b",
          durationSeconds: 1,
          telegraphSeconds: 0,
          invulnerableOnEnterSeconds: 0,
          movement: null,
          attacks: [spreadAttack({ shots: 6 }), spreadAttack({ shots: 1 })],
          spawns: null,
        },
      ] as never;
      primary(x).phases = [p];
    });
    const arch = c.archetypes[c.primaryArchetypeId];
    const one = attackShardBound(c, spreadAttack({ shots: 1 }));
    expect(liveShardBoundPerEnemy(c, arch)).toBe(one * (2 + 3 + 7));
    // phase without sub-phases
    const plain = edited((x) => {
      phase0(x).attacks = [spreadAttack({ shots: 2 })] as never;
      phase0(x).subPhases = null;
      primary(x).phases = [phase0(x)];
    });
    expect(
      liveShardBoundPerEnemy(plain, plain.archetypes[plain.primaryArchetypeId]),
    ).toBe(one * 2);
    const emptySub = edited((x) => {
      phase0(x).attacks = [spreadAttack({ shots: 2 })] as never;
      phase0(x).subPhases = [] as never;
      primary(x).phases = [phase0(x)];
    });
    expect(
      liveShardBoundPerEnemy(emptySub, emptySub.archetypes[emptySub.primaryArchetypeId]),
    ).toBe(one * 2);
  });
  test("encounter bound combines primary and minion bounds", () => {
    const c = edited((x) => {
      x.spawns.maxConcurrent = 3;
      x.maxConcurrentMinions = 4;
      primary(x).phases = [phase0(x)];
      phase0(x).attacks = [spreadAttack({ shots: 1 })] as never;
      phase0(x).subPhases = null;
      const minion = structuredClone(primary(x));
      minion.id = "minion";
      x.archetypes.minion = minion;
    });
    const one = attackShardBound(c, spreadAttack({ shots: 1 }));
    expect(liveShardBoundForEncounter(c)).toBe(one * 3 + one * 4);
    const largest = Math.max(
      ...Object.values(c.projectiles).map((p) => p.collisionPartsTiles.length),
    );
    expect(liveCollisionPartBoundForEncounter(c)).toBe(
      liveShardBoundForEncounter(c) * largest,
    );
  });
  test("bodyExtentTiles", () => {
    const v = [
      { x: -1, y: 2 },
      { x: 3, y: 5 },
      { x: 0, y: -1 },
    ];
    expect(bodyExtentTiles(v, "x")).toBe(4);
    expect(bodyExtentTiles(v, "y")).toBe(6);
  });
});
