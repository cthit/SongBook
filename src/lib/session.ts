import { createHash } from 'crypto'
import { EncryptJWT, jwtDecrypt } from 'jose'
import type { PublicUser } from '@/lib/types'

export const SESSION_COOKIE = 'songbook_session'
export const LOGIN_COOKIE = 'songbook_login'
export const SESSION_LIFETIME_S = 12 * 60 * 60
export const LOGIN_LIFETIME_S = 10 * 60

export interface SessionUser {
  /** Gamma user id (UUID) */
  sub: string
  cid: string
  nickname: string
  name: string
  locale: string
  picture: string | null
  isAdmin: boolean
  authorities: string[]
  /** Epoch ms when the user signed in */
  issuedAt: number
  /** Epoch ms when the authorities were last fetched from gamma */
  authoritiesCheckedAt: number
}

/** State kept between /auth/login and /auth/callback */
export interface LoginState {
  state: string
  nonce: string
  codeVerifier: string
  returnTo: string
}

const DEV_SECRET = 'songbook-development-secret-not-for-production-use'

/** 256 bit key derived from SESSION_SECRET */
export function sessionKey(env: NodeJS.ProcessEnv = process.env): Uint8Array {
  const secret = env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    if (env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set to at least 32 characters in production')
    }
    return createHash('sha256').update(DEV_SECRET).digest()
  }
  return createHash('sha256').update(secret).digest()
}

async function encrypt(
  payload: Record<string, unknown>,
  key: Uint8Array,
  lifetimeS: number,
  now: number,
) {
  const iat = Math.floor(now / 1000)
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(iat)
    .setExpirationTime(iat + lifetimeS)
    .encrypt(key)
}

async function decrypt(token: string, key: Uint8Array, now: number) {
  try {
    const { payload } = await jwtDecrypt(token, key, { currentDate: new Date(now) })
    return payload
  } catch {
    return null
  }
}

export async function encodeSession(user: SessionUser, key: Uint8Array, now = Date.now()) {
  return encrypt({ user }, key, SESSION_LIFETIME_S, now)
}

export async function decodeSession(
  token: string | undefined,
  key: Uint8Array,
  now = Date.now(),
): Promise<SessionUser | null> {
  if (!token) return null
  const payload = await decrypt(token, key, now)
  const user = payload?.user as Partial<SessionUser> | undefined
  if (
    !user ||
    typeof user.sub !== 'string' ||
    typeof user.cid !== 'string' ||
    typeof user.isAdmin !== 'boolean' ||
    !Array.isArray(user.authorities) ||
    typeof user.issuedAt !== 'number' ||
    typeof user.authoritiesCheckedAt !== 'number'
  ) {
    return null
  }
  // The lifetime counts from sign in, refreshing authorities must not extend it
  if (now - user.issuedAt > SESSION_LIFETIME_S * 1000) return null
  return user as SessionUser
}

export async function encodeLoginState(state: LoginState, key: Uint8Array, now = Date.now()) {
  return encrypt({ login: state }, key, LOGIN_LIFETIME_S, now)
}

export async function decodeLoginState(
  token: string | undefined,
  key: Uint8Array,
  now = Date.now(),
): Promise<LoginState | null> {
  if (!token) return null
  const payload = await decrypt(token, key, now)
  const login = payload?.login as Partial<LoginState> | undefined
  if (
    !login ||
    typeof login.state !== 'string' ||
    typeof login.nonce !== 'string' ||
    typeof login.codeVerifier !== 'string' ||
    typeof login.returnTo !== 'string'
  ) {
    return null
  }
  return login as LoginState
}

export function toPublicUser(user: SessionUser): PublicUser {
  return {
    cid: user.cid,
    nickname: user.nickname,
    name: user.name,
    locale: user.locale,
    picture: user.picture,
    isAdmin: user.isAdmin,
  }
}

const RETURN_TO_BASE = 'http://songbook.invalid'

/** Path, query and hash of `value` resolved like a browser would, or null if it leaves the site */
function localPath(value: string): string | null {
  // URL parsing strips tabs/newlines and treats backslashes as slashes, reject them up front
  if (!value.startsWith('/') || /[\x00-\x1f\x7f\\]/.test(value)) return null
  // Throws for some values starting with `//`, e.g. `//[` or `//%`, which are hosts not paths
  const url = URL.parse(value, RETURN_TO_BASE)
  if (!url) return null
  // Dot segments (also %2e) are resolved here, e.g. `/.//evil.example` becomes `//evil.example`,
  // which a later `new URL(path, APP_URL)` would read as a protocol relative URL
  if (url.origin !== RETURN_TO_BASE || /^\/[/\\]/.test(url.pathname)) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/** Only allow redirects to paths on this site, never to other origins */
export function safeReturnTo(value: string | null | undefined): string {
  const path = value ? localPath(value) : null
  // The result must be stable, i.e. resolve to itself when it is resolved again
  return path !== null && localPath(path) === path ? path : '/'
}

/**
 * The absolute URL to redirect to after signing in. Checks the final destination once more right
 * before redirecting, so a bad value (e.g. from an old login cookie) can never leave the site.
 */
export function returnToUrl(returnTo: string | null | undefined, appUrl: string): URL {
  const home = new URL('/', appUrl)
  const target = new URL(safeReturnTo(returnTo), home)
  return target.origin === home.origin ? target : home
}

export function cookieOptions(maxAge: number, env: NodeJS.ProcessEnv = process.env) {
  const appUrl = env.APP_URL ?? 'http://localhost:3000'
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: appUrl.startsWith('https://'),
    path: '/',
    maxAge,
  }
}
