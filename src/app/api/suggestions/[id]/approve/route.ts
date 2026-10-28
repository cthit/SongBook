import { jsonData, readJsonObject, withHandler } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { approveSuggestion, parseReviewComment } from '@/lib/suggestions'

type Context = { params: Promise<{ id: string }> }

export const POST = withHandler<Context>('approve suggestion', async (request, context) => {
  const admin = await requireAdmin()
  const { id } = await context.params
  const body = await readJsonObject(request).catch(() => ({}))
  const songId = await approveSuggestion(id, admin, parseReviewComment(body))
  return jsonData({ song_id: songId })
})
