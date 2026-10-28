// Standalone mock gamma for manual testing: pnpm tsx e2e/mock-gamma/main.ts
import { startMockGamma } from './server'

const port = Number(process.env.MOCK_GAMMA_PORT ?? 8092)
startMockGamma({
  port,
  clientId: process.env.GAMMA_CLIENT_ID ?? 'songbook-client',
  clientSecret: process.env.GAMMA_CLIENT_SECRET ?? 'songbook-secret',
  redirectUri: process.env.GAMMA_REDIRECT_URI ?? 'http://localhost:3000/auth/callback',
  apiKeyId: process.env.GAMMA_API_KEY_ID ?? 'songbook-key',
  apiKeyToken: process.env.GAMMA_API_KEY_TOKEN ?? 'songbook-token',
}).then(({ url }) => console.log(`Mock gamma listening on ${url}`))
