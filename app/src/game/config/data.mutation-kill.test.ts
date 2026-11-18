import { describe, expect, test } from "vitest";
import appearancesData from "../data/projectile-appearances.json";
import encounterData from "../data/encounter.json";
import { PALADIN_DERIVED_STATS } from "./stats";
import {
  MAXIMUM_PATH_DEVIATION_TILES,
  turningDeviationTiles,
  validateAppearances,
  validateArchetypes,
  validateArenaMap,
  validateAttack,
  validateBody,
  validateEncounterData,
  validateMovement,
  validateOutline,
  validateProgression,
  validateProjectile,
  validateProjectiles,
  wavyDeviationTiles,
} from "./data";

// Mutation-kill tests for data.ts. Each rejection is asserted at the exact
// authored path, so a different later check cannot satisfy the test.

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(RangeError);
    return (error as Error).message;
  }
  throw new Error("expected the action to throw");
}

function expectRejectedAt(action: () => unknown, path: string): void {
  expect(messageOf(action).startsWith(`Authored data ${path} `)).toBe(true);
}

type Json = Record<string, any>;

// ---------------------------------------------------------------- appearances

const APPEARANCE = "appearances.appearances";
const bombAppearanceId = Object.entries(
  appearancesData.appearances as Record<string, Json>,
).find(([, value]) => value.template === "bomb-explosion")![0];
const pixelsAppearanceId = "red-stinger-small";

function appearances(edit: (data: Json) => void): () => unknown {
  const data = clone(appearancesData) as Json;
  edit(data);
  return () => validateAppearances(data);
}

