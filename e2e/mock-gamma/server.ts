/**
 * A tiny stand-in for gamma (https://github.com/cthit/gamma, v2.5.x) implementing the parts of the
 * contract the songbook uses: OIDC discovery, authorization code flow with PKCE, RS256 ID tokens
 * with gamma's claims, JWKS, userinfo and the client API's authorities endpoint.
 *
 * Like gamma 2.5.3 (Spring Authorization Server without a fixed issuer) the issuer and every URL in
 * the discovery document are derived from the Host header of the request, so the mock answers to
 * different hostnames (e.g. localhost for the browser and 127.0.0.1 for the app) with different
 * issuers. Only the `picture` claim uses a fixed base URL, like gamma's BASE_URL.
 *
 * Run standalone with `pnpm tsx e2e/mock-gamma/main.ts`.
 */
import { createHash, randomBytes, randomUUID } from 'crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'

export interface MockUser {
  sub: string
  cid: string
  nick: string
  firstName: string
  lastName: string
  locale: 'en' | 'sv'
  authorities: string[]
}

export const MOCK_USERS: Record<'admin' | 'member', MockUser> = {
  admin: {
    sub: '5f6b1c3e-2a4d-4e8f-9b1a-0c2d3e4f5a6b',
    cid: 'kulturchef',
    nick: 'Kulturchefen',
    firstName: 'Kultur',
    lastName: 'Chef',
    locale: 'en',
    authorities: ['songbook'],
  },
  member: {
    sub: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    cid: 'jhalpert',
    nick: 'Jim',
    firstName: 'Jim',
    lastName: 'Halpert',
    locale: 'en',
    authorities: [],
  },
}

export interface MockGammaOptions {
  /** 0 picks a free port */
  port: number
  /** gamma's BASE_URL, used for the picture claim. Defaults to http://localhost:{port} */
  baseUrl?: string
  clientId: string
  clientSecret: string
  redirectUri: string
  apiKeyId: string
  apiKeyToken: string
}

interface PendingCode {
  user: MockUser
  redirectUri: string
  nonce: string | null
  codeChallenge: string | null
  expiresAt: number
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )

async function readBody(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
}

function send(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const isString = typeof body === 'string'
  response.writeHead(status, {
    'Content-Type': isString ? 'text/html; charset=utf-8' : 'application/json',
    ...headers,
  })
  response.end(isString ? body : JSON.stringify(body))
}

