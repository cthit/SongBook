import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { songbookToMarkdown } from '@/lib/export'
import { parseSongbookMarkdown } from '@/lib/seed'
import type { Song, Tag } from '@/lib/types'

const markdown = readFileSync(path.join(__dirname, '..', 'data', 'sangbok.md'), 'utf8')

/** Turns the parsed file into what the database would contain after `pnpm db:seed` */
function seededSongbook(): { songs: Song[]; tags: Tag[] } {
  const songs: Song[] = []
  const tags: Tag[] = []
  parseSongbookMarkdown(markdown).forEach((category, i) => {
    const tagId = `t${String(i).padStart(3, '0')}`
    tags.push({
      tag_id: tagId,
      name: category.name,
      pretty_name_sv: category.name,
      pretty_name_en: category.name,
      song: [],
    })
    for (const song of category.songs) {
      songs.push({
        ...song,
        song_id: `s${songs.length}`,
        number: songs.length + 1,
        tags: [tagId],
        hidden: false,
      })
    }
  })
  return { songs, tags }
}

describe('songbookToMarkdown', () => {
  it('round trips through the seed parser', () => {
    const { songs, tags } = seededSongbook()
    const parsed = parseSongbookMarkdown(songbookToMarkdown(songs, tags))
    expect(parsed.map((category) => category.name)).toEqual(tags.map((tag) => tag.name))
    const reparsed = parsed.flatMap((category) => category.songs)
    expect(reparsed.map((song) => song.title)).toEqual(songs.map((song) => song.title))
    expect(reparsed.map((song) => song.melody)).toEqual(songs.map((song) => song.melody))
    expect(reparsed.map((song) => song.author)).toEqual(songs.map((song) => song.author))
    expect(reparsed.map((song) => song.text)).toEqual(songs.map((song) => song.text))
  })

  it('adds Mel and Text lines for songs created in the app', () => {
    const songs: Song[] = [
      {
        song_id: 'aaaa',
        number: 2,
        title: 'NY VISA',
        author: 'Någon',
        melody: 'Gubben Noak',
        text: 'La la la',
        tags: ['tttt'],
        hidden: false,
      },
      {
        song_id: 'bbbb',
        number: 1,
        title: 'UTAN TAGG',
        author: '',
        melody: '',
        text: 'Hej',
        tags: [],
        hidden: false,
      },
    ]
    const tags: Tag[] = [
      {
        tag_id: 'tttt',
        name: 'Snaps',
        pretty_name_sv: 'Snaps',
        pretty_name_en: 'Snaps',
        song: ['aaaa'],
      },
    ]
    const exported = songbookToMarkdown(songs, tags)
    // Ordered by song number, untagged songs end up under "Övrigt"
    expect(exported.indexOf('Övrigt')).toBeLessThan(exported.indexOf('Snaps'))
    const parsed = parseSongbookMarkdown(exported)
    expect(parsed.map((category) => category.name)).toEqual(['Övrigt', 'Snaps'])
    expect(parsed[1].songs[0]).toMatchObject({
      title: 'NY VISA',
      melody: 'Gubben Noak',
      author: 'Någon',
    })
    expect(parsed[0].songs[0]).toMatchObject({ title: 'UTAN TAGG', melody: '', author: 'Unknown' })
  })

  /** Exports `songs` under one tag and parses the result again, like an export + re-seed */
  function roundTrip(songs: Song[]) {
    const tag: Tag = {
      tag_id: 'tttt',
      name: 'IT',
      pretty_name_sv: 'IT',
      pretty_name_en: 'IT',
      song: [],
    }
    return parseSongbookMarkdown(songbookToMarkdown(songs, [tag])).flatMap((c) => c.songs)
  }

  it('exports edited and cleared melodies and authors, not the stale lines in the lyrics', () => {
    const { songs } = seededSongbook()
    const original = songs.find((song) => song.title === 'SKÅL FÖR IT')!
    // The seeded lyrics contain both lines
    expect(original.text).toMatch(/^Mel: Vikingen$/m)
    expect(original.text).toMatch(/^\*?Text: P\.R\.I\.T\. -04/m)

    const edited = {
      ...original,
      melody: 'Gubben Noak',
      author: 'Kulturnämnden -26',
      tags: ['tttt'],
    }
    const [reparsedEdited] = roundTrip([edited])
    expect(reparsedEdited).toMatchObject({ melody: 'Gubben Noak', author: 'Kulturnämnden -26' })
    expect(reparsedEdited.text).not.toContain('Vikingen')
    expect(reparsedEdited.text).not.toContain('P.R.I.T.')
    expect(reparsedEdited.text).toContain('När IT har kalas')

    const cleared = { ...original, melody: '', author: '', tags: ['tttt'] }
    const [reparsedCleared] = roundTrip([cleared])
    expect(reparsedCleared).toMatchObject({ melody: '', author: 'Unknown' })
    expect(reparsedCleared.text).not.toMatch(/Mel:|Text:/)
    expect(reparsedCleared.text.startsWith('När IT har kalas')).toBe(true)
  })

  it('round trips every seeded song after editing all melodies and authors', () => {
    const { songs } = seededSongbook()
    const edited = songs.map((song, i) => ({
      ...song,
      melody: i % 3 === 0 ? '' : `Melodi ${i}`,
      author: i % 4 === 0 ? '' : `Författare ${i}`,
    }))
    const { tags } = seededSongbook()
    const reparsed = parseSongbookMarkdown(songbookToMarkdown(edited, tags)).flatMap(
      (category) => category.songs,
    )
    expect(reparsed.map((song) => song.title)).toEqual(edited.map((song) => song.title))
    expect(reparsed.map((song) => song.melody)).toEqual(edited.map((song) => song.melody))
    expect(reparsed.map((song) => song.author)).toEqual(
      edited.map((song) => song.author || 'Unknown'),
    )
  })

  it('round trips melodies and authors containing asterisks and backslashes', () => {
    const song = (melody: string, author: string, text = 'La la la'): Song => ({
      song_id: `s-${melody}`,
      number: 1,
      title: 'VISA',
      author,
      melody,
      text,
      tags: ['tttt'],
      hidden: false,
    })
    const values: [string, string][] = [
      ['C*D', 'A*B'],
      ['*emphasised*', '*emphasised*'],
      ['**', 'A\\*B\\'],
    ]
    for (const [melody, author] of values) {
      // Both as new lines and replacing a `Mel:` / `Text:` line that is already in the lyrics
      for (const text of ['La la la', '*Mel: Vikingen*\n\nLa la la\n\n*Text: Någon*']) {
        const [reparsed] = roundTrip([song(melody, author, text)])
        expect(reparsed, `${melody} ${text}`).toMatchObject({ melody, author })
        // And again, i.e. exporting what an earlier export + re-import produced
        const [again] = roundTrip([song(melody, author, reparsed.text)])
        expect(again).toEqual(reparsed)
      }
    }
  })

  it('round trips a minimal song', () => {
    const song: Song = {
      song_id: 'aaaa',
      number: 1,
      title: 'A',
      author: '',
      melody: '',
      text: 'B',
      tags: ['tttt'],
      hidden: false,
    }
    expect(roundTrip([song])).toEqual([{ title: 'A', melody: '', author: 'Unknown', text: 'B' }])
  })
})
