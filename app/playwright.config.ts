import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const testPort = 4173;
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${testPort} --strictPort`,
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: baseURL,
    reuseExistingServer: false,
  },
});
