import { jsonData, readJsonObject, withHandler } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { parseReviewComment, rejectSuggestion } from '@/lib/suggestions'

type Context = { params: Promise<{ id: string }> }

export const POST = withHandler<Context>('reject suggestion', async (request, context) => {
  const admin = await requireAdmin()
  const { id } = await context.params
  const body = await readJsonObject(request).catch(() => ({}))
  await rejectSuggestion(id, admin, parseReviewComment(body))
  return jsonData({})
})
