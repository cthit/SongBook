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
})
