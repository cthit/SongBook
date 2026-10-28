/**
 * Runs the migrations and the data layer against a database shaped like the production one that
 * Pony ORM created: Postgres' default constraint names and foreign keys without ON DELETE CASCADE.
 */
import path from 'path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const PONY_SCHEMA = `
  CREATE TABLE "song" (
    "song_id" TEXT PRIMARY KEY, "number" INTEGER UNIQUE NOT NULL, "title" TEXT UNIQUE NOT NULL,
    "author" TEXT NOT NULL, "melody" TEXT NOT NULL, "text" TEXT NOT NULL
  );
  CREATE TABLE "tag" (
    "tag_id" TEXT PRIMARY KEY, "name" TEXT UNIQUE NOT NULL,
    "pretty_name_sv" TEXT NOT NULL, "pretty_name_en" TEXT NOT NULL
  );
  CREATE TABLE "songtotag" ("song" TEXT NOT NULL, "tag" TEXT NOT NULL, PRIMARY KEY ("song", "tag"));
  CREATE INDEX "idx_songtotag__tag" ON "songtotag" ("tag");
  ALTER TABLE "songtotag" ADD CONSTRAINT "fk_songtotag__song" FOREIGN KEY ("song") REFERENCES "song" ("song_id");
  ALTER TABLE "songtotag" ADD CONSTRAINT "fk_songtotag__tag" FOREIGN KEY ("tag") REFERENCES "tag" ("tag_id");

  INSERT INTO "tag" VALUES ('gmng', 'Allmänt', 'Allmänt', 'Allmänt'), ('wtuu', 'Snaps', 'Snaps', 'Snaps');
  INSERT INTO "song" VALUES
    ('crsi', 137, 'LAMBO', 'Unknown', '', '*Alla:*\n\nFör nu glaset till din mun!'),
    ('xvmp', 15, 'LIVET', 'Unknown', 'Röda kavalleriet', 'Livet är härligt!'),
    ('unwt', 148, 'FREDMANS EPISTEL NR: 21', 'Unknown', '', 'Så lunkar vi så småningom');
  INSERT INTO "songtotag" VALUES ('crsi', 'gmng'), ('xvmp', 'wtuu'), ('unwt', 'gmng');
