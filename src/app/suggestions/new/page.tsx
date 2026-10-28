import { notFound } from 'next/navigation'
import { SongForm } from '@/components/SongForm'
import { pageUser } from '@/lib/pages'
import { getSong } from '@/lib/songs'
import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

// Issues #8 and #9: any signed in user can suggest a new song, or an edit with ?song={song_id}
export default async function NewSuggestionPage({
  searchParams,
}: {
  searchParams: Promise<{ song?: string }>
}) {
  const user = await pageUser()
  const { song: songId } = await searchParams
  const visibility = { includeHidden: user.isAdmin }
  const tags = await listTags(visibility)

  if (!songId) return <SongForm mode={{ kind: 'suggest-new' }} tags={tags} />

  const song = await getSong(songId, visibility)
  if (!song) notFound()
  return (
    <SongForm
      mode={{ kind: 'suggest-edit', songId: song.song_id, number: song.number, title: song.title }}
      initial={{ ...song, hidden: undefined }}
      tags={tags}
    />
  )
}
