import { forbidden, unauthorized } from 'next/navigation'
import { cache } from 'react'
import { getCurrentUser } from '@/lib/auth'
import type { SessionUser } from '@/lib/session'
import { listSongs } from '@/lib/songs'
import { listTags } from '@/lib/tags'

/** Songs and tags as the current user may see them, deduplicated per request */
export const loadSongbook = cache(async () => {
  const user = await getCurrentUser()
  const visibility = { includeHidden: user?.isAdmin ?? false }
  const [songs, tags] = await Promise.all([listSongs(visibility), listTags(visibility)])
  return { user, songs, tags }
})

/** For pages: renders the 401 page when signed out */
export async function pageUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) unauthorized()
  return user
}

/** For pages: renders the 403 "Insufficient access" page for everyone but admins */
export async function pageAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user?.isAdmin) forbidden()
  return user
}
