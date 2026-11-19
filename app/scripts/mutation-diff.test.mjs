import { expect, test } from "vitest";
import {
  baseRef,
  changedLineRanges,
  DIFF_MODULE_LIMIT,
  diffPlan,
  requestedFiles,
  selectMutatedFiles,
} from "./mutation-diff.mjs";

test("named files replace the changed-file selection, keeping only mutated modules", () => {
  const exists = () => false;
  expect(
    requestedFiles(["src/game/simulation/marks.ts", "src/game/simulation/marks.test.ts", "README.md"], exists),
  ).toEqual(["src/game/simulation/marks.ts"]);
  expect(requestedFiles([], exists)).toBeNull();
});

test("the diff is taken against the pull request's base branch, so a stacked pull request counts only its own changes", () => {
  expect(baseRef({ GITHUB_BASE_REF: "plan-v22-quality-gates" })).toBe("origin/plan-v22-quality-gates");
});

test("outside a pull request the diff is taken against main", () => {
  expect(baseRef({})).toBe("origin/main");
  expect(baseRef({ GITHUB_BASE_REF: "" })).toBe("origin/main");
});

test("changed line ranges are the new side of each hunk, per file relative to app/", () => {
  const diff = [
    "diff --git a/app/src/research/study.ts b/app/src/research/study.ts",
    "--- a/app/src/research/study.ts",
    "+++ b/app/src/research/study.ts",
    "@@ -10,2 +12,3 @@ function load() {",
    "+added",
    "@@ -40 +44 @@",
    "+one line",
    "diff --git a/docs/plan.md b/docs/plan.md",
    "--- a/docs/plan.md",
    "+++ b/docs/plan.md",
    "@@ -1 +1 @@",
  ].join("\n");
  expect(changedLineRanges(diff)).toEqual({ "src/research/study.ts": [[12, 14], [44, 44]] });
});

test("a hunk that only deletes lines changes no line", () => {
  const diff = ["+++ b/app/src/a.ts", "@@ -5,3 +4,0 @@", "-gone"].join("\n");
  expect(changedLineRanges(diff)).toEqual({});
});

test("a deleted file changes no line", () => {
  const diff = ["--- a/app/src/a.ts", "+++ /dev/null", "@@ -1,3 +0,0 @@"].join("\n");
  expect(changedLineRanges(diff)).toEqual({});
});

test("no selected module skips the run", () => {
  expect(diffPlan([])).toEqual({ run: false, message: "no mutated modules changed" });
});

test("up to the limit, the run mutates every selected module", () => {
  const files = Array.from({ length: DIFF_MODULE_LIMIT }, (_, index) => `src/storage/m${index}.ts`);
  expect(diffPlan(files)).toEqual({ run: true, message: expect.stringContaining(`Mutating ${DIFF_MODULE_LIMIT} changed file(s)`) });
});

test("above the limit, the run is skipped and says the scheduled sharded run covers it", () => {
  const files = Array.from({ length: DIFF_MODULE_LIMIT + 1 }, (_, index) => `src/storage/m${index}.ts`);
  const plan = diffPlan(files);
  expect(plan.run).toBe(false);
  expect(plan.message).toContain(`${DIFF_MODULE_LIMIT + 1} mutated modules changed, above the diff limit of ${DIFF_MODULE_LIMIT}`);
  expect(plan.message).toContain("scheduled sharded run");
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
