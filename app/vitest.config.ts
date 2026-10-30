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
            include: ["src/**/*.test.ts"],
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
