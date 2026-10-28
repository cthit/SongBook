import { describe, expect, it, vi } from 'vitest'
import {
  AUTHORITY_REFRESH_MS,
  authorityRefreshMs,
  isAdminFromAuthorities,
  needsAuthorityRefresh,
  refreshAuthorities,
} from '@/lib/auth'
import type { SessionUser } from '@/lib/session'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const now = 1_700_000_000_000
const user: SessionUser = {
  sub: 'sub',
  cid: 'cid',
  nickname: 'nick',
  name: 'name',
  locale: 'en',
  picture: null,
  isAdmin: true,
  authorities: ['songbook'],
  issuedAt: now,
  authoritiesCheckedAt: now,
}

describe('authority checks', () => {
  it('is admin only with the configured authority', () => {
    expect(isAdminFromAuthorities(['songbook'], 'songbook')).toBe(true)
    expect(isAdminFromAuthorities(['songbook-admin', 'other'], 'songbook')).toBe(false)
    expect(isAdminFromAuthorities([], 'songbook')).toBe(false)
    expect(isAdminFromAuthorities(['kulturnamnden'], 'kulturnamnden')).toBe(true)
  })

  it('refreshes after five minutes', () => {
    expect(needsAuthorityRefresh(user, now + AUTHORITY_REFRESH_MS - 1)).toBe(false)
    expect(needsAuthorityRefresh(user, now + AUTHORITY_REFRESH_MS)).toBe(true)
  })

  it('can shorten, but not lengthen, the refresh interval', () => {
    const env = (value?: string) =>
      authorityRefreshMs({ NODE_ENV: 'test', GAMMA_AUTHORITY_REFRESH_SECONDS: value })
    expect(env(undefined)).toBe(AUTHORITY_REFRESH_MS)
    expect(env('')).toBe(AUTHORITY_REFRESH_MS)
    expect(env('nope')).toBe(AUTHORITY_REFRESH_MS)
    expect(env('-1')).toBe(AUTHORITY_REFRESH_MS)
    expect(env('1')).toBe(1000)
    expect(env('0')).toBe(0)
    expect(env('3600')).toBe(AUTHORITY_REFRESH_MS)
    expect(needsAuthorityRefresh(user, now + 1000, 1000)).toBe(true)
    expect(needsAuthorityRefresh(user, now + 999, 1000)).toBe(false)
  })

  it('keeps fresh sessions without asking gamma', async () => {
    const fetch = vi.fn()
    const result = await refreshAuthorities(user, {
      adminAuthority: 'songbook',
      fetch,
      now: now + 1000,
    })
    expect(result).toBe(user)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('revokes admin when gamma no longer lists the authority', async () => {
    const later = now + AUTHORITY_REFRESH_MS + 1
    const fetch = vi.fn().mockResolvedValue(['something-else'])
    const result = await refreshAuthorities(user, { adminAuthority: 'songbook', fetch, now: later })
    expect(fetch).toHaveBeenCalledWith('sub')
    expect(result).toMatchObject({
      isAdmin: false,
      authorities: ['something-else'],
      authoritiesCheckedAt: later,
    })
    expect(result.issuedAt).toBe(now)
  })

  it('grants admin when the authority is added', async () => {
    const member = { ...user, isAdmin: false, authorities: [] }
    const later = now + AUTHORITY_REFRESH_MS
    const result = await refreshAuthorities(member, {
      adminAuthority: 'songbook',
      fetch: async () => ['songbook'],
      now: later,
    })
    expect(result.isAdmin).toBe(true)
  })

  it('propagates gamma errors so callers can fail closed', async () => {
    const later = now + AUTHORITY_REFRESH_MS
    await expect(
      refreshAuthorities(user, {
        adminAuthority: 'songbook',
        fetch: () => Promise.reject(new Error('down')),
        now: later,
      }),
    ).rejects.toThrow('down')
  })
})
