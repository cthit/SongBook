import { describe, expect, it } from 'vitest'
import { generateShortId, isShortId, isUuid, shortIdError } from '@/lib/ids'

describe('short ids', () => {
  it('generates four lowercase ascii letters', () => {
    for (let i = 0; i < 1000; i++) expect(generateShortId()).toMatch(/^[a-z]{4}$/)
  })

  it('is random enough', () => {
    const ids = new Set(Array.from({ length: 200 }, generateShortId))
    expect(ids.size).toBeGreaterThan(190)
  })

  it('validates ids like the old backend', () => {
    expect(isShortId('crsi')).toBe(true)
    expect(isShortId('CRSI')).toBe(false)
    expect(isShortId('crs')).toBe(false)
    expect(isShortId('crsi1')).toBe(false)
    expect(isShortId('åäöx')).toBe(false)
    expect(isShortId(1234)).toBe(false)
    expect(shortIdError('crsi')).toBeNull()
    expect(shortIdError('abcde')).toBe('ID_NOT_LENGTH_FOUR')
    expect(shortIdError('AbCd')).toBe('ID_NOT_LOWERCASE')
  })

  it('validates uuids', () => {
    expect(isUuid('5f6b1c3e-2a4d-4e8f-9b1a-0c2d3e4f5a6b')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
  })
})
