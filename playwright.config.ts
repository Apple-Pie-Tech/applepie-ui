import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8081';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;

export default defineConfig({
  fullyParallel: false,
  outputDir: path.join(tmpdir(), 'applepie-ui-playwright'),
  reporter: 'list',
  testDir: './tests/browser',
  testMatch: 'universe-ui.spec.ts',
  timeout: 20_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run web',
        reuseExistingServer: true,
        timeout: 120_000,
        url: DEFAULT_BASE_URL,
      },
  workers: 1,
});
