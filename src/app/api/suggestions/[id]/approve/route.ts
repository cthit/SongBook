import { jsonData, readJsonObject, withHandler } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { approveSuggestion, parseReviewComment } from '@/lib/suggestions'

type Context = { params: Promise<{ id: string }> }

export const POST = withHandler<Context>('approve suggestion', async (request, context) => {
  const admin = await requireAdmin()
  const { id } = await context.params
  // The review comment is optional, so is the body
  const body = await readJsonObject(request, { optional: true })
  const songId = await approveSuggestion(id, admin, parseReviewComment(body))
  return jsonData({ song_id: songId })
})