describe("validateAppearances", () => {
  test("accepts the authored catalogue and keeps palettes, defaults and bomb frames", () => {
    const result = validateAppearances(clone(appearancesData));
    const pixels = result.appearances[pixelsAppearanceId];
    expect(pixels.palette).toEqual(
      (appearancesData.appearances as Json)[pixelsAppearanceId].palette,
    );
    expect(pixels.sourceUpscale).toBe(1);
    expect(result.templates["bomb-explosion"]).toEqual({
      kind: "bomb",
      frameOuterPixels: [4, 5, 7, 9, 13],
      borderPixels: 1,
    });
    expect(result.appearances[bombAppearanceId].bodyColor).toMatch(/^#/);
  });

  test("keeps an authored sourceUpscale and rejects a fractional one", () => {
    const keep = clone(appearancesData) as Json;
    keep.appearances[pixelsAppearanceId].sourceUpscale = 3;
    expect(validateAppearances(keep).appearances[pixelsAppearanceId].sourceUpscale).toBe(3);
    expectRejectedAt(
      appearances((data) => {
        data.appearances[pixelsAppearanceId].sourceUpscale = 1.5;
      }),
      `${APPEARANCE}.${pixelsAppearanceId}.sourceUpscale`,
    );
  });

  test.each(["#12345", "x#123456", "#1234567", "123456", "#12345g"])(
    "rejects the colour %p at its palette entry",
    (bad) => {
      expectRejectedAt(
        appearances((data) => {
          data.appearances[pixelsAppearanceId].palette.A = bad;
        }),
        `${APPEARANCE}.${pixelsAppearanceId}.palette.A`,
      );
    },
  );

  test.each(["AB", "aB", "Ab", "1"])("rejects the palette key %p", (key) => {
    expectRejectedAt(
      appearances((data) => {
        data.appearances[pixelsAppearanceId].palette[key] = "#123456";
      }),
      `${APPEARANCE}.${pixelsAppearanceId}.palette.${key}`,
    );
  });

  test("rejects an empty palette with the empty-palette reason", () => {
    const action = appearances((data) => {
      data.appearances[pixelsAppearanceId].palette = {};
    });
    expectRejectedAt(action, `${APPEARANCE}.${pixelsAppearanceId}.palette`);
    expect(messageOf(action)).toContain("at least one colour");
  });

  test("rejects a palette missing a colour the rows use", () => {
    const action = appearances((data) => {
      delete data.appearances[pixelsAppearanceId].palette.E;
    });
    expectRejectedAt(action, `${APPEARANCE}.${pixelsAppearanceId}.palette`);
    expect(messageOf(action)).toContain("missing colour E");
  });

  test("rejects a bomb appearance without A, B or a body colour", () => {
    const base = `${APPEARANCE}.${bombAppearanceId}`;
    expectRejectedAt(
      appearances((data) => {
        delete data.appearances[bombAppearanceId].palette.A;
      }),
      `${base}.palette`,
    );
    expectRejectedAt(
      appearances((data) => {
        delete data.appearances[bombAppearanceId].palette.B;
      }),
      `${base}.palette`,
    );
    expectRejectedAt(
      appearances((data) => {
        delete data.appearances[bombAppearanceId].bodyColor;
      }),
      `${base}.bodyColor`,
    );
    expectRejectedAt(
      appearances((data) => {
        data.appearances[bombAppearanceId].bodyColor = "nope";
      }),
      `${base}.bodyColor`,
    );
  });

  test("rejects a wrong template count and a wrong appearance count", () => {
    expectRejectedAt(
      appearances((data) => {
        delete data.templates["bomb-explosion"];
      }),
      "appearances.templates",
    );
    expectRejectedAt(
      appearances((data) => {
        data.templates.extra = clone(data.templates.ball);
      }),
      "appearances.templates",
    );
    expectRejectedAt(
      appearances((data) => {
        delete data.appearances[pixelsAppearanceId];
      }),
      APPEARANCE,
    );
  });

  describe("pixel templates", () => {
    const path = "appearances.templates.stinger-small";
    test("rejects both or neither of rows and frameOuterPixels", () => {
      expectRejectedAt(
        appearances((data) => {
          data.templates["stinger-small"].frameOuterPixels = [4];
        }),
        path,
      );
      expectRejectedAt(
        appearances((data) => {
          delete data.templates["stinger-small"].rows;
        }),
        path,
      );
    });

    test("rejects rows that are not an array or have the wrong count", () => {
      expectRejectedAt(
        appearances((data) => {
          data.templates["stinger-small"].rows = "AAABCDE";
        }),
        `${path}.rows`,
      );
      expectRejectedAt(
        appearances((data) => {
          data.templates["stinger-small"].rows = ["AAABCDE", "AAABCDE"];
        }),
        `${path}.rows`,
      );
    });

    test("rejects a row of the wrong width", () => {
      expectRejectedAt(
        appearances((data) => {
          data.templates["stinger-small"].rows = ["AAABCD"];
        }),
        `${path}.rows[0]`,
      );
    });

    test("rejects a row with a character that is not a palette letter or dot", () => {
      expectRejectedAt(
        appearances((data) => {
          data.templates["stinger-small"].rows = ["AAABCDe"];
        }),
        `${path}.rows[0]`,
      );
    });
  });

  describe("bomb templates", () => {
    const path = "appearances.templates.bomb-explosion";
    test.each([[[]], ["abc"]])("rejects frameOuterPixels %p", (frames) => {
      expectRejectedAt(
        appearances((data) => {
          data.templates["bomb-explosion"].frameOuterPixels = frames;
        }),
        `${path}.frameOuterPixels`,
      );
    });

    test("validates each frame size as a positive safe integer", () => {
      expectRejectedAt(
        appearances((data) => {
          data.templates["bomb-explosion"].frameOuterPixels = [4, 0];
        }),
        `${path}.frameOuterPixels[1]`,
      );
    });

    test("rejects a border that leaves no interior in any one frame", () => {
      // 2 * 2 = 4 equals the first frame exactly; only that frame is too small.
      expectRejectedAt(
        appearances((data) => {
          data.templates["bomb-explosion"].borderPixels = 2;
        }),
        `${path}.borderPixels`,
      );
      expectRejectedAt(
        appearances((data) => {
          data.templates["bomb-explosion"].frameOuterPixels = [9, 4];
          data.templates["bomb-explosion"].borderPixels = 2;
        }),
        `${path}.borderPixels`,
      );
    });
  });
});

// ----------------------------------------------------------- body and outline

describe("validateBody", () => {
  test("returns the shape and both sizes", () => {
    expect(
      validateBody(
        { shape: "beveled-octagon", widthTiles: 1.5, heightTiles: 2.5 },
        "b",
      ),
    ).toEqual({ shape: "beveled-octagon", widthTiles: 1.5, heightTiles: 2.5 });
  });

  test("rejects an undefined outline and a blank shape name at the shape", () => {
    const unknown = { shape: "no-such-outline", widthTiles: 1, heightTiles: 1 };
    expectRejectedAt(() => validateBody(unknown, "b"), "shapes.no-such-outline");
    const blank = { shape: "   ", widthTiles: 1, heightTiles: 1 };
    expectRejectedAt(() => validateBody(blank, "b"), "b.shape");
  });
});

describe("validateOutline vertex count", () => {
  const ring = (count: number) => {
    const base = [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
      [0.5, 1],
      [0, 1],
      [0, 0.5],
      [0.25, 0.25],
    ];
    return base.slice(0, count).map(([x, y]) => ({ x, y }));
  };
  const triangle = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];

  test("accepts exactly 3 and exactly 8 vertices", () => {
    expect(validateOutline(triangle, "t")).toHaveLength(3);
    expect(validateOutline(ring(8), "e")).toHaveLength(8);
  });

  test("rejects 2 and 9 vertices", () => {
    expectRejectedAt(
      () =>
        validateOutline(
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          "two",
        ),
      "shapes.two",
    );
    expectRejectedAt(() => validateOutline(ring(9), "nine"), "shapes.nine");
  });
});

