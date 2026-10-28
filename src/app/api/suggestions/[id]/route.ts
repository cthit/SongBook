import { jsonData, readJsonObject, withHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  deleteSuggestion,
  getVisibleSuggestion,
  parseSuggestionInput,
  updateSuggestion,
} from '@/lib/suggestions'

type Context = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export const GET = withHandler<Context>('fetch suggestion', async (_request, context) => {
  const user = await requireUser()
  const { id } = await context.params
  return jsonData({ suggestion: await getVisibleSuggestion(id, user) })
})

export const PUT = withHandler<Context>('update suggestion', async (request, context) => {
  const user = await requireUser()
  const { id } = await context.params
  await updateSuggestion(id, user, parseSuggestionInput(await readJsonObject(request)))
  return jsonData({})
})

export const DELETE = withHandler<Context>('delete suggestion', async (_request, context) => {
  const user = await requireUser()
  const { id } = await context.params
  await deleteSuggestion(id, user)
  return jsonData({})
})
