import { randomUUID } from 'crypto'
import type { PoolClient } from 'pg'
import { ApiError, optionalString } from '@/lib/api'
import { isUniqueViolation, query, queryOne, withTransaction } from '@/lib/db'
import { isShortId, isUuid } from '@/lib/ids'
import type { SessionUser } from '@/lib/session'
import { getSong, insertSong, parseSongInput, updateSongInTransaction } from '@/lib/songs'
import type { SongInput, Suggestion, SuggestionKind } from '@/lib/types'

const COLUMNS = `"id", "kind", "song_id", "title", "author", "melody", "text", "tags",
  "suggested_by_sub", "suggested_by_cid", "suggested_by_name", "status",
  "created_at", "reviewed_at", "reviewed_by_cid", "review_comment"`

interface SuggestionRow extends Omit<Suggestion, 'created_at' | 'reviewed_at'> {
  created_at: Date
  reviewed_at: Date | null
}

const toSuggestion = (row: SuggestionRow): Suggestion => ({
  ...row,
  created_at: row.created_at.toISOString(),
  reviewed_at: row.reviewed_at ? row.reviewed_at.toISOString() : null,
})

export interface SuggestionInput extends SongInput {
  kind: SuggestionKind
  song_id: string | null
}

export function parseSuggestionInput(body: Record<string, unknown>): SuggestionInput {
  const song = parseSongInput(body)
  const kind = body.kind ?? (body.song_id ? 'edit' : 'new')
  if (kind !== 'new' && kind !== 'edit') throw new ApiError(400, 'INVALID_KIND')
  const songId = kind === 'edit' ? body.song_id : null
  if (kind === 'edit' && !isShortId(songId)) throw new ApiError(400, 'SONG_ID_NOT_EXIST')
  return { ...song, hidden: undefined, kind, song_id: (songId as string | null) ?? null }
}

export async function createSuggestion(user: SessionUser, input: SuggestionInput): Promise<string> {
  if (input.kind === 'edit') {
    const song = await getSong(input.song_id ?? '', { includeHidden: user.isAdmin })
    if (!song) throw new ApiError(404, 'SONG_ID_NOT_EXIST')
  }
  const id = randomUUID()
  await query(
    `INSERT INTO "suggestion" ("id", "kind", "song_id", "title", "author", "melody", "text", "tags",
       "suggested_by_sub", "suggested_by_cid", "suggested_by_name")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
    [
      id,
      input.kind,
      input.song_id,
      input.title,
      input.author,
      input.melody,
      input.text,
      JSON.stringify(input.tags),
      user.sub,
      user.cid,
      user.nickname || user.name || user.cid,
    ],
  )
  return id
}

export async function getSuggestion(id: string): Promise<Suggestion | null> {
  if (!isUuid(id)) return null
  const row = await queryOne<SuggestionRow>(`SELECT ${COLUMNS} FROM "suggestion" WHERE "id" = $1`, [
    id,
  ])
  return row ? toSuggestion(row) : null
}

export async function listSuggestionsBy(sub: string): Promise<Suggestion[]> {
  const rows = await query<SuggestionRow>(
    `SELECT ${COLUMNS} FROM "suggestion" WHERE "suggested_by_sub" = $1 ORDER BY "created_at" DESC`,
    [sub],
  )
  return rows.map(toSuggestion)
}

export async function listPendingSuggestions(): Promise<Suggestion[]> {
  const rows = await query<SuggestionRow>(
    `SELECT ${COLUMNS} FROM "suggestion" WHERE "status" = 'pending' ORDER BY "created_at" ASC`,
  )
  return rows.map(toSuggestion)
}

export async function countPendingSuggestions(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS "count" FROM "suggestion" WHERE "status" = 'pending'`,
  )
  return Number(row?.count ?? 0)
}

/** The suggestion if `user` may see it: their own, or any for admins */
export async function getVisibleSuggestion(id: string, user: SessionUser): Promise<Suggestion> {
  const suggestion = await getSuggestion(id)
  if (!suggestion || (!user.isAdmin && suggestion.suggested_by_sub !== user.sub)) {
    throw new ApiError(404, 'SUGGESTION_NOT_EXIST')
  }
  return suggestion
}

