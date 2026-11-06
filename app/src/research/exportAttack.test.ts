import { describe, expect, test } from "vitest";
import { validateAttack, validateProjectile } from "../game/config/data";
import {
  ENCOUNTER_CONFIGS,
  primaryArchetype,
  type AttackPattern,
  type AttackSpec,
  type EncounterConfig,
} from "../game/config/encounter";
import {
  attackJson,
  authoredAttackFromTag,
  EXPORT_ATTACK_ID_SUFFIX,
  EXPORT_TUNING_SOURCE,
  slugOf,
} from "./exportAttack";
import type { SavedAttack, Tag } from "./tagging";

const QUEEN = ENCOUNTER_CONFIGS["killer-bee-queen"]!;
const PRIMARY = primaryArchetype(QUEEN);

const RING: AttackPattern = {
  kind: "ring",
  arms: 3,
  emitterRadiusTiles: 0.5,
  initialPhaseRadians: (30 * Math.PI) / 180,
  clockwiseDegreesPerSecond: 60,
};
const SPREAD: AttackPattern = {
  kind: "spread",
  shots: 3,
  arcDegrees: 40,
  aim: "player",
  emitterRadiusTiles: 0.25,
};
const SCATTER: AttackPattern = {
  kind: "scatter",
  shots: 4,
  coneDegrees: 40,
  aim: "fixed",
  fixedBearingDegrees: 90,
  emitterRadiusTiles: 0,
};

const baseAttack = PRIMARY.phases[0]!.attacks[0]!;
const attack = (id: string, projectileId: string, pattern: AttackPattern): AttackSpec => ({
  ...baseAttack,
  id,
  projectileId,
  pattern,
  tuningSource: "trainer-authored",
});

/** A config whose phase 0 fires the given attacks of one Queen sprite. */
function configOf(attacks: readonly AttackSpec[]): EncounterConfig {
  return {
    ...QUEEN,
    archetypes: {
      [PRIMARY.id]: {
        ...PRIMARY,
        phases: [{ ...PRIMARY.phases[0]!, subPhases: null, attacks }],
      },
    },
  };
}

const PROJECTILE = "red-glaive-v1";
const SPRITE = QUEEN.projectiles[PROJECTILE]!.appearance!.id;
const CONFIG = configOf([
  attack("ring", PROJECTILE, RING),
  attack("spread", PROJECTILE, SPREAD),
  attack("scatter", PROJECTILE, SCATTER),
]);

const tag = (overrides: Partial<Tag> = {}): Tag => ({
  timeSeconds: 10,
  phaseIndex: 0,
  spriteId: SPRITE,
  pattern: "rotating-arm",
  shots: 4,
  ...overrides,
});

const exported = (entry: Tag, config = CONFIG) => {
  const result = authoredAttackFromTag(entry, config);
  if (!result) throw new Error("expected an export");
  return result;
};

/** An exported snippet must always be valid for enemies.json. */
const valid = (entry: Tag, config = CONFIG) =>
  validateAttack(
    JSON.parse(JSON.stringify(exported(entry, config).attack)),
    "export",
    new Set([PROJECTILE]),
    new Set(),
  );

