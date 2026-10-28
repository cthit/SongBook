import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the real gamma 2.5.3 from `docker compose --profile gamma up`, see
// e2e/real-gamma.spec.ts and README.md, "Local gamma". Not run in CI. The songbook under test is
// the one on APP_URL (`pnpm dev` or the compose `songbook` service); if none is running, `pnpm dev`
// is started, which reads the client from .env.local (`pnpm gamma:setup`).
const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'real-gamma.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // Gamma is slow when emulated on arm64
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer:
    process.env.REAL_GAMMA === '1'
      ? {
          command: 'pnpm dev',
          url: `${APP_URL}/healthcheck`,
          reuseExistingServer: true,
          timeout: 120_000,
        }
      : undefined,
})
