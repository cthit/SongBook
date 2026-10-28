import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { AUTHORITY_REFRESH_MS, GAMMA_URL } from './env'
import { signIn, songIdOf } from './helpers'

/** Changes a user's authorities in the mock gamma, like an admin editing the client authority */
async function setAuthorities(request: APIRequestContext, cid: string, authorities: string[]) {
  const form = new URLSearchParams({ cid })
  for (const authority of authorities) form.append('authority', authority)
  const response = await request.post(`${GAMMA_URL}/__test/authorities`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
  })
  expect(response.ok()).toBe(true)
}

/** Waits until the app has to ask gamma again */
const waitForRefresh = (page: Page) => page.waitForTimeout(AUTHORITY_REFRESH_MS + 500)

test('signing in from the 401 page returns to that page', async ({ page }) => {
  await page.goto('/suggestions/new')
  await expect(page.getByTestId('error-401')).toBeVisible()
  await page.getByTestId('error-sign-in').click()
  await expect(page.getByRole('heading', { name: 'Mock gamma sign in' })).toBeVisible()
  expect(new URL(page.url()).origin).toBe(GAMMA_URL)
  await page.getByRole('radio', { name: /^member / }).check()
  await page.getByRole('button', { name: 'Authorize' }).click()
  await page.waitForURL((url) => url.pathname === '/suggestions/new')
  await expect(page.getByTestId('role-badge')).toHaveText('Member')
  await expect(page.getByTestId('error-401')).toHaveCount(0)
})

test('removing the songbook authority in gamma revokes admin after the refresh interval', async ({
  page,
  request,
}) => {
  await page.goto('/')
  await signIn(page, 'admin')
  const songId = await songIdOf(page, 'LAMBO')
  const { data } = await (await page.request.get(`/api/songs/${songId}`)).json()
  // Saving the song unchanged, so a failing assertion can't leave an edited song behind
  const unchanged = {
    title: data.song.title,
    author: data.song.author,
    melody: data.song.melody,
    text: data.song.text,
    tags: data.song.tags,
  }

  try {
    await setAuthorities(request, 'kulturchef', [])
    await waitForRefresh(page)

    // Mutations ask gamma again and are refused
    const response = await page.request.put(`/api/songs/${songId}`, { data: unchanged })
    expect(response.status()).toBe(403)
    expect((await response.json()).error.message).toBe('INSUFFICIENT_ACCESS')

    // Pages show the user as a member
    await page.goto(`/songs/edit/${songId}`)
    await expect(page.getByRole('heading', { name: '403 - Insufficient access' })).toBeVisible()
    await expect(page.getByTestId('role-badge')).toHaveText('Member')
  } finally {
    await setAuthorities(request, 'kulturchef', ['songbook'])
  }

  // Adding the authority again makes the same session an admin again
  await waitForRefresh(page)
  expect((await page.request.put(`/api/songs/${songId}`, { data: unchanged })).status()).toBe(200)
  await page.goto('/')
  await expect(page.getByTestId('role-badge')).toHaveText('Admin')
})
