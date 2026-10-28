import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

export interface GammaConfig {
  appUrl: string
  /** Public gamma URL, used for browser redirects and links */
  gammaUrl: string
  /** URL used for server to server calls, e.g. a docker network hostname. Defaults to gammaUrl. */
  internalUrl: string
  clientId: string
  clientSecret: string
  apiKeyId: string
  apiKeyToken: string
  redirectUri: string
  adminAuthority: string
}

const stripSlash = (url: string) => url.replace(/\/+$/, '')

export function gammaConfig(env: NodeJS.ProcessEnv = process.env): GammaConfig {
  const appUrl = stripSlash(env.APP_URL ?? 'http://localhost:3000')
  const gammaUrl = stripSlash(env.GAMMA_URL ?? 'https://gamma.chalmers.it')
  return {
    appUrl,
    gammaUrl,
    internalUrl: stripSlash(env.GAMMA_INTERNAL_URL || gammaUrl),
    clientId: env.GAMMA_CLIENT_ID ?? '',
    clientSecret: env.GAMMA_CLIENT_SECRET ?? '',
    apiKeyId: env.GAMMA_API_KEY_ID ?? '',
    apiKeyToken: env.GAMMA_API_KEY_TOKEN ?? '',
    redirectUri: env.GAMMA_REDIRECT_URI ?? `${appUrl}/auth/callback`,
    adminAuthority: env.GAMMA_ADMIN_AUTHORITY ?? 'songbook',
  }
}

export interface Discovery {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  jwks_uri: string
}

/** `url` with its origin replaced by `to`'s if it is on `from`'s origin, otherwise unchanged */
function replaceOrigin(url: string, from: string, to: string): string {
  const target = new URL(url)
  if (target.origin !== new URL(from).origin) return url
  // Not via the host setter: setting a host without a port keeps the old port
  return new URL(`${target.pathname}${target.search}${target.hash}`, new URL(to).origin).toString()
}

/*
 * Gamma 2.5.3 has no fixed issuer: Spring Authorization Server derives the issuer and every URL in
 * the discovery document from the Host of the request. Discovery fetched through GAMMA_INTERNAL_URL
 * (e.g. http://gamma:8081) therefore describes gamma at the internal URL, and the ID token from a
 * token request to the internal URL carries that internal issuer. The server keeps talking to the
 * internal URL and verifies `iss` against the internally fetched issuer; only URLs that the
 * browser opens are rewritten to the public GAMMA_URL.
 */

/** Rewrites a public gamma URL to the internal URL, for server to server requests */
export function toInternalUrl(url: string, config: GammaConfig): string {
  if (config.internalUrl === config.gammaUrl) return url
  return replaceOrigin(url, config.gammaUrl, config.internalUrl)
}

/** Rewrites an internal gamma URL (e.g. from discovery) to the public URL, for the browser */
export function toPublicUrl(url: string, config: GammaConfig): string {
  if (config.internalUrl === config.gammaUrl) return url
  return replaceOrigin(url, config.internalUrl, config.gammaUrl)
}

const DISCOVERY_TTL_MS = 60 * 60 * 1000
const cache = globalThis as typeof globalThis & {
  gammaDiscovery?: { key: string; value: Discovery; at: number }
  gammaJwks?: { url: string; jwks: ReturnType<typeof createRemoteJWKSet> }
}

export async function discover(config: GammaConfig): Promise<Discovery> {
  const key = config.internalUrl
  const cached = cache.gammaDiscovery
  if (cached && cached.key === key && Date.now() - cached.at < DISCOVERY_TTL_MS) {
    return cached.value
  }
  const response = await fetch(`${config.internalUrl}/.well-known/openid-configuration`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Gamma discovery failed with ${response.status}`)
  const value = (await response.json()) as Discovery
  if (!value.issuer || !value.authorization_endpoint || !value.token_endpoint || !value.jwks_uri) {
    throw new Error('Gamma discovery document is incomplete')
  }
  cache.gammaDiscovery = { key, value, at: Date.now() }
  return value
}

export function buildAuthorizeUrl(
  config: GammaConfig,
  discovery: Discovery,
  params: { state: string; nonce: string; codeChallenge: string },
): string {
  // The browser can't reach the internal URL that discovery was fetched through
  const url = new URL(toPublicUrl(discovery.authorization_endpoint, config))
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'openid profile',
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  }).toString()
  return url.toString()
}

export interface TokenResponse {
  access_token: string
  id_token: string
  token_type: string
}

export async function exchangeCode(
  config: GammaConfig,
  discovery: Discovery,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const basic = Buffer.from(
    `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`,
  ).toString('base64')
  const response = await fetch(toInternalUrl(discovery.token_endpoint, config), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Gamma token exchange failed with ${response.status}: ${await response.text()}`)
  }
  const tokens = (await response.json()) as Partial<TokenResponse>
  if (!tokens.id_token || !tokens.access_token) throw new Error('Gamma returned no id_token')
  return tokens as TokenResponse
}

export interface GammaClaims extends JWTPayload {
  sub: string
  cid: string
  nickname?: string
  name?: string
  given_name?: string
  family_name?: string
  locale?: string
  picture?: string
  nonce?: string
}

function jwks(config: GammaConfig, discovery: Discovery) {
  const url = toInternalUrl(discovery.jwks_uri, config)
  if (cache.gammaJwks?.url !== url) {
    cache.gammaJwks = { url, jwks: createRemoteJWKSet(new URL(url)) }
  }
  return cache.gammaJwks.jwks
}

/**
 * Verifies signature, issuer, audience, expiry and nonce of a gamma ID token. The token was minted
 * by the token request to the internal URL, so its `iss` is the issuer of the internally fetched
 * discovery document.
 */
export async function verifyIdToken(
  config: GammaConfig,
  discovery: Discovery,
  idToken: string,
  nonce: string,
): Promise<GammaClaims> {
  const { payload } = await jwtVerify(idToken, jwks(config, discovery), {
    issuer: discovery.issuer,
    audience: config.clientId,
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'exp', 'iat'],
  })
  if (payload.nonce !== nonce) throw new Error('ID token nonce mismatch')
  if (typeof payload.cid !== 'string') throw new Error('ID token has no cid claim')
  return payload as GammaClaims
}

/** Authorities the client has given the user, via gamma's client API */
export async function fetchAuthorities(config: GammaConfig, userId: string): Promise<string[]> {
  const response = await fetch(
    `${config.internalUrl}/api/client/v1/authorities/for/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `pre-shared ${config.apiKeyId}:${config.apiKeyToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  )
  if (!response.ok) throw new Error(`Gamma authorities request failed with ${response.status}`)
  const body: unknown = await response.json()
  if (!Array.isArray(body)) throw new Error('Unexpected authorities response from gamma')
  if (!body.every((authority) => typeof authority === 'string')) {
    throw new Error('Unexpected authorities response from gamma, expected a list of names')
  }
  return body as string[]
}
