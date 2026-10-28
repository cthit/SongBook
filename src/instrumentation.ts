// Runs the database migrations when the production server boots. Failures are logged, not fatal,
// so /healthcheck keeps working and the next request retries (see getDb). In development the
// migrations run on the first request instead: importing the database from here makes Turbopack's
// dev server reload the page in a loop.
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.SONGBOOK_SKIP_BOOT_MIGRATIONS === 'true'
  ) {
    return
  }
  const { getDb } = await import('@/lib/db')
  getDb().catch((error: unknown) => console.error('Could not migrate the database on boot:', error))
}