// --------------------------------------------------------------------- arenas

describe("validateArenaMap hazards", () => {
  const arena = (region: Json) => ({
    arenas: {
      a: {
        kind: "circle",
        centerTiles: { x: 0, y: 0 },
        radiusTiles: 10,
        hazards: [{ kind: "honey", region }],
      },
    },
  });
  const annulus = (innerRadiusTiles: number, outerRadiusTiles: number) =>
    arena({ shape: "annulus", innerRadiusTiles, outerRadiusTiles });

  test("accepts an inner radius of exactly 0 and an outer radius equal to the circle radius", () => {
    expect(() => validateArenaMap(annulus(0, 10))).not.toThrow();
  });

  test("rejects a negative inner radius at the inner radius", () => {
    expectRejectedAt(
      () => validateArenaMap(annulus(-1, 5)),
      "arena.arenas.a.hazards[0].region.innerRadiusTiles",
    );
  });

  test("rejects a band wider than a circular arena's own radius", () => {
    expectRejectedAt(
      () => validateArenaMap(annulus(1, 10.5)),
      "arena.arenas.a.hazards[0].region.outerRadiusTiles",
    );
  });
});

// ------------------------------------------------------------ projectile maths

describe("path deviation", () => {
  test("wavyDeviationTiles follows 0.5 * amplitude * (2 pi f)^2 * step^2", () => {
    const expected = 0.5 * 0.8 * (2 * Math.PI) ** 2 * (1 / 60) ** 2;
    expect(wavyDeviationTiles(0.8, 1, 1 / 60)).toBeCloseTo(expected, 12);
  });

  /** Walks a few ulps around `guess` until `measure` equals `target` exactly. */
  function exactInput(
    measure: (input: number) => number,
    guess: number,
    target: number,
  ): number | undefined {
    for (let k = -64; k <= 64; k++) {
      const candidate = guess * (1 + k * Number.EPSILON);
      if (measure(candidate) === target) return candidate;
    }
    return undefined;
  }

  const bullet = (motion: Json, speed = 8) => ({
    source: "s",
    damageHp: 1,
    speedTilesPerSecond: speed,
    armorPiercing: false,
    conditions: [],
    body: { shape: "beveled-octagon", widthTiles: 1, heightTiles: 1 },
    expiration: "e",
    hitPolicy: "h",
    motion,
  });

  test("a turning path at exactly the bound is accepted", () => {
    const rate = exactInput(
      (value) => turningDeviationTiles(8, value, 1),
      (MAXIMUM_PATH_DEVIATION_TILES * 180) / Math.PI,
      MAXIMUM_PATH_DEVIATION_TILES,
    );
    expect(rate).toBeDefined();
    expect(() =>
      validateProjectile(
        bullet({ kind: "turning", rangeTiles: 5, turnRateDegreesPerSecond: rate }),
        "p",
        1,
      ),
    ).not.toThrow();
  });

  test("a wavy path at exactly the bound is accepted", () => {
    const amplitude = exactInput(
      (value) => wavyDeviationTiles(value, 1, 1),
      (2 * MAXIMUM_PATH_DEVIATION_TILES) / (2 * Math.PI) ** 2,
      MAXIMUM_PATH_DEVIATION_TILES,
    );
    expect(amplitude).toBeDefined();
    expect(() =>
      validateProjectile(
        bullet({ kind: "wavy", rangeTiles: 5, amplitudeTiles: amplitude, frequencyHz: 1 }),
        "p",
        1,
      ),
    ).not.toThrow();
  });

  test("a path beyond the bound is rejected at the motion field", () => {
    expectRejectedAt(
      () =>
        validateProjectile(
          bullet({ kind: "turning", rangeTiles: 5, turnRateDegreesPerSecond: 70 }),
          "p",
          1,
        ),
      "projectiles.projectiles.p.motion.turnRateDegreesPerSecond",
    );
    expectRejectedAt(
      () =>
        validateProjectile(
          bullet({ kind: "wavy", rangeTiles: 5, amplitudeTiles: 0.8, frequencyHz: 1 }),
          "p",
          1,
        ),
      "projectiles.projectiles.p.motion.amplitudeTiles",
    );
  });
});

