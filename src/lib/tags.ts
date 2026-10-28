import { ApiError, requiredString } from '@/lib/api'
import { isUniqueViolation, query, queryOne, withTransaction } from '@/lib/db'
import { isShortId } from '@/lib/ids'
import { freeShortId, type Visibility } from '@/lib/songs'
import type { Tag, TagInput } from '@/lib/types'

const SELECT_TAGS = `
  SELECT t."tag_id", t."name", t."pretty_name_sv", t."pretty_name_en",
         COALESCE(array_agg(s."song_id" ORDER BY s."number") FILTER (WHERE s."song_id" IS NOT NULL), '{}') AS "song"
  FROM "tag" t
  LEFT JOIN "songtotag" st ON st."tag" = t."tag_id"
  LEFT JOIN "song" s ON s."song_id" = st."song" AND ($1 OR NOT s."hidden")
`

export async function listTags({ includeHidden }: Visibility): Promise<Tag[]> {
  return query<Tag>(`${SELECT_TAGS} GROUP BY t."tag_id" ORDER BY t."name"`, [includeHidden])
}

export async function getTag(tagId: string, { includeHidden }: Visibility): Promise<Tag | null> {
  if (!isShortId(tagId)) return null
  return queryOne<Tag>(`${SELECT_TAGS} WHERE t."tag_id" = $2 GROUP BY t."tag_id"`, [
    includeHidden,
    tagId,
  ])
}

export function parseTagInput(body: Record<string, unknown>): TagInput {
  const name = requiredString(body, 'name', 100)
  // Pretty names default to the name, like the seed data
  const prettySv = typeof body.pretty_name_sv === 'string' ? body.pretty_name_sv.trim() : ''
  const prettyEn = typeof body.pretty_name_en === 'string' ? body.pretty_name_en.trim() : ''
  if (prettySv.length > 100 || prettyEn.length > 100) throw new ApiError(400, 'NAME_TOO_LONG')
  return { name, pretty_name_sv: prettySv || name, pretty_name_en: prettyEn || name }
}

export async function createTag(input: TagInput): Promise<string> {
  try {
    return await withTransaction(async (client) => {
      const existing = await client.query('SELECT 1 FROM "tag" WHERE "name" = $1', [input.name])
      if (existing.rows.length > 0) throw new ApiError(400, 'TAG_NAME_ALREADY_EXIST')
      const tagId = await freeShortId(client, 'tag')
      await client.query(
        'INSERT INTO "tag" ("tag_id", "name", "pretty_name_sv", "pretty_name_en") VALUES ($1, $2, $3, $4)',
        [tagId, input.name, input.pretty_name_sv, input.pretty_name_en],
      )
      return tagId
    })
  } catch (error) {
    if (isUniqueViolation(error, 'unq_tag__name')) throw new ApiError(400, 'TAG_NAME_ALREADY_EXIST')
    throw error
  }
}

export async function updateTag(tagId: string, input: TagInput): Promise<void> {
  try {
    await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT 1 FROM "tag" WHERE "name" = $1 AND "tag_id" <> $2',
        [input.name, tagId],
      )
      if (existing.rows.length > 0) throw new ApiError(400, 'TAG_NAME_ALREADY_EXIST')
      const result = await client.query(
        'UPDATE "tag" SET "name" = $2, "pretty_name_sv" = $3, "pretty_name_en" = $4 WHERE "tag_id" = $1',
        [tagId, input.name, input.pretty_name_sv, input.pretty_name_en],
      )
      if (result.rowCount === 0) throw new ApiError(404, 'TAG_NOT_EXIST')
    })
  } catch (error) {
    if (isUniqueViolation(error, 'unq_tag__name')) throw new ApiError(400, 'TAG_NAME_ALREADY_EXIST')
    throw error
  }
}

export async function deleteTag(tagId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM "songtotag" WHERE "tag" = $1', [tagId])
    const result = await client.query('DELETE FROM "tag" WHERE "tag_id" = $1', [tagId])
    if (result.rowCount === 0) throw new ApiError(404, 'TAG_NOT_EXIST')
  })
}

/** Keyed by tag id, the shape the old API used */
export function tagsById(tags: Tag[]): Record<string, Tag> {
  return Object.fromEntries(tags.map((tag) => [tag.tag_id, tag]))
}
