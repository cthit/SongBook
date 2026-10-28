// Runs the database migrations when the server boots. Failures are logged, not fatal, so
// /healthcheck keeps working and the next request retries (see getDb).
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.SONGBOOK_SKIP_BOOT_MIGRATIONS === 'true'
  ) {
    return
  }
  const { getDb } = await import('@/lib/db')
  getDb().catch((error: unknown) => console.error('Could not migrate the database on boot:', error))
}