// ------------------------------------------------------------------ projectiles

describe("validateProjectile", () => {
  const base = {
    source: "s",
    damageHp: 1,
    speedTilesPerSecond: 8,
    armorPiercing: false,
    conditions: [],
    expiration: "e",
    hitPolicy: "h",
    motion: { kind: "linear", rangeTiles: 5 },
  };
  const withBody = {
    ...base,
    body: { shape: "beveled-octagon", widthTiles: 1, heightTiles: 1 },
  };
  const path = "projectiles.projectiles.p";

  test("keeps the appearance name only when one is authored", () => {
    const ids = new Set(["look"]);
    const looked = validateProjectile({ ...base, appearance: "look" }, "p", 1 / 60, ids);
    expect(looked.appearance).toBe("look");
    expect(looked).not.toHaveProperty("body");
    const bodied = validateProjectile(withBody, "p", 1 / 60, ids);
    expect(bodied).not.toHaveProperty("appearance");
    expect(bodied.body).toBeDefined();
  });

  test("rejects an unknown type at the type field", () => {
    expectRejectedAt(
      () => validateProjectile({ ...withBody, type: "banana" }, "p", 1 / 60),
      `${path}.type`,
    );
  });

  test("returns the exact motion for linear and boomerang", () => {
    // A bomb has no motion, so narrow the validated projectile before reading it.
    const motionOf = (projectile: ReturnType<typeof validateProjectile>) =>
      "motion" in projectile ? projectile.motion : undefined;
    expect(motionOf(validateProjectile(withBody, "p", 1 / 60))).toEqual({
      kind: "linear",
      rangeTiles: 5,
    });
    const boomerang = { kind: "boomerang", reversalAgeSeconds: 1, lifetimeSeconds: 2 };
    expect(motionOf(validateProjectile({ ...withBody, motion: boomerang }, "p", 1 / 60))).toEqual(
      boomerang,
    );
  });

  test("rejects an unknown motion kind at the kind field", () => {
    expectRejectedAt(
      () => validateProjectile({ ...withBody, motion: { kind: "bogus" } }, "p", 1 / 60),
      `${path}.motion.kind`,
    );
  });

  test("rejects an empty catalogue at the catalogue path", () => {
    expectRejectedAt(
      () => validateProjectiles({ projectiles: {} }, 1 / 60),
      "projectiles.projectiles",
    );
  });
});

// --------------------------------------------------------------------- attacks

