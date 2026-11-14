import { describe, expect, test } from "vitest";
import { validateProjectile } from "../game/config/data";
import { ENCOUNTER_CONFIGS } from "../game/config/encounter";
import { projectileVariantOf, slugOf } from "./exportAttack";
import type { Tag } from "./tagging";

const QUEEN = ENCOUNTER_CONFIGS["killer-bee-queen"]!;
const BOMB = "white-bomb-v1";
const appearanceIds = new Set(
  Object.values(QUEEN.projectiles).flatMap((p) => (p.appearance ? [p.appearance.id] : [])),
);
const tag = (overrides: Partial<Tag> = {}): Tag => ({
  timeSeconds: 10,
  phaseIndex: 0,
  spriteId: "s",
  pattern: "spread",
  aim: "player",
  shots: 1,
  ...overrides,
});
const valid = (variant: { id: string; entry: Record<string, unknown> }) =>
  expect(() =>
    validateProjectile(JSON.parse(JSON.stringify(variant.entry)), variant.id, 1 / 60, appearanceIds),
  ).not.toThrow();

test("slugOf keeps lowercase letters, digits and hyphens and never returns empty", () => {
  expect(slugOf("Slow Spiral!", "attack-1")).toBe("slow-spiral");
  expect(slugOf("  --A__b2  ", "attack-1")).toBe("a-b2");
  expect(slugOf("!!!", "attack-7")).toBe("attack-7");
});

describe("projectileVariantOf (V16 S13, S24)", () => {
  test("untyped values give no variant", () => {
    expect(projectileVariantOf(tag(), BOMB, "v")).toBeNull();
  });

  test("a typed bomb range or time gives a valid bomb variant", () => {
    for (const typed of [{ bombRangeTiles: 4 }, { bombTravelSeconds: 1.5 }]) {
      const variant = projectileVariantOf(tag(typed), BOMB, "v")!;
      expect(variant.id).toBe("v");
      expect(variant.entry).not.toHaveProperty("id");
      expect(variant.entry.type).toBe("bomb");
      valid(variant);
    }
  });

  test("a targeted bomb keeps the catalog range", () => {
    const variant = projectileVariantOf(
      tag({ target: "player", bombTravelSeconds: 2, bombRangeTiles: 9 }),
      BOMB,
      "v",
    )!;
    expect(variant.entry.travelSeconds).toBe(2);
    expect(variant.entry.rangeTiles).toBe((QUEEN.projectiles[BOMB] as { rangeTiles: number }).rangeTiles);
  });

  test("typed linear bullet speed and range give a valid variant without a type", () => {
    const linearId = Object.keys(QUEEN.projectiles).find((id) => {
      const spec = QUEEN.projectiles[id]!;
      return spec.type !== "bomb" && spec.motion.kind === "linear" && spec.appearance;
    })!;
    const variant = projectileVariantOf(
      tag({ bulletSpeedTilesPerSecond: 5, bulletRangeTiles: 9 }),
      linearId,
      "v",
    )!;
    expect(variant.entry).not.toHaveProperty("type");
    expect(variant.entry.speedTilesPerSecond).toBe(5);
    expect(variant.entry.motion).toMatchObject({ kind: "linear", rangeTiles: 9 });
    valid(variant);
  });
});
