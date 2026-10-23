/**
 * Deployed-site eval -- Phase 64 "Leavers and suspended members".
 *
 * Proves on the deployed site, with the real database and real sessions:
 *  1. Suspend asks first, then a suspended person shows a "Suspended" tag in the grid and the chart;
 *  2. the cut-off: the suspended person's OWN pre-suspend token reads no members and no SOPs, their old
 *     refresh token is refused, their browser shows the paused page, and (D-19) the sop-videos bucket is
 *     scoped to the organisation folder;
 *  3. Reinstate brings the access back on a fresh sign-in;
 *  5. Has left moves a person to a collapsed Former staff group, and inviting their email brings the same
 *     membership row back as active (logged as a reinstatement);
 *  6. nobody can suspend or mark themselves as left.
 * (Case 4 is the owner handover case, added by plan 64-05.)
 *
 * It creates its OWN disposable members in the eval-site organisation, so no other eval ever sees a
 * suspended or departed fixture. They are told apart by their run address, never by a count. The real
 * organisation is refused.
 *
 * OTP spend (the shared budget, CLAUDE.md): the site admin signs in once, member A twice (before the
 * suspend and after the reinstate), member B never. Do not loop this file.
 *
 * Tokens stay in memory: they are never logged, written into a screenshot or reported.
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, EVAL_USERS, signInAs, signInAsEmail } from './lib/session'
import { REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'

const SLOW = { timeout: 30_000 }
const SHORT = { timeout: 10_000 }
const LEDGER = ' · logged in the decision ledger'
const RUN = randomUUID().slice(0, 8)
const A_EMAIL = `eval-site-suspend-${RUN}@sopstart.invalid`
const B_EMAIL = `eval-site-left-${RUN}@sopstart.invalid`
const PROBE = `phase64-probe-${RUN}.bin`
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/** A supabase-js client that acts as one person: their access token, nothing else. */
const asToken = (token: string) =>
  createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

/** How many rows of a table this token can read (head count, so RLS decides). */
async function readable(c: SupabaseClient, table: 'organisation_members' | 'sops'): Promise<number> {
  const { count, error } = await c.from(table).select('id', { count: 'exact', head: true })
  if (error) throw new Error(`${table} read failed: ${error.message}`)
  return count ?? 0
}