`

let container: StartedPostgreSqlContainer
let pool: Pool
const migrations = path.join(__dirname, '..', '..', 'src', 'db', 'migrations')

const snapshot = async () => ({
  songs: (
    await pool.query(
      'SELECT "song_id", "number", "title", "author", "melody", "text" FROM "song" ORDER BY 1',
    )
  ).rows,
  tags: (await pool.query('SELECT * FROM "tag" ORDER BY 1')).rows,
  links: (await pool.query('SELECT * FROM "songtotag" ORDER BY 1, 2')).rows,
  constraints: (
    await pool.query(
      `SELECT conname FROM pg_constraint WHERE conrelid IN ('song'::regclass, 'tag'::regclass, 'songtotag'::regclass) ORDER BY 1`,
    )
  ).rows.map((row) => row.conname),
})

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start()
  process.env.DATABASE_URL = container.getConnectionUri()
  process.env.SONGBOOK_MIGRATIONS_DIR = migrations
  pool = new Pool({ connectionString: container.getConnectionUri() })
  await pool.query(PONY_SCHEMA)
})

afterAll(async () => {
  await pool?.end()
  const { getDb } = await import('@/lib/db')
  await (await getDb()).end()
  await container?.stop()
})

describe('against the production (Pony) schema', () => {
  it('migrations only add, and are idempotent', async () => {
    const { runMigrations } = await import('@/lib/migrate')
    const before = await snapshot()
    expect(await runMigrations(pool, migrations, () => {})).toEqual([
      '0001_baseline.sql',
      '0002_hidden.sql',
      '0003_suggestions.sql',
    ])
    expect(await runMigrations(pool, migrations, () => {})).toEqual([])
    const after = await snapshot()
    expect(after.songs).toEqual(before.songs)
    expect(after.tags).toEqual(before.tags)
    expect(after.links).toEqual(before.links)
    // No constraints were added to or removed from the existing tables
    expect(after.constraints).toEqual(before.constraints)
    const hidden = await pool.query('SELECT DISTINCT "hidden" FROM "song"')
    expect(hidden.rows).toEqual([{ hidden: false }])
  })

  it('reads the existing data in the old API shape', async () => {
    const { listSongs, getSong } = await import('@/lib/songs')
    const { listTags } = await import('@/lib/tags')
    const songs = await listSongs({ includeHidden: false })
    expect(songs.map((song) => song.number)).toEqual([15, 137, 148])
    expect(await getSong('crsi', { includeHidden: false })).toMatchObject({
      title: 'LAMBO',
      tags: ['gmng'],
      hidden: false,
    })
    const tags = await listTags({ includeHidden: false })
    expect(tags.find((tag) => tag.tag_id === 'gmng')?.song).toEqual(['crsi', 'unwt'])
  })

  it('creates, updates and deletes songs without relying on ON DELETE CASCADE', async () => {
    const { createSong, updateSong, deleteSong, getSong } = await import('@/lib/songs')
    const songId = await createSong({
      title: 'NY VISA',
      author: '',
      melody: '',
      text: 'Hej',
      tags: ['wtuu'],
    })
    expect(await getSong(songId, { includeHidden: true })).toMatchObject({
      number: 149,
      tags: ['wtuu'],
    })

    await updateSong(songId, {
      title: 'NY VISA',
      author: 'A',
      melody: 'M',
      text: 'Hej då',
      tags: ['gmng'],
      hidden: true,
    })
    expect(await getSong(songId, { includeHidden: false })).toBeNull()
    expect(await getSong(songId, { includeHidden: true })).toMatchObject({
      author: 'A',
      tags: ['gmng'],
      hidden: true,
    })

    await expect(
      createSong({ title: 'LAMBO', author: '', melody: '', text: 'x', tags: [] }),
    ).rejects.toMatchObject({ status: 400, code: 'SONG_TITLE_ALREADY_EXIST' })
    await expect(
      createSong({ title: 'ANNAN', author: '', melody: '', text: 'x', tags: ['zzzz'] }),
    ).rejects.toMatchObject({ code: 'TAG_NOT_EXIST' })

    await deleteSong(songId)
    expect(await getSong(songId, { includeHidden: true })).toBeNull()
    await expect(deleteSong(songId)).rejects.toMatchObject({ status: 404 })
  })

  it('detects unique violations regardless of the constraint name', async () => {
    const { isUniqueViolation } = await import('@/lib/db')
    const error = await pool
      .query(`INSERT INTO "song" VALUES ('abcd', 999, 'LAMBO', '', '', 'x')`)
      .catch((caught: unknown) => caught)
    expect(isUniqueViolation(error, 'title')).toBe(true)
    expect(isUniqueViolation(error, 'number')).toBe(false)
  })

  it('deletes tags together with their song links', async () => {
    const { createTag, deleteTag, getTag } = await import('@/lib/tags')
    const { getSong } = await import('@/lib/songs')
    const tagId = await createTag({
      name: 'Punsch',
      pretty_name_sv: 'Punsch',
      pretty_name_en: 'Punch',
    })
    await pool.query('INSERT INTO "songtotag" VALUES ($1, $2)', ['crsi', tagId])
    await deleteTag(tagId)
    expect(await getTag(tagId, { includeHidden: true })).toBeNull()
    expect((await getSong('crsi', { includeHidden: true }))?.tags).toEqual(['gmng'])
    await expect(
      createTag({ name: 'Snaps', pretty_name_sv: '', pretty_name_en: '' }),
    ).rejects.toMatchObject({
      code: 'TAG_NAME_ALREADY_EXIST',
    })
  })

  it('approves suggestions into songs', async () => {
    const { createSuggestion, approveSuggestion, getSuggestion } = await import('@/lib/suggestions')
    const { getSong } = await import('@/lib/songs')
    const member = {
      sub: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      cid: 'jhalpert',
      nickname: 'Jim',
      name: 'Jim Halpert',
      locale: 'en',
      picture: null,
      isAdmin: false,
      authorities: [],
      issuedAt: Date.now(),
      authoritiesCheckedAt: Date.now(),
    }
    const id = await createSuggestion(member, {
      kind: 'edit',
      song_id: 'xvmp',
      title: 'LIVET',
      author: 'Unknown',
      melody: 'Röda kavalleriet (ny)',
      text: 'Livet är härligt!',
      tags: ['wtuu'],
    })
    await approveSuggestion(id, { ...member, cid: 'kulturchef', isAdmin: true }, 'Tack!')
    expect(await getSong('xvmp', { includeHidden: false })).toMatchObject({
      melody: 'Röda kavalleriet (ny)',
    })
    expect(await getSuggestion(id)).toMatchObject({
      status: 'approved',
      reviewed_by_cid: 'kulturchef',
      review_comment: 'Tack!',
    })
    await expect(approveSuggestion(id, member, null)).rejects.toMatchObject({ status: 409 })
  })
})