describe("validateAttack", () => {
  const ids = new Set(["proj"]);
  const cadence = {
    shotsPerBurst: 1,
    shotIntervalSeconds: 1,
    cooldownAfterLastShotSeconds: 1,
    initialDelaySeconds: 0,
  };
  const ring = (extra: Json = {}) => ({
    kind: "ring",
    arms: 3,
    emitterRadiusTiles: 0,
    initialPhaseDegrees: 0,
    clockwiseDegreesPerSecond: 0,
    ...extra,
  });
  const attack = (pattern: Json, id = "a") => ({
    id,
    projectile: "proj",
    tuningSource: "approved-v3",
    pattern,
    cadence,
  });
  const run = (pattern: Json) => () =>
    validateAttack(attack(pattern), "atk", ids, new Set<string>());

  test("rejects a repeated attack id sharing one seen set", () => {
    const seen = new Set<string>();
    validateAttack(attack(ring()), "atk", ids, seen);
    expectRejectedAt(() => validateAttack(attack(ring()), "atk2", ids, seen), "atk2.id");
  });

  test("rejects an unknown pattern kind at the kind field", () => {
    expectRejectedAt(run({ kind: "bogus" }), "atk.pattern.kind");
  });

  test("rejects an unknown inner arm kind at the arm's kind field", () => {
    expectRejectedAt(
      run(ring({ armPattern: { kind: "bogus" } })),
      "atk.pattern.armPattern.kind",
    );
  });

  test("rejects a 360 degree gap sector at the sector itself", () => {
    expectRejectedAt(
      run(ring({ gapSectorsDegrees: [[0, 360]] })),
      "atk.pattern.gapSectorsDegrees[0]",
    );
  });

  test("handles the arm-spread extensions precisely", () => {
    const zeroRate = validateAttack(
      attack(ring({ armSpreadDegreesPerSecond: 0 })),
      "atk",
      ids,
      new Set(),
    );
    expect(zeroRate.pattern).toHaveProperty("armSpreadDegreesPerSecond", 0);
    expect(zeroRate.pattern).not.toHaveProperty("maxArmSpreadDegrees");

    const plain = validateAttack(attack(ring()), "atk", ids, new Set());
    expect(plain.pattern).not.toHaveProperty("armSpreadDegreesPerSecond");
    expect(plain.pattern).not.toHaveProperty("maxArmSpreadDegrees");

    const zeroMax = validateAttack(
      attack(ring({ maxArmSpreadDegrees: 0 })),
      "atk",
      ids,
      new Set(),
    );
    expect(zeroMax.pattern).toHaveProperty("maxArmSpreadDegrees", 0);

    expectRejectedAt(
      run(ring({ maxArmSpreadDegrees: -1 })),
      "atk.pattern.maxArmSpreadDegrees",
    );
    expectRejectedAt(
      run(ring({ armSpreadDegreesPerSecond: 5 })),
      "atk.pattern.maxArmSpreadDegrees",
    );
    // A one-arm ring has no collision limit; a three-arm ring caps at 60.
    expect(() => run(ring({ arms: 1, maxArmSpreadDegrees: 1000 }))()).not.toThrow();
    expectRejectedAt(
      run(ring({ maxArmSpreadDegrees: 60 })),
      "atk.pattern.maxArmSpreadDegrees",
    );
    expect(() => run(ring({ maxArmSpreadDegrees: 59 }))()).not.toThrow();
  });
});

// -------------------------------------------------------------------- movement

describe("validateMovement and validateProgression results", () => {
  test("return the exact authored shape", () => {
    expect(validateMovement({ kind: "chase", speedTilesPerSecond: 2 }, "m")).toEqual({
      kind: "chase",
      speedTilesPerSecond: 2,
    });
    expect(
      validateMovement(
        { kind: "move-to-point", target: "arena-center", speedTilesPerSecond: 3 },
        "m",
      ),
    ).toEqual({ kind: "move-to-point", target: "arena-center", speedTilesPerSecond: 3 });
    expect(validateProgression({ kind: "none" }, "p")).toEqual({ kind: "none" });
  });

  test("an unknown progression kind is rejected at its kind", () => {
    expectRejectedAt(() => validateProgression({ kind: "bogus" }, "p"), "p.kind");
  });

  test("an orbit whose tangential speed equals the Paladin's is rejected", () => {
    const speed = PALADIN_DERIVED_STATS.speedTilesPerSecond;
    // Search a radius and turn rate whose product is exactly the Paladin's speed.
    let found: { radius: number; degrees: number } | undefined;
    for (let degrees = 1; degrees <= 400 && !found; degrees++) {
      const rate = (degrees * Math.PI) / 180;
      for (let k = -64; k <= 64 && !found; k++) {
        const radius = (speed / rate) * (1 + k * Number.EPSILON);
        if (radius * rate === speed) found = { radius, degrees };
      }
    }
    expect(found).toBeDefined();
    const orbit = (radiusTiles: number) => () =>
      validateMovement(
        {
          kind: "orbit",
          radiusTiles,
          degreesPerSecond: found!.degrees,
          direction: "cw",
          approachSpeedTilesPerSecond: 1,
        },
        "m",
      );
    expectRejectedAt(orbit(found!.radius), "m");
    expect(orbit(found!.radius * 0.99)).not.toThrow();
  });
});

