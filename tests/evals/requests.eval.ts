/**
 * Deployed-site eval -- Phase 60 "Requests, notifications and objectives".
 *
 * Skeleton (60-01): one fixme case per owning plan. 60-11, 60-12, 60-13, 60-14,
 * 60-16 and 60-17 turn their cases live; 60-18 runs the lot
 * (`npm run eval -- --phase 60`) against the deployed site and reads every
 * screenshot before declaring a pass.
 *
 * Fixtures come from `node scripts/eval-fixtures.mjs` in the isolated
 * "SOPstart Eval Site" org: admin, worker, supervisor (supervises the worker),
 * an idle supervisor, a second worker and a safety manager (the second approver
 * of a two-step chain). The zero-SOP machine comes from ensureZeroSopMachine.
 *
 * Rules (CLAUDE.md Learnings):
 *  - assert by NAME, never a total count: the eval-site org is shared with
 *    sibling evals (2026-09-29);
 *  - every assertion after a fresh navigation carries SLOW (2026-09-29);
 *  - toHaveCount(1) with a short timeout BEFORE a click (2026-09-28);
 *  - exercise requests and notifications TWICE in one session: state can leak
 *    between records (2026-10-03);
 *  - a not-found boundary serves HTTP 200: assert rendered content, never the
 *    raw status (2026-09-29);
 *  - read the screenshots: CSS-token and sizing bugs are invisible to
 *    assertions (2026-07-14); fixed geometry gets one zoomed shot (2026-10-05);
 *  - the real-org case is read-only;
 *  - one minted session per role for the whole file (shared OTP budget);
 *  - requests, notifications and objectives rows are cleaned up in afterAll,
 *    eval-site org only; ledger rows are permanent by design.
 * Comments describe retired routes in words (2026-09-28).
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test, expect, type BrowserContext } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_BASE_URL, EVAL_ENV_READY, EVAL_SITE_SOP_TITLE, EVAL_USERS, signInAs } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot } from './lib/plant-fixture'
import { deleteEvalRequestRows, ensureZeroSopMachine } from './lib/requests-fixture'

export const SLOW = { timeout: 30_000 }

/**
 * Shared cron helper (60-11; 60-16 reuses it). A wrong bearer must be refused first -- that proves the
 * route checks the secret at all -- then the real secret is sent; if THAT is refused too, the eval's
 * CRON_SECRET is not the deployed one, and every later assertion would be noise.
 */
