import { SongForm } from '@/components/SongForm'
import { pageAdmin } from '@/lib/pages'
import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export default async function CreateSongPage() {
  await pageAdmin()
  const tags = await listTags({ includeHidden: true })
  return <SongForm mode={{ kind: 'create' }} tags={tags} />
}
