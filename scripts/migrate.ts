// pnpm db:migrate - applies pending migrations from src/db/migrations
import { createPool } from '@/lib/db'
import { runMigrations } from '@/lib/migrate'

async function main() {
  const pool = createPool()
  try {
    const applied = await runMigrations(pool)
    console.log(
      applied.length ? `Applied ${applied.length} migration(s)` : 'Database is up to date',
    )
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
