import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const oxlintPath = fileURLToPath(
  new URL("../node_modules/oxlint/bin/oxlint", import.meta.url),
);
const realConfigPath = fileURLToPath(
  new URL("../.oxlintrc.json", import.meta.url),
);
const appRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * Lints `source` as the file `relativePath` inside a scratch tree that uses the
 * repository's real `.oxlintrc.json`, so the path-scoped overrides apply.
 * Returns the `no-restricted-*` messages reported for the file.
 */
function lint(relativePath: string, source: string): string[] {
  const root = mkdtempSync(join(tmpdir(), "boundaries-"));
  const config = JSON.parse(
    readFileSync(realConfigPath, "utf8").replace(/^\s*\/\/.*$/gm, ""),
  ) as {
    jsPlugins: string[];
  };
  config.jsPlugins = config.jsPlugins.map((plugin) => join(appRoot, plugin));
  writeFileSync(join(root, ".oxlintrc.json"), JSON.stringify(config));
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [oxlintPath, "-c", join(root, ".oxlintrc.json"), "-f", "json", file],
      { encoding: "utf8", cwd: root },
    );
  } catch (error) {
    output = (error as { stdout: string }).stdout;
  }
  const { diagnostics } = JSON.parse(output) as {
    diagnostics: { code: string; message: string; help?: string }[];
  };
  return diagnostics
    .filter((diagnostic) => diagnostic.code.includes("no-restricted-"))
    .map((diagnostic) => `${diagnostic.message} ${diagnostic.help ?? ""}`);
}

const CORE_FILES = [
  "src/game/models.ts",
  "src/game/config/x.ts",
  "src/game/simulation/x.ts",
  "src/game/session/x.ts",
];

describe("core import boundary (A01)", () => {
  it.each(CORE_FILES)("%s rejects UI and engine packages", (file) => {
    const messages = lint(
      file,
      [
        'import "react";',
        'import "react-dom";',
        'import "react-dom/client";',
        'import "phaser";',
        'import "./x.css";',
      ].join("\n"),
    );
    expect(messages).toHaveLength(5);
    expect(messages.join("\n")).toContain("independent of React");
    expect(messages.join("\n")).toContain("independent of Phaser");
    expect(messages.join("\n")).toContain("must not import styles");
  });

  it.each(CORE_FILES)("%s rejects layers above the core", (file) => {
    const messages = lint(
      file,
      [
        'import "../../ui/Thing";',
        'import "../../research/study";',
        'import "../phaser/view";',
        'import "../../storage/attempts";',
      ].join("\n"),
    );
    expect(messages).toHaveLength(4);
    expect(messages.join("\n")).toContain("UI modules");
    expect(messages.join("\n")).toContain("research modules");
    expect(messages.join("\n")).toContain("Phaser layer");
    expect(messages.join("\n")).toContain("storage modules");
  });

  it.each(CORE_FILES)("%s rejects browser globals", (file) => {
    const messages = lint(
      file,
      [
        "export const a = window;",
        "export const b = document;",
        "export const c = localStorage;",
        "export const d = sessionStorage;",
        "export const e = navigator;",
        "export const f = requestAnimationFrame;",
      ].join("\n"),
    );
    expect(messages).toHaveLength(6);
    expect(messages.join("\n")).toContain("must not read browser globals");
  });

  it("allows core-to-core imports and plain code", () => {
    expect(
      lint(
        "src/game/simulation/x.ts",
        'import { a } from "../config/data";\nimport { b } from "./random";\nexport const c = [a, b];',
      ),
    ).toEqual([]);
  });

  it("does not apply to test files", () => {
    expect(
      lint("src/game/simulation/x.test.ts", "export const a = window;"),
    ).toEqual([]);
  });
});

describe("game and research boundary (T13)", () => {
  it("rejects a research import from the Phaser layer", () => {
    const messages = lint(
      "src/game/phaser/x.ts",
      'import "../../research/study";',
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("src/game must not import src/research");
  });

  it("allows the Phaser layer to import the simulation and use browser globals", () => {
    expect(
      lint(
        "src/game/phaser/x.ts",
        'import { a } from "../simulation/simulation";\nexport const b = [a, window];',
      ),
    ).toEqual([]);
  });
});

describe("storage boundary", () => {
  it("rejects React and Phaser", () => {
    const messages = lint(
      "src/storage/x.ts",
      'import "react";\nimport "phaser";',
    );
    expect(messages).toHaveLength(2);
    expect(messages.join("\n")).toContain("storage adapters must not import");
  });

  it("allows the browser storage global", () => {
    expect(
      lint("src/storage/x.ts", "export const a = localStorage;"),
    ).toEqual([]);
  });
});
