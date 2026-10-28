import { expect, test } from '@playwright/test'
import { openSong, searchBox, signIn, songCard } from './helpers'

test('an admin can sign in, edit and create songs and manage tags', async ({ page }) => {
  await page.goto('/')
  await signIn(page, 'admin')
  await expect(page).toHaveURL('/')

  // Edit the melody of a song
  let dialog = await openSong(page, 'KOMPILATORN')
  await dialog.getByRole('link', { name: 'Edit song' }).click()
  await expect(
    page.getByRole('heading', { name: /^Edit song: Nr\.\d+ KOMPILATORN$/ }),
  ).toBeVisible()
  await page.getByLabel('Melody').fill('Imse vimse spindel')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toHaveText('Successfully edited song')
  dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Melody: Imse vimse spindel')

  // Reopen it from a freshly loaded list
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL('/')
  await page.reload()
  dialog = await openSong(page, 'KOMPILATORN')
  await expect(dialog).toContainText('Melody: Imse vimse spindel')
  await dialog.getByRole('button', { name: 'Close' }).click()

  // Create a new song, it gets the next number
  const { data } = await (await page.request.get('/api/songs')).json()
  const numbers = Object.values<{ number: number }>(data.songs).map((song) => song.number)
  const nextNumber = Math.max(...numbers) + 1
  await page.getByTestId('user-menu').click()
  await page.getByRole('menuitem', { name: 'Add a song' }).click()
  await expect(page.getByRole('heading', { name: 'Add a song' })).toBeVisible()
  await page.getByLabel('Title').fill('E2E TESTVISAN')
  await page.getByLabel('Author').fill('Playwright')
  await page.getByLabel('Lyrics').fill('*Alla:*\n\nTra la la, vi testar allihop!')
  await page.getByRole('button', { name: 'Tags' }).click()
  await page.getByRole('option', { name: 'IT' }).getByRole('checkbox').check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toHaveText('Successfully added song')
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(
    `${nextNumber}. E2E TESTVISAN`,
  )
  // data/sangbok.md has 157 songs (production has 148, see README), so the new one is number 158
  expect(nextNumber).toBe(158)

  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await searchBox(page).fill('E2E TESTVISAN')
  await expect(songCard(page, 'E2E TESTVISAN')).toContainText('Author: Playwright')
  await expect(songCard(page, 'E2E TESTVISAN')).toContainText('IT')

  // Duplicate titles are rejected with a translated message
  await page.goto('/songs/create')
  await page.getByLabel('Title').fill('E2E TESTVISAN')
  await page.getByLabel('Lyrics').fill('Igen')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByText('There already exists a song with this title, try another one'),
  ).toBeVisible()

  // The tag admin page is reachable
  await page.goto('/tags')
  await expect(page.getByRole('heading', { name: 'Manage tags' })).toBeVisible()
  await expect(page.getByTestId('tag-row')).toHaveCount(9)
})