test.describe('Phase 64 -- leavers and suspended members (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  test.describe.serial('people states', () => {
    let db: SupabaseClient
    let siteOrgId = ''
    let aUserId = ''
    let bUserId = ''
    let aMemberId = ''
    let bMemberId = ''
    let adminCtx: BrowserContext
    let aCtx: BrowserContext | undefined
    let adminToken = ''
    let aToken = ''
    let aRefresh = ''
    let scoped = false
    let probeOrgPath = ''
    let probeOtherPath = ''

    const gridRow = (page: Page, email: string) => page.getByTestId('people-row').filter({ hasText: email })

    async function openGridSheet(page: Page, email: string) {
      await page.goto('/?s=people')
      await expect(page.getByTestId('people-tab')).toHaveCount(1, SLOW)
      await page.getByTestId('people-view-authority').click()
      const row = gridRow(page, email)
      await expect(row).toHaveCount(1, SLOW)
      await row.click()
      const sheet = page.getByTestId('person-sheet')
      await expect(sheet).toBeVisible(SLOW)
      return { row, sheet }
    }

    async function makeMember(email: string, role: 'safety_manager' | 'worker') {
      const made = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { eval_fixture: true } })
      if (made.error || !made.data.user) throw new Error(`member create failed: ${made.error?.message}`)
      const joined = await db
        .from('organisation_members')
        .insert({ organisation_id: siteOrgId, user_id: made.data.user.id, role })
        .select('id')
        .single()
      if (joined.error || !joined.data) throw new Error(`membership insert failed: ${joined.error?.message}`)
      return { userId: made.data.user.id, memberId: joined.data.id as string }
    }

    test.beforeAll(async ({ browser }) => {
      if (!EVAL_ENV_READY) return
      db = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const { data: org, error } = await db.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).maybeSingle()
      if (error || !org) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found -- run node scripts/eval-fixtures.mjs`)
      siteOrgId = org.id as string
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')

      // A reads every organisation SOP (safety manager), so the cut-off has rows to lose.
      const a = await makeMember(A_EMAIL, 'safety_manager')
      aUserId = a.userId
      aMemberId = a.memberId
      const b = await makeMember(B_EMAIL, 'worker')
      bUserId = b.userId
      bMemberId = b.memberId

      const viewport = { width: 1440, height: 900 }
      adminCtx = await browser.newContext({ viewport })
      adminToken = (await signInAs(adminCtx, 'siteAdmin')).access_token
      aCtx = await browser.newContext({ viewport })
      const aSession = await signInAsEmail(aCtx, A_EMAIL)
      aToken = aSession.access_token
      aRefresh = aSession.refresh_token

      // D-19: two probe objects, one inside the organisation folder and one outside any organisation.
      probeOrgPath = `${siteOrgId}/${PROBE}`
      probeOtherPath = `${randomUUID()}/${PROBE}`
      const body = Buffer.from('phase64 probe')
      const up1 = await db.storage.from('sop-videos').upload(probeOrgPath, body, { contentType: 'video/mp4', upsert: true })
      const up2 = await db.storage.from('sop-videos').upload(probeOtherPath, body, { contentType: 'video/mp4', upsert: true })
      scoped = !up1.error && !up2.error
      if (!scoped) console.log(`sop-videos probes not uploaded (${up1.error?.message ?? up2.error?.message}); scope check skipped`)
    })

    test.afterAll(async () => {
      if (!EVAL_ENV_READY || !db || !siteOrgId || siteOrgId === REAL_SOPSTART_ORG_ID) return
      await db.storage.from('sop-videos').remove([probeOrgPath, probeOtherPath]).catch(() => {})
      // Memberships first, then the accounts (tests only; the ledger rows stay by design).
      for (const uid of [aUserId, bUserId]) {
        if (!uid) continue
        await db.from('organisation_members').delete().eq('organisation_id', siteOrgId).eq('user_id', uid)
        await db.auth.admin.deleteUser(uid).catch(() => {})
      }
      for (const c of [adminCtx, aCtx]) await c?.close().catch(() => {})
    })

    test('1. suspend: asks first, Keep them changes nothing, then the grid and the chart show the Suspended tag', async () => {
      // Before: A's own token reads the organisation, and A's browser is on the home.
      const before = asToken(aToken)
      expect(await readable(before, 'organisation_members')).toBeGreaterThanOrEqual(1)
      expect(await readable(before, 'sops')).toBeGreaterThanOrEqual(1)
      const aPage = await aCtx!.newPage()
      await aPage.goto('/')
      await expect(aPage.getByTestId('home')).toBeVisible(SLOW)
      expect(aPage.url()).not.toContain('/pending')
      await aPage.close()

      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      const { row, sheet } = await openGridSheet(page, A_EMAIL)
      const suspend = sheet.getByTestId('people-suspend')
      await expect(suspend).toHaveCount(1, SHORT)
      await expect(sheet.getByTestId('people-left')).toHaveCount(1)
      await expect(sheet.getByTestId('people-reinstate')).toHaveCount(0)
      await suspend.click()
      const dialog = page.getByTestId('people-state-dialog')
      await expect(dialog).toBeVisible(SLOW)
      await expect(dialog).toHaveAttribute('data-to', 'suspended')
      await expect(dialog).toContainText(`Suspend ${A_EMAIL}?`)
      await expect(dialog).toContainText('They are signed out everywhere and cannot open anything on this site until you reinstate them.')
      await shot(page, '64-member-suspend-dialog')

      // Keep them: nothing changes.
      await page.getByTestId('people-state-cancel').click()
      await expect(dialog).toHaveCount(0)
      await expect(row).toHaveAttribute('data-status', 'active')
      expect(await readable(asToken(aToken), 'sops')).toBeGreaterThanOrEqual(1)

      await suspend.click()
      await page.getByTestId('people-state-confirm').click()
      const receipt = page.getByTestId('office-receipt')
      await expect(receipt).toContainText('Suspended' + LEDGER, SLOW)
      await expect(row).toHaveAttribute('data-status', 'suspended', SLOW)
      await expect(row.getByTestId('people-status-tag')).toHaveText('Suspended')
      await page.getByTestId('person-sheet-close').click()
      await shot(page, '64-member-suspended-grid')

      // Still in the chart, with the tag.
      await page.getByTestId('people-view-chart').click()
      const chip = page.locator(`[data-testid="org-person"][data-member-id="${aMemberId}"]`)
      await expect(chip).toHaveCount(1, SLOW)
      await expect(chip.getByTestId('people-status-tag')).toHaveText('Suspended')
      await shot(page, '64-member-suspended-chart')

      // Still in the Departments view too, and at phone width.
      await page.getByTestId('people-view-departments').click()
      await expect(page.locator(`[data-testid="people-card"][data-member-id="${aMemberId}"]`).getByTestId('people-status-tag')).toHaveCount(1, SLOW)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(600)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      await shot(page, '64-member-suspended-phone')
      expect(errors).toEqual([])
      await page.close()
    })

    test('2. cut-off: the same token reads nothing, the old refresh token is refused, the browser shows the paused page', async () => {
      // The pre-suspend access token, unchanged: the next request already sees no membership and no SOPs.
      await expect(async () => {
        expect(await readable(asToken(aToken), 'organisation_members')).toBe(0)
        expect(await readable(asToken(aToken), 'sops')).toBe(0)
      }).toPass(SLOW)

      // The refresh token was revoked with the sessions.
      const refresher = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
      const refreshed = await refresher.auth.refreshSession({ refresh_token: aRefresh })
      expect(refreshed.error, 'a revoked refresh token must be refused').not.toBeNull()
      expect(refreshed.data.session).toBeNull()

      // A's browser (cookie from before the suspend) ends on the paused page.
      const page = await aCtx!.newPage()
      await page.goto('/')
      await expect(page.getByTestId('pending')).toBeVisible(SLOW)
      await expect(page.getByTestId('pending')).toHaveAttribute('data-status', 'paused')
      await expect(page.getByTestId('pending')).toContainText(`Your access to ${EVAL_SITE_ORG_NAME} has been paused. Talk to your supervisor.`)
      await shot(page, '64-member-paused')
      await page.close()

      // D-19: the sop-videos bucket is scoped to the organisation folder.
      if (scoped) {
        const admin = asToken(adminToken)
        const own = await admin.storage.from('sop-videos').createSignedUrl(probeOrgPath, 60)
        expect(own.error, 'admin can sign a link inside their organisation folder').toBeNull()
        const other = await admin.storage.from('sop-videos').createSignedUrl(probeOtherPath, 60)
        expect(other.data?.signedUrl, 'admin cannot sign a link outside their organisation folder').toBeFalsy()
        const suspended = await asToken(aToken).storage.from('sop-videos').createSignedUrl(probeOrgPath, 60)
        expect(suspended.data?.signedUrl, 'the suspended person cannot sign a link at all').toBeFalsy()
      }
    })

    test('3. reinstate: the tag goes, a fresh sign-in reads the site again', async () => {
      const page = await adminCtx.newPage()
      const { row, sheet } = await openGridSheet(page, A_EMAIL)
      await expect(sheet.getByTestId('people-status-tag')).toHaveText('Suspended')
      await expect(sheet.getByTestId('people-suspend')).toHaveCount(0)
      await expect(sheet.getByTestId('people-role-select')).toBeDisabled()
      await shot(page, '64-member-sheet-suspended')
      const reinstate = sheet.getByTestId('people-reinstate')
      await expect(reinstate).toHaveCount(1, SHORT)
      await reinstate.click()
      await expect(page.getByTestId('office-receipt')).toContainText('Reinstated' + LEDGER, SLOW)
      await expect(row).toHaveAttribute('data-status', 'active', SLOW)
      await expect(row.getByTestId('people-status-tag')).toHaveCount(0)
      await page.close()

      // A signs in again in a fresh context.
      await aCtx?.close()
      aCtx = await adminCtx.browser()!.newContext({ viewport: { width: 1440, height: 900 } })
      const fresh = await signInAsEmail(aCtx, A_EMAIL)
      expect(await readable(asToken(fresh.access_token), 'sops')).toBeGreaterThanOrEqual(1)
      const aPage = await aCtx.newPage()
      await aPage.goto('/')
      await expect(aPage.getByTestId('home')).toBeVisible(SLOW)
      expect(aPage.url()).not.toContain('/pending')
      await shot(aPage, '64-member-reinstated')
      await aPage.close()
    })

    test('5. has left: Former staff holds them, and inviting their email brings the same row back', async () => {
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      const { row, sheet } = await openGridSheet(page, B_EMAIL)
      await sheet.getByTestId('people-left').click()
      const dialog = page.getByTestId('people-state-dialog')
      await expect(dialog).toBeVisible(SLOW)
      await expect(dialog).toHaveAttribute('data-to', 'left')
      await expect(dialog).toContainText(`Mark ${B_EMAIL} as left?`)
      await expect(dialog).toContainText('They are signed out everywhere and move to Former staff.')
      await page.getByTestId('people-state-confirm').click()
      const receipt = page.getByTestId('office-receipt')
      await expect(receipt).toContainText('Marked as left' + LEDGER, SLOW)
      await expect(row).toHaveCount(0, SLOW)

      // The fold is there, closed; open it and find them.
      const former = page.getByTestId('people-former')
      await expect(former).toHaveCount(1)
      expect(await former.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false)
      await former.locator('summary').click()
      const formerRow = page.getByTestId('people-former-row').filter({ hasText: B_EMAIL })
      await expect(formerRow).toHaveCount(1, SLOW)
      await expect(formerRow).toContainText('Left ')
      await shot(page, '64-member-former')

      // Their sheet offers Reinstate and Has left is gone; check it at phone width too.
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(600)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      await shot(page, '64-member-former-phone')
      await formerRow.click()
      const leftSheet = page.getByTestId('person-sheet')
      await expect(leftSheet).toBeVisible(SLOW)
      await expect(leftSheet.getByTestId('people-reinstate')).toHaveCount(1)
      await expect(leftSheet.getByTestId('people-left')).toHaveCount(0)
      await expect(leftSheet.getByTestId('people-status-tag')).toHaveText('Has left')
      await shot(page, '64-member-sheet-left-phone')
      await page.getByTestId('person-sheet-close').click()
      await page.setViewportSize({ width: 1440, height: 900 })

      // Invite the same address: no mail (an existing account), the same row comes back active.
      await page.getByTestId('people-invite').click()
      await page.getByTestId('people-invite-email').fill(B_EMAIL)
      await page.getByTestId('people-invite-send').click()
      await expect(receipt).toContainText('Reinstated' + LEDGER, SLOW)
      const rows = await db.from('organisation_members').select('id, status').eq('organisation_id', siteOrgId).eq('user_id', bUserId)
      expect(rows.data).toEqual([{ id: bMemberId, status: 'active' }])
      await expect(page.getByTestId('people-former-row').filter({ hasText: B_EMAIL })).toHaveCount(0, SLOW)
      await expect(gridRow(page, B_EMAIL)).toHaveAttribute('data-status', 'active', SLOW)

      // The ledger carries all three words, under the People chip.
      await page.goto('/?s=signoffs&tab=decisions')
      await page.locator('[data-testid="decisions-chip"][data-chip="people"]').click()
      const people = page.getByTestId('decisions-row')
      await expect(people.first()).toBeVisible(SLOW)
      for (const words of ['Suspended someone', 'Reinstated someone', 'Marked someone as left']) {
        await expect(people.filter({ hasText: words }).first(), words).toBeVisible(SLOW)
      }
      await shot(page, '64-member-ledger')
      expect(errors).toEqual([])
      await page.close()
    })

    test('6. self guard: nobody can suspend or mark themselves as left', async () => {
      const page = await adminCtx.newPage()
      const { sheet } = await openGridSheet(page, EVAL_USERS.siteAdmin)
      await expect(sheet.getByTestId('people-suspend')).toHaveCount(0)
      await expect(sheet.getByTestId('people-left')).toHaveCount(0)
      await expect(sheet.getByTestId('people-reinstate')).toHaveCount(0)
      await shot(page, '64-member-self')
      await page.close()
    })
  })
})
