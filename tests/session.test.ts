import { describe, expect, it } from 'vitest'
import {
  SESSION_LIFETIME_S,
  decodeLoginState,
  decodeSession,
  encodeLoginState,
  encodeSession,
  safeReturnTo,
  sessionKey,
  type SessionUser,
} from '@/lib/session'

const key = sessionKey({ SESSION_SECRET: 'a'.repeat(40), NODE_ENV: 'test' })
const now = Date.UTC(2026, 9, 28, 12)
const user: SessionUser = {
  sub: '5f6b1c3e-2a4d-4e8f-9b1a-0c2d3e4f5a6b',
  cid: 'kulturchef',
  nickname: 'Kulturchefen',
  name: "Kultur 'Kulturchefen' Chef",
  locale: 'sv',
  picture: null,
  isAdmin: true,
  authorities: ['songbook'],
  issuedAt: now,
  authoritiesCheckedAt: now,
}

describe('session cookie', () => {
  it('round trips', async () => {
    const token = await encodeSession(user, key, now)
    expect(token.split('.')).toHaveLength(5) // compact JWE, i.e. encrypted
    expect(token).not.toContain('kulturchef')
    expect(await decodeSession(token, key, now + 1000)).toEqual(user)
  })

  it('rejects tampered tokens and other keys', async () => {
    const token = await encodeSession(user, key, now)
    const tampered = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(await decodeSession(tampered, key, now)).toBeNull()
    const otherKey = sessionKey({ SESSION_SECRET: 'b'.repeat(40), NODE_ENV: 'test' })
    expect(await decodeSession(token, otherKey, now)).toBeNull()
    expect(await decodeSession(undefined, key, now)).toBeNull()
    expect(await decodeSession('garbage', key, now)).toBeNull()
  })

  it('expires after 12 hours', async () => {
    const token = await encodeSession(user, key, now)
    expect(await decodeSession(token, key, now + (SESSION_LIFETIME_S - 60) * 1000)).not.toBeNull()
    expect(await decodeSession(token, key, now + (SESSION_LIFETIME_S + 60) * 1000)).toBeNull()
  })

  it('does not extend the lifetime when re-encoded later', async () => {
    const token = await encodeSession(user, key, now + 11 * 3600 * 1000)
    expect(await decodeSession(token, key, now + 13 * 3600 * 1000)).toBeNull()
  })

  it('round trips the login state', async () => {
    const state = { state: 's', nonce: 'n', codeVerifier: 'v', returnTo: '/songs/create' }
    expect(await decodeLoginState(await encodeLoginState(state, key, now), key, now)).toEqual(state)
    expect(await decodeLoginState(await encodeSession(user, key, now), key, now)).toBeNull()
  })

  it('requires a long SESSION_SECRET in production', () => {
    expect(() => sessionKey({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/)
    expect(() => sessionKey({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow()
    expect(sessionKey({ NODE_ENV: 'development' })).toHaveLength(32)
  })
})

describe('safeReturnTo', () => {
  it('only allows local paths', () => {
    expect(safeReturnTo('/crsi')).toBe('/crsi')
    expect(safeReturnTo('/songs/edit/crsi?x=1')).toBe('/songs/edit/crsi?x=1')
    expect(safeReturnTo('https://evil.example')).toBe('/')
    expect(safeReturnTo('//evil.example')).toBe('/')
    expect(safeReturnTo('/\\evil.example')).toBe('/')
    expect(safeReturnTo(null)).toBe('/')
    // URL parsing strips tabs and newlines, which would turn these into //evil.example
    expect(safeReturnTo('/\t/evil.example')).toBe('/')
    expect(safeReturnTo('/\n/evil.example')).toBe('/')
    expect(safeReturnTo('/%09/evil.example')).toBe('/%09/evil.example')
    expect(new URL(safeReturnTo('/%09/evil.example'), 'https://songbook.chalmers.it').origin).toBe(
      'https://songbook.chalmers.it',
    )
  })
})
