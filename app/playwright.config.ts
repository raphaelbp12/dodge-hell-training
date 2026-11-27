import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import {
  PREVIEW_PORT_ENV,
  sharedFreePort,
  TEST_PORT_ENV,
} from "./scripts/free-port.mjs";
import viteConfig from "./vite.config.ts";

// Random free ports (plan V25 D-25-5). Playwright evaluates this config again in
// every worker: the parent draws the ports and stores them in the environment,
// and later evaluations read them back.
const testPort = await sharedFreePort(TEST_PORT_ENV);
const previewPort = await sharedFreePort(
  PREVIEW_PORT_ENV,
  process.env,
  undefined,
  [testPort],
);
const baseURL = new URL(viteConfig.base ?? "/", `http://127.0.0.1:${testPort}`)
  .href;
const previewURL = new URL(
  viteConfig.base ?? "/",
  `http://127.0.0.1:${previewPort}`,
).href;
const liveURL = process.env.PLAYWRIGHT_LIVE_URL;
// The three 60-second @soak tests (real-time frame timing and runtime bounds)
// run in CI, which keeps their JSON reports as an artifact. Locally they are
// opt-in with PLAYWRIGHT_SOAK=1, for measurement steps that need them.
const runSoak = !!process.env.CI || process.env.PLAYWRIGHT_SOAK === "1";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Quality report item 2.9: a test that passes only on retry must fail the CI
  // job. Retries stay so the flaky test still leaves its retry trace as evidence.
  failOnFlakyTests: !!process.env.CI,
  workers: process.env.CI ? 1 : 2,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: liveURL
    ? [
        {
          name: "live-chromium",
          grep: /production assets/,
          use: { ...devices["Desktop Chrome"], baseURL: liveURL },
        },
      ]
    : [
        {
          name: "chromium",
          grepInvert: runSoak
            ? /production assets/
            : [/production assets/, /@soak/],
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "production-chromium",
          grep: /production assets/,
          use: { ...devices["Desktop Chrome"], baseURL: previewURL },
        },
      ],
  webServer: liveURL
    ? []
    : [
        {
          command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${testPort} --strictPort`,
          cwd: fileURLToPath(new URL(".", import.meta.url)),
          url: baseURL,
          reuseExistingServer: false,
        },
        {
          command: `"${process.execPath}" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
          cwd: fileURLToPath(new URL(".", import.meta.url)),
          url: previewURL,
          reuseExistingServer: false,
        },
      ],
});
