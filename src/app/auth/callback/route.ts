import { NextResponse, type NextRequest } from 'next/server'
import { isAdminFromAuthorities } from '@/lib/auth'
import { discover, exchangeCode, fetchAuthorities, gammaConfig, verifyIdToken } from '@/lib/gamma'
import {
  LOGIN_COOKIE,
  SESSION_COOKIE,
  SESSION_LIFETIME_S,
  cookieOptions,
  decodeLoginState,
  encodeSession,
  sessionKey,
  type SessionUser,
} from '@/lib/session'

export const dynamic = 'force-dynamic'

function failure(message: string, status = 400) {
  const html = `<!doctype html><meta charset="utf-8"><title>Sign in failed</title>
<body style="font-family:sans-serif;max-width:32rem;margin:4rem auto">
<h1>Sign in failed</h1><p>${message}</p><p><a href="/auth/login">Try again</a> or <a href="/">go back to the songbook</a>.</p></body>`
  const response = new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
  response.cookies.delete(LOGIN_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  const config = gammaConfig()
  const params = request.nextUrl.searchParams
  const key = sessionKey()
  const login = await decodeLoginState(request.cookies.get(LOGIN_COOKIE)?.value, key)

  if (params.get('error')) {
    // e.g. the user denied the consent screen
    return NextResponse.redirect(new URL(login?.returnTo ?? '/', config.appUrl))
  }
  const code = params.get('code')
  if (!login || !code || params.get('state') !== login.state) {
    return failure('The sign in request expired or was tampered with.')
  }

  let user: SessionUser
  try {
    const discovery = await discover(config)
    const tokens = await exchangeCode(config, discovery, code, login.codeVerifier)
    const claims = await verifyIdToken(config, discovery, tokens.id_token, login.nonce)
    const authorities = await fetchAuthorities(config, claims.sub)
    const now = Date.now()
    user = {
      sub: claims.sub,
      cid: claims.cid,
      nickname: claims.nickname ?? claims.cid,
      name: claims.name ?? claims.cid,
      locale: claims.locale === 'sv' ? 'sv' : 'en',
      picture: claims.picture ?? null,
      isAdmin: isAdminFromAuthorities(authorities, config.adminAuthority),
      authorities,
      issuedAt: now,
      authoritiesCheckedAt: now,
    }
  } catch (error) {
    console.error('Gamma sign in failed:', error)
    return failure('Could not complete the sign in with gamma.', 502)
  }

  const response = NextResponse.redirect(new URL(login.returnTo, config.appUrl))
  response.cookies.delete(LOGIN_COOKIE)
  response.cookies.set(
    SESSION_COOKIE,
    await encodeSession(user, key),
    cookieOptions(SESSION_LIFETIME_S),
  )
  return response
}
