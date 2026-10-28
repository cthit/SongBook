import { withHandler } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { songbookToMarkdown } from '@/lib/export'
import { listSongs } from '@/lib/songs'
import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

// Issue #21: the whole songbook as markdown, in the same format `pnpm db:seed` reads
export const GET = withHandler('export songs', async () => {
  const user = await getCurrentUser()
  const visibility = { includeHidden: user?.isAdmin ?? false }
  const [songs, tags] = await Promise.all([listSongs(visibility), listTags(visibility)])
  return new Response(songbookToMarkdown(songs, tags), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sangbok.md"',
      'Cache-Control': 'no-store',
    },
  })
})
