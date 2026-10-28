import { SuggestionsView } from '@/components/SuggestionsView'
import { pageUser } from '@/lib/pages'
import { listSongs } from '@/lib/songs'
import { listPendingSuggestions, listSuggestionsBy } from '@/lib/suggestions'
import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export default async function SuggestionsPage() {
  const user = await pageUser()
  const visibility = { includeHidden: user.isAdmin }
  const [mine, pending, songs, tags] = await Promise.all([
    listSuggestionsBy(user.sub),
    user.isAdmin ? listPendingSuggestions() : Promise.resolve([]),
    listSongs(visibility),
    listTags(visibility),
  ])
  // Only the songs that suggestions refer to are needed for the diffs
  const referenced = new Set([...mine, ...pending].map((suggestion) => suggestion.song_id))
  return (
    <SuggestionsView
      mine={mine}
      pending={pending}
      songs={songs.filter((song) => referenced.has(song.song_id))}
      tags={tags}
      isAdmin={user.isAdmin}
    />
  )
}
