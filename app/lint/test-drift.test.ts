import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginPath = fileURLToPath(new URL("./test-drift.js", import.meta.url));
const oxlintPath = fileURLToPath(
  new URL("../node_modules/oxlint/bin/oxlint", import.meta.url),
);

/** Lints `source` with only the test-drift rules on, returning `rule:line` pairs. */
function lint(source: string): string[] {
  const directory = mkdtempSync(join(tmpdir(), "test-drift-"));
  const configPath = join(directory, ".oxlintrc.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      jsPlugins: [pluginPath],
      rules: {
        "test-drift/no-hardcoded-rules-version": "error",
        "test-drift/typed-exact-expectation": "error",
      },
    }),
  );
  const file = join(directory, "fixture.spec.ts");
  writeFileSync(file, source);
  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [oxlintPath, "-c", configPath, "-f", "unix", file],
      { encoding: "utf8" },
    );
  } catch (error) {
    output = (error as { stdout: string }).stdout;
  }
  return [...output.matchAll(/:(\d+):\d+: .*test-drift\(([a-z-]+)\)/g)].map(
    ([, line, rule]) => `${rule}:${line}`,
  );
}

describe("no-hardcoded-rules-version", () => {
  it("flags base, drill and one-shot rulesVersion literals", () => {
    expect(
      lint(
        [
          'const a = "crystal-worm-child-swarm-paladin-v7";',
          'const b = "killer-bee-queen-nest-paladin-v12-drill-p2-4-once";',
          "const c = `crystal-worm-child-swarm-paladin-v7-drill-p0`;",
        ].join("\n"),
      ),
    ).toEqual([
      "no-hardcoded-rules-version:1",
      "no-hardcoded-rules-version:2",
      "no-hardcoded-rules-version:3",
    ]);
  });

  it("allows derived versions and unrelated strings", () => {
    expect(
      lint(
        [
          "declare const base: string;",
          "const a = `${base}-drill-p0-once`;",
          'const b = "phase-3-pond-barrage";',
          'const c = "v7";',
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

describe("typed-exact-expectation", () => {
  it("flags an untyped object literal in toEqual and toStrictEqual", () => {
    expect(
      lint(
        [
          "declare const expect: (value: unknown) => any;",
          "expect(1).toEqual({ x: 0, y: 0 });",
          "expect(1).toStrictEqual({ x: 0 });",
        ].join("\n"),
      ),
    ).toEqual(["typed-exact-expectation:2", "typed-exact-expectation:3"]);
  });

  it("allows satisfies-typed literals, non-literals and other matchers", () => {
    expect(
      lint(
        [
          "type Point = { x: number; y: number };",
          "declare const expect: (value: unknown) => any;",
          "declare const point: Point;",
          "expect(1).toEqual({ x: 0, y: 0 } satisfies Point);",
          "expect(1).toEqual(point);",
          "expect(1).toEqual([]);",
          "expect(1).toMatchObject({ x: 0 });",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
