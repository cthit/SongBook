import { expect, type Page } from '@playwright/test'
import { APP_URL, GAMMA_URL } from './env'

/** Signs in through the (mock) gamma consent page, starting from the current page */
export async function signIn(page: Page, user: 'admin' | 'member') {
  await page.getByRole('link', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Mock gamma sign in' })).toBeVisible()
  // The app fetched discovery through GAMMA_INTERNAL_URL, the browser must still use GAMMA_URL
  expect(new URL(page.url()).origin).toBe(GAMMA_URL)
  await page.getByRole('radio', { name: new RegExp(`^${user} `) }).check()
  await page.getByRole('button', { name: 'Authorize' }).click()
  await page.waitForURL((url) => url.origin === APP_URL && !url.pathname.startsWith('/auth'))
  await expect(page.getByTestId('role-badge')).toHaveText(user === 'admin' ? 'Admin' : 'Member')
}

export function searchBox(page: Page) {
  return page.getByRole('searchbox', { name: 'Search songs' })
}

export function songCard(page: Page, title: string) {
  return page
    .getByTestId('song-card')
    .filter({ has: page.getByRole('heading', { name: new RegExp(`^\\d+\\. ${title}$`) }) })
}

/** Searches for a song on the list page and opens its dialog */
export async function openSong(page: Page, title: string) {
  await searchBox(page).fill(title)
  await songCard(page, title).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: new RegExp(`^\\d+\\. ${title}$`) }),
  ).toBeVisible()
  return dialog
}

/** The song id from a card link */
export async function songIdOf(page: Page, title: string): Promise<string> {
  const href = await songCard(page, title).getAttribute('href')
  return href!.slice(1)
}
