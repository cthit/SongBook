import { describe, expect, it } from 'vitest'
import { diffLines } from '@/lib/diff'
import { startOfText } from '@/lib/markdown'
import { filterSongs } from '@/lib/search'
import type { Song } from '@/lib/types'

const song = (number: number, title: string, tags: string[], text = 'La la la'): Song => ({
  song_id: title.slice(0, 4).toLowerCase(),
  number,
  title,
  author: 'Unknown',
  melody: '',
  text,
  tags,
  hidden: false,
})

const songs = [
  song(3, 'LAMBO', ['allm']),
  song(1, 'SKÅL FÖR IT', ['itit']),
  song(2, 'HELAN GÅR', ['snap']),
]

describe('filterSongs', () => {
  it('sorts by number without filters', () => {
    expect(filterSongs(songs, '', []).map((s) => s.number)).toEqual([1, 2, 3])
  })

  it('ORs the selected tags', () => {
    expect(filterSongs(songs, '', ['snap', 'itit']).map((s) => s.title)).toEqual([
      'SKÅL FÖR IT',
      'HELAN GÅR',
    ])
  })

  it('fuzzy searches titles and numbers', () => {
    expect(filterSongs(songs, 'lambo', []).map((s) => s.title)).toEqual(['LAMBO'])
    expect(filterSongs(songs, '2', []).map((s) => s.title)).toEqual(['HELAN GÅR'])
  })

  it('applies tags before the search', () => {
    expect(filterSongs(songs, 'lambo', ['snap'])).toEqual([])
  })
})

describe('startOfText', () => {
  it('cuts after ~100 characters at the end of the line', () => {
    const text = `${'a'.repeat(95)} end of line\nnext line`
    expect(startOfText(text)).toBe(`${'a'.repeat(95)} end of line\n\n...`)
  })
})

describe('diffLines', () => {
  it('marks added and removed lines', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'x' },
      { type: 'same', text: 'c' },
    ])
  })
})
