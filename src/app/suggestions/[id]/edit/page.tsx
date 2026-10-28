import { notFound } from 'next/navigation'
import { SongForm } from '@/components/SongForm'
import { pageUser } from '@/lib/pages'
import { getSuggestion } from '@/lib/suggestions'
import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

// Authors can change their own suggestions while they are pending
export default async function EditSuggestionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser()
  const { id } = await params
  const suggestion = await getSuggestion(id)
  if (!suggestion || suggestion.suggested_by_sub !== user.sub || suggestion.status !== 'pending') {
    notFound()
  }
  const tags = await listTags({ includeHidden: user.isAdmin })
  return (
    <SongForm
      mode={{ kind: 'edit-suggestion', suggestionId: suggestion.id, songId: suggestion.song_id }}
      initial={suggestion}
      tags={tags}
    />
  )
}
