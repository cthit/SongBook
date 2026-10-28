import { expect, test } from '@playwright/test'
import { openSong, searchBox, signIn, songCard } from './helpers'

test('an admin approves and rejects suggestions from members', async ({ browser }) => {
  const memberContext = await browser.newContext()
  const member = await memberContext.newPage()
  await member.goto('/')
  await signIn(member, 'member')

  // Suggest a brand new song
  await member.getByTestId('user-menu').click()
  await member.getByRole('menuitem', { name: 'Suggest a song' }).click()
  await member.getByLabel('Title').fill('FÖRSLAGSVISAN')
  await member.getByLabel('Melody').fill('Gubben Noak')
  await member.getByLabel('Lyrics').fill('Vi föreslår en visa\n\nsom alla kan sjunga')
  await member.getByRole('button', { name: 'Tags' }).click()
  await member.getByRole('option', { name: 'Snaps' }).getByRole('checkbox').check()
  await member.keyboard.press('Escape')
  await member.getByRole('button', { name: 'Send suggestion' }).click()
  await expect(member).toHaveURL('/suggestions')

  // ... and a second one that will be rejected
  await member.goto('/suggestions/new')
  await member.getByLabel('Title').fill('DÅLIGA VISAN')
  await member.getByLabel('Lyrics').fill('Inte så bra')
  await member.getByRole('button', { name: 'Send suggestion' }).click()
  await expect(member).toHaveURL('/suggestions')

  // Suggestions are not public
  await member.goto('/')
  await searchBox(member).fill('FÖRSLAGSVISAN')
  await expect(member.getByTestId('no-songs')).toBeVisible()

  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  await admin.goto('/')
  await signIn(admin, 'admin')
  await admin.getByTestId('user-menu').click()
  await admin.getByRole('menuitem', { name: /^Suggestions/ }).click()
  const pending = admin.getByTestId('pending-suggestion')
  const proposal = pending.filter({ hasText: 'FÖRSLAGSVISAN' })
  await expect(proposal).toContainText('New song: FÖRSLAGSVISAN')
  await expect(proposal).toContainText('Suggested by Jim (jhalpert)')
  await expect(proposal).toContainText('Melody: Gubben Noak')
  await proposal.getByRole('button', { name: 'Approve' }).click()
  await expect(admin.getByRole('status')).toHaveText('Suggestion approved')
  await expect(proposal).toHaveCount(0)

  const bad = pending.filter({ hasText: 'DÅLIGA VISAN' })
  await bad.getByLabel('Comment (optional)').fill('Tyvärr inte')
  await bad.getByRole('button', { name: 'Reject' }).click()
  await expect(admin.getByRole('status').filter({ hasText: 'Suggestion rejected' })).toBeVisible()
  await expect(bad).toHaveCount(0)

  // The approved song is in the songbook with its tag
  await admin.goto('/')
  const dialog = await openSong(admin, 'FÖRSLAGSVISAN')
  await expect(dialog).toContainText('Melody: Gubben Noak')
  await expect(dialog).toContainText('Snaps')

  // The member sees the outcome
  await member.goto('/suggestions')
  await expect(
    member.getByTestId('my-suggestion').filter({ hasText: 'FÖRSLAGSVISAN' }),
  ).toContainText('Approved')
  const rejected = member.getByTestId('my-suggestion').filter({ hasText: 'DÅLIGA VISAN' })
  await expect(rejected).toContainText('Rejected')
  await expect(rejected).toContainText('Tyvärr inte')
  await member.goto('/')
  await searchBox(member).fill('FÖRSLAGSVISAN')
  await expect(songCard(member, 'FÖRSLAGSVISAN')).toBeVisible()

  await memberContext.close()
  await adminContext.close()
})
