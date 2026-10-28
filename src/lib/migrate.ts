import { promises as fs } from 'fs'
import path from 'path'
import type { Pool } from 'pg'

// Arbitrary constant so concurrent app instances never run migrations at the same time
const MIGRATION_LOCK_KEY = 4_242_017

const MIGRATION_FILE = /^(\d{4})_[\w-]+\.sql$/

export function migrationsDir(): string {
  return (
    process.env.SONGBOOK_MIGRATIONS_DIR ??
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'src', 'db', 'migrations')
  )
}

export async function listMigrations(dir = migrationsDir()): Promise<string[]> {
  // Migrations are bundled via outputFileTracingIncludes in next.config.js
  const files = await fs.readdir(/*turbopackIgnore: true*/ dir)
  return files.filter((file) => MIGRATION_FILE.test(file)).sort()
}

/**
 * Applies all migrations in `dir` that are not yet recorded in `schema_migrations`.
 * Each migration runs in its own transaction. Returns the names of the applied migrations.
 */
export async function runMigrations(
  pool: Pool,
  dir = migrationsDir(),
  log: (message: string) => void = console.log,
): Promise<string[]> {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY])
    await client.query(`
      CREATE TABLE IF NOT EXISTS "schema_migrations" (
        "version" TEXT PRIMARY KEY,
        "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const { rows } = await client.query<{ version: string }>(
      'SELECT "version" FROM "schema_migrations"',
    )
    const applied = new Set(rows.map((row) => row.version))
    const pending = (await listMigrations(dir)).filter((file) => !applied.has(file))

    for (const file of pending) {
      const sql = await fs.readFile(path.join(/*turbopackIgnore: true*/ dir, file), 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO "schema_migrations" ("version") VALUES ($1)', [file])
        await client.query('COMMIT')
        log(`Applied migration ${file}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error })
      }
    }

    return pending
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {})
    client.release()
  }
}
