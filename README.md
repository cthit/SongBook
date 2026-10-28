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

| Variable                          | Default                     | Description                                                                                                                                             |
| --------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                         | `http://localhost:3000`     | Public base URL of the songbook. Cookies are `Secure` when it is `https://`.                                                                            |
| `SESSION_SECRET`                  | dev only fallback           | Key for the encrypted session cookie. **Required in production**, at least 32 characters (`openssl rand -base64 48`).                                   |
| `SONGBOOK_POSTGRES_HOST`          | `localhost`                 | Same variables as the old Python backend, so the existing database can be used as is.                                                                   |
| `SONGBOOK_POSTGRES_PORT`          | `5432`                      |                                                                                                                                                         |
| `SONGBOOK_POSTGRES_USER`          | `songbook`                  |                                                                                                                                                         |
| `SONGBOOK_POSTGRES_PASSWORD`      | `password`                  |                                                                                                                                                         |
| `SONGBOOK_POSTGRES_DB`            | `postgres`                  |                                                                                                                                                         |
| `DATABASE_URL`                    |                             | Alternative to the variables above, wins if set.                                                                                                        |
| `GAMMA_URL`                       | `https://gamma.chalmers.it` | Public gamma URL, users are redirected here to sign in.                                                                                                 |
| `GAMMA_INTERNAL_URL`              | `GAMMA_URL`                 | URL the server uses to talk to gamma (discovery, token, JWKS, client API), e.g. `http://gamma:8081` in docker compose. See [Local gamma](#local-gamma). |
| `GAMMA_CLIENT_ID`                 |                             | Client id of the songbook client in gamma.                                                                                                              |
| `GAMMA_CLIENT_SECRET`             |                             | Client secret.                                                                                                                                          |
| `GAMMA_API_KEY_ID`                |                             | Id of the client's API key, used to read the user's authorities.                                                                                        |
| `GAMMA_API_KEY_TOKEN`             |                             | Token of the client's API key.                                                                                                                          |
| `GAMMA_REDIRECT_URI`              | `${APP_URL}/auth/callback`  | Must match the redirect URL of the client in gamma.                                                                                                     |
| `GAMMA_ADMIN_AUTHORITY`           | `songbook`                  | Client authority that makes a user an admin.                                                                                                            |
| `GAMMA_AUTHORITY_REFRESH_SECONDS` | `300`                       | How often authorities are checked again. Can only be shortened (the end-to-end tests use `1`).                                                          |
| `PORT`                            | `3000`                      | HTTP port.                                                                                                                                              |

## Gamma

The songbook signs users in with gamma's OpenID Connect provider (authorization code flow with PKCE,
scopes `openid profile`) and reads which authorities the user has through gamma's client API
(`GET /api/client/v1/authorities/for/{userId}` with `Authorization: pre-shared {id}:{token}`). A user
with the `GAMMA_ADMIN_AUTHORITY` authority is an admin. Authorities are checked again at most every five
minutes, so removing someone in gamma takes effect quickly. Sessions last 12 hours.

Setting up the client in gamma 2.5.3 (as a gamma admin):

1. Open _Clients_ (`/clients`) and choose **Create client** (`/clients/create`, official clients can
   only be created by admins). Fill in the pretty name and descriptions, set the redirect url to
   `${APP_URL}/auth/callback` (`https://songbook.chalmers.it/auth/callback` in production) and tick
   **Generate api key**; the API key can only be created together with the client. The email scope
   is not needed.
2. Gamma now shows the credentials **once** ("They will not be shown again"): the client secret is
   `GAMMA_CLIENT_SECRET` and the api key is `GAMMA_API_KEY_TOKEN`. The header shown below them,
   `Authorization: pre-shared <id>:<token>`, contains the api key id, `GAMMA_API_KEY_ID`. The
   _Client id_ on the client details page is `GAMMA_CLIENT_ID`. If a secret is lost, use **Reset
   client secret** on the client page, or **More details** → **Reset token** for the api key (the
   api key id is also the last part of that page's URL, `/api-keys/<id>`).
3. Under **Create client authority** on the same page, enter the authority name `songbook`, add the
   super groups that may edit the songbook with **Add super group authority** (e.g. the culture
   committee) and/or single users with **Add user authority**, and save.

The old songbook used gamma's removed v1 login, so nothing from it carries over to gamma. Gamma's Redis
can be cleared at go-live; the songbook's PostgreSQL must not be.

### Local gamma

`docker compose --profile gamma up --build` starts the songbook, its database and gamma 2.5.3 (with its
own PostgreSQL, Redis and a mocked gotify) on http://localhost:8081. Gamma prints the generated admin
password in its log (`docker compose logs gamma`). It runs with mock data (`IS_MOCKING=true`); the mock
users log in with the password `password1337`. Create the client, API key and authority as described
above with the redirect url `http://localhost:3000/auth/callback`, then create a `.env` file next to
`docker-compose.yml` and restart the `songbook` service (`docker compose --profile gamma up -d`):

```sh
GAMMA_URL=http://localhost:8081           # what your browser uses
GAMMA_INTERNAL_URL=http://gamma:8081      # what the songbook container uses
GAMMA_CLIENT_ID=...
GAMMA_CLIENT_SECRET=...
GAMMA_API_KEY_ID=...
GAMMA_API_KEY_TOKEN=...
```

Gamma 2.5.3 has no fixed issuer: it derives the issuer and all URLs in its discovery document from the
`Host` of the request. The songbook fetches discovery, tokens, keys and authorities through
`GAMMA_INTERNAL_URL`, so the ID token's issuer is `http://gamma:8081`, which is what it is verified
against. Only the sign in redirect (and the "View account" link) go to `GAMMA_URL`.

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
