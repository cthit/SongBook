import { createHash, randomBytes } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { buildAuthorizeUrl, discover, gammaConfig } from '@/lib/gamma'
import {
  LOGIN_COOKIE,
  LOGIN_LIFETIME_S,
  cookieOptions,
  encodeLoginState,
  safeReturnTo,
  sessionKey,
} from '@/lib/session'

export const dynamic = 'force-dynamic'

const random = () => randomBytes(32).toString('base64url')

export async function GET(request: NextRequest) {
  const config = gammaConfig()
  let discovery
  try {
    discovery = await discover(config)
  } catch (error) {
    console.error('Gamma discovery failed:', error)
    return new Response('Could not reach gamma, try again later.', { status: 502 })
  }

  const state = random()
  const nonce = random()
  const codeVerifier = random()
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'))

  const response = NextResponse.redirect(
    buildAuthorizeUrl(config, discovery, { state, nonce, codeChallenge }),
  )
  response.cookies.set(
    LOGIN_COOKIE,
    await encodeLoginState({ state, nonce, codeVerifier, returnTo }, sessionKey()),
    cookieOptions(LOGIN_LIFETIME_S),
  )
  return response
}
