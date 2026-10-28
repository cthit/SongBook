import { jsonData, readJsonObject, withHandler } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { parseReviewComment, rejectSuggestion } from '@/lib/suggestions'

type Context = { params: Promise<{ id: string }> }

export const POST = withHandler<Context>('reject suggestion', async (request, context) => {
  const admin = await requireAdmin()
  const { id } = await context.params
  // The review comment is optional, so is the body
  const body = await readJsonObject(request, { optional: true })
  await rejectSuggestion(id, admin, parseReviewComment(body))
  return jsonData({})
})
