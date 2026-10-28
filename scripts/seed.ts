// pnpm db:seed [path] - fills an empty database with the songs from data/sangbok.md
import { readFileSync } from 'fs'
import path from 'path'
import { createPool } from '@/lib/db'
import { runMigrations } from '@/lib/migrate'
import { seedDatabase } from '@/lib/seed'

async function main() {
  const file = process.argv[2] ?? path.join(process.cwd(), 'data', 'sangbok.md')
  const pool = createPool()
  try {
    await runMigrations(pool)
    const result = await seedDatabase(pool, readFileSync(file, 'utf8'))
    if (result.seeded) {
      console.log(`Seeded ${result.songs} songs and ${result.tags} tags from ${file}`)
    } else {
      console.log(`Not seeding: ${result.reason}. Nothing was changed.`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
