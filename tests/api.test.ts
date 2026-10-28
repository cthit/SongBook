import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { ApiError, assertSameOrigin, readJsonObject } from '@/lib/api'

const request = (headers: Record<string, string>, body?: string) =>
  new NextRequest('http://localhost:3000/api/songs', { method: 'POST', headers, body })

const appUrl = 'https://songbook.chalmers.it'

describe('assertSameOrigin', () => {
  it('allows our own origin and requests without browser headers', () => {
    expect(() => assertSameOrigin(request({ origin: appUrl }), appUrl)).not.toThrow()
    expect(() =>
      assertSameOrigin(request({ origin: 'http://localhost:3000' }), appUrl),
    ).not.toThrow()
    expect(() =>
      assertSameOrigin(request({ 'sec-fetch-site': 'same-origin' }), appUrl),
    ).not.toThrow()
    expect(() => assertSameOrigin(request({}), appUrl)).not.toThrow()
  })

  it('rejects other origins, including other chalmers.it sites', () => {
    expect(() => assertSameOrigin(request({ origin: 'https://evil.chalmers.it' }), appUrl)).toThrow(
      ApiError,
    )
    expect(() => assertSameOrigin(request({ 'sec-fetch-site': 'same-site' }), appUrl)).toThrow(
      ApiError,
    )
    expect(() => assertSameOrigin(request({ 'sec-fetch-site': 'cross-site' }), appUrl)).toThrow(
      ApiError,
    )
  })
})

describe('readJsonObject', () => {
  it('requires a JSON content type', async () => {
    await expect(
      readJsonObject(request({ 'content-type': 'text/plain' }, '{}')),
    ).rejects.toMatchObject({
      status: 415,
    })
    await expect(
      readJsonObject(request({ 'content-type': 'application/json' }, '{"a":1}')),
    ).resolves.toEqual({ a: 1 })
    await expect(
      readJsonObject(request({ 'content-type': 'application/json' }, '[1]')),
    ).rejects.toMatchObject({ status: 400 })
  })
})
