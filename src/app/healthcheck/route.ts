// Used by the reverse proxy, must not depend on the database
export const dynamic = 'force-dynamic'

export function GET() {
  return new Response('OK', { headers: { 'Content-Type': 'text/plain' } })
}
