import { SongBrowser } from '@/components/SongBrowser'
import { loadSongbook } from '@/lib/pages'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { songs, tags } = await loadSongbook()
  return <SongBrowser songs={songs} tags={tags} />
}
