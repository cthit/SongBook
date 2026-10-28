import { notFound } from 'next/navigation'
import { SongForm } from '@/components/SongForm'
import { pageAdmin } from '@/lib/pages'
import { getSong } from '@/lib/songs'
import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export default async function EditSongPage({ params }: { params: Promise<{ songId: string }> }) {
  await pageAdmin()
  const { songId } = await params
  const [song, tags] = await Promise.all([
    getSong(songId, { includeHidden: true }),
    listTags({ includeHidden: true }),
  ])
  if (!song) notFound()
  return (
    <SongForm
      mode={{ kind: 'edit', songId: song.song_id, number: song.number, title: song.title }}
      initial={song}
      tags={tags}
    />
  )
}
