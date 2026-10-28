/*
 * Creates the songbook client in the local gamma from `docker compose --profile gamma up` and writes
 * its credentials to .env.local (for `pnpm dev`) and .env (for the compose `songbook` service).
 * See README.md, "Local gamma".
 *
 *   pnpm gamma:setup            # does nothing if the credentials in .env.local still work
 *   pnpm gamma:setup --force    # always creates a new client
 *
 * Gamma only shows a client's secret and API key once, so every run that does something creates a
 * new client (named "SongBook local"); clients from earlier runs are left in gamma.
 *
 * Environment: GAMMA_URL (http://localhost:8081), APP_URL (http://localhost:3000),
 * GAMMA_ADMIN_CID and GAMMA_ADMIN_PASSWORD (read from `docker compose logs gamma` if unset),
 * GAMMA_ADMIN_AUTHORITY (songbook), GAMMA_SETUP_SUPER_GROUP (digit, the super group that gets the
 * authority) and GAMMA_SETUP_HEADED=true to watch the browser.
 */
import { execFileSync } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { chromium, type Page } from '@playwright/test'

const root = path.join(__dirname, '..')
const stripSlash = (url: string) => url.replace(/\/+$/, '')

const gammaUrl = stripSlash(process.env.GAMMA_URL ?? 'http://localhost:8081')
const appUrl = stripSlash(process.env.APP_URL ?? 'http://localhost:3000')
const authority = process.env.GAMMA_ADMIN_AUTHORITY ?? 'songbook'
const superGroup = (process.env.GAMMA_SETUP_SUPER_GROUP ?? 'digit').toLowerCase()
const force = process.argv.includes('--force')

// The songbook on the host talks to gamma on the same URL as the browser; inside the compose
// network gamma is http://gamma:8081 (the issuer follows that Host, see src/lib/gamma.ts)
const targets = [
  { file: '.env.local', internalUrl: gammaUrl },
  { file: '.env', internalUrl: 'http://gamma:8081' },
]

interface Credentials {
  clientId: string
  clientSecret: string
  apiKeyId: string
  apiKeyToken: string
}

function readEnvFile(file: string): Record<string, string> {
  const values: Record<string, string> = {}
  if (!existsSync(file)) return values
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return values
}

/** Sets `values` in an env file, replacing existing lines and keeping everything else */
function upsertEnvFile(file: string, values: Record<string, string>) {
  const lines = existsSync(file) ? readFileSync(file, 'utf8').replace(/\n$/, '').split('\n') : []
  const pending = new Map(Object.entries(values))
  const updated = lines.map((line) => {
    const key = /^\s*([A-Z0-9_]+)\s*=/.exec(line)?.[1]
    if (!key || !pending.has(key)) return line
    const value = pending.get(key)!
    pending.delete(key)
    return `${key}=${value}`
  })
  if (pending.size > 0) {
    if (updated.length > 0 && updated.at(-1) !== '') updated.push('')
    updated.push('# Local gamma, written by `pnpm gamma:setup`')
    for (const [key, value] of pending) updated.push(`${key}=${value}`)
  }
  writeFileSync(file, `${updated.join('\n')}\n`)
}

async function waitForGamma() {
  const deadline = Date.now() + 5 * 60_000
  let last = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${gammaUrl}/login`)
      if (response.ok) return
      last = `status ${response.status}`
    } catch (error) {
      last = String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(
    `Gamma did not answer on ${gammaUrl}/login (${last}). Is \`docker compose --profile gamma up -d\` running?`,
  )
}

