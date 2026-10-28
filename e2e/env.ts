// Fixed ports: Playwright starts the webServer before globalSetup, so the app's environment has to
// be known before the database and mock gamma are running.
export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3123)
export const DB_PORT = Number(process.env.E2E_DB_PORT ?? 54329)
export const GAMMA_PORT = Number(process.env.E2E_GAMMA_PORT ?? 8092)

export const APP_URL = `http://localhost:${APP_PORT}`
export const GAMMA_URL = `http://localhost:${GAMMA_PORT}`
// The app talks to the mock under another hostname than the browser, like the songbook does with
// http://gamma:8081 in docker compose. The mock (like gamma) derives its issuer from the Host header.
export const GAMMA_INTERNAL_URL = `http://127.0.0.1:${GAMMA_PORT}`
export const DATABASE_URL = `postgres://songbook:password@localhost:${DB_PORT}/songbook`

export const GAMMA = {
  clientId: 'songbook-e2e-client',
  clientSecret: 'songbook-e2e-secret',
  apiKeyId: 'songbook-e2e-key',
  apiKeyToken: 'songbook-e2e-token',
  redirectUri: `${APP_URL}/auth/callback`,
}

export const appEnv: Record<string, string> = {
  PORT: String(APP_PORT),
  APP_URL,
  DATABASE_URL,
  GAMMA_URL,
  GAMMA_INTERNAL_URL,
  GAMMA_CLIENT_ID: GAMMA.clientId,
  GAMMA_CLIENT_SECRET: GAMMA.clientSecret,
  GAMMA_API_KEY_ID: GAMMA.apiKeyId,
  GAMMA_API_KEY_TOKEN: GAMMA.apiKeyToken,
  GAMMA_REDIRECT_URI: GAMMA.redirectUri,
  GAMMA_ADMIN_AUTHORITY: 'songbook',
  SESSION_SECRET: 'e2e-session-secret-that-is-long-enough-1234567890',
}
