import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";
import { MUTATE_GLOBS } from "./stryker.config.mjs";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: {
        provider: "v8",
        // Same files Stryker mutates: one source of truth.
        include: MUTATE_GLOBS.filter((glob) => !glob.startsWith("!")),
        exclude: MUTATE_GLOBS.filter((glob) => glob.startsWith("!")).map((glob) =>
          glob.slice(1),
        ),
        reporter: ["text-summary", "json-summary"],
        reportsDirectory: "reports/coverage",
        // Branch and statement floors per Stryker-mutated directory, each
        // floor(measured) - 2, measured 2026-11-18 with
        // `vitest run --project node --coverage` (branches/statements):
        // config 97.3/98.3, session 100.0/98.5, simulation 97.4/99.0,
        // storage 97.7/98.4, research 85.1/92.7. Docs: quality-gates.md,
        // "Branch coverage". Raise a floor when coverage rises; never lower one.
        // Per-file floors are not set: src/research/previewModel.ts sits at
        // 70.6/67.7.
        thresholds: {
          "src/game/config/**": { branches: 95, statements: 96 },
          "src/game/session/**": { branches: 98, statements: 96 },
          "src/game/simulation/**": { branches: 95, statements: 97 },
          "src/storage/**": { branches: 95, statements: 96 },
          "src/research/**": { branches: 83, statements: 90 },
        },
      },
      // Root-only option. The slow-test reporter checks the node project only.
      reporters: ["default", "./scripts/slow-test-reporter.mjs"],
      projects: [
        {
          extends: true,
          test: {
            name: "node",
            environment: "node",
            include: [
              "src/**/*.test.ts",
              "lint/**/*.test.ts",
              // Vitest-style script tests; scripts/verify.test.mjs uses node:test and is not listed.
              "scripts/mutation-diff.test.mjs",
              "scripts/mutation-summary.test.mjs",
              "scripts/bench-gate.test.mjs",
              "scripts/mutation-shards.test.mjs",
              "scripts/slow-test-reporter.test.mjs",
              "scripts/free-port.test.mjs",
            ],
            // The simulated soak runs in its own project (`npm run test:soak:sim`).
            exclude: ["src/**/*.soak.test.ts", "node_modules/**"],
            benchmark: { include: ["src/**/*.bench.ts"] },
            // The Queen's full-fight simulations now test compound hitboxes
            // with up to 58 parts per projectile. The longest case is the
            // four-rate determinism run at about 20 seconds; 60 seconds leaves
            // headroom without turning every node test into a two-minute hang.
            testTimeout: 60000,
          },
        },
        {
          extends: true,
          test: {
            name: "soak",
            environment: "node",
            include: ["src/**/*.soak.test.ts"],
            testTimeout: 300000,
          },
        },
        {
          extends: true,
          test: {
            name: "dom",
            environment: "jsdom",
            include: ["src/**/*.test.tsx"],
            setupFiles: ["./src/test/setup.ts"],
            css: { include: /\.module\.css$/ },
          },
        },
      ],
    },
  }),
);
