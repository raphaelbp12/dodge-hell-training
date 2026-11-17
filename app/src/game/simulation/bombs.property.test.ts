import fc from "fast-check";
import { expect, test } from "vitest";
import { propertyParameters } from "../../test/property";
import { advanceBomb, createBomb } from "./bombs";
import { SHIPPED_BOMBS } from "./test-support";

const orientation = fc.double({ min: 0, max: 2 * Math.PI, noNaN: true });
const spawn = fc.record({
  x: fc.double({ min: -5, max: 5, noNaN: true }),
  y: fc.double({ min: -5, max: 5, noNaN: true }),
});
const weights = fc.array(fc.double({ min: 0.01, max: 1, noNaN: true }), {
  minLength: 1,
  maxLength: 12,
});

test("the shipped catalog contains at least one bomb", () => {
  expect(SHIPPED_BOMBS.length).toBeGreaterThan(0);
});

test("a bomb reports a hit and a detonation only on the step that reaches its travel time, and then dies", () => {
  fc.assert(
    fc.property(
      fc.nat({ max: SHIPPED_BOMBS.length - 1 }),
      orientation,
      spawn,
      weights,
      fc.boolean(),
      (index, bearing, origin, parts, standOnTarget) => {
        const entry = SHIPPED_BOMBS[index];
        const bomb = createBomb(entry.projectile, 1, origin, bearing);
        const sum = parts.reduce((acc, part) => acc + part, 0);
        // Stepping through 1.3 travel times guarantees the detonation occurs.
        const steps = parts.map(
          (part) => (part / sum) * bomb.lifetimeSeconds * 1.3,
        );
        let elapsed = 0;
        let detonations = 0;
        for (const seconds of steps) {
          const player = standOnTarget ? bomb.detonationTargetTiles : origin;
          const wasLive = bomb.ageSeconds < bomb.lifetimeSeconds;
          const result = advanceBomb(
            { config: entry.config },
            bomb,
            seconds,
            player,
            player,
          );
          elapsed += seconds;
          if (result.hitPlayer) expect(result.detonated).toBe(true);
          if (result.detonated && wasLive) {
            detonations++;
            expect(elapsed).toBeGreaterThanOrEqual(
              bomb.lifetimeSeconds * (1 - 1e-9),
            );
            expect(result.alive).toBe(false);
          } else if (wasLive) {
            expect(result.alive).toBe(true);
            expect(result.hitPlayer).toBe(false);
          }
          if (!result.alive) break;
        }
        expect(detonations).toBe(1);
        expect(bomb.ageSeconds).toBe(bomb.lifetimeSeconds);
      },
    ),
    propertyParameters(),
  );
});