export async function postCron(path: string, body: Record<string, unknown>): Promise<Record<string, number>> {
  const url = `${EVAL_BASE_URL}${path}`
  const send = (secret: string) =>
    fetch(url, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const wrong = await send('not-the-cron-secret')
  expect(wrong.status, `${path} accepted a wrong bearer`).toBe(401)
  const real = await send(process.env.CRON_SECRET ?? '')
  if (real.status === 401) throw new Error('CRON_SECRET differs from the deployed value (Railway env vs .env.local)')
  expect(real.status, `${path} with the real secret`).toBe(200)
  return (await real.json()) as Record<string, number>
}

test.describe('Phase 60 -- requests, notifications and objectives (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')
  test.use({ viewport: { width: 1440, height: 900 } })

  test.describe.serial('requests cases', () => {
    let db: SupabaseClient
    let siteOrgId: string
    let zeroMachine: { id: string; name: string }
    const runId = Date.now().toString(36)

    test.beforeAll(async () => {
      if (!EVAL_ENV_READY) return
      db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const fixture = await ensurePlantFixture(db)
      siteOrgId = fixture.siteOrgId
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')
      // The agent-request case needs a machine with no linked SOP.
      zeroMachine = await ensureZeroSopMachine(db, siteOrgId)
    })

    test.afterAll(async () => {
      if (!EVAL_ENV_READY || !db || !siteOrgId || siteOrgId === REAL_SOPSTART_ORG_ID) return
      await deleteEvalRequestRows(db, siteOrgId).catch(() => null)
    })

    test('supervisor Requests tab and pin: tab bar shows Inbox and Requests, pin equals inbox plus requests (60-11)', async ({ browser }) => {
      test.setTimeout(180_000)
      const note = `EVAL supervisor request ${runId}`
      const { data: sop } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).eq('title', EVAL_SITE_SOP_TITLE).limit(1).single()
      const { data: worker } = await db.auth.admin.listUsers({ perPage: 1000 }).then((r) => ({ data: r.data.users.find((u) => u.email === EVAL_USERS.siteWorker) }))
      if (!sop || !worker) throw new Error('eval-site SOP or worker missing -- run node scripts/eval-fixtures.mjs')
      const seeded = await db
        .from('requests')
        .insert({ organisation_id: siteOrgId, kind: 'change_sop', state: 'open', subject_type: 'sop', subject_id: sop.id, note, raised_by_user: worker.id })
        .select('id')
        .single()
      if (seeded.error) throw new Error(`request seed failed: ${seeded.error.message}`)

      const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(ctx, 'siteSupervisor')
      const page = await ctx.newPage()
      await page.goto('/?place=office')
      await expect(page.getByTestId('office-pane')).toHaveCount(1, SLOW)
      await expect(page.getByRole('tab')).toHaveCount(2, SLOW)
      await page.getByTestId('office-tab-requests').click()
      const row = page.getByTestId('request-row').filter({ hasText: note })
      await expect(row).toHaveCount(1, SLOW)
      await shot(page, '60-requests-supervisor')

      // The pin is the Inbox segment count plus the Requests segment count (the supervisor's pin reads the same query).
      const seg = async (id: string) => Number(((await page.getByTestId(id).locator('.mono').first().textContent().catch(() => '')) ?? '').trim()) || 0
      await expect(async () => {
        const pin = Number(((await page.locator('[data-testid="shell-room-row"][data-room-id="office"] .mono').first().textContent().catch(() => '')) ?? '').trim()) || 0
        expect(pin).toBe((await seg('office-tab-inbox')) + (await seg('office-tab-requests')))
      }).toPass(SLOW)

      await row.getByTestId('request-accept').click()
      const receipt = page.getByTestId('office-receipt')
      await expect(receipt).toContainText('Accepted · logged in the decision ledger', SLOW)
      const link = page.getByTestId('office-receipt-link')
      await expect(link).toHaveText('Open the SOP')
      // A supervisor is sent to the browse address, never the editor (F-23).
      await expect(link).not.toHaveAttribute('href', /mode=edit/)
      await expect(page.getByTestId('request-row').filter({ hasText: note })).toHaveCount(0, SLOW)
      await shot(page, '60-requests-receipt')
      await ctx.close()
    })

    test('agent new-SOP request from the machines sweep appears with the agent chip; declined; a second run raises nothing (60-11)', async ({ browser }) => {
      test.setTimeout(240_000)
      // Clear anything an earlier run left for this machine so the first sweep has something to raise.
      await db.from('requests').delete().eq('organisation_id', siteOrgId).eq('subject_type', 'machine').eq('subject_id', zeroMachine.id)
      await postCron('/api/cron/machines-without-sops', { organisationId: siteOrgId })

      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(ctx, 'siteAdmin')
      const page = await ctx.newPage()
      await page.goto('/?place=office&tab=requests')
      const row = page.getByTestId('request-row').filter({ hasText: zeroMachine.name })
      await expect(row).toHaveCount(1, SLOW)
      await expect(row).toHaveAttribute('data-agent', 'true')
      await expect(row.getByText('agent', { exact: true })).toHaveCount(1)
      // Normal width, two buttons, each at least 44 px tall.
      const pane = await page.getByTestId('office-pane').boundingBox()
      expect(pane?.width ?? 0).toBeLessThan(520)
      for (const id of ['request-accept', 'request-decline']) {
        const box = await row.getByTestId(id).boundingBox()
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
      }
      await shot(page, '60-requests-tab')

      await row.getByTestId('request-decline').click()
      await expect(page.getByRole('dialog')).toHaveCount(1, SLOW)
      await shot(page, '60-decline-dialog')
      await page.getByRole('dialog').getByRole('textbox').fill(`EVAL decline ${runId}: not needed on this machine`)
      await page.getByRole('dialog').getByRole('button', { name: 'Decline request' }).click()
      await expect(page.getByTestId('office-receipt')).toContainText('Declined · logged in the decision ledger', SLOW)
      await expect(page.getByTestId('request-row').filter({ hasText: zeroMachine.name })).toHaveCount(0, SLOW)

      // A second sweep run raises nothing new for a machine whose request was just answered.
      await postCron('/api/cron/machines-without-sops', { organisationId: siteOrgId })
      await page.reload()
      await expect(page.getByTestId('office-pane')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('request-row').filter({ hasText: zeroMachine.name })).toHaveCount(0, SLOW)
      await ctx.close()
    })
    test.fixme('composer opens from the machine panel; the ask picker works in role mode and person mode (60-12)', async () => {})
    test.fixme('objective on a machine, a department and a person; an agent-set objective is confirmed (60-13)', async () => {})
    test.fixme('SOP objective in browse and This SOP; a second request raised from browse (60-14)', async () => {})
    test.fixme('worker raises, admin accepts, bell count shows, the notification opens its place, mark-read clears it; a second round (60-16)', async () => {})
    test.fixme('decline with a note; the asker sees the answer (60-16)', async () => {})
    test.fixme('supervisor asks a worker: due on the badge and the Now card; a new version is published and the worker is told; the worker declines (60-16)', async () => {})
    test.fixme('review-due sweep notifies the SOP owner (60-16)', async () => {})
    test.fixme('two-step approval chain notifies the next approver at the divert and after a non-final approval (60-16)', async () => {})
    test.fixme('a sent walk notifies the supervisor (60-16)', async () => {})
    test.fixme('overview order, empty states and Office line; zoomed bell shot; real-org overview read-only (60-16)', async () => {})
    test.fixme('the old assign address lands on the SOP (assert rendered place, not status) (60-17)', async () => {})
  })
})
