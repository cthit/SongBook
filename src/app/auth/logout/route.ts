import { NextResponse } from 'next/server'
import { gammaConfig } from '@/lib/gamma'
import { SESSION_COOKIE } from '@/lib/session'

export const dynamic = 'force-dynamic'

export function GET() {
  const response = NextResponse.redirect(new URL('/', gammaConfig().appUrl))
  response.cookies.delete(SESSION_COOKIE)
  return response
}
