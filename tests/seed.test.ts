import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { parseSong, parseSongbookMarkdown } from '@/lib/seed'

const markdown = readFileSync(path.join(__dirname, '..', 'data', 'sangbok.md'), 'utf8')

describe('parseSongbookMarkdown', () => {
  const categories = parseSongbookMarkdown(markdown)
  const songs = categories.flatMap((category) => category.songs)

  it('finds the nine categories in file order', () => {
    expect(categories.map((category) => category.name)).toEqual([
      'IT',
      'Snaps',
      'Öhl',
      'Vin',
      'Bäsk',
      'Punsch',
      'Dagen efter...',
      'Mannen och kvinnan',
      'Allmänt',
    ])
  })

  it('finds every song, including the last one of each category', () => {
    expect(songs).toHaveLength(157)
    expect(categories.map((category) => category.songs.length)).toEqual([
      15, 58, 8, 12, 4, 8, 11, 8, 33,
    ])
    expect(categories[0].songs.at(-1)?.title).toBe('ÖVERAMBITIÖS')
    expect(categories.at(-1)?.songs.at(-1)?.title).toBe('I WILL SURVIVE')
  })

  it('has unique titles', () => {
    expect(new Set(songs.map((song) => song.title)).size).toBe(songs.length)
  })

  it('parses melody, author and text like the old backend', () => {
    const byTitle = new Map(songs.map((song) => [song.title, song]))
    expect(byTitle.get('SKÅL FÖR IT')).toMatchObject({
      melody: 'Vikingen',
      author: 'P.R.I.T. -04',
    })
    expect(byTitle.get('SKÅL FÖR IT')?.text.startsWith('Mel: Vikingen\n\nNär IT har kalas')).toBe(
      true,
    )
    expect(byTitle.get('HALLONSAFT')).toMatchObject({ melody: '', author: 'Unknown' })
    expect(byTitle.get('VI ÄRO FRÅN IT')?.melody).toBe('Vi äro små humlor vi...')
    expect(byTitle.get('LAMBO')).toMatchObject({ melody: '', author: 'Unknown' })
    expect(byTitle.get('LAMBO')?.text.startsWith('*Alla:*')).toBe(true)
    // Titles are trimmed, like Pony did
    expect(byTitle.has('LIFE')).toBe(true)
  })

  it('every song has text', () => {
    for (const song of songs) expect(song.text.length).toBeGreaterThan(0)
  })
})

describe('parseSong', () => {
  it('reads Mel and Text lines', () => {
    expect(parseSong('A SONG\n------\n\n*Mel: Some tune*\n\nLa la\n\n*Text: Someone*\n')).toEqual({
      title: 'A SONG',
      melody: 'Some tune',
      author: 'Someone',
      text: '*Mel: Some tune*\n\nLa la\n\n*Text: Someone*',
    })
  })
})

describe('parseSongbookMarkdown with short songs', () => {
  it('keeps short songs and drops songs without title or text', () => {
    expect(parseSongbookMarkdown('IT\n==\n\nA\n---\n\nB\n')).toEqual([
      { name: 'IT', songs: [{ title: 'A', melody: '', author: 'Unknown', text: 'B' }] },
    ])
    expect(parseSongbookMarkdown('IT\n==\n\nA\n---\n\n\nC\n---\n\nD\n')).toEqual([
      { name: 'IT', songs: [{ title: 'C', melody: '', author: 'Unknown', text: 'D' }] },
    ])
  })
})
