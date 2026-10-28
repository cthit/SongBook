import { jsonData, withHandler } from '@/lib/api'
import { SESSION_COOKIE } from '@/lib/session'

export const POST = withHandler('sign out', async () => {
  const response = jsonData({})
  response.cookies.delete(SESSION_COOKIE)
  return response
})
