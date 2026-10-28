import { createHash, randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { GET as login } from '@/app/auth/login/route'
import {
  buildAuthorizeUrl,
  discover,
  exchangeCode,
  fetchAuthorities,
  gammaConfig,
  toInternalUrl,
  toPublicUrl,
  verifyIdToken,
  type GammaConfig,
} from '@/lib/gamma'
import { LOGIN_COOKIE, decodeLoginState, sessionKey } from '@/lib/session'
import { MOCK_USERS, startMockGamma } from '../e2e/mock-gamma/server'

const APP_URL = 'http://localhost:3999'
const CLIENT = {
  clientId: 'songbook-test-client',
  clientSecret: 'songbook-test-secret',
  apiKeyId: 'songbook-test-key',
  apiKeyToken: 'songbook-test-token',
  redirectUri: `${APP_URL}/auth/callback`,
}

let gamma: Awaited<ReturnType<typeof startMockGamma>>
let port: number

beforeAll(async () => {
  gamma = await startMockGamma({ port: 0, ...CLIENT })
  port = Number(new URL(gamma.url).port)
})

afterAll(() => gamma.close())

const configFor = (gammaUrl: string, internalUrl?: string) =>
  gammaConfig({
    NODE_ENV: 'test',
    APP_URL,
    GAMMA_URL: gammaUrl,
    GAMMA_INTERNAL_URL: internalUrl,
    GAMMA_CLIENT_ID: CLIENT.clientId,
    GAMMA_CLIENT_SECRET: CLIENT.clientSecret,
    GAMMA_API_KEY_ID: CLIENT.apiKeyId,
    GAMMA_API_KEY_TOKEN: CLIENT.apiKeyToken,
  })

/** Runs the whole sign in like /auth/login, the browser and /auth/callback do */
async function signIn(config: GammaConfig) {
  const discovery = await discover(config)
  const nonce = randomBytes(16).toString('base64url')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const authorizeUrl = new URL(
    buildAuthorizeUrl(config, discovery, { state: 'state', nonce, codeChallenge }),
  )

  // The browser opens the authorize URL and consents as the admin
  const consent = await fetch(new URL('/oauth2/authorize', authorizeUrl), {
    method: 'POST',
    body: new URLSearchParams({
      user: 'admin',
      redirect_uri: authorizeUrl.searchParams.get('redirect_uri')!,
      state: authorizeUrl.searchParams.get('state')!,
      nonce: authorizeUrl.searchParams.get('nonce')!,
      code_challenge: authorizeUrl.searchParams.get('code_challenge')!,
    }),
    redirect: 'manual',
  })
  const callback = new URL(consent.headers.get('location')!)
  expect(callback.origin + callback.pathname).toBe(CLIENT.redirectUri)

  const tokens = await exchangeCode(
    config,
    discovery,
    callback.searchParams.get('code')!,
    codeVerifier,
  )
  const claims = await verifyIdToken(config, discovery, tokens.id_token, nonce)
  const authorities = await fetchAuthorities(config, claims.sub)
  return { discovery, authorizeUrl, claims, authorities }
}

describe('gamma sign in', () => {
  it('works when the app and the browser use the same gamma URL', async () => {
    const config = configFor(`http://localhost:${port}`)
    const { discovery, authorizeUrl, claims, authorities } = await signIn(config)
    expect(discovery.issuer).toBe(`http://localhost:${port}`)
    expect(authorizeUrl.origin).toBe(`http://localhost:${port}`)
    expect(claims).toMatchObject({ sub: MOCK_USERS.admin.sub, cid: MOCK_USERS.admin.cid })
    expect(authorities).toEqual(['songbook'])
  })

  it('sends the browser to GAMMA_URL when the server uses GAMMA_INTERNAL_URL', async () => {
    // Gamma derives its issuer from the Host header: 127.0.0.1 internally, localhost publicly
    const config = configFor(`http://localhost:${port}`, `http://127.0.0.1:${port}`)
    const { discovery, authorizeUrl, claims, authorities } = await signIn(config)
    expect(discovery.issuer).toBe(`http://127.0.0.1:${port}`)
    expect(discovery.authorization_endpoint).toBe(`http://127.0.0.1:${port}/oauth2/authorize`)
    expect(authorizeUrl.origin).toBe(`http://localhost:${port}`)
    expect(authorizeUrl.pathname).toBe('/oauth2/authorize')
    // The token was requested internally, so it carries the internal issuer
    expect(claims.iss).toBe(`http://127.0.0.1:${port}`)
    expect(claims.cid).toBe(MOCK_USERS.admin.cid)
    expect(authorities).toEqual(['songbook'])
  })
})

describe('/auth/login', () => {
  it('falls back to / for a returnTo that is not a valid URL', async () => {
    vi.stubEnv('APP_URL', APP_URL)
    vi.stubEnv('GAMMA_URL', `http://localhost:${port}`)
    vi.stubEnv('GAMMA_CLIENT_ID', CLIENT.clientId)
    try {
      for (const returnTo of ['%2F%2F', '%2F%2F%5B']) {
        const response = await login(new NextRequest(`${APP_URL}/auth/login?returnTo=${returnTo}`))
        expect(response.status, returnTo).toBe(307)
        const location = new URL(response.headers.get('location')!)
        expect(location.origin + location.pathname).toBe(
          `http://localhost:${port}/oauth2/authorize`,
        )
        expect(location.searchParams.get('client_id')).toBe(CLIENT.clientId)
        const cookie = response.headers
          .getSetCookie()
          .find((header) => header.startsWith(`${LOGIN_COOKIE}=`))
        const token = cookie?.slice(LOGIN_COOKIE.length + 1).split(';')[0]
        const state = await decodeLoginState(token, sessionKey())
        expect(state?.returnTo).toBe('/')
      }
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('gamma URL rewriting', () => {
  const config = configFor('https://gamma.chalmers.it', 'http://gamma:8081')

  it('rewrites only URLs on the matching origin', () => {
    expect(toPublicUrl('http://gamma:8081/oauth2/authorize?a=1', config)).toBe(
      'https://gamma.chalmers.it/oauth2/authorize?a=1',
    )
    expect(toInternalUrl('https://gamma.chalmers.it/oauth2/jwks', config)).toBe(
      'http://gamma:8081/oauth2/jwks',
    )
    expect(toPublicUrl('https://elsewhere.example/x', config)).toBe('https://elsewhere.example/x')
    expect(toInternalUrl('https://elsewhere.example/x', config)).toBe('https://elsewhere.example/x')
  })

  it('does nothing without an internal URL', () => {
    const same = configFor('https://gamma.chalmers.it')
    expect(same.internalUrl).toBe('https://gamma.chalmers.it')
    expect(configFor('https://gamma.chalmers.it', '').internalUrl).toBe('https://gamma.chalmers.it')
    expect(toPublicUrl('https://gamma.chalmers.it/oauth2/authorize', same)).toBe(
      'https://gamma.chalmers.it/oauth2/authorize',
    )
  })
})
