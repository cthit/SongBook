import { TagsManager } from '@/components/TagsManager'
import { pageAdmin } from '@/lib/pages'
import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

// Issue #13: create, rename and delete tags
export default async function TagsPage() {
  await pageAdmin()
  const tags = await listTags({ includeHidden: true })
  return <TagsManager tags={tags} />
}
