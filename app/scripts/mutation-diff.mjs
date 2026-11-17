// Runs Stryker on the mutated modules changed against the base branch (plan V22 A17).
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, matchesGlob } from "node:path";
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
 * selection would only time out; the scheduled sharded run covers it instead.
 */
export const DIFF_MODULE_LIMIT = 4;

/**
 * Minutes Stryker may run before it is interrupted. The limit above is a guess
 * from module counts, and one slow module can still outlast the 30-minute job.
 * On SIGINT Stryker writes the mutants tested so far to its incremental file,
 * so an interrupted run reports part of its result instead of none.
 */
const DIFF_BUDGET_MINUTES = 24;

/** Whether to run Stryker on `files`, and the line to print either way. */
export function diffPlan(files, limit = DIFF_MODULE_LIMIT) {
  if (files.length === 0) return { run: false, message: "no mutated modules changed" };
  if (files.length > limit)
    return {
      run: false,
      message:
        `${files.length} mutated modules changed, above the diff limit of ${limit}; ` +
        `skipping. The scheduled sharded run (.github/workflows/mutation.yml) covers them:\n  ${files.join("\n  ")}`,
    };
  return { run: true, message: `Mutating ${files.length} changed file(s):\n  ${files.join("\n  ")}` };
}

/**
 * The ref the diff is taken against. On a pull request GitHub names the base
 * branch, which is not `main` for a pull request stacked on another one;
 * against `main` such a run would count the lower pull request's modules too.
 */
export function baseRef(env = process.env) {
  return `origin/${env.GITHUB_BASE_REF || "main"}`;
}

const PREFIX = "app/";
const NEW_FILE = /^\+\+\+ b\/(.*)$/;
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * The `[first, last]` line ranges a `git diff -U0` adds or rewrites, per file
 * relative to `app/`. The summary uses them to tell the undetected mutants a
 * change introduced from those the module already had.
 */
export function changedLineRanges(diffText, prefix = PREFIX) {
  const ranges = {};
  let file = null;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = NEW_FILE.exec(line)?.[1];
      file = path?.startsWith(prefix) ? path.slice(prefix.length) : null;
      continue;
    }
    const hunk = file === null ? null : HUNK.exec(line);
    if (!hunk) continue;
    const first = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (count > 0) (ranges[file] ??= []).push([first, first + count - 1]);
  }
  return ranges;
}

/** Where the changed line ranges go for `scripts/mutation-summary.mjs`. */
const CHANGED_LINES_FILE = "reports/mutation/changed-lines.json";

function git(args) {
  // A diff can exceed Node's default 1 MiB of captured output.
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}

function gitLines(args) {
  return git(args).split("\n").filter((line) => line.length > 0);
}

function untrackedFiles() {
  return gitLines(["ls-files", "--others", "--exclude-standard", "--full-name"]);
}

function withoutPrefix(names) {
  return names.filter((name) => name.startsWith(PREFIX)).map((name) => name.slice(PREFIX.length));
}

/** Added or modified files committed since the merge base, plus uncommitted ones, relative to `app/`. */
function changedFilesAgainst(base) {
  return withoutPrefix([
    ...gitLines(["diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`]),
    ...gitLines(["diff", "--name-only", "--diff-filter=AM", "HEAD"]),
    ...untrackedFiles(),
  ]);
}

/** Changed line ranges of `files` since the merge base, uncommitted changes included; an untracked file is new throughout. */
function changedLinesAgainst(base, files) {
  const mergeBase = git(["merge-base", base, "HEAD"]).trim();
  const ranges = changedLineRanges(git(["diff", "-U0", mergeBase, "--", ...files]));
  for (const file of withoutPrefix(untrackedFiles())) ranges[file] = [[1, Number.MAX_SAFE_INTEGER]];
  return ranges;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = baseRef();
  const files = selectMutatedFiles(changedFilesAgainst(base));
  const plan = diffPlan(files);
  console.log(plan.message);
  if (!plan.run) {
    // A skipped run would otherwise look the same on the run page as a clean one.
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Mutation tests: changed modules\n\nNot run: ${plan.message}\n`);
    process.exit(0);
  }
  mkdirSync(dirname(CHANGED_LINES_FILE), { recursive: true });
  writeFileSync(CHANGED_LINES_FILE, JSON.stringify(changedLinesAgainst(base, files)));
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../node_modules/@stryker-mutator/core/bin/stryker.js", import.meta.url)),
      "run",
      "--mutate",
      files.join(","),
    ],
    {
      stdio: "inherit",
      // MUTATION_DIFF lifts the break value; see stryker.config.mjs.
      env: { ...process.env, MUTATION_DIFF: "1" },
      timeout: DIFF_BUDGET_MINUTES * 60 * 1000,
      killSignal: "SIGINT",
    },
  );
  if (result.error?.code === "ETIMEDOUT") {
    console.log(
      `${process.env.GITHUB_ACTIONS ? "::warning::" : ""}The diff run was interrupted after ${DIFF_BUDGET_MINUTES} minutes; ` +
        "the incremental file holds the mutants tested so far.",
    );
    process.exit(0);
  }
  process.exit(result.status ?? 1);
}