/** True if gamma accepts both the client secret and the API key */
async function credentialsWork(credentials: Partial<Credentials>): Promise<boolean> {
  const { clientId, clientSecret, apiKeyId, apiKeyToken } = credentials
  if (!clientId || !clientSecret || !apiKeyId || !apiKeyToken) return false
  // The client has no client_credentials grant: a valid secret gets 400 unauthorized_client, an
  // unknown client or wrong secret 401 invalid_client
  const token = await fetch(`${gammaUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (token.status === 401) return false
  const authorities = await fetch(`${gammaUrl}/api/client/v1/authorities/for/${randomUUID()}`, {
    headers: { Authorization: `pre-shared ${apiKeyId}:${apiKeyToken}` },
    redirect: 'manual',
  })
  return authorities.ok
}

/** The admin's cid and password: from the environment, gamma's log, or gamma's non-production default */
function adminLogin(): { cid: string; password: string } {
  if (process.env.GAMMA_ADMIN_CID && process.env.GAMMA_ADMIN_PASSWORD) {
    return { cid: process.env.GAMMA_ADMIN_CID, password: process.env.GAMMA_ADMIN_PASSWORD }
  }
  try {
    const logs = execFileSync('docker', ['compose', 'logs', '--no-log-prefix', 'gamma'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const match = /Admin user created -> cid:([^,\s]+),password:(\S+)/.exec(logs)
    if (match) return { cid: match[1], password: match[2] }
  } catch {
    // No docker or no gamma service, fall through
  }
  // The log line is only printed when gamma creates the admin; with PRODUCTION=false (as in
  // docker-compose.yml) its password is always this one
  console.log(
    'No "Admin user created" line in `docker compose logs gamma`, trying admin/password1337',
  )
  return { cid: 'admin', password: 'password1337' }
}

async function login(page: Page, cid: string, password: string) {
  await page.goto(`${gammaUrl}/login`)
  await page.fill('input[name="username"]', cid)
  await page.fill('input[name="password"]', password)
  await Promise.all([
    page.waitForURL((url) => url.pathname !== '/login', { timeout: 30_000 }).catch(() => {}),
    page.click('button:has-text("Login")'),
  ])
  if (new URL(page.url()).pathname === '/login') {
    throw new Error(`Could not log in to gamma as ${cid}, set GAMMA_ADMIN_CID/GAMMA_ADMIN_PASSWORD`)
  }
}

/** Creates an official client with an API key, see templates/create-client/page.html in gamma */
async function createClient(page: Page): Promise<Credentials & { clientUid: string }> {
  await page.goto(`${gammaUrl}/clients/create`)
  await page.fill('input[name="prettyName"]', 'SongBook local')
  await page.fill('input[name="svDescription"]', 'Sångboken, lokal utveckling')
  await page.fill('input[name="enDescription"]', 'The songbook, local development')
  await page.fill('input[name="redirectUrl"]', `${appUrl}/auth/callback`)
  await page.check('input[name="generateApiKey"]')
  // The songbook asks for `openid profile` only
  await page.locator('input[name="emailScope"]').setChecked(false)
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByText('Client details').waitFor({ timeout: 30_000 })
  await page.waitForURL(/\/clients\/[0-9a-f-]+$/)

  // The credentials article is only on this page, see templates/client-details/client-credentials.html
  const credentials = page.locator('article:has-text("Credentials")')
  const clientSecret = (await credentials.locator('code').first().innerText()).trim()
  const header = (await credentials.locator('code', { hasText: 'pre-shared' }).innerText()).trim()
  const apiKey = /pre-shared\s+([0-9a-fA-F-]+):(\S+)/.exec(header)
  if (!apiKey) throw new Error('Could not read the API key from the client page')
  const clientId = (await page.locator('li:has-text("Client id:") span').first().innerText()).trim()

  return {
    clientUid: new URL(page.url()).pathname.split('/').at(-1)!,
    clientId,
    clientSecret,
    apiKeyId: apiKey[1],
    apiKeyToken: apiKey[2],
  }
}

/** Adds the authority for a super group, see templates/client-details/add-authority-to-client.html */
async function addAuthority(page: Page) {
  await page.fill('input[name="authority"]', authority)
  await page.getByRole('button', { name: 'Add super group authority' }).click()
  const select = page.locator('select.authority-super-group-row').first()
  await select.waitFor()
  // The options show pretty names (digIT) with super group ids as values
  const options = await select.locator('option').evaluateAll((elements) =>
    elements.map((option) => ({
      value: (option as HTMLOptionElement).value,
      label: option.textContent?.trim() ?? '',
    })),
  )
  const option = options.find((candidate) => candidate.label.toLowerCase() === superGroup)
  if (!option) {
    throw new Error(
      `No super group ${superGroup} in gamma, choose one of ${options.map((o) => o.label).join(', ')}`,
    )
  }
  await select.selectOption(option.value)
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/authority') &&
        response.ok(),
    ),
    page.locator('button[form="create-client-authority"]').click(),
  ])
  await page.locator('article > header', { hasText: authority }).waitFor()
}

async function main() {
  await waitForGamma()

  const existing = readEnvFile(path.join(root, '.env.local'))
  if (!force && stripSlash(existing.GAMMA_URL ?? '') === gammaUrl) {
    const current = {
      clientId: existing.GAMMA_CLIENT_ID,
      clientSecret: existing.GAMMA_CLIENT_SECRET,
      apiKeyId: existing.GAMMA_API_KEY_ID,
      apiKeyToken: existing.GAMMA_API_KEY_TOKEN,
    }
    if (await credentialsWork(current)) {
      console.log(
        `The gamma client ${current.clientId} in .env.local still works, nothing to do (--force creates a new one)`,
      )
      return
    }
  }

  const admin = adminLogin()
  const browser = await chromium.launch({ headless: process.env.GAMMA_SETUP_HEADED !== 'true' })
  let client
  try {
    const page = await browser.newPage()
    await login(page, admin.cid, admin.password)
    client = await createClient(page)
    await addAuthority(page)
  } finally {
    await browser.close()
  }
  if (!(await credentialsWork(client))) {
    throw new Error('Gamma does not accept the credentials that were just created')
  }

  for (const target of targets) {
    upsertEnvFile(path.join(root, target.file), {
      GAMMA_URL: gammaUrl,
      GAMMA_INTERNAL_URL: target.internalUrl,
      GAMMA_CLIENT_ID: client.clientId,
      GAMMA_CLIENT_SECRET: client.clientSecret,
      GAMMA_API_KEY_ID: client.apiKeyId,
      GAMMA_API_KEY_TOKEN: client.apiKeyToken,
      GAMMA_ADMIN_AUTHORITY: authority,
    })
  }

  console.log(
    `Created the gamma client ${client.clientId}: ${gammaUrl}/clients/${client.clientUid}`,
  )
  console.log(
    `  redirect url ${appUrl}/auth/callback, authority ${authority} for super group ${superGroup}`,
  )
  console.log(
    `Wrote the GAMMA_* variables to ${targets.map((target) => target.file).join(' and ')}`,
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
