import { expect, test } from '@playwright/test'
import { openSong, searchBox, signIn, songCard, songIdOf } from './helpers'

test('hidden songs are only visible to admins', async ({ browser }) => {
  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  await admin.goto('/')
  await signIn(admin, 'admin')

  const dialog = await openSong(admin, 'HALLONSAFT')
  await dialog.getByRole('link', { name: 'Edit song' }).click()
  await admin.getByRole('checkbox', { name: /Hidden/ }).check()
  await admin.getByRole('button', { name: 'Save' }).click()
  await expect(admin.getByRole('status')).toHaveText('Successfully edited song')
  await expect(admin.getByRole('dialog')).toContainText('Hidden')
  await admin.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await searchBox(admin).fill('HALLONSAFT')
  await expect(songCard(admin, 'HALLONSAFT')).toContainText('Hidden')
  const songId = await songIdOf(admin, 'HALLONSAFT')

  const exportedForAdmin = await (await admin.request.get('/api/songs/export')).text()
  expect(exportedForAdmin).toContain('HALLONSAFT')

  // Visitors don't see it anywhere
  const visitorContext = await browser.newContext()
  const visitor = await visitorContext.newPage()
  await visitor.goto('/')
  await searchBox(visitor).fill('HALLONSAFT')
  await expect(visitor.getByTestId('no-songs')).toBeVisible()
  const response = await visitor.goto(`/${songId}`)
  expect(response?.status()).toBe(404)
  await expect(visitor.getByRole('heading', { name: '404 - Page not found' })).toBeVisible()
  expect((await visitor.request.get(`/api/songs/${songId}`)).status()).toBe(404)
  const all = await (await visitor.request.get('/api/songs')).json()
  expect(all.data.songs[songId]).toBeUndefined()
  const exported = await visitor.request.get('/api/songs/export')
  expect(exported.headers()['content-type']).toContain('text/markdown')
  expect(exported.headers()['content-disposition']).toContain('sangbok.md')
  expect(await exported.text()).not.toContain('HALLONSAFT')

  await visitorContext.close()
  await adminContext.close()
})
