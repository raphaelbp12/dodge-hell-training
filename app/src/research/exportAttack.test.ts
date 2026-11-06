import { describe, expect, test } from "vitest";
import { validateAttack } from "../game/config/data";
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
} from "./exportAttack";
import type { Tag } from "./tagging";

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

  test("a targeted attack keeps its target only while the export stays one player-aimed shot", () => {
    const single: AttackPattern = { ...SPREAD, shots: 1, arcDegrees: 0, emitterRadiusTiles: 0 };
    const config = configOf([{ ...attack("bomb", "white-bomb-v1", single), target: "player" }]);
    const bombSprite = QUEEN.projectiles["white-bomb-v1"]!.appearance!.id;
    const one = tag({ spriteId: bombSprite, pattern: "spread", aim: "player", shots: 1 });
    expect(exported(one, config).attack.target).toBe("player");
    const many = tag({ spriteId: bombSprite, pattern: "spread", aim: "player", shots: 3 });
    expect(exported(many, config).attack.target).toBeUndefined();
    // A `fixed` tag changes nothing (N39), so the authored player aim and target stay.
    const fixed = tag({ spriteId: bombSprite, pattern: "spread", aim: "fixed", shots: 1 });
    expect(exported(fixed, config).attack.target).toBe("player");
    const front = tag({ spriteId: bombSprite, pattern: "spread", aim: "front", shots: 1 });
    expect(exported(front, config).attack.target).toBeUndefined();
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
