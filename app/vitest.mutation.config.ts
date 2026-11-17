import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Property tests draw a fresh seed per run; a fixed one keeps every mutant run
// comparable with the baseline (plan V22 A15). Reproduce a CI failure with
// FC_SEED instead.
process.env.FC_SEED ??= "20261116";
// Fewer runs per property: each mutant re-runs every property that covers it.
process.env.FC_NUM_RUNS ??= "10";

// Stryker runs the pure core's node tests only: the DOM project and the
// simulated soak do not take part.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: "node",
      environment: "node",
      include: ["src/**/*.test.ts"],
      exclude: [
        "src/**/*.soak.test.ts",
        "node_modules/**",
        // Contract and robustness suites re-load whole data sets hundreds of
        // times; instrumented they cost minutes per mutant. They run in `npm test`.
        "src/game/config/data.property.test.ts",
        "src/game/config/data-contract.test.ts",
        "src/game/config/rules-fingerprint.test.ts",
        "src/research/export-contract.test.ts",
        "src/research/persistence-contract.test.ts",
        "src/research/study.property.test.ts",
      ],
      testTimeout: 60000,
      // The Queen's full-fight, five-minute and other long runs take 1 to 15
      // seconds each unmutated and ten times that instrumented; every mutant they cover
      // would pay for them. The mutated core is covered by the faster unit and
      // property tests, and the full fights still run in `npm test`.
      testNamePattern:
        "^(?!.*(?:full fight|five-minute moving|eight phases carry|non-realigning glaive|stalled frame)).*$",
    },
  }),
);
