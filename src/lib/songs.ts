import type { PoolClient } from 'pg'
import { ApiError, LIMITS, optionalBoolean, optionalString, requiredString } from '@/lib/api'
import { isUniqueViolation, query, queryOne, withTransaction, type Queryable } from '@/lib/db'
import { generateShortId, isShortId, shortIdError } from '@/lib/ids'
import type { Song, SongInput } from '@/lib/types'

interface SongRow {
  song_id: string
  title: string
  number: number
  melody: string
  author: string
  text: string
  hidden: boolean
  tags: string[]
}

const SELECT_SONGS = `
  SELECT s."song_id", s."title", s."number", s."melody", s."author", s."text", s."hidden",
         COALESCE(array_agg(st."tag" ORDER BY st."tag") FILTER (WHERE st."tag" IS NOT NULL), '{}') AS "tags"
  FROM "song" s
  LEFT JOIN "songtotag" st ON st."song" = s."song_id"
`

const toSong = (row: SongRow): Song => ({
  song_id: row.song_id,
  title: row.title,
  number: row.number,
  melody: row.melody,
  author: row.author,
  text: row.text,
  tags: row.tags,
  hidden: row.hidden,
})

export interface Visibility {
  /** Admins also see hidden songs */
  includeHidden: boolean
}

export async function listSongs({ includeHidden }: Visibility): Promise<Song[]> {
  const rows = await query<SongRow>(
    `${SELECT_SONGS} WHERE ($1 OR NOT s."hidden") GROUP BY s."song_id" ORDER BY s."number"`,
    [includeHidden],
  )
  return rows.map(toSong)
}

export async function getSong(songId: string, { includeHidden }: Visibility): Promise<Song | null> {
  if (!isShortId(songId)) return null
  const row = await queryOne<SongRow>(
    `${SELECT_SONGS} WHERE s."song_id" = $1 AND ($2 OR NOT s."hidden") GROUP BY s."song_id"`,
    [songId, includeHidden],
  )
  return row ? toSong(row) : null
}

/** Validates a request body for creating/updating a song */
export function parseSongInput(body: Record<string, unknown>): SongInput {
  const tags = body.tags ?? []
  if (!Array.isArray(tags)) throw new ApiError(400, 'TAGS_NOT_LIST')
  for (const tag of tags) {
    if (typeof tag !== 'string') throw new ApiError(400, 'TAG_NOT_EXIST')
    const error = shortIdError(tag)
    if (error) throw new ApiError(400, error)
  }
  return {
    title: requiredString(body, 'title'),
    author: optionalString(body, 'author'),
    melody: optionalString(body, 'melody'),
    text: requiredString(body, 'text', LIMITS.MAX_LONG_TEXT),
    tags: [...new Set(tags as string[])],
    hidden: optionalBoolean(body, 'hidden'),
  }
}

async function assertTagsExist(client: Queryable, tags: string[]): Promise<void> {
  if (tags.length === 0) return
  const { rows } = await client.query<{ tag_id: string }>(
    'SELECT "tag_id" FROM "tag" WHERE "tag_id" = ANY($1::text[])',
    [tags],
  )
  if (rows.length !== tags.length) throw new ApiError(400, 'TAG_NOT_EXIST')
}

async function assertTitleFree(client: Queryable, title: string, exceptSongId?: string) {
  const { rows } = await client.query(
    'SELECT 1 FROM "song" WHERE "title" = $1 AND "song_id" IS DISTINCT FROM $2',
    [title, exceptSongId ?? null],
  )
  if (rows.length > 0) throw new ApiError(400, 'SONG_TITLE_ALREADY_EXIST')
}

async function syncTags(client: Queryable, songId: string, tags: string[]): Promise<void> {
  await client.query(
    'DELETE FROM "songtotag" WHERE "song" = $1 AND NOT ("tag" = ANY($2::text[]))',
    [songId, tags],
  )
  await client.query(
    `INSERT INTO "songtotag" ("song", "tag")
     SELECT $1, unnest($2::text[])
     ON CONFLICT DO NOTHING`,
    [songId, tags],
  )
}

/** Picks a random 4 letter id that is not used in `table` yet */
export async function freeShortId(client: Queryable, table: 'song' | 'tag'): Promise<string> {
  const column = table === 'song' ? 'song_id' : 'tag_id'
  for (let attempt = 0; attempt < 50; attempt++) {
    const id = generateShortId()
    const { rows } = await client.query(`SELECT 1 FROM "${table}" WHERE "${column}" = $1`, [id])
    if (rows.length === 0) return id
  }
  throw new ApiError(503, 'NO_FREE_ID')
}

/** Inserts a song using an open transaction, number is assigned as max + 1 */
export async function insertSong(client: PoolClient, input: SongInput): Promise<string> {
  // Serialise song creation so two concurrent creates can't pick the same number
  await client.query('LOCK TABLE "song" IN SHARE ROW EXCLUSIVE MODE')
  await assertTitleFree(client, input.title)
  await assertTagsExist(client, input.tags)
  const songId = await freeShortId(client, 'song')
  await client.query(
    `INSERT INTO "song" ("song_id", "number", "title", "author", "melody", "text", "hidden")
     VALUES ($1, (SELECT COALESCE(MAX("number"), 0) + 1 FROM "song"), $2, $3, $4, $5, $6)`,
    [songId, input.title, input.author, input.melody, input.text, input.hidden ?? false],
  )
  await syncTags(client, songId, input.tags)
  return songId
}

export async function createSong(input: SongInput): Promise<string> {
  try {
    return await withTransaction((client) => insertSong(client, input))
  } catch (error) {
    if (isUniqueViolation(error, 'unq_song__title')) {
      throw new ApiError(400, 'SONG_TITLE_ALREADY_EXIST')
    }
    throw error
  }
}

export async function updateSongInTransaction(
  client: PoolClient,
  songId: string,
  input: SongInput,
): Promise<void> {
  const { rows } = await client.query<{ hidden: boolean }>(
    'SELECT "hidden" FROM "song" WHERE "song_id" = $1 FOR UPDATE',
    [songId],
  )
  if (rows.length === 0) throw new ApiError(404, 'SONG_ID_NOT_EXIST')
  await assertTitleFree(client, input.title, songId)
  await assertTagsExist(client, input.tags)
  await client.query(
    `UPDATE "song" SET "title" = $2, "author" = $3, "melody" = $4, "text" = $5, "hidden" = $6
     WHERE "song_id" = $1`,
    [songId, input.title, input.author, input.melody, input.text, input.hidden ?? rows[0].hidden],
  )
  await syncTags(client, songId, input.tags)
}

export async function updateSong(songId: string, input: SongInput): Promise<void> {
  try {
    await withTransaction((client) => updateSongInTransaction(client, songId, input))
  } catch (error) {
    if (isUniqueViolation(error, 'unq_song__title')) {
      throw new ApiError(400, 'SONG_TITLE_ALREADY_EXIST')
    }
    throw error
  }
}

export async function deleteSong(songId: string): Promise<void> {
  await withTransaction(async (client) => {
    // Don't rely on ON DELETE CASCADE, the Pony schema may not have it
    await client.query('DELETE FROM "songtotag" WHERE "song" = $1', [songId])
    const result = await client.query('DELETE FROM "song" WHERE "song_id" = $1', [songId])
    if (result.rowCount === 0) throw new ApiError(404, 'SONG_ID_NOT_EXIST')
  })
}
