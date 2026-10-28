import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toPublicUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export const GET = withHandler('fetch user', async () => {
  const user = await getCurrentUser()
  return NextResponse.json({
    user: user ? toPublicUser(user) : null,
    isAdmin: user?.isAdmin ?? false,
  })
})
