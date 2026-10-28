import { defineConfig, devices } from '@playwright/test'
import { APP_URL, appEnv } from './e2e/env'

// The app is built and started like in the Docker image (`node server.js` from the standalone
// output, see scripts/start-standalone.mjs); set E2E_DEV=true to use `next dev` instead
const command = process.env.E2E_DEV === 'true' ? 'pnpm next dev' : 'pnpm build && pnpm start'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // The specs share one database, run them one at a time
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command,
    url: `${APP_URL}/healthcheck`,
    // HOSTNAME: the standalone server binds to it, and shells may set it to the machine's name
    env: { ...appEnv, HOSTNAME: 'localhost', SONGBOOK_SKIP_BOOT_MIGRATIONS: 'true' },
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: 'pipe',
  },
})
