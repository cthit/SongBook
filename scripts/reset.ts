// pnpm db:reset --yes - deletes ALL songs, tags and suggestions, then seeds from data/sangbok.md.
// Requires SONGBOOK_ALLOW_RESET=true as well, so it can't be run against production by accident.
import { readFileSync } from 'fs'
import path from 'path'
import { createPool, databaseConfig } from '@/lib/db'
import { runMigrations } from '@/lib/migrate'
import { resetDatabase, seedDatabase } from '@/lib/seed'

async function main() {
  if (process.env.SONGBOOK_ALLOW_RESET !== 'true' || !process.argv.includes('--yes')) {
    console.error(
      'Refusing to reset. This deletes every song, tag and suggestion.\n' +
        'Run with SONGBOOK_ALLOW_RESET=true pnpm db:reset --yes if you really mean it.',
    )
    process.exit(1)
  }
  const config = databaseConfig()
  console.log(
    `Resetting ${config.connectionString ? 'DATABASE_URL' : `${config.host}:${config.port}/${config.database}`}`,
  )
  const pool = createPool()
  try {
    await runMigrations(pool)
    await resetDatabase(pool)
    const result = await seedDatabase(
      pool,
      readFileSync(path.join(process.cwd(), 'data', 'sangbok.md'), 'utf8'),
    )
    console.log(
      result.seeded ? `Reset done, seeded ${result.songs} songs` : `Reset done, ${result.reason}`,
    )
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
