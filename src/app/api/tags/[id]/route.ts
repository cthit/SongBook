import { ApiError, jsonData, readJsonObject, withHandler } from '@/lib/api'
import { getCurrentUser, requireAdmin } from '@/lib/auth'
import { shortIdError } from '@/lib/ids'
import { deleteTag, getTag, parseTagInput, updateTag } from '@/lib/tags'

type Context = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

async function validId(context: Context): Promise<string> {
  const { id } = await context.params
  const error = shortIdError(id)
  if (error) throw new ApiError(400, error)
  return id
}

export const GET = withHandler<Context>('fetch tag', async (_request, context) => {
  const id = await validId(context)
  const user = await getCurrentUser()
  const tag = await getTag(id, { includeHidden: user?.isAdmin ?? false })
  if (!tag) throw new ApiError(404, 'TAG_NOT_EXIST')
  return jsonData({ tag })
})

export const PUT = withHandler<Context>('update tag', async (request, context) => {
  await requireAdmin()
  const id = await validId(context)
  await updateTag(id, parseTagInput(await readJsonObject(request)))
  return jsonData({})
})

export const DELETE = withHandler<Context>('delete tag', async (_request, context) => {
  await requireAdmin()
  const id = await validId(context)
  await deleteTag(id)
  return jsonData({})
})