export async function startMockGamma(
  options: MockGammaOptions,
): Promise<{ url: string; close: () => Promise<void> }> {
  // Set once the server is listening, when the port is known
  let baseUrl = options.baseUrl ?? ''
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const kid = randomUUID()
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid, use: 'sig', alg: 'RS256' }

  const users = Object.values(MOCK_USERS).map((user) => ({
    ...user,
    authorities: [...user.authorities],
  }))
  const codes = new Map<string, PendingCode>()
  const accessTokens = new Map<string, MockUser>()

  const claimsFor = (user: MockUser) => ({
    name: `${user.firstName} '${user.nick}' ${user.lastName}`,
    given_name: user.firstName,
    family_name: user.lastName,
    nickname: user.nick,
    locale: user.locale,
    picture: `${baseUrl}/images/user/avatar/${user.sub}`,
    cid: user.cid,
  })

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const issuer = `http://${request.headers.host ?? new URL(baseUrl).host}`
    const url = new URL(request.url ?? '/', issuer)

    if (request.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
      return send(response, 200, {
        issuer,
        authorization_endpoint: `${issuer}/oauth2/authorize`,
        token_endpoint: `${issuer}/oauth2/token`,
        userinfo_endpoint: `${issuer}/oauth2/userinfo`,
        jwks_uri: `${issuer}/oauth2/jwks`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'profile', 'email'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
        code_challenge_methods_supported: ['S256'],
      })
    }

    if (request.method === 'GET' && url.pathname === '/oauth2/jwks') {
      return send(response, 200, { keys: [jwk] })
    }

    if (request.method === 'GET' && url.pathname === '/oauth2/authorize') {
      const params = url.searchParams
      if (params.get('client_id') !== options.clientId) return send(response, 400, 'Unknown client')
      if (params.get('redirect_uri') !== options.redirectUri)
        return send(response, 400, 'Invalid redirect_uri')
      if (params.get('response_type') !== 'code')
        return send(response, 400, 'Unsupported response_type')
      if (!params.get('scope')?.split(' ').includes('openid'))
        return send(response, 400, 'Missing openid scope')
      if (params.get('code_challenge') && params.get('code_challenge_method') !== 'S256') {
        return send(response, 400, 'Only S256 is supported')
      }
      const hidden = ['redirect_uri', 'state', 'nonce', 'code_challenge']
        .map(
          (key) =>
            `<input type="hidden" name="${key}" value="${escapeHtml(params.get(key) ?? '')}">`,
        )
        .join('')
      const choices = Object.entries(MOCK_USERS)
        .map(
          ([key, user], index) =>
            `<label><input type="radio" name="user" value="${key}"${index === 0 ? ' checked' : ''}> ${key} (${user.cid})</label><br>`,
        )
        .join('')
      return send(
        response,
        200,
        `<!doctype html><meta charset="utf-8"><title>Mock gamma</title>
<h1>Mock gamma sign in</h1><form method="post" action="/oauth2/authorize">${hidden}${choices}
<button type="submit">Authorize</button></form>`,
      )
    }

    if (request.method === 'POST' && url.pathname === '/oauth2/authorize') {
      const body = await readBody(request)
      const user = MOCK_USERS[body.get('user') as keyof typeof MOCK_USERS]
      const redirectUri = body.get('redirect_uri') ?? ''
      if (!user || redirectUri !== options.redirectUri)
        return send(response, 400, 'Invalid request')
      const code = randomBytes(24).toString('base64url')
      codes.set(code, {
        user: users.find((candidate) => candidate.sub === user.sub)!,
        redirectUri,
        nonce: body.get('nonce') || null,
        codeChallenge: body.get('code_challenge') || null,
        expiresAt: Date.now() + 60_000,
      })
      const target = new URL(redirectUri)
      target.searchParams.set('code', code)
      if (body.get('state')) target.searchParams.set('state', body.get('state')!)
      response.writeHead(302, { Location: target.toString() })
      return response.end()
    }

    if (request.method === 'POST' && url.pathname === '/oauth2/token') {
      const body = await readBody(request)
      const [scheme, credentials] = (request.headers.authorization ?? '').split(' ')
      const [clientId, clientSecret] =
        scheme === 'Basic'
          ? Buffer.from(credentials ?? '', 'base64')
              .toString('utf8')
              .split(':')
              .map(decodeURIComponent)
          : [body.get('client_id'), body.get('client_secret')]
      if (clientId !== options.clientId || clientSecret !== options.clientSecret) {
        return send(response, 401, { error: 'invalid_client' })
      }
      if (body.get('grant_type') !== 'authorization_code') {
        return send(response, 400, { error: 'unsupported_grant_type' })
      }
      const code = body.get('code') ?? ''
      const pending = codes.get(code)
      codes.delete(code)
      if (
        !pending ||
        pending.expiresAt < Date.now() ||
        pending.redirectUri !== body.get('redirect_uri')
      ) {
        return send(response, 400, { error: 'invalid_grant' })
      }
      if (pending.codeChallenge) {
        const challenge = createHash('sha256')
          .update(body.get('code_verifier') ?? '')
          .digest('base64url')
        if (challenge !== pending.codeChallenge)
          return send(response, 400, { error: 'invalid_grant' })
      }
      const accessToken = randomBytes(32).toString('base64url')
      accessTokens.set(accessToken, pending.user)
      const idToken = await new SignJWT({
        ...claimsFor(pending.user),
        ...(pending.nonce ? { nonce: pending.nonce } : {}),
        auth_time: Math.floor(Date.now() / 1000),
      })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuer(issuer)
        .setSubject(pending.user.sub)
        .setAudience(options.clientId)
        .setIssuedAt()
        .setExpirationTime('30m')
        .setJti(randomUUID())
        .sign(privateKey)
      return send(response, 200, {
        access_token: accessToken,
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 299,
        scope: 'openid profile',
      })
    }

    if (url.pathname === '/oauth2/userinfo') {
      const token = request.headers.authorization?.replace(/^Bearer /, '') ?? ''
      const user = accessTokens.get(token)
      if (!user) return send(response, 401, { error: 'invalid_token' })
      return send(response, 200, { sub: user.sub, ...claimsFor(user) })
    }

    if (url.pathname.startsWith('/api/client/v1/')) {
      if (
        request.headers.authorization !== `pre-shared ${options.apiKeyId}:${options.apiKeyToken}`
      ) {
        return send(response, 401, { error: 'Unauthorized' })
      }
      const forUser = /^\/api\/client\/v1\/authorities\/for\/([^/]+)$/.exec(url.pathname)
      if (request.method === 'GET' && forUser) {
        const user = users.find((candidate) => candidate.sub === decodeURIComponent(forUser[1]))
        return send(response, 200, user?.authorities ?? [])
      }
      if (request.method === 'GET' && url.pathname === '/api/client/v1/authorities') {
        return send(response, 200, [...new Set(users.flatMap((user) => user.authorities))])
      }
      return send(response, 404, { error: 'Not found' })
    }

    // Test hook: change a user's authorities, e.g. to test revocation
    if (request.method === 'POST' && url.pathname === '/__test/authorities') {
      const body = await readBody(request)
      const user = users.find((candidate) => candidate.cid === body.get('cid'))
      if (!user) return send(response, 404, { error: 'Unknown cid' })
      user.authorities = body.getAll('authority')
      return send(response, 200, user.authorities)
    }

    return send(response, 404, 'Not found')
  }

  const server: Server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      console.error('Mock gamma error:', error)
      send(response, 500, { error: 'server_error' })
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, resolve)
  })
  baseUrl ||= `http://localhost:${(server.address() as AddressInfo).port}`

  return {
    url: baseUrl,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
