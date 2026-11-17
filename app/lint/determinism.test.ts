import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginPath = fileURLToPath(new URL("./determinism.js", import.meta.url));
const oxlintPath = fileURLToPath(
  new URL("../node_modules/oxlint/bin/oxlint", import.meta.url),
);

/** Lints `source` with only the determinism rule on, returning reported lines. */
function lint(source: string): number[] {
  const directory = mkdtempSync(join(tmpdir(), "determinism-"));
  const configPath = join(directory, ".oxlintrc.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      jsPlugins: [pluginPath],
      rules: { "determinism/no-ambient-entropy": "error" },
    }),
  );
  const file = join(directory, "fixture.ts");
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
  return [...output.matchAll(/:(\d+):\d+: .*determinism\(no-ambient-entropy\)/g)].map(
    ([, line]) => Number(line),
  );
}

describe("determinism/no-ambient-entropy", () => {
  it("reports each of the six ambient forms", () => {
    expect(
      lint(
        [
          "Math.random();",
          "Date.now();",
          "new Date();",
          "performance.now();",
          "crypto.getRandomValues(new Uint8Array(1));",
          "crypto.randomUUID();",
        ].join("\n"),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("ignores a dated constructor and a local random function", () => {
    expect(
      lint(
        [
          "new Date(0);",
          "const random = () => 4;",
          "random();",
          "const clock = { now: () => 1 };",
          "clock.now();",
          "Math.floor(1.5);",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("lets an inline disable with a reason silence one report", () => {
    expect(
      lint(
        [
          "// oxlint-disable-next-line determinism/no-ambient-entropy -- host seed (G13)",
          "Math.random();",
          "Math.random();",
        ].join("\n"),
      ),
    ).toEqual([3]);
  });
});
