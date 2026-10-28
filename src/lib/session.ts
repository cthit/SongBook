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

/** Only allow redirects to paths on this site, never to other origins */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/'
  }
  return value
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
