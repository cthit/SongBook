import { readFileSync } from 'fs'
import path from 'path'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { Pool } from 'pg'
import { runMigrations } from '../src/lib/migrate'
import { seedDatabase } from '../src/lib/seed'
import { startMockGamma } from './mock-gamma/server'
import { DATABASE_URL, DB_PORT, GAMMA, GAMMA_PORT } from './env'

export default async function globalSetup() {
  const container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('songbook')
    .withUsername('songbook')
    .withPassword('password')
    .withExposedPorts({ container: 5432, host: DB_PORT })
    .start()

  const pool = new Pool({ connectionString: DATABASE_URL })
  try {
    await runMigrations(pool, path.join(__dirname, '..', 'src', 'db', 'migrations'), () => {})
    const result = await seedDatabase(
      pool,
      readFileSync(path.join(__dirname, '..', 'data', 'sangbok.md'), 'utf8'),
    )
    if (!result.seeded) throw new Error(`Seeding failed: ${result.reason}`)
  } finally {
    await pool.end()
  }

  const gamma = await startMockGamma({ port: GAMMA_PORT, ...GAMMA })

  return async () => {
    await gamma.close()
    await container.stop()
  }
}
