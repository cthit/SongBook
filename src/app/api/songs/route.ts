import { jsonData, readJsonObject, withHandler } from '@/lib/api'
import { getCurrentUser, requireAdmin } from '@/lib/auth'
import { createSong, listSongs, parseSongInput } from '@/lib/songs'
import { listTags, tagsById } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export const GET = withHandler('fetch songs', async () => {
  const user = await getCurrentUser()
  const visibility = { includeHidden: user?.isAdmin ?? false }
  const [songs, tags] = await Promise.all([listSongs(visibility), listTags(visibility)])
  return jsonData({
    songs: Object.fromEntries(songs.map((song) => [song.song_id, song])),
    tags: tagsById(tags),
  })
})

export const POST = withHandler('create song', async (request) => {
  await requireAdmin()
  const input = parseSongInput(await readJsonObject(request))
  const songId = await createSong(input)
  return jsonData({ song_id: songId })
})
