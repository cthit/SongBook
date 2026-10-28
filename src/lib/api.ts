import { NextResponse, type NextRequest } from 'next/server'

/** Error with an HTTP status and a machine readable code, e.g. `SONG_TITLE_ALREADY_EXIST` */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

export interface ApiEnvelope<T> {
  data: T
  error: { isError: boolean; message: string }
}

/** Same envelope as the old Flask backend: `{ data, error: { isError, message } }` */
export const jsonData = <T>(data: T, status = 200) =>
  NextResponse.json<ApiEnvelope<T>>({ data, error: { isError: false, message: '' } }, { status })

export const jsonError = (message: string, status: number) =>
  NextResponse.json<ApiEnvelope<Record<string, never>>>(
    { data: {}, error: { isError: true, message } },
    { status },
  )

const isSafeMethod = (method: string) => method === 'GET' || method === 'HEAD'

/**
 * CSRF protection for mutating requests. SameSite=Lax stops other sites, but not other
 * *.chalmers.it origins, so browsers' Origin / Sec-Fetch-Site headers must point at us.
 * Requests without them (curl and friends) carry no browser cookies, so they are let through.
 */
export function assertSameOrigin(request: NextRequest, appUrl = process.env.APP_URL) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new ApiError(403, 'CROSS_ORIGIN_REQUEST')
  }
  const origin = request.headers.get('origin')
  if (!origin) return
  const allowed = new Set([request.nextUrl.origin])
  if (appUrl) allowed.add(new URL(appUrl).origin)
  if (!allowed.has(origin)) throw new ApiError(403, 'CROSS_ORIGIN_REQUEST')
}

export function withHandler<Context = unknown>(
  label: string,
  handler: (request: NextRequest, context: Context) => Promise<Response>,
) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    try {
      if (!isSafeMethod(request.method)) assertSameOrigin(request)
      return await handler(request, context)
    } catch (error) {
      if (error instanceof ApiError) {
        return jsonError(error.code, error.status)
      }
      console.error(`Error in ${label}:`, error)
      return jsonError(`Failed to ${label}`, 500)
    }
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  // Forces a CORS preflight for cross-origin browser requests
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'EXPECTED_JSON')
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError(400, 'INVALID_JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_JSON')
  }
  return body as Record<string, unknown>
}

const MAX_SHORT_TEXT = 200
const MAX_LONG_TEXT = 50_000

/** Required, non-empty (after trimming) string */
export function requiredString(body: Record<string, unknown>, key: string, max = MAX_SHORT_TEXT) {
  const value = body[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, `${key.toUpperCase()}_REQUIRED`)
  }
  if (value.length > max) throw new ApiError(400, `${key.toUpperCase()}_TOO_LONG`)
  return value.trim()
}

/** Optional string, missing means '' */
export function optionalString(body: Record<string, unknown>, key: string, max = MAX_SHORT_TEXT) {
  const value = body[key] ?? ''
  if (typeof value !== 'string') throw new ApiError(400, `${key.toUpperCase()}_NOT_STRING`)
  if (value.length > max) throw new ApiError(400, `${key.toUpperCase()}_TOO_LONG`)
  return value.trim()
}

export function optionalBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const value = body[key]
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new ApiError(400, `${key.toUpperCase()}_NOT_BOOLEAN`)
  return value
}

export const LIMITS = { MAX_SHORT_TEXT, MAX_LONG_TEXT }
