import { jsonData, readJsonObject, withHandler } from '@/lib/api'
import { getCurrentUser, requireAdmin } from '@/lib/auth'
import { createTag, listTags, parseTagInput, tagsById } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export const GET = withHandler('fetch tags', async () => {
  const user = await getCurrentUser()
  const tags = await listTags({ includeHidden: user?.isAdmin ?? false })
  return jsonData({ tags: tagsById(tags) })
})

export const POST = withHandler('create tag', async (request) => {
  await requireAdmin()
  const tagId = await createTag(parseTagInput(await readJsonObject(request)))
  return jsonData({ tag_id: tagId })
})