describe("authoredAttackFromTag", () => {
  test("an unmatched tag cannot export", () => {
    expect(authoredAttackFromTag(tag({ spriteId: "nope" }), CONFIG)).toBeNull();
    expect(authoredAttackFromTag(tag({ pattern: "volley" }), CONFIG)).toBeNull();
    expect(authoredAttackFromTag(tag({ phaseIndex: 9 }), CONFIG)).toBeNull();
  });

  test("a plain rotating tag takes its id, projectile and cadence from the match", () => {
    const { attack: result } = exported(tag());
    expect(result.id).toBe(`ring${EXPORT_ATTACK_ID_SUFFIX}`);
    expect(EXPORT_ATTACK_ID_SUFFIX).toBe("-tagged");
    expect(result.projectile).toBe(PROJECTILE);
    expect(result.tuningSource).toBe(EXPORT_TUNING_SOURCE);
    expect(EXPORT_TUNING_SOURCE).toBe("video-observation");
    expect(result.cadence).toEqual(baseAttack.cadence);
    expect(result.pattern).toMatchObject({
      kind: "ring",
      arms: 4,
      emitterRadiusTiles: 0.5,
      clockwiseDegreesPerSecond: 60,
    });
    expect(result.target).toBeUndefined();
    expect(() => valid(tag())).not.toThrow();
  });

  test("the authored phase is converted back to degrees", () => {
    const { pattern } = exported(tag()).attack;
    expect(pattern).toMatchObject({ initialPhaseDegrees: 30 });
    expect(pattern).not.toHaveProperty("initialPhaseRadians");
  });

  test("a composite with a typed cone exports its arm pattern", () => {
    const entry = tag({ armPattern: "spread", shotsPerArm: 3, armArcDegrees: 25 });
    expect(exported(entry).attack.pattern).toMatchObject({
      arms: 4,
      armPattern: { kind: "spread", shots: 3, arcDegrees: 25 },
    });
    expect(() => valid(entry)).not.toThrow();
    const ring = tag({ armPattern: "ring", shotsPerArm: 2 });
    expect(exported(ring).attack.pattern).toMatchObject({
      armPattern: { kind: "ring", arms: 2 },
    });
    expect(() => valid(ring)).not.toThrow();
  });

  test("typed rotation is exported, measured at the first tag", () => {
    const entry = tag({ clockwiseDegreesPerSecond: -45, initialPhaseDegrees: 70 });
    expect(exported(entry).attack.pattern).toMatchObject({
      clockwiseDegreesPerSecond: -45,
      initialPhaseDegrees: 70,
    });
    expect(() => valid(entry)).not.toThrow();
  });

  test("a fixed-ring exports rate 0", () => {
    const entry = tag({ pattern: "fixed-ring" });
    expect(exported(entry).attack.pattern).toMatchObject({
      clockwiseDegreesPerSecond: 0,
      initialPhaseDegrees: 30,
    });
    expect(() => valid(entry)).not.toThrow();
  });

  test("spread and scatter tags export their aim and shots", () => {
    const spread = tag({ pattern: "spread", aim: "player", shots: 5 });
    expect(exported(spread).attack.pattern).toMatchObject({
      kind: "spread",
      shots: 5,
      aim: "player",
    });
    const scatter = tag({ pattern: "scatter", aim: "fixed", shots: 2 });
    expect(exported(scatter).attack.pattern).toMatchObject({
      kind: "scatter",
      shots: 2,
      aim: "fixed",
      fixedBearingDegrees: 90,
    });
    expect(() => valid(spread)).not.toThrow();
    expect(() => valid(scatter)).not.toThrow();
  });

  test("a front tag exports aim front and reports it", () => {
    const entry = tag({ pattern: "spread", aim: "front", shots: 1 });
    const result = exported(entry);
    expect(result.attack.pattern).toMatchObject({ aim: "front", offsetDegrees: 0 });
    expect(result.aimsFront).toBe(true);
    expect(() => valid(entry)).not.toThrow();
    expect(exported(tag()).aimsFront).toBe(false);
  });

  test("the tag, not the matched attack, decides the target (S02, S09)", () => {
    const single: AttackPattern = { ...SPREAD, shots: 1, arcDegrees: 0, emitterRadiusTiles: 0 };
    const config = configOf([{ ...attack("bomb", "white-bomb-v1", single), target: "player" }]);
    const bombSprite = QUEEN.projectiles["white-bomb-v1"]!.appearance!.id;
    const bomb = (overrides: Partial<Tag>) =>
      tag({ spriteId: bombSprite, pattern: "spread", aim: "player", shots: 1, ...overrides });
    expect(exported(bomb({ target: "player" }), config).attack.target).toBe("player");
    expect(exported(bomb({}), config).attack.target).toBeUndefined();
    expect(exported(bomb({ shots: 3, target: "player" }), config).attack.target).toBeUndefined();
    // A fixed tag never exports as player-aimed or targeted; it needs a bearing.
    expect(authoredAttackFromTag(bomb({ aim: "fixed" }), config)).toBeNull();
    const fixed = exported(bomb({ aim: "fixed", fixedBearingDegrees: 90 }), config);
    expect(fixed.attack.target).toBeUndefined();
    expect(fixed.attack.pattern).toMatchObject({ aim: "fixed", fixedBearingDegrees: 90 });
    const front = exported(bomb({ aim: "front" }), config);
    expect(front.attack.target).toBeUndefined();
  });

  test("the result is plain JSON", () => {
    const { attack: result } = exported(
      tag({ armPattern: "scatter", shotsPerArm: 2, armArcDegrees: 30 }),
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe("attackJson", () => {
  test("pretty-prints two-space JSON that parses back to the attack", () => {
    const { attack: result } = exported(tag());
    const text = attackJson(result);
    expect(text).toContain('\n  "id": "ring-tagged"');
    expect(JSON.parse(text)).toEqual(result);
  });
});

describe("projectile variants (V16 S13, S24)", () => {
  const BOMB = "white-bomb-v1";
  const bombSprite = QUEEN.projectiles[BOMB]!.appearance!.id;
  const single: AttackPattern = { ...SPREAD, shots: 1, arcDegrees: 0, emitterRadiusTiles: 0 };
  const bombConfig = configOf([attack("bomb", BOMB, single)]);
  const bombTag = (overrides: Partial<Tag> = {}) =>
    tag({ spriteId: bombSprite, pattern: "spread", aim: "player", shots: 1, ...overrides });
  const appearanceIds = new Set(Object.values(QUEEN.projectiles).flatMap((p) => (p.appearance ? [p.appearance.id] : [])));

  test("untyped bombs and bullets have no variant", () => {
    expect(exported(bombTag(), bombConfig).projectileVariant).toBeUndefined();
    expect(exported(tag()).projectileVariant).toBeUndefined();
  });

  test("a typed bomb range or time gives a valid variant its attack references", () => {
    for (const typed of [{ bombRangeTiles: 4 }, { bombTravelSeconds: 1.5 }, { bombRangeTiles: 4, bombTravelSeconds: 1.5 }]) {
      const result = exported(bombTag(typed), bombConfig);
      const variant = result.projectileVariant!;
      expect(variant.id).toBe(`${BOMB}${EXPORT_ATTACK_ID_SUFFIX}`);
      expect(result.attack.projectile).toBe(variant.id);
      expect(variant.entry).not.toHaveProperty("id");
      expect(variant.entry).not.toHaveProperty("speedTilesPerSecond");
      expect(variant.entry.type).toBe("bomb");
      expect(() =>
        validateProjectile(JSON.parse(JSON.stringify(variant.entry)), variant.id, 1 / 60, appearanceIds),
      ).not.toThrow();
      expect(() =>
        validateAttack(JSON.parse(JSON.stringify(result.attack)), "export", new Set([variant.id]), new Set()),
      ).not.toThrow();
    }
  });

  test("a targeted bomb exports flight time but never range", () => {
    const result = exported(
      bombTag({ target: "player", bombTravelSeconds: 2 }),
      bombConfig,
    );
    expect(result.attack.target).toBe("player");
    expect(result.projectileVariant!.entry.travelSeconds).toBe(2);
    expect(result.projectileVariant!.entry.rangeTiles).toBe(QUEEN.projectiles[BOMB]!.type === "bomb" ? (QUEEN.projectiles[BOMB] as { rangeTiles: number }).rangeTiles : 0);
  });

  test("typed linear bullet speed and range give a valid variant without a type", () => {
    const linearId = Object.keys(QUEEN.projectiles).find((id) => {
      const spec = QUEEN.projectiles[id]!;
      return spec.type !== "bomb" && spec.motion.kind === "linear" && spec.appearance;
    })!;
    const sprite = QUEEN.projectiles[linearId]!.appearance!.id;
    const config = configOf([attack("linear", linearId, { ...SPREAD, shots: 1, emitterRadiusTiles: 0 })]);
    const result = exported(
      tag({ spriteId: sprite, pattern: "spread", aim: "player", shots: 1, bulletSpeedTilesPerSecond: 5, bulletRangeTiles: 9 }),
      config,
    );
    const variant = result.projectileVariant!;
    expect(variant.entry).not.toHaveProperty("type");
    expect(variant.entry.speedTilesPerSecond).toBe(5);
    expect(variant.entry.motion).toMatchObject({ kind: "linear", rangeTiles: 9 });
    expect(() =>
      validateProjectile(JSON.parse(JSON.stringify(variant.entry)), variant.id, 1 / 60, appearanceIds),
    ).not.toThrow();
  });

});

describe("linked tag export (V16 step 61.4)", () => {
  const saved = (overrides: Partial<SavedAttack> = {}): SavedAttack => ({
    id: "attack-1",
    name: "Slow Spiral!",
    spriteId: SPRITE,
    pattern: "rotating-arm",
    shots: 4,
    cadence: { shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0.4 },
    ...overrides,
  });
  const linkedTag = tag();

  test("slugOf keeps lowercase letters, digits and hyphens and never returns empty", () => {
    expect(slugOf("Slow Spiral!", "attack-1")).toBe("slow-spiral");
    expect(slugOf("  --A__b2  ", "attack-1")).toBe("a-b2");
    expect(slugOf("!!!", "attack-7")).toBe("attack-7");
  });

  test("two saved attacks from one match give different ids", () => {
    const first = authoredAttackFromTag(linkedTag, CONFIG, saved())!;
    const second = authoredAttackFromTag(linkedTag, CONFIG, saved({ id: "attack-2", name: "Other" }))!;
    expect(first.attack.id).toBe("slow-spiral-tagged");
    expect(second.attack.id).toBe("other-tagged");
  });

  test("cadence comes from the saved attack at one and at three shots per burst", () => {
    const one = authoredAttackFromTag(linkedTag, CONFIG, saved())!.attack.cadence;
    expect(one).toMatchObject({ shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0.4 });
    const three = authoredAttackFromTag(
      linkedTag,
      CONFIG,
      saved({
        cadence: { shotsPerBurst: 3, shotIntervalSeconds: 0.15, cooldownAfterLastShotSeconds: 1.2 },
      }),
    )!.attack.cadence;
    expect(three).toMatchObject({
      shotsPerBurst: 3,
      shotIntervalSeconds: 0.15,
      cooldownAfterLastShotSeconds: 1.2,
    });
    expect(one.initialDelaySeconds).toBe(baseAttack.cadence.initialDelaySeconds);
  });

  test("a symbols-only name falls back to the stable id and the result is valid", () => {
    const result = authoredAttackFromTag(linkedTag, CONFIG, saved({ name: "???" }))!;
    expect(result.attack.id).toBe("attack-1-tagged");
    expect(() =>
      validateAttack(JSON.parse(JSON.stringify(result.attack)), "export", new Set([PROJECTILE]), new Set()),
    ).not.toThrow();
  });

  test("a linked variant takes the saved attack's slug; unlinked export is unchanged", () => {
    const bomb = "white-bomb-v1";
    const sprite = QUEEN.projectiles[bomb]!.appearance!.id;
    const config = configOf([attack("bomb", bomb, { ...SPREAD, shots: 1, arcDegrees: 0, emitterRadiusTiles: 0 })]);
    const typed = tag({ spriteId: sprite, pattern: "spread", aim: "player", shots: 1, bombRangeTiles: 4 });
    const linked = authoredAttackFromTag(typed, config, saved())!;
    expect(linked.projectileVariant!.id).toBe("slow-spiral-tagged");
    expect(linked.attack.projectile).toBe("slow-spiral-tagged");
    const loose = authoredAttackFromTag(typed, config)!;
    expect(loose.attack.id).toBe("bomb-tagged");
    expect(loose.projectileVariant!.id).toBe("white-bomb-v1-tagged");
  });
});
