import type { Pool } from 'pg'
import { transaction } from '@/lib/db'
import { generateShortId } from '@/lib/ids'

export interface ParsedSong {
  title: string
  melody: string
  author: string
  text: string
}

export interface ParsedCategory {
  name: string
  songs: ParsedSong[]
}

const CATEGORY_HEADING = /[^\n]+\n=+/g
const CATEGORY_SPLIT = /\n=+\n/
const SONG_HEADING = /[^\n]+\n-+\n/g
const SONG_SPLIT = /\n-+\n/
const MELODY = /\n\*?[mM][eE][lL]:([^\n*]+)/
const AUTHOR = /\n\*?[tT][eE][xX][tT]: ([^\n*]+)/

const startsOf = (input: string, pattern: RegExp) =>
  [...input.matchAll(pattern)].map((match) => match.index)

function sliceAt<T>(input: string, starts: number[], map: (part: string) => T): T[] {
  return starts.map((start, i) => map(input.slice(start, starts[i + 1])))
}

function splitOnce(input: string, separator: RegExp): [string, string] | null {
  const match = separator.exec(input)
  if (!match) return null
  return [input.slice(0, match.index), input.slice(match.index + match[0].length)]
}

/** Parses one song chunk: `TITLE\n-----\n...` */
export function parseSong(chunk: string): ParsedSong | null {
  const parts = splitOnce(chunk, SONG_SPLIT)
  if (!parts) return null
  const [title, rest] = parts
  // `rest` starts with the newline of the empty line after the heading, which the regexes rely on
  const body = `\n${rest}`
  return {
    title: title.trim(),
    melody: MELODY.exec(body)?.[1].trim() ?? '',
    author: AUTHOR.exec(body)?.[1].trim() || 'Unknown',
    text: rest.trim(),
  }
}

/**
 * TypeScript port of the old `backend/src/setup/md/md_to_db.py`: categories (`Title\n===`) become
 * tags and songs (`Title\n---`) become songs, melody from `Mel:` and author from `Text:` lines.
 *
 * Unlike the Python version this keeps the last song of every category; the old parser dropped it
 * by accident, which is why production has 148 songs while the file contains 157.
 */
export function parseSongbookMarkdown(markdown: string): ParsedCategory[] {
  const md = markdown.replace(/\r\n/g, '\n')
  const categories = sliceAt(md, startsOf(md, CATEGORY_HEADING), (part) =>
    splitOnce(part, CATEGORY_SPLIT),
  )

  const result: ParsedCategory[] = []
  for (const category of categories) {
    if (!category) continue
    const [name, data] = category
    if (name.trim() === '') continue
    const songs = sliceAt(data, startsOf(data, SONG_HEADING), parseSong).filter(
      (song): song is ParsedSong => song !== null && song.title !== '' && song.text !== '',
    )
    result.push({ name: name.trim(), songs })
  }
  return result
}

export type SeedResult =
  { seeded: false; reason: string } | { seeded: true; tags: number; songs: number }

/** Inserts the songbook, but only into an empty `song` table */
export async function seedDatabase(pool: Pool, markdown: string): Promise<SeedResult> {
  const categories = parseSongbookMarkdown(markdown)
  return transaction(pool, async (client) => {
    await client.query('LOCK TABLE "song" IN SHARE ROW EXCLUSIVE MODE')
    const { rows } = await client.query<{ count: string }>('SELECT COUNT(*) AS "count" FROM "song"')
    if (Number(rows[0].count) > 0) {
      return { seeded: false, reason: `the song table already contains ${rows[0].count} songs` }
    }

    const usedSongIds = new Set<string>()
    const freshId = (used: Set<string>) => {
      let id = generateShortId()
      while (used.has(id)) id = generateShortId()
      used.add(id)
      return id
    }

    const { rows: existingTags } = await client.query<{ tag_id: string; name: string }>(
      'SELECT "tag_id", "name" FROM "tag"',
    )
    const usedTagIds = new Set(existingTags.map((tag) => tag.tag_id))
    const tagIdByName = new Map(existingTags.map((tag) => [tag.name, tag.tag_id]))

    let number = 0
    let tagCount = 0
    for (const category of categories) {
      let tagId = tagIdByName.get(category.name)
      if (!tagId) {
        tagId = freshId(usedTagIds)
        await client.query(
          'INSERT INTO "tag" ("tag_id", "name", "pretty_name_sv", "pretty_name_en") VALUES ($1, $2, $2, $2)',
          [tagId, category.name],
        )
        tagIdByName.set(category.name, tagId)
        tagCount++
      }
      for (const song of category.songs) {
        const songId = freshId(usedSongIds)
        number++
        await client.query(
          `INSERT INTO "song" ("song_id", "number", "title", "author", "melody", "text")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [songId, number, song.title, song.author, song.melody, song.text],
        )
        await client.query('INSERT INTO "songtotag" ("song", "tag") VALUES ($1, $2)', [
          songId,
          tagId,
        ])
      }
    }
    return { seeded: true, tags: tagCount, songs: number }
  })
}

/** Deletes all songbook data. Only used by `pnpm db:reset`, which requires explicit opt-in. */
export async function resetDatabase(pool: Pool): Promise<void> {
  await transaction(pool, async (client) => {
    await client.query('DELETE FROM "songtotag"')
    await client.query('DELETE FROM "song"')
    await client.query('DELETE FROM "tag"')
    await client.query('DELETE FROM "suggestion"')
  })
}
