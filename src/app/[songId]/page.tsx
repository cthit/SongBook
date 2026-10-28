import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SongBrowser } from '@/components/SongBrowser'
import { loadSongbook } from '@/lib/pages'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ songId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { songId } = await params
  const { songs } = await loadSongbook()
  const song = songs.find((candidate) => candidate.song_id === songId)
  return { title: song ? `${song.number}. ${song.title} - Songbook` : 'Songbook' }
}

// Deep link to a song: the list with the song dialog opened on top
export default async function SongPage({ params }: Props) {
  const { songId } = await params
  const { songs, tags } = await loadSongbook()
  if (!songs.some((song) => song.song_id === songId)) notFound()
  return <SongBrowser songs={songs} tags={tags} />
}
