import { cookies } from 'next/headers'
import { ApiError } from '@/lib/api'
import { fetchAuthorities, gammaConfig } from '@/lib/gamma'
import {
  SESSION_COOKIE,
  SESSION_LIFETIME_S,
  cookieOptions,
  decodeSession,
  encodeSession,
  sessionKey,
  type SessionUser,
} from '@/lib/session'

/** Authorities are re-checked against gamma this often so revocations apply quickly */
export const AUTHORITY_REFRESH_MS = 5 * 60 * 1000

/**
 * The refresh interval, AUTHORITY_REFRESH_MS unless GAMMA_AUTHORITY_REFRESH_SECONDS sets a shorter
 * one (the end-to-end tests use 1 second). It can't be made longer.
 */
export function authorityRefreshMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.GAMMA_AUTHORITY_REFRESH_SECONDS?.trim()
  const seconds = value ? Number(value) : NaN
  if (!Number.isFinite(seconds) || seconds < 0) return AUTHORITY_REFRESH_MS
  return Math.min(seconds * 1000, AUTHORITY_REFRESH_MS)
}

export function isAdminFromAuthorities(authorities: readonly string[], adminAuthority: string) {
  return authorities.includes(adminAuthority)
}

export function needsAuthorityRefresh(
  user: SessionUser,
  now = Date.now(),
  refreshMs = authorityRefreshMs(),
): boolean {
  return now - user.authoritiesCheckedAt >= refreshMs
}

/** Returns the user with fresh authorities if the session's check is older than 5 minutes */
export async function refreshAuthorities(
  user: SessionUser,
  options: {
    adminAuthority: string
    fetch: (sub: string) => Promise<string[]>
    now?: number
  },
): Promise<SessionUser> {
  const now = options.now ?? Date.now()
  if (!needsAuthorityRefresh(user, now)) return user
  const authorities = await options.fetch(user.sub)
  return {
    ...user,
    authorities,
    isAdmin: isAdminFromAuthorities(authorities, options.adminAuthority),
    authoritiesCheckedAt: now,
  }
}

// Short lived per-user cache so page renders with a stale cookie don't hit gamma every time
const authorityCache = globalThis as typeof globalThis & {
  songbookAuthorities?: Map<string, { authorities: string[]; at: number }>
}

async function cachedFetchAuthorities(sub: string): Promise<string[]> {
  const map = (authorityCache.songbookAuthorities ??= new Map())
  const cached = map.get(sub)
  if (cached && Date.now() - cached.at < authorityRefreshMs()) return cached.authorities
  const authorities = await fetchAuthorities(gammaConfig(), sub)
  map.set(sub, { authorities, at: Date.now() })
  return authorities
}

/** The session stored in the cookie, without contacting gamma */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  return decodeSession(store.get(SESSION_COOKIE)?.value, sessionKey())
}

async function refreshed(user: SessionUser, useCache: boolean): Promise<SessionUser> {
  return refreshAuthorities(user, {
    adminAuthority: gammaConfig().adminAuthority,
    fetch: useCache ? cachedFetchAuthorities : uncachedFetchAuthorities,
  })
}

/** Always asks gamma (and updates the cache), used before mutations */
async function uncachedFetchAuthorities(sub: string): Promise<string[]> {
  const authorities = await fetchAuthorities(gammaConfig(), sub)
  ;(authorityCache.songbookAuthorities ??= new Map()).set(sub, { authorities, at: Date.now() })
  return authorities
}

/**
 * The signed in user for rendering pages. Authorities are refreshed when stale; if gamma is
 * unreachable the user is treated as a non-admin until it is back (mutations answer 503).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user) return null
  try {
    return await refreshed(user, true)
  } catch (error) {
    console.error('Could not refresh authorities from gamma:', error)
    return { ...user, isAdmin: false }
  }
}

/** For route handlers: 401 when signed out */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'NOT_AUTHENTICATED')
  return refreshAndPersist(user)
}

/** For route handlers: 401 when signed out, 403 without the admin authority */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.isAdmin) throw new ApiError(403, 'INSUFFICIENT_ACCESS')
  return user
}

async function refreshAndPersist(user: SessionUser): Promise<SessionUser> {
  if (!needsAuthorityRefresh(user)) return user
  let fresh: SessionUser
  try {
    fresh = await refreshed(user, false)
  } catch (error) {
    console.error('Could not refresh authorities from gamma:', error)
    throw new ApiError(503, 'GAMMA_UNAVAILABLE')
  }
  const remaining = SESSION_LIFETIME_S - Math.floor((Date.now() - fresh.issuedAt) / 1000)
  const store = await cookies()
  store.set(SESSION_COOKIE, await encodeSession(fresh, sessionKey()), cookieOptions(remaining))
  return fresh
}
