import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

const integration = process.env.VITEST_INTEGRATION === 'true'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Integration tests start a Postgres container, run them with `pnpm test:integration`
    include: integration ? ['tests/integration/**/*.test.ts'] : ['tests/*.test.ts'],
    environment: 'node',
    testTimeout: integration ? 120_000 : 5_000,
    hookTimeout: integration ? 120_000 : 10_000,
  },
})
