import { ApiError, jsonData, readJsonObject, withHandler } from '@/lib/api'
import { getCurrentUser, requireAdmin } from '@/lib/auth'
import { shortIdError } from '@/lib/ids'
import { deleteSong, getSong, parseSongInput, updateSong } from '@/lib/songs'
import { listTags, tagsById } from '@/lib/tags'

type Context = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

async function validId(context: Context): Promise<string> {
  const { id } = await context.params
  const error = shortIdError(id)
  if (error) throw new ApiError(400, error)
  return id
}

export const GET = withHandler<Context>('fetch song', async (_request, context) => {
  const id = await validId(context)
  const user = await getCurrentUser()
  const visibility = { includeHidden: user?.isAdmin ?? false }
  const song = await getSong(id, visibility)
  if (!song) throw new ApiError(404, 'SONG_ID_NOT_EXIST')
  const tags = (await listTags(visibility)).filter((tag) => song.tags.includes(tag.tag_id))
  return jsonData({ song, tags: tagsById(tags) })
})

export const PUT = withHandler<Context>('update song', async (request, context) => {
  await requireAdmin()
  const id = await validId(context)
  await updateSong(id, parseSongInput(await readJsonObject(request)))
  return jsonData({})
})

export const DELETE = withHandler<Context>('delete song', async (_request, context) => {
  await requireAdmin()
  const id = await validId(context)
  await deleteSong(id)
  return jsonData({})
})
