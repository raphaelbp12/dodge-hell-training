import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginPath = fileURLToPath(
  new URL("./test-strictness.js", import.meta.url),
);
const oxlintPath = fileURLToPath(
  new URL("../node_modules/oxlint/bin/oxlint", import.meta.url),
);

/** Lints `source` with only the test-strictness rules on, returning `rule:line` pairs. */
function lint(source: string): string[] {
  const directory = mkdtempSync(join(tmpdir(), "test-strictness-"));
  const configPath = join(directory, ".oxlintrc.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      jsPlugins: [pluginPath],
      rules: { "test-strictness/no-bare-to-throw": "error" },
    }),
  );
  const file = join(directory, "fixture.test.ts");
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
  return [...output.matchAll(/:(\d+):\d+: .*test-strictness\(([a-z-]+)\)/g)].map(
    ([, line, rule]) => `${rule}:${line}`,
  );
}

describe("no-bare-to-throw", () => {
  it("flags toThrow and toThrowError called with no argument, but not .not.toThrow()", () => {
    expect(
      lint(
        [
          "expect(() => a()).toThrow();",
          "expect(() => a()).toThrowError();",
          "await expect(p).rejects.toThrow();",
          "expect(() => a()).not.toThrow();",
        ].join("\n"),
      ),
    ).toEqual([
      "no-bare-to-throw:1",
      "no-bare-to-throw:2",
      "no-bare-to-throw:3",
    ]);
  });

  it("allows a call that names the error", () => {
    expect(
      lint(
        [
          "expect(() => a()).toThrow(RangeError);",
          "expect(() => a()).toThrow(/path/);",
          'expect(() => a()).toThrowError("msg");',
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
