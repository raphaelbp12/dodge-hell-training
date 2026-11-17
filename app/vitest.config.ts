import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
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
