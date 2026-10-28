import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from 'pg'
import { runMigrations } from '@/lib/migrate'

/**
 * Connection settings. `DATABASE_URL` wins if set, otherwise the same
 * `SONGBOOK_POSTGRES_*` variables as the old Python backend are used.
 */
export function databaseConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  if (env.DATABASE_URL) {
    return { connectionString: env.DATABASE_URL }
  }
  return {
    host: env.SONGBOOK_POSTGRES_HOST ?? 'localhost',
    port: Number(env.SONGBOOK_POSTGRES_PORT ?? 5432),
    user: env.SONGBOOK_POSTGRES_USER ?? 'songbook',
    password: env.SONGBOOK_POSTGRES_PASSWORD ?? 'password',
    database: env.SONGBOOK_POSTGRES_DB ?? 'postgres',
  }
}

export function createPool(env: NodeJS.ProcessEnv = process.env): Pool {
  return new Pool({ ...databaseConfig(env), max: 10 })
}

// Kept on globalThis so all route bundles and dev reloads share one pool
const globalForDb = globalThis as typeof globalThis & { songbookDb?: Promise<Pool> }

export function getDb(): Promise<Pool> {
  if (!globalForDb.songbookDb) {
    globalForDb.songbookDb = initDb().catch((error: unknown) => {
      // Let the next request retry instead of caching the failure forever
      globalForDb.songbookDb = undefined
      throw error
    })
  }
  return globalForDb.songbookDb
}

async function initDb(): Promise<Pool> {
  const pool = createPool()
  pool.on('error', (error) => console.error('Unexpected Postgres error:', error))
  try {
    await runMigrations(pool)
  } catch (error) {
    await pool.end().catch(() => {})
    throw error
  }
  return pool
}

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb()
  const result = await db.query<T>(sql, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export type Queryable = Pick<PoolClient, 'query'>

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const db = await getDb()
  return transaction(db, fn)
}

export async function transaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** Postgres unique_violation, optionally for a specific constraint */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pgError = error as { code?: string; constraint?: string }
  return pgError?.code === '23505' && (!constraint || pgError.constraint === constraint)
}
