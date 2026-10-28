import { jsonData, readJsonObject, withHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  createSuggestion,
  listPendingSuggestions,
  listSuggestionsBy,
  parseSuggestionInput,
} from '@/lib/suggestions'

export const dynamic = 'force-dynamic'

// Own suggestions, or every pending one for admins with ?status=pending
export const GET = withHandler('fetch suggestions', async (request) => {
  const user = await requireUser()
  const pending = request.nextUrl.searchParams.get('status') === 'pending'
  const suggestions =
    pending && user.isAdmin ? await listPendingSuggestions() : await listSuggestionsBy(user.sub)
  return jsonData({ suggestions })
})

export const POST = withHandler('create suggestion', async (request) => {
  const user = await requireUser()
  const id = await createSuggestion(user, parseSuggestionInput(await readJsonObject(request)))
  return jsonData({ id })
})
