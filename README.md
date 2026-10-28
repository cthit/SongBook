# [songbook.chalmers.it](https://songbook.chalmers.it)

The digital songbook of the IT student division at Chalmers, with all the songs you've come to love.

A single Next.js app (same stack as [EatIT](https://github.com/cthit/EatIT): Next.js 16 app router, React 19,
TypeScript, Tailwind CSS 3, pnpm, raw SQL) backed by PostgreSQL, with sign in through
[gamma](https://github.com/cthit/gamma).

## Features

- Browse all songs, fuzzy search over number, title, melody, author and lyrics, filter by tags.
- Every song has its own URL (`/{song_id}`) that opens it on top of the list.
- Admins (users with the `songbook` authority in gamma) add, edit and delete songs, manage tags
  (`/tags`) and can hide songs from everyone else.
- Signed in users suggest new songs or edits (`/suggestions`), admins approve or reject them.
- Export the whole songbook as markdown (`/api/songs/export`, the same format `pnpm db:seed` reads).
- English and Swedish.

## Quick start

Requires Node 24, pnpm and Docker.

```sh
pnpm install
cp .env.example .env.local       # fill in the gamma variables to be able to sign in
docker compose up -d songbook-db # PostgreSQL on localhost:5432
pnpm db:migrate
pnpm db:seed                     # imports data/sangbok.md into the empty database
pnpm dev                         # http://localhost:3000
```

Browsing works without gamma. To sign in locally either point the `GAMMA_*` variables at a gamma
where you have a client, start the local gamma (see [Local gamma](#local-gamma)), or run the mock gamma
used by the tests: `pnpm tsx e2e/mock-gamma/main.ts` (listens on port 8092; set
`GAMMA_URL=http://localhost:8092`, `GAMMA_CLIENT_ID=songbook-client`,
`GAMMA_CLIENT_SECRET=songbook-secret`, `GAMMA_API_KEY_ID=songbook-key`,
`GAMMA_API_KEY_TOKEN=songbook-token`; the user `admin` is an admin, `member` is not).

## Environment variables

| Variable                     | Default                     | Description                                                                                                                                          |
| ---------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                    | `http://localhost:3000`     | Public base URL of the songbook. Cookies are `Secure` when it is `https://`.                                                                         |
| `SESSION_SECRET`             | dev only fallback           | Key for the encrypted session cookie. **Required in production**, at least 32 characters (`openssl rand -base64 48`).                                |
| `SONGBOOK_POSTGRES_HOST`     | `localhost`                 | Same variables as the old Python backend, so the existing database can be used as is.                                                                |
| `SONGBOOK_POSTGRES_PORT`     | `5432`                      |                                                                                                                                                      |
| `SONGBOOK_POSTGRES_USER`     | `songbook`                  |                                                                                                                                                      |
| `SONGBOOK_POSTGRES_PASSWORD` | `password`                  |                                                                                                                                                      |
| `SONGBOOK_POSTGRES_DB`       | `postgres`                  |                                                                                                                                                      |
| `DATABASE_URL`               |                             | Alternative to the variables above, wins if set.                                                                                                     |
| `GAMMA_URL`                  | `https://gamma.chalmers.it` | Public gamma URL, users are redirected here to sign in.                                                                                              |
| `GAMMA_INTERNAL_URL`         | `GAMMA_URL`                 | URL the server uses to talk to gamma (discovery, token, JWKS, client API), e.g. `http://gamma:8081` in docker compose. The issuer is still verified. |
| `GAMMA_CLIENT_ID`            |                             | Client id of the songbook client in gamma.                                                                                                           |
| `GAMMA_CLIENT_SECRET`        |                             | Client secret.                                                                                                                                       |
| `GAMMA_API_KEY_ID`           |                             | Id of the client's API key, used to read the user's authorities.                                                                                     |
| `GAMMA_API_KEY_TOKEN`        |                             | Token of the client's API key.                                                                                                                       |
| `GAMMA_REDIRECT_URI`         | `${APP_URL}/auth/callback`  | Must match the redirect URL of the client in gamma.                                                                                                  |
| `GAMMA_ADMIN_AUTHORITY`      | `songbook`                  | Client authority that makes a user an admin.                                                                                                         |
| `PORT`                       | `3000`                      | HTTP port.                                                                                                                                           |

## Gamma

The songbook signs users in with gamma's OpenID Connect provider (authorization code flow with PKCE,
scopes `openid profile`) and reads which authorities the user has through gamma's client API
(`GET /api/client/v1/authorities/for/{userId}` with `Authorization: pre-shared {id}:{token}`). A user
with the `GAMMA_ADMIN_AUTHORITY` authority is an admin. Authorities are checked again at most every five
minutes, so removing someone in gamma takes effect quickly. Sessions last 12 hours.

Setting up the client in gamma (as a gamma admin):

1. Create an **official client** under _Clients_ with the redirect URL `${APP_URL}/auth/callback`
   (`https://songbook.chalmers.it/auth/callback` in production). The email scope is not needed. Note the
   client id and secret: `GAMMA_CLIENT_ID` / `GAMMA_CLIENT_SECRET`.
2. On the client's page, generate an **API key** for it: `GAMMA_API_KEY_ID` / `GAMMA_API_KEY_TOKEN`.
3. Add a **client authority** named `songbook` and attach the super groups and/or users that may edit
   the songbook (e.g. the culture committee).

The old songbook used gamma's removed v1 login, so nothing from it carries over to gamma. Gamma's Redis
can be cleared at go-live; the songbook's PostgreSQL must not be.

### Local gamma

`docker compose --profile gamma up --build` starts the songbook, its database and gamma 2.5.3 (with its
own PostgreSQL, Redis and a mocked gotify) on http://localhost:8081. Gamma prints the generated admin
password in its log (`docker compose logs gamma`). It runs with mock data (`IS_MOCKING=true`); the mock
users log in with the password `password1337`. Create the client, API key and authority as described
above and put them in a `.env` file next to `docker-compose.yml` (`GAMMA_CLIENT_ID=...` etc.), then
restart the `songbook` service. The songbook talks to gamma over the compose network
(`GAMMA_INTERNAL_URL=http://gamma:8081`) while your browser uses `http://localhost:8081`.

## Database

The schema is the one the old Pony ORM backend created (`song`, `tag`, `songtotag`), so the app runs
directly against the production database.

- Migrations are SQL files in `src/db/migrations`, tracked in `schema_migrations`. They run
  automatically when the app starts (and with `pnpm db:migrate`). `0001_baseline.sql` only contains
  `CREATE ... IF NOT EXISTS` and is a no-op on the existing database; later migrations only add
  (`0002` adds `song.hidden`, `0003` adds the `suggestion` table). Each runs in a transaction, guarded
  by an advisory lock.
- `pnpm db:seed` imports `data/sangbok.md` (categories become tags) but only into an empty `song`
  table. Note that the old importer skipped the last song of every category, which is why production
  has 148 songs while the file (and a freshly seeded database) has 157.
- `pnpm db:reset --yes` deletes all songs, tags and suggestions and seeds again. It refuses to run
  unless `SONGBOOK_ALLOW_RESET=true` is set as well. Nothing ever resets automatically.

## API

The public API keeps the shape of the old backend:

- `GET /api/songs` → `{ data: { songs: { [song_id]: song }, tags: { [tag_id]: tag } }, error: { isError, message } }`
- `GET /api/songs/{id}` → `{ data: { song, tags } }`, `GET /api/tags`, `GET /api/tags/{id}`
- `POST /api/songs`, `PUT|DELETE /api/songs/{id}`, `POST /api/tags`, `PUT|DELETE /api/tags/{id}` (admins)
- `GET /api/songs/export` → `sangbok.md`
- `GET /api/me`, `POST /api/signout`, `/api/suggestions/**`
- `GET /healthcheck` → `OK`

Errors are `{ data: {}, error: { isError: true, message: "CODE" } }` with status 400, 401, 403 or 404.
Hidden songs are only returned to admins.

## Deployment

One image, `ghcr.io/cthit/songbook`, built by GitHub Actions on pushes to `master` and on `v*` tags. It
replaces both `songbook-frontend` and `songbook-backend`; the reverse proxy should send everything to
port 3000 (`/healthcheck` returns `OK`).

1. **Back up the database first** (`pg_dump`).
2. Set the same `SONGBOOK_POSTGRES_*` variables as before, plus `APP_URL`, `SESSION_SECRET` and the
   `GAMMA_*` variables.
3. Start the container. It applies the pending migrations on boot (additive only, nothing is dropped
   or renamed).

## Development

```sh
pnpm lint             # eslint + prettier --check (pnpm format to fix)
pnpm typecheck
pnpm test             # unit tests (vitest)
pnpm test:integration # migrations and data layer against a Pony-shaped PostgreSQL (needs Docker)
pnpm test:e2e         # Playwright, needs Docker
```

The end-to-end tests start PostgreSQL with testcontainers, migrate and seed it, start a mock gamma
(`e2e/mock-gamma`) and run the app with `next build && next start` (`E2E_DEV=true` uses `next dev`).
Run `pnpm exec playwright install chromium` once first.

```
src/app             pages and route handlers (src/app/api/**/route.ts, /auth/*, /healthcheck)
src/components      React components
src/lib             database, auth, gamma, i18n and other helpers
src/db/migrations   SQL migrations
scripts             pnpm db:migrate / db:seed / db:reset
data/sangbok.md     the songbook used for seeding
e2e                 Playwright tests and the mock gamma
tests               unit and integration tests
```

See [CONTRIBUTING.MD](CONTRIBUTING.MD) for how to contribute.