async function lockPending(client: PoolClient, id: string): Promise<SuggestionRow> {
  const { rows } = await client.query<SuggestionRow>(
    `SELECT ${COLUMNS} FROM "suggestion" WHERE "id" = $1 FOR UPDATE`,
    [id],
  )
  const row = rows[0]
  if (!row) throw new ApiError(404, 'SUGGESTION_NOT_EXIST')
  if (row.status !== 'pending') throw new ApiError(409, 'SUGGESTION_NOT_PENDING')
  return row
}

/** The author can change their suggestion while it is pending */
export async function updateSuggestion(
  id: string,
  user: SessionUser,
  input: SuggestionInput,
): Promise<void> {
  if (!isUuid(id)) throw new ApiError(404, 'SUGGESTION_NOT_EXIST')
  await withTransaction(async (client) => {
    const row = await lockPending(client, id)
    if (row.suggested_by_sub !== user.sub) throw new ApiError(404, 'SUGGESTION_NOT_EXIST')
    await client.query(
      `UPDATE "suggestion" SET "title" = $2, "author" = $3, "melody" = $4, "text" = $5, "tags" = $6::jsonb
       WHERE "id" = $1`,
      [id, input.title, input.author, input.melody, input.text, JSON.stringify(input.tags)],
    )
  })
}

/** Authors can withdraw pending suggestions, admins can delete any */
export async function deleteSuggestion(id: string, user: SessionUser): Promise<void> {
  if (!isUuid(id)) throw new ApiError(404, 'SUGGESTION_NOT_EXIST')
  await withTransaction(async (client) => {
    const { rows } = await client.query<SuggestionRow>(
      `SELECT ${COLUMNS} FROM "suggestion" WHERE "id" = $1 FOR UPDATE`,
      [id],
    )
    const row = rows[0]
    if (!row || (!user.isAdmin && row.suggested_by_sub !== user.sub)) {
      throw new ApiError(404, 'SUGGESTION_NOT_EXIST')
    }
    if (!user.isAdmin && row.status !== 'pending') throw new ApiError(409, 'SUGGESTION_NOT_PENDING')
    await client.query('DELETE FROM "suggestion" WHERE "id" = $1', [id])
  })
}

export function parseReviewComment(body: Record<string, unknown>): string | null {
  return optionalString(body, 'comment', 2000) || null
}

/** Applies the suggestion to the songbook. Returns the id of the created/updated song. */
export async function approveSuggestion(
  id: string,
  reviewer: SessionUser,
  comment: string | null,
): Promise<string> {
  if (!isUuid(id)) throw new ApiError(404, 'SUGGESTION_NOT_EXIST')
  try {
    return await withTransaction(async (client) => {
      const row = await lockPending(client, id)
      // Tags may have been deleted since the suggestion was made, ignore those
      const { rows: tagRows } = await client.query<{ tag_id: string }>(
        'SELECT "tag_id" FROM "tag" WHERE "tag_id" = ANY($1::text[])',
        [row.tags],
      )
      const input: SongInput = {
        title: row.title,
        author: row.author,
        melody: row.melody,
        text: row.text,
        tags: tagRows.map((tag) => tag.tag_id),
      }
      let songId: string
      if (row.kind === 'new') {
        songId = await insertSong(client, input)
      } else {
        songId = row.song_id ?? ''
        await updateSongInTransaction(client, songId, input)
      }
      await client.query(
        `UPDATE "suggestion" SET "status" = 'approved', "reviewed_at" = now(), "reviewed_by_cid" = $2,
           "review_comment" = $3, "song_id" = $4
         WHERE "id" = $1`,
        [id, reviewer.cid, comment, songId],
      )
      return songId
    })
  } catch (error) {
    if (isUniqueViolation(error, 'title')) {
      throw new ApiError(400, 'SONG_TITLE_ALREADY_EXIST')
    }
    throw error
  }
}

export async function rejectSuggestion(
  id: string,
  reviewer: SessionUser,
  comment: string | null,
): Promise<void> {
  if (!isUuid(id)) throw new ApiError(404, 'SUGGESTION_NOT_EXIST')
  await withTransaction(async (client) => {
    await lockPending(client, id)
    await client.query(
      `UPDATE "suggestion" SET "status" = 'rejected', "reviewed_at" = now(), "reviewed_by_cid" = $2,
         "review_comment" = $3
       WHERE "id" = $1`,
      [id, reviewer.cid, comment],
    )
  })
}
