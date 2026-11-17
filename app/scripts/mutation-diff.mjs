// Runs Stryker on the mutated modules changed against origin/main (plan V22 A17).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { matchesGlob } from "node:path";
import { fileURLToPath } from "node:url";
import { MUTATE_GLOBS } from "../stryker.config.mjs";

const SIBLING_TEST = /\.(property\.)?test\.ts$/;

/**
 * The module a unit or property test file sits beside, when one exists. A
 * change to a test alone (a removed assertion, say) must still mutate the
 * module it tests, or the weakened test would never show as new survivors.
 * A soak (`x.soak.test.ts`) maps to `x.soak.ts`, which never exists, so it
 * selects nothing. Tests not named after one module (`*-contract.test.ts`)
 * select nothing either; their modules are mutated when they change.
 */
function testedModule(file, exists) {
  if (!SIBLING_TEST.test(file)) return [];
  const module = file.replace(SIBLING_TEST, ".ts");
  return exists(module) ? [module] : [];
}

/**
 * The changed files that Stryker mutates: matched by a positive glob and by no
 * negated one, plus the module beside each changed test. Paths are relative to
 * `app/`; `exists` resolves them from the current directory.
 */
export function selectMutatedFiles(changedFiles, globs = MUTATE_GLOBS, exists = existsSync) {
  const included = globs.filter((glob) => !glob.startsWith("!"));
  const excluded = globs.filter((glob) => glob.startsWith("!")).map((glob) => glob.slice(1));
  const candidates = changedFiles.flatMap((file) => [file, ...testedModule(file, exists)]);
  return [...new Set(candidates)]
    .filter((file) => included.some((glob) => matchesGlob(file, glob)))
    .filter((file) => !excluded.some((glob) => matchesGlob(file, glob)))
    .sort();
}

/**
 * Most modules one pull-request run mutates. Two core modules take about ten
 * to twenty minutes on a hosted runner and the job allows thirty, so a larger
 * selection would only time out; the weekly sharded run covers it instead.
 */
export const DIFF_MODULE_LIMIT = 4;

/** Whether to run Stryker on `files`, and the line to print either way. */
export function diffPlan(files, limit = DIFF_MODULE_LIMIT) {
  if (files.length === 0) return { run: false, message: "no mutated modules changed" };
  if (files.length > limit)
    return {
      run: false,
      message:
        `${files.length} mutated modules changed, above the diff limit of ${limit}; ` +
        `skipping. The weekly sharded run (.github/workflows/mutation.yml) covers them:\n  ${files.join("\n  ")}`,
    };
  return { run: true, message: `Mutating ${files.length} changed file(s):\n  ${files.join("\n  ")}` };
}

function gitLines(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.split("\n").filter((line) => line.length > 0);
}

/** Added or modified files committed since the merge base, plus uncommitted ones, relative to `app/`. */
function changedFilesAgainstMain() {
  const prefix = "app/";
  const names = [
    ...gitLines(["diff", "--name-only", "--diff-filter=AM", "origin/main...HEAD"]),
    ...gitLines(["diff", "--name-only", "--diff-filter=AM", "HEAD"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard", "--full-name"]),
  ];
  return names.filter((name) => name.startsWith(prefix)).map((name) => name.slice(prefix.length));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = selectMutatedFiles(changedFilesAgainstMain());
  const plan = diffPlan(files);
  console.log(plan.message);
  if (!plan.run) process.exit(0);
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../node_modules/@stryker-mutator/core/bin/stryker.js", import.meta.url)),
      "run",
      "--mutate",
      files.join(","),
    ],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
