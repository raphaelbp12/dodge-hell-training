import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Plan V22 A19: every runtime module under `src/` has a sibling test, or an
 * entry with a reason in `test-presence-allowlist.json`. The list can only
 * shrink: an entry whose module has gained a test, or whose path is gone,
 * fails the check.
 */

const TEST_SUFFIXES = [".test.ts", ".test.tsx", ".property.test.ts"] as const;
const NOT_A_MODULE = /\.(?:test|property\.test|soak\.test|bench)\.tsx?$|\.d\.ts$/;

function modulesUnder(directory: string, appRoot: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "__fixtures__" ? [] : modulesUnder(path, appRoot);
    if (!/\.tsx?$/.test(name) || NOT_A_MODULE.test(name)) return [];
    return [relative(appRoot, path)];
  });
}

function hasTest(appRoot: string, modulePath: string): boolean {
  const base = join(appRoot, modulePath.replace(/\.tsx?$/, ""));
  return TEST_SUFFIXES.some((suffix) => existsSync(base + suffix));
}

/** Every way the presence check can fail for the tree under `appRoot`. */
export function presenceProblems(appRoot: string, allowlist: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  const modules = modulesUnder(join(appRoot, "src"), appRoot);
  for (const modulePath of modules) {
    const tested = hasTest(appRoot, modulePath);
    const reason = allowlist[modulePath];
    if (!tested && reason === undefined)
      problems.push(`${modulePath} has no sibling test and no allowlist entry`);
    if (tested && reason !== undefined)
      problems.push(`${modulePath} now has a test; remove its allowlist entry`);
  }
  for (const [path, reason] of Object.entries(allowlist)) {
    if (reason.trim().length === 0) problems.push(`${path} has an empty allowlist reason`);
    if (!existsSync(join(appRoot, path))) problems.push(`${path} is allowlisted but does not exist`);
  }
  return problems;
}

function scratchTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "presence-"));
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

describe("the presence check", () => {
  const root = scratchTree({
    "src/a/tested.ts": "",
    "src/a/tested.test.ts": "",
    "src/a/bare.ts": "",
    "src/a/listed.ts": "",
    "src/a/listedButTested.tsx": "",
    "src/a/listedButTested.test.tsx": "",
    "src/a/prop.ts": "",
    "src/a/prop.property.test.ts": "",
    "src/a/types.d.ts": "",
    "src/a/__fixtures__/data.ts": "",
    "src/a/helper.bench.ts": "",
  });

  test("a module with a test, a property test or a listed reason passes", () => {
    expect(presenceProblems(root, { "src/a/listed.ts": "types only", "src/a/bare.ts": "types only" })).toEqual([]);
  });

  test("a module with neither a test nor an entry is reported", () => {
    expect(presenceProblems(root, {})).toContain("src/a/bare.ts has no sibling test and no allowlist entry");
  });

  test("an allowlisted module that gained a test is reported", () => {
    expect(presenceProblems(root, { "src/a/listedButTested.tsx": "was untested" })).toContain(
      "src/a/listedButTested.tsx now has a test; remove its allowlist entry",
    );
  });

  test("a stale allowlist path is reported", () => {
    expect(presenceProblems(root, { "src/a/gone.ts": "was a module" })).toContain(
      "src/a/gone.ts is allowlisted but does not exist",
    );
  });

  test("an empty reason is reported", () => {
    expect(presenceProblems(root, { "src/a/listed.ts": " " })).toContain("src/a/listed.ts has an empty allowlist reason");
  });

  test("declaration files, fixtures, and test, property and bench files are not modules", () => {
    const problems = presenceProblems(root, {}).join("\n");
    for (const ignored of ["types.d.ts", "__fixtures__", "helper.bench.ts", "tested.test.ts", "prop.property.test.ts"])
      expect(problems).not.toContain(ignored);
  });
});

describe("the repository", () => {
  const appRoot = fileURLToPath(new URL("..", import.meta.url));
  const allowlist = JSON.parse(
    readFileSync(new URL("./test-presence-allowlist.json", import.meta.url), "utf8"),
  ) as Record<string, string>;

  test("every runtime module has a test or a reasoned allowlist entry, and the list holds no stale entry", () => {
    expect(presenceProblems(appRoot, allowlist)).toEqual([]);
  });
});
