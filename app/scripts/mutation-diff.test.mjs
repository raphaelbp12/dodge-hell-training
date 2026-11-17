import { expect, test } from "vitest";
import { DIFF_MODULE_LIMIT, diffPlan, selectMutatedFiles } from "./mutation-diff.mjs";

test("no selected module skips the run", () => {
  expect(diffPlan([])).toEqual({ run: false, message: "no mutated modules changed" });
});

test("up to the limit, the run mutates every selected module", () => {
  const files = Array.from({ length: DIFF_MODULE_LIMIT }, (_, index) => `src/storage/m${index}.ts`);
  expect(diffPlan(files)).toEqual({ run: true, message: expect.stringContaining(`Mutating ${DIFF_MODULE_LIMIT} changed file(s)`) });
});

test("above the limit, the run is skipped and says the weekly sharded run covers it", () => {
  const files = Array.from({ length: DIFF_MODULE_LIMIT + 1 }, (_, index) => `src/storage/m${index}.ts`);
  const plan = diffPlan(files);
  expect(plan.run).toBe(false);
  expect(plan.message).toContain(`${DIFF_MODULE_LIMIT + 1} mutated modules changed, above the diff limit of ${DIFF_MODULE_LIMIT}`);
  expect(plan.message).toContain("weekly sharded run");
});

test("selects changed files that match a mutate glob", () => {
  expect(
    selectMutatedFiles([
      "src/game/simulation/bombs.ts",
      "src/game/config/data.ts",
      "src/storage/attempts.ts",
      "src/research/study.ts",
      "src/game/session/session.ts",
    ]),
  ).toEqual([
    "src/game/config/data.ts",
    "src/game/session/session.ts",
    "src/game/simulation/bombs.ts",
    "src/research/study.ts",
    "src/storage/attempts.ts",
  ]);
});

test("a changed test or property test selects the module beside it, so a weakened test shows as new survivors", () => {
  expect(
    selectMutatedFiles(
      ["src/game/simulation/projectiles.test.ts", "src/game/simulation/bombs.property.test.ts"],
      undefined,
      () => true,
    ),
  ).toEqual(["src/game/simulation/bombs.ts", "src/game/simulation/projectiles.ts"]);
});

test("a changed test with no module beside it selects nothing", () => {
  expect(
    selectMutatedFiles(["src/research/export-contract.test.ts"], undefined, () => false),
  ).toEqual([]);
});

test("drops soaks, benches, test support and the canvas drawer", () => {
  expect(
    selectMutatedFiles([
      "src/game/simulation/runtime-bounds.soak.test.ts",
      "src/game/simulation/simulation.bench.ts",
      "src/game/simulation/test-support.ts",
      "src/research/previewDraw.ts",
    ]),
  ).toEqual([]);
});

test("drops files outside the mutated set", () => {
  expect(
    selectMutatedFiles([
      "src/ui/History.tsx",
      "src/game/config/debug.ts",
      "src/game/phaser/encounter.ts",
      "docs/plan-v22.md",
    ]),
  ).toEqual([]);
});

test("a deleted file never reaches the selection because the diff filter keeps only added and modified files", () => {
  expect(selectMutatedFiles([])).toEqual([]);
});

test("each file is listed once", () => {
  expect(
    selectMutatedFiles(["src/game/simulation/bombs.ts", "src/game/simulation/bombs.ts"]),
  ).toEqual(["src/game/simulation/bombs.ts"]);
});