// ------------------------------------------------------------------ archetypes

describe("validateArchetypes", () => {
  const phase = (extra: Json = {}): Json => ({
    id: "p",
    enterAtHpFraction: 1,
    exitAfterSeconds: null,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    telegraphColor: "white",
    movement: { kind: "stationary" },
    progression: null,
    attacks: [],
    ...extra,
  });
  const archetype = (phases: Json[], extra: Json = {}): Json => ({
    spawnTiles: { x: 0, y: 0 },
    body: { shape: "beveled-octagon", widthTiles: 1, heightTiles: 1 },
    contactDamageHp: 0,
    contactConditions: [],
    contactArmorPiercing: false,
    contactCooldownSeconds: 0,
    blocksPlayer: false,
    phases,
    ...extra,
  });
  const load = (archetypes: Record<string, Json>, max = 12) =>
    validateArchetypes({ archetypes }, new Set(["proj"]), max);
  const one = (phases: Json[], extra: Json = {}) => load({ a: archetype(phases, extra) }).a;
  const ARCH = "enemies.archetypes.a";
  const spawn = (extra: Json = {}): Json => ({
    archetype: "a",
    count: 1,
    despawnOnExit: false,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
    ...extra,
  });

  test("keeps an authored initial heading and omits an absent one", () => {
    expect(one([phase()], { initialHeadingDegrees: 45 }).initialHeadingDegrees).toBe(45);
    expect(one([phase()])).not.toHaveProperty("initialHeadingDegrees");
  });

  test("keeps a real progression and a null one on a phase", () => {
    const withProgression = one([
      phase({ progression: { kind: "simulated-dps", hpPerSecond: 3 } }),
    ]);
    expect(withProgression.phases[0].progression).toEqual({
      kind: "simulated-dps",
      hpPerSecond: 3,
    });
    expect(one([phase()]).phases[0].progression).toBeNull();
    const none = one([phase({ progression: { kind: "none" } })]);
    expect(none.phases[0].progression).toEqual({ kind: "none" });
  });

  test("a sub-phase keeps its own movement, or null when absent or null", () => {
    const sub = (extra: Json = {}): Json => ({
      id: "s",
      durationSeconds: 1,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      attacks: [],
      ...extra,
    });
    const movements = one([
      phase({
        subPhases: [
          sub({ movement: { kind: "stationary" } }),
          sub(),
          sub({ movement: null }),
        ],
      }),
    ]).phases[0].subPhases!;
    expect(movements[0].movement).toEqual({ kind: "stationary" });
    expect(movements[1].movement).toBeNull();
    expect(movements[2].movement).toBeNull();
    expectRejectedAt(
      () => one([phase({ subPhases: [sub({ movement: "nope" })] })]),
      `${ARCH}.phases[0].subPhases[0].movement`,
    );
  });

  test("null sub-phases and null spawns on a phase become null", () => {
    const built = one([phase({ subPhases: null, spawns: null })]).phases[0];
    expect(built.subPhases).toBeNull();
    expect(built.spawns).toBeNull();
  });

  test("a spawn defaults startPhaseIndex to 0 and keeps both placements", () => {
    const built = one([
      phase({
        spawns: [
          spawn(),
          spawn({ placement: { kind: "arena-ring", ringRadiusFraction: 0.5 } }),
        ],
      }),
    ]).phases[0].spawns!;
    expect(built[0].startPhaseIndex).toBe(0);
    expect(built[0].placement).toEqual({ kind: "ring-around-owner", radiusTiles: 2 });
    expect(built[1].placement).toEqual({ kind: "arena-ring", ringRadiusFraction: 0.5 });
  });

  test("a spawn count may equal the minion cap but not exceed it", () => {
    expect(
      one([phase({ spawns: [spawn({ count: 12 })] })]).phases[0].spawns![0].count,
    ).toBe(12);
    expectRejectedAt(
      () => one([phase({ spawns: [spawn({ count: 13 })] })]),
      `${ARCH}.phases[0].spawns[0].count`,
    );
  });

  test("startPhaseIndex must be a safe integer inside the spawned archetype", () => {
    expectRejectedAt(
      () => one([phase({ spawns: [spawn({ startPhaseIndex: 1.5 })] })]),
      `${ARCH}.phases[0].spawns[0].startPhaseIndex`,
    );
    // The archetype has exactly one phase, so index 1 is one past the end.
    expectRejectedAt(
      () => one([phase({ spawns: [spawn({ startPhaseIndex: 1 })] })]),
      `${ARCH}.phases[0].spawns`,
    );
    expect(
      one([phase({ spawns: [spawn({ startPhaseIndex: 0 })] })]).phases[0].spawns![0]
        .startPhaseIndex,
    ).toBe(0);
  });

  test("a spawn naming an archetype that does not exist is rejected", () => {
    expectRejectedAt(
      () => one([phase({ spawns: [spawn({ archetype: "ghost" })] })]),
      `${ARCH}.phases[0].spawns`,
    );
  });

  test("a rising entry fraction is rejected even after a duration-exit phase", () => {
    expectRejectedAt(
      () =>
        one([
          phase(),
          phase({ id: "q", enterAtHpFraction: 0.5, exitAfterSeconds: 10 }),
          phase({ id: "r", enterAtHpFraction: 0.8 }),
        ]),
      `${ARCH}.phases[2].enterAtHpFraction`,
    );
    // An equal fraction is allowed only after a duration-exit phase.
    expect(() =>
      one([phase({ exitAfterSeconds: 10 }), phase({ id: "q", enterAtHpFraction: 1 })]),
    ).not.toThrow();
    expectRejectedAt(
      () => one([phase(), phase({ id: "q", enterAtHpFraction: 1 })]),
      `${ARCH}.phases[1].enterAtHpFraction`,
    );
  });
});

