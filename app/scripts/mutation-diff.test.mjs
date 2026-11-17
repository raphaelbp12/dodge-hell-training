import { expect, test } from "vitest";
import { selectMutatedFiles } from "./mutation-diff.mjs";

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
