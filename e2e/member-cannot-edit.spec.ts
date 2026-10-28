import { expect, test } from '@playwright/test'
import { openSong, searchBox, signIn, songCard, songIdOf } from './helpers'

const edit = {
  title: 'SKÅL FÖR IT',
  author: 'P.R.I.T. -04',
  melody: 'Vikingen',
  text: 'Ändrad text',
  tags: [],
}

test('visitors and members can read and suggest, but not edit', async ({ page }) => {
  await page.goto('/')

  // Fuzzy search
  await searchBox(page).fill('Lambo')
  await expect(songCard(page, 'LAMBO')).toBeVisible()
  await expect(songCard(page, 'SKÅL FÖR IT')).toHaveCount(0)
  await expect(page.getByTestId('song-card')).toHaveCount(1)

  // Nothing matches
  await searchBox(page).fill('xyzzyqwerty')
  await expect(page.getByTestId('no-songs')).toBeVisible()
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await expect(searchBox(page)).toHaveValue('')

  // Tag filter
  await page.getByRole('button', { name: 'Filter by tags' }).click()
  await page.getByRole('option', { name: 'Snaps' }).getByRole('checkbox').check()
  await page.keyboard.press('Escape')
  const cards = page.getByTestId('song-card')
  await expect(cards).toHaveCount(58)
  for (const card of await cards.all()) await expect(card).toContainText('Snaps')
  await expect(songCard(page, 'SKÅL FÖR IT')).toHaveCount(0)
  await page.getByRole('button', { name: 'Filter by tags' }).click()
  await page.getByRole('option', { name: 'Snaps' }).getByRole('checkbox').uncheck()
  await page.keyboard.press('Escape')

  // Signed out: no edit button, the 403 page and 401 from the API
  let dialog = await openSong(page, 'SKÅL FÖR IT')
  await expect(dialog).toContainText('Melody: Vikingen')
  await expect(dialog.getByRole('link', { name: 'Edit song' })).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: 'Suggest an edit' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click()
  const songId = await songIdOf(page, 'SKÅL FÖR IT')

  await page.goto(`/${songId}`)
  await expect(page.getByRole('dialog')).toContainText('SKÅL FÖR IT')

  await page.goto(`/songs/edit/${songId}`)
  await expect(page.getByRole('heading', { name: '403 - Insufficient access' })).toBeVisible()
  expect((await page.request.put(`/api/songs/${songId}`, { data: edit })).status()).toBe(401)
  expect((await page.request.post('/api/songs', { data: { ...edit, title: 'NY' } })).status()).toBe(
    401,
  )
  expect((await page.request.delete(`/api/songs/${songId}`)).status()).toBe(401)

  // Signed in without the songbook authority
  await page.goto('/')
  await signIn(page, 'member')
  dialog = await openSong(page, 'SKÅL FÖR IT')
  await expect(dialog.getByRole('link', { name: 'Edit song' })).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: 'Suggest an edit' })).toBeVisible()

  await page.goto('/songs/create')
  await expect(page.getByRole('heading', { name: '403 - Insufficient access' })).toBeVisible()
  await page.goto('/tags')
  await expect(page.getByRole('heading', { name: '403 - Insufficient access' })).toBeVisible()
  expect((await page.request.put(`/api/songs/${songId}`, { data: edit })).status()).toBe(403)
  // Requests from other (even same-site) origins are rejected before anything else
  const crossOrigin = await page.request.post('/api/suggestions', {
    data: { ...edit, kind: 'new', title: 'CSRF' },
    headers: { Origin: 'https://evil.chalmers.it' },
  })
  expect(crossOrigin.status()).toBe(403)
  expect((await crossOrigin.json()).error.message).toBe('CROSS_ORIGIN_REQUEST')
  expect((await page.request.delete('/api/tags/abcd')).status()).toBe(403)
  const unchanged = await (await page.request.get(`/api/songs/${songId}`)).json()
  expect(unchanged.data.song.text).not.toBe('Ändrad text')

  // Suggest an edit instead
  await page.goto('/')
  dialog = await openSong(page, 'SKÅL FÖR IT')
  await dialog.getByRole('link', { name: 'Suggest an edit' }).click()
  await expect(
    page.getByRole('heading', { name: /^Suggest an edit: Nr\.1 SKÅL FÖR IT$/ }),
  ).toBeVisible()
  await expect(page.getByLabel('Melody')).toHaveValue('Vikingen')
  await page.getByLabel('Melody').fill('Vikingen (Kalle Moraeus)')
  await page.getByRole('button', { name: 'Send suggestion' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'Thanks! Your suggestion was sent to the admins',
  )
  await expect(page).toHaveURL('/suggestions')
  const mine = page.getByTestId('my-suggestion')
  await expect(mine).toHaveCount(1)
  await expect(mine).toContainText('Edit of 1. SKÅL FÖR IT')
  await expect(mine).toContainText('Pending')

  // Members can't review suggestions
  const suggestions = await (await page.request.get('/api/suggestions')).json()
  const id = suggestions.data.suggestions[0].id
  expect((await page.request.post(`/api/suggestions/${id}/approve`)).status()).toBe(403)
})
