import { expect, test, type Page } from '@playwright/test'

// Runs the songbook against the real gamma 2.5.3 from `docker compose --profile gamma up`, after
// `pnpm gamma:setup`: REAL_GAMMA=1 pnpm test:e2e:gamma (playwright.gamma.config.ts, not run in CI).
// Gamma's default mock data (app/src/main/resources/mock/mock.json in gamma) puts amartin in the
// super group digit, which `pnpm gamma:setup` gives the songbook authority; mscott is in no group.
test.skip(process.env.REAL_GAMMA !== '1', 'Set REAL_GAMMA=1 to run against a local gamma')

const GAMMA_URL = (process.env.GAMMA_URL ?? 'http://localhost:8081').replace(/\/+$/, '')
const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const ADMIN = process.env.REAL_GAMMA_ADMIN_CID ?? 'amartin'
const MEMBER = process.env.REAL_GAMMA_MEMBER_CID ?? 'mscott'
const PASSWORD = process.env.REAL_GAMMA_PASSWORD ?? 'password1337'

interface Song {
  song_id: string
  number: number
  title: string
  author: string
  melody: string
  text: string
  tags: string[]
  hidden: boolean
}

/** The body of PUT /api/songs/:id that leaves the song as it is */
const songInput = ({ title, author, melody, text, tags, hidden }: Song) => ({
  title,
  author,
  melody,
  text,
  tags,
  hidden,
})

/** Signs in with gamma's login form and consent screen, starting from the current page */
async function signIn(page: Page, cid: string) {
  await page.getByRole('link', { name: 'Sign in' }).click()
  // Gamma sends the browser from /oauth2/authorize to its login page
  await page.waitForURL(`${GAMMA_URL}/login**`)
  await page.fill('input[name="username"]', cid)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button:has-text("Login")')

  // The consent screen is only shown the first time a user signs in to the client
  const authorize = page.getByRole('button', { name: 'Authorize' })
  const backInApp = (url: URL) => url.origin === APP_URL && !url.pathname.startsWith('/auth')
  await expect
    .poll(async () => backInApp(new URL(page.url())) || (await authorize.isVisible()), {
      timeout: 60_000,
    })
    .toBe(true)
  if (!backInApp(new URL(page.url()))) await authorize.click()
  await page.waitForURL(backInApp, { timeout: 60_000 })
}

async function me(page: Page) {
  return (await page.request.get('/api/me')).json()
}

async function firstSong(page: Page): Promise<Song> {
  const { data } = await (await page.request.get('/api/songs')).json()
  const songs = Object.values<Song>(data.songs).sort((a, b) => a.number - b.number)
  expect(songs.length, 'the songbook has no songs, run `pnpm db:seed`').toBeGreaterThan(0)
  const { data: one } = await (await page.request.get(`/api/songs/${songs[0].song_id}`)).json()
  return one.song
}

test('/auth/login redirects to the authorize endpoint on the public gamma URL', async ({
  request,
}) => {
  const response = await request.get('/auth/login', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  const location = new URL(response.headers().location)
  expect(`${location.origin}${location.pathname}`).toBe(`${GAMMA_URL}/oauth2/authorize`)
  expect(location.searchParams.get('redirect_uri')).toBe(`${APP_URL}/auth/callback`)
  expect(location.searchParams.get('code_challenge_method')).toBe('S256')
})

test(`${ADMIN}, who has the authority through digit, is an admin and can edit songs`, async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page, ADMIN)
  await expect(page.getByTestId('role-badge')).toHaveText('Admin')
  const { user, isAdmin } = await me(page)
  expect(user.cid).toBe(ADMIN)
  expect(isAdmin).toBe(true)
  // The picture claim comes from gamma's BASE_URL, which is the public URL
  expect(user.picture).toMatch(new RegExp(`^${GAMMA_URL}/images/user/avatar/`))

  const song = await firstSong(page)
  const melody = `Real gamma e2e ${Date.now()}`
  try {
    await page.goto(`/songs/edit/${song.song_id}`)
    await expect(page.getByRole('heading', { name: /^Edit song: / })).toBeVisible()
    await page.getByLabel('Melody').fill(melody)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toHaveText('Successfully edited song')
    await expect(page.getByRole('dialog')).toContainText(`Melody: ${melody}`)
    const { data } = await (await page.request.get(`/api/songs/${song.song_id}`)).json()
    expect(data.song.melody).toBe(melody)
  } finally {
    // Put the song back, the test runs against the development database
    const restored = await page.request.put(`/api/songs/${song.song_id}`, {
      data: songInput(song),
    })
    expect(restored.status()).toBe(200)
  }
})

test(`${MEMBER}, who has no authority, is a member and cannot edit songs`, async ({ page }) => {
  await page.goto('/')
  await signIn(page, MEMBER)
  await expect(page.getByTestId('role-badge')).toHaveText('Member')
  const { user, isAdmin } = await me(page)
  expect(user.cid).toBe(MEMBER)
  expect(isAdmin).toBe(false)

  const song = await firstSong(page)
  await page.goto(`/songs/edit/${song.song_id}`)
  await expect(page.getByRole('heading', { name: '403 - Insufficient access' })).toBeVisible()
  const response = await page.request.put(`/api/songs/${song.song_id}`, {
    data: { ...songInput(song), melody: 'Not allowed' },
  })
  expect(response.status()).toBe(403)
})