// ------------------------------------------------------------------- encounter

describe("validateEncounterData", () => {
  const encounter = (edit: (data: Json) => void = () => undefined) => {
    const data = clone(encounterData) as Json;
    edit(data);
    return () => validateEncounterData(data);
  };

  test("keeps every shared block", () => {
    const result = encounter()();
    expect(result.simulation.fixedStepSeconds).toBeCloseTo(1 / 60, 12);
    expect(result.simulation.maxStepsPerUpdate).toBe(8);
    expect(result.player.spawnTiles).toEqual({ x: 0, y: 0 });
    expect(result.player.body.shape).toBe("beveled-octagon");
    expect(result.camera).toEqual({
      cssPixelsPerTile: 32,
      defaultZoom: 1,
      minZoom: 0.25,
      maxZoom: 3,
      zoomStep: 0.125,
    });
    expect(result.presentation.lobTelegraphSeconds).toBe(0.3);
    expect(result.encounters["crystal-worm"].session).toEqual({
      startCountdownSeconds: 3,
      retryCountdownSeconds: 0,
      historyLimit: 100,
    });
  });

  test("zoom bounds are inclusive at both ends and rejected beyond", () => {
    const zoom = (min: number, max: number, current: number) =>
      encounter((data) => {
        data.camera.minZoom = min;
        data.camera.maxZoom = max;
        data.camera.defaultZoom = current;
      });
    expect(zoom(1, 1, 1)).not.toThrow();
    expect(zoom(1, 2, 1)).not.toThrow();
    expect(zoom(1, 2, 2)).not.toThrow();
    expectRejectedAt(zoom(1, 2, 0.5), "encounter.camera.defaultZoom");
    expectRejectedAt(zoom(1, 2, 3), "encounter.camera.defaultZoom");
    expectRejectedAt(zoom(2, 1, 1.5), "encounter.camera.defaultZoom");
  });
});
