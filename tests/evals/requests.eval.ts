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
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_BASE_URL, EVAL_ENV_READY, EVAL_SITE_SOP_TITLE, EVAL_USERS, signInAs } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot } from './lib/plant-fixture'
import { deleteEvalRequestRows, ensureZeroSopMachine } from './lib/requests-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'
import { startWalking, walkFixture } from './lib/walk'
import { SOP_CATEGORIES } from '../../src/lib/sop-categories'

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
    let pressId: string
    const runId = Date.now().toString(36)

    test.beforeAll(async () => {
      if (!EVAL_ENV_READY) return
      db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const fixture = await ensurePlantFixture(db)
      siteOrgId = fixture.siteOrgId
      pressId = fixture.pressId
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
      const seg = async (id: string) => Number(((await page.getByTestId(id).locator('.mono').first().textContent({ timeout: 1000 }).catch(() => '')) ?? '').trim()) || 0
      await expect(async () => {
        const pin = Number(((await page.locator('[data-testid="shell-room-row"][data-room-id="office"] .mono').first().textContent({ timeout: 1000 }).catch(() => '')) ?? '').trim()) || 0
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
    test('composer opens from the machine panel; the ask picker works in role mode and person mode (60-12)', async ({ browser }) => {
      test.setTimeout(240_000)

      // Admin: Ask > on the fixture SOP row; choosing is not sending.
      const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(adminCtx, 'siteAdmin')
      const admin = await adminCtx.newPage()
      await admin.goto(`/?place=${pressId}`)
      const adminRow = admin.getByTestId('admin-panel-row').filter({ hasText: EVAL_SITE_SOP_TITLE })
      await expect(adminRow).toHaveCount(1, SLOW)
      const ask = adminRow.getByTestId('ask-trigger')
      await expect(ask).toHaveCount(1, SLOW)
      await ask.click()
      await expect(admin.getByTestId('ask-picker')).toHaveCount(1, SLOW)
      await expect(admin.getByTestId('ask-confirm')).toBeDisabled()
      await admin.getByTestId('ask-role-option').filter({ hasText: 'Workers' }).click()
      await expect(admin.getByTestId('ask-confirm')).toHaveText('Ask Workers')
      await expect(admin.getByTestId('ask-told')).toContainText('will be told')
      await shot(admin, '60-ask-picker')

      await admin.getByTestId('ask-mode-person').click()
      await expect(admin.getByTestId('ask-confirm')).toBeDisabled()
      await admin.getByTestId('ask-person-search').fill('worker')
      const person = admin.getByTestId('ask-person-option').first()
      await expect(person).toHaveCount(1, SLOW)
      await person.click()
      await expect(admin.getByTestId('ask-confirm')).toBeEnabled()
      await shot(admin, '60-ask-person')
      await admin.getByTestId('ask-cancel').click()
      await expect(admin.getByTestId('ask-picker')).toHaveCount(0)
      await adminCtx.close()

      // Worker: the composer, twice; the second starts empty.
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(ctx, 'siteWorker')
      const page = await ctx.newPage()
      await page.goto(`/?place=${pressId}`)
      await expect(page.getByTestId('ask-trigger')).toHaveCount(0)
      const trigger = page.getByTestId('request-composer-trigger')
      await expect(trigger).toHaveCount(1, SLOW)
      await trigger.click()
      await expect(page.getByTestId('request-composer')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('composer-send')).toBeDisabled()
      await shot(page, '60-composer-machine')
      await page.getByRole('radio', { name: /Change a SOP/ }).check({ force: true })
      await page.getByTestId('composer-note').fill(`EVAL change request ${runId}: step text is out of date`)
      await page.getByTestId('composer-send').click()
      await expect(page.getByTestId('request-sent')).toContainText("Request sent. You'll see its answer under My requests.", SLOW)
      await shot(page, '60-composer-sent')

      await trigger.click()
      await expect(page.getByTestId('request-composer')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('composer-note')).toHaveValue('')
      await page.getByTestId('composer-cancel').click()
      await ctx.close()
    })
    test('objective on a machine, a department and a person; an agent-set objective is confirmed (60-13)', async ({ browser }) => {
      test.setTimeout(300_000)
      const typed = `EVAL objective ${runId}`
      const agentText = `EVAL agent objective ${runId}`
      const { data: dept } = await db.from('departments').select('id').eq('organisation_id', siteOrgId).eq('name', 'Forming').limit(1).single()
      if (!dept) throw new Error('eval-site Forming department missing -- run node scripts/eval-fixtures.mjs')
      await db.from('objectives').delete().eq('organisation_id', siteOrgId)

      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(ctx, 'siteAdmin')
      const page = await ctx.newPage()

      // Machine: set, with a date.
      await page.goto(`/?place=${pressId}`)
      const set = page.getByRole('button', { name: 'Set an objective' })
      await expect(set).toHaveCount(1, SLOW)
      await set.click()
      await expect(page.getByTestId('objective-editor')).toHaveCount(1, SLOW)
      await page.getByLabel('Objective', { exact: true }).fill(typed)
      await page.getByLabel('By (optional)').fill('2030-11-12')
      await page.getByRole('button', { name: 'Save objective' }).click()
      await expect(page.getByTestId('objective-line')).toContainText(typed, SLOW)
      await expect(page.getByRole('status')).toContainText('Objective set · logged in the decision ledger', SLOW)
      await expect(page.getByTestId('objective-line')).toHaveAttribute('data-agent', 'false')

      // Change it: the editor opens with the text and Remove in red (look at the shot).
      await page.getByRole('button', { name: 'Change' }).click()
      await expect(page.getByTestId('objective-editor')).toHaveCount(1, SLOW)
      await expect(page.getByLabel('Objective', { exact: true })).toHaveValue(typed)
      await shot(page, '60-objective-editor')
      await page.getByRole('button', { name: "Don't change it" }).click()

      // Agent path: an agent sets the machine objective; it reads as unconfirmed until confirmed.
      const body = {
        fieldId: 'objective.machine',
        context: { organisationId: siteOrgId, subjectId: pressId },
        newValue: { text: agentText },
        agentName: 'SOPstart assistant',
      }
      const wrote = await page.request.post('/api/ai-fields/write', { data: body })
      expect(wrote.status(), await wrote.text()).toBe(200)
      await page.goto(`/?place=${pressId}`)
      const line = page.getByTestId('objective-line')
      await expect(line).toContainText(agentText, SLOW)
      await expect(line).toHaveAttribute('data-agent', 'true')
      await expect(line).toHaveAttribute('data-confirmed', 'false')
      await expect(line.getByText('agent', { exact: true })).toHaveCount(1)
      await expect(line.getByText('Unconfirmed')).toHaveCount(1)
      await page.getByTestId('objective-confirm').click()
      await expect(page.getByRole('status')).toContainText('Confirmed · logged in the decision ledger', SLOW)
      await expect(page.getByTestId('objective-line')).toHaveAttribute('data-confirmed', 'true', SLOW)
      const { data: machineObjective } = await db.from('objectives').select('id').eq('organisation_id', siteOrgId).eq('subject_type', 'machine').eq('subject_id', pressId).single()
      const { count } = await db
        .from('decisions')
        .select('id', { count: 'exact', head: true })
        .eq('organisation_id', siteOrgId)
        .eq('kind', 'objective_confirmed')
        .eq('subject_id', machineObjective?.id ?? '')
      expect(count).toBe(1)
      await shot(page, '60-objective-meta')

      // Department: set from the department panel.
      await page.goto(`/?place=dept:${dept.id}`)
      await page.getByRole('button', { name: 'Set an objective' }).click()
      await page.getByLabel('Objective', { exact: true }).fill(`${typed} dept`)
      await page.getByRole('button', { name: 'Save objective' }).click()
      await expect(page.getByTestId('objective-line')).toContainText(`${typed} dept`, SLOW)
      await shot(page, '60-objective-meta-dept')

      // Person: the People row of the eval-site worker; removal is two-step.
      await page.goto('/?place=office&tab=people')
      const row = page.getByTestId('people-row').filter({ hasText: EVAL_USERS.siteWorker })
      await expect(row).toHaveCount(1, SLOW)
      await row.getByRole('button', { name: '+ Objective' }).click()
      await row.getByLabel('Objective', { exact: true }).fill(`${typed} person`)
      await row.getByRole('button', { name: 'Save objective' }).click()
      await expect(row.getByTestId('objective-line')).toContainText(`${typed} person`, SLOW)
      await shot(page, '60-objective-meta-person')
      await row.getByRole('button', { name: 'Change' }).click()
      await row.getByRole('button', { name: 'Remove objective' }).click()
      await expect(row.getByText('Remove this objective?')).toHaveCount(1)
      await row.getByRole('button', { name: 'Keep it' }).click()
      await row.getByRole('button', { name: 'Remove objective' }).click()
      await row.getByRole('button', { name: 'Yes, remove it' }).click()
      await expect(row.getByTestId('objective-line')).toHaveCount(0, SLOW)
      await ctx.close()

      // Worker: the same machine and department show the line, read-only.
      const wctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(wctx, 'siteWorker')
      const worker = await wctx.newPage()
      await worker.goto(`/?place=${pressId}`)
      await expect(worker.getByTestId('objective-line')).toContainText(agentText, SLOW)
      await expect(worker.getByRole('button', { name: /Change|Set an objective|Confirm/ })).toHaveCount(0)
      await wctx.close()
    })
    test('SOP objective in This SOP and browse; a second request raised from browse, never in the walk (60-14)', async ({ browser }) => {
      test.setTimeout(240_000)
      const { data: sopRow } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).eq('title', EVAL_SITE_SOP_TITLE).single()
      const sopId = sopRow!.id as string
      const text = `EVAL SOP objective ${runId}`

      // Admin: set the objective from This SOP.
      const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(adminCtx, 'siteAdmin')
      const admin = await adminCtx.newPage()
      await admin.goto(`/sops/${sopId}?mode=edit`)
      const rail = admin.getByTestId('this-sop')
      await expect(rail).toHaveCount(1, SLOW)
      await rail.getByRole('button', { name: /Set an objective/ }).click()
      await rail.getByLabel('Objective', { exact: true }).fill(text)
      await rail.getByRole('button', { name: 'Save objective' }).click()
      await expect(rail.getByTestId('objective-line')).toContainText(text, SLOW)
      await shot(admin, '60-sop-objective-rail')
      await adminCtx.close()

      // Worker: the line sits in the summary card, then the second request goes from browse.
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(ctx, 'siteWorker')
      const page = await ctx.newPage()
      await page.goto(`/sops/${sopId}`)
      const summary = page.getByTestId('focus-summary')
      await expect(summary.getByTestId('objective-line')).toContainText(text, SLOW)
      const trigger = page.getByTestId('request-composer-trigger')
      await expect(trigger).toHaveCount(1, SLOW)
      await trigger.click()
      await expect(page.getByTestId('request-composer')).toHaveCount(1, SLOW)
      await shot(page, '60-composer')
      await page.getByRole('radio', { name: /Observe me/ }).check({ force: true })
      await page.getByTestId('composer-note').fill(`EVAL observe request ${runId}`)
      await page.getByTestId('composer-send').click()
      await expect(page.getByTestId('request-sent')).toContainText('Request sent', SLOW)

      // The walk state offers no request.
      await page.getByTestId('focus-start-walking').click()
      await expect(page.getByTestId('focus-browse')).toHaveCount(0, SLOW)
      await expect(page.getByTestId('request-composer-trigger')).toHaveCount(0)
      await ctx.close()
    })
    // ---- 60-16: the bell, the overview, the loop and every notification trigger (by title, never by count) ----
    const NOTE_CHANGE = () => `EVAL change request ${runId}: step text is out of date`
    const NOTE_OBSERVE = () => `EVAL observe request ${runId}`
    const SEEDED_TITLES: string[] = []

    async function userIdOf(email: string): Promise<string> {
      const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
      if (error) throw new Error(`listUsers failed: ${error.message}`)
      const u = data.users.find((x) => x.email === email)
      if (!u) throw new Error(`eval user ${email} missing`)
      return u.id
    }

    /** A SOP with one section and three verified steps in the eval-site org, in the seedApproveSop shape. */
    async function seedSop(title: string, o: { status: 'draft' | 'published'; ownerId: string; extra?: Record<string, unknown> }): Promise<string> {
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to seed the real org')
      const adminId = await userIdOf(EVAL_USERS.siteAdmin)
      await db.from('sops').delete().eq('organisation_id', siteOrgId).eq('title', title)
      const { data: sop, error } = await db
        .from('sops')
        .insert({
          organisation_id: siteOrgId,
          title,
          source_file_name: title,
          source_file_type: 'docx',
          source_file_path: '',
          uploaded_by: adminId,
          source_type: 'blank',
          status: o.status,
          version: 1,
          objective: 'Close the guard.',
          owner_user_id: o.ownerId,
          ...(o.status === 'published' ? { published_at: new Date().toISOString() } : {}),
          ...o.extra,
        })
        .select('id')
        .single()
      if (error || !sop) throw new Error(`seed ${title} failed: ${error?.message}`)
      SEEDED_TITLES.push(title)
      const sec = await db.from('sop_sections').insert({ sop_id: sop.id, section_type: 'procedure', title: 'Procedure', sort_order: 0, approved: true }).select('id').single()
      if (sec.error || !sec.data) throw new Error(`seed section failed: ${sec.error?.message}`)
      for (const [i, text] of ['Isolate the press.', 'Fit your own lock.', 'Test the lock.'].entries()) {
        const ins = await db.from('sop_focus_steps').insert({
          organisation_id: siteOrgId, sop_id: sop.id, section_id: sec.data.id, source_key: `new:eval-60-16-${i}`,
          kind: 'step', text, tip: null, photo_required: false, sort_order: i,
          verified_by_admin_id: adminId, verified_at: new Date().toISOString(),
        })
        if (ins.error) throw new Error(`seed step failed: ${ins.error.message}`)
      }
      return sop.id as string
    }

    /** Newest version first, so a v2 never blocks the delete of its v1. */
    async function dropSops(title: string) {
      const { data } = await db.from('sops').select('id, version').eq('organisation_id', siteOrgId).eq('title', title).order('version', { ascending: false })
      for (const r of data ?? []) await db.from('sops').delete().eq('id', r.id as string)
    }

    async function as(browser: Browser, user: keyof typeof EVAL_USERS) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(ctx, user)
      return { ctx, page: await ctx.newPage() }
    }

    const notif = (page: Page, text: string | RegExp) => page.getByTestId('notification-row').filter({ hasText: text })
    async function openSite(page: Page) {
      await page.goto('/')
      await expect(page.getByTestId('overview-body').or(page.getByTestId('room-body')).first()).toBeVisible(SLOW)
    }

    test.afterAll(async () => {
      if (!EVAL_ENV_READY || !db || !siteOrgId || siteOrgId === REAL_SOPSTART_ORG_ID) return
      for (const t of SEEDED_TITLES) await dropSops(t).catch(() => null)
    })

    test('the loop, twice: accepted, then declined with a reason; bell count, bell click, open to My requests, mark-read (60-16 a)', async ({ browser }) => {
      test.setTimeout(300_000)
      // Admin accepts the worker's change-a-SOP request (raised by the 60-12 case).
      const admin = await as(browser, 'siteAdmin')
      await admin.page.goto('/?place=office&tab=requests')
      const changeRow = admin.page.getByTestId('request-row').filter({ hasText: NOTE_CHANGE() })
      await expect(changeRow).toHaveCount(1, SLOW)
      await changeRow.getByTestId('request-accept').click()
      await expect(admin.page.getByTestId('request-row').filter({ hasText: NOTE_CHANGE() })).toHaveCount(0, SLOW)

      const worker = await as(browser, 'siteWorker')
      const w = worker.page
      await openSite(w)
      const accepted = notif(w, /Your request about .* was accepted\./).first()
      await expect(accepted).toBeVisible(SLOW)
      await expect(w.getByTestId('shell-bell-count')).toHaveCount(1, SLOW)

      // Select a machine, then press the bell: the overview returns with the Notifications heading focused.
      await w.getByTestId('shell-search').fill('Press')
      await w.getByTestId('shell-bell').click()
      await expect(w.getByTestId('overview-notifications')).toBeVisible(SLOW)
      await expect(w.locator(':focus')).toContainText('Notifications', SLOW)
      await shot(w, '60-bell-click')

      // Opening the row marks it read and lands on My requests showing Accepted.
      await accepted.click()
      await expect(w.getByTestId('overview-requests')).toContainText('Accepted', SLOW)
      await shot(w, '60-overview-worker')
      await expect(notif(w, /Your request about .* was accepted\./).first()).toHaveAttribute('data-unread', 'false', SLOW)

      // Second round in the same session: decline the observe-me request with a reason.
      await admin.page.goto('/?place=office&tab=requests')
      const obsRow = admin.page.getByTestId('request-row').filter({ hasText: NOTE_OBSERVE() })
      await expect(obsRow).toHaveCount(1, SLOW)
      await obsRow.getByTestId('request-decline').click()
      const reason = `EVAL declined ${runId}: not this week`
      await admin.page.getByRole('dialog').getByRole('textbox').fill(reason)
      await admin.page.getByRole('dialog').getByRole('button', { name: /Decline/ }).last().click()
      await expect(admin.page.getByTestId('request-row').filter({ hasText: NOTE_OBSERVE() })).toHaveCount(0, SLOW)

      await w.reload()
      const declined = notif(w, /Your request about .* was declined\./).first()
      await expect(declined).toBeVisible(SLOW)
      await expect(w.getByTestId('overview-requests')).toContainText(reason, SLOW)
      await declined.click()
      await expect(declined).toHaveAttribute('data-unread', 'false', SLOW)
      await admin.ctx.close()
      await worker.ctx.close()
    })

    test('ask then a new version: due on the badge and Now card, the new version notifies, the decline reaches the supervisor (60-16 b)', async ({ browser }) => {
      test.setTimeout(480_000)
      const title = `EVAL ask ${runId}`
      const adminId = await userIdOf(EVAL_USERS.siteAdmin)
      const v1 = await seedSop(title, { status: 'published', ownerId: adminId })
      const link = await db.from('sop_machines').upsert({ organisation_id: siteOrgId, sop_id: v1, machine_id: pressId }, { onConflict: 'sop_id,machine_id' })
      if (link.error) throw new Error(`link failed: ${link.error.message}`)

      // The supervisor asks the worker (person mode) from Ask > on the row.
      const sup = await as(browser, 'siteSupervisor')
      await sup.page.goto(`/?place=${pressId}`)
      const row = sup.page.getByTestId('plant-panel-row').filter({ hasText: title })
      await expect(row).toHaveCount(1, SLOW)
      await row.getByTestId('ask-trigger').click()
      await sup.page.getByTestId('ask-mode-person').click()
      await sup.page.getByPlaceholder('Find a person…').fill('worker')
      await sup.page.getByRole('button', { name: /worker/i }).first().click()
      await sup.page.getByTestId('ask-confirm').click()

      const worker = await as(browser, 'siteWorker')
      const w = worker.page
      await openSite(w)
      const asked = notif(w, `You've been asked to do ${title}.`)
      await expect(asked).toHaveCount(1, SLOW)
      await shot(w, '60-notification-open')
      await asked.click()
      await w.waitForURL((u) => u.pathname === `/sops/${v1}`, SLOW)
      // Due on the site: the Now card names it.
      await w.goto('/')
      await expect(w.getByTestId('plant-now-card')).toContainText(title, SLOW)

      // The admin publishes v2 through the real dialog, one tick at a time.
      const admin = await as(browser, 'siteAdmin')
      const a = admin.page
      await a.goto(`/sops/${v1}?mode=edit`)
      await a.getByTestId('edit-start-editing').click()
      await a.waitForURL((u) => u.searchParams.get('mode') === 'edit' && !u.pathname.endsWith(v1), SLOW)
      const v2 = new URL(a.url()).pathname.split('/').pop()!
      const boxes = a.getByRole('checkbox', { name: /I have checked this/ })
      const n = await boxes.count()
      for (let i = 0; i < n; i++) {
        await boxes.first().click()
        await expect(boxes).toHaveCount(n - i - 1, SLOW)
      }
      await a.getByTestId('publish-button').click()
      await a.getByTestId('publish-dialog').getByRole('button', { name: 'Publish v2' }).click()
      await expect(a.getByTestId('edit-version-slot')).toContainText('Published v2', SLOW)

      await w.goto('/')
      const newVersion = notif(w, `${title} has a new version (v2).`)
      await expect(newVersion).toHaveCount(1, SLOW)
      await newVersion.click()
      await w.waitForURL((u) => u.pathname === `/sops/${v2}`, SLOW)

      // The worker declines the ask from My requests; the lineage resolves it on v2 (F-20).
      await w.goto('/')
      const askRow = w.getByTestId('ask-row').filter({ hasText: title })
      await expect(askRow).toHaveCount(1, SLOW)
      await shot(w, '60-ask-row')
      await askRow.getByTestId('ask-decline').click()
      await w.getByRole('dialog').getByRole('textbox').fill(`EVAL cannot do ${runId}: off site`)
      await w.getByRole('dialog').getByRole('button', { name: /Decline/ }).last().click()
      await expect(w.getByTestId('ask-row').filter({ hasText: title })).toHaveCount(0, SLOW)
      await w.goto('/')
      await expect(w.getByTestId('plant-now-card')).not.toContainText(title, SLOW)

      await sup.page.goto('/')
      await expect(notif(sup.page, `can't do ${title}.`)).toHaveCount(1, SLOW)
      for (const c of [sup, worker, admin]) await c.ctx.close()
      await dropSops(title)
    })

    test('review due sweep notifies the SOP owner once (60-16 c)', async ({ browser }) => {
      test.setTimeout(120_000)
      const title = `EVAL review-due ${runId}`
      const adminId = await userIdOf(EVAL_USERS.siteAdmin)
      await seedSop(title, { status: 'published', ownerId: adminId, extra: { review_due_at: new Date(Date.now() + 5 * 86_400_000).toISOString() } })
      await postCron('/api/cron/review-due', { organisationId: siteOrgId })
      const admin = await as(browser, 'siteAdmin')
      await openSite(admin.page)
      const text = new RegExp(`${title} is due for you to review by `)
      await expect(notif(admin.page, text)).toHaveCount(1, SLOW)
      await postCron('/api/cron/review-due', { organisationId: siteOrgId })
      await admin.page.reload()
      await expect(notif(admin.page, text)).toHaveCount(1, SLOW)
      await admin.ctx.close()
      await dropSops(title)
    })

    test('two-step approval chain: the divert and a non-final approval each name the next approver (60-16 d)', async ({ browser }) => {
      test.setTimeout(300_000)
      let category: string | null = null
      for (const c of SOP_CATEGORIES) {
        const { count } = await db.from('sops').select('id', { count: 'exact', head: true }).eq('organisation_id', siteOrgId).eq('category_slug', c.slug)
        if (!count) {
          category = c.slug
          break
        }
      }
      if (!category) throw new Error('no SOP category is free in the eval-site org')
      const title = `EVAL chain ${runId}`
      const adminId = await userIdOf(EVAL_USERS.siteAdmin)
      try {
        const chain = await db.from('approval_chains').upsert({
          organisation_id: siteOrgId,
          category,
          created_by: adminId,
          steps: [
            { role: 'safety_manager', label: 'Safety review' },
            { role: 'admin', label: 'Final sign-off' },
          ],
        })
        if (chain.error) throw new Error(`chain insert failed: ${chain.error.message}`)
        const sopId = await seedSop(title, { status: 'draft', ownerId: adminId, extra: { category_slug: category } })

        const admin = await as(browser, 'siteAdmin')
        const res = await admin.page.request.post(`/api/sops/${sopId}/publish`, { headers: { 'content-type': 'application/json' } })
        expect(res.status(), 'the publish route accepted the draft into the chain').toBeLessThan(400)
        const { data: pending } = await db.from('sops').select('approval_state').eq('id', sopId).single()
        expect(pending?.approval_state).toBe('pending')

        const safety = await as(browser, 'siteSafety')
        await openSite(safety.page)
        await expect(notif(safety.page, `Your approval is next on ${title}.`)).toHaveCount(1, SLOW)

        // Step 1 of 2 approved from the Office Inbox.
        await safety.page.goto('/?place=office')
        const row = safety.page.getByTestId('office-row').filter({ hasText: title })
        await expect(row).toHaveCount(1, SLOW)
        await row.getByTestId('office-row-action').click()
        await row.getByTestId('approve-panel').getByTestId('approve-commit').click()

        await admin.page.goto('/')
        const next = notif(admin.page, `Your approval is next on ${title}.`)
        await expect(next).toHaveCount(1, SLOW)
        await next.click()
        await expect(admin.page.getByTestId('room-body')).toHaveAttribute('data-room-id', 'office', SLOW)
        await admin.ctx.close()
        await safety.ctx.close()
      } finally {
        await db.from('approval_chains').delete().eq('organisation_id', siteOrgId).eq('category', category)
        await dropSops(title)
      }
    })

    test('a sent walk notifies the supervisor, who finds the sign-off row (60-16 e)', async ({ browser }) => {
      test.setTimeout(300_000)
      const { data: sopRow } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).eq('title', EVAL_SITE_SOP_TITLE).single()
      const sopId = sopRow!.id as string
      const worker = await as(browser, 'siteWorker')
      await worker.page.goto(`/sops/${sopId}`)
      await startWalking(worker.page)
      await walkFixture(worker.page, false)
      await worker.ctx.close()

      const sup = await as(browser, 'siteSupervisor')
      await openSite(sup.page)
      const row = notif(sup.page, new RegExp(`finished ${EVAL_SITE_SOP_TITLE} and is waiting for you to sign off\\.`)).first()
      await expect(row).toBeVisible(SLOW)
      await row.click()
      await expect(sup.page.getByTestId('room-body')).toHaveAttribute('data-room-id', 'office', SLOW)
      await expect(sup.page.getByTestId('office-row').filter({ hasText: EVAL_SITE_SOP_TITLE }).first()).toBeVisible(SLOW)
      await sup.ctx.close()
      await deleteEvalCompletions(db, sopId)
    })

    test('overview structure: order, empty states, the Office line, the zoomed bell and the real org read-only (60-16 f)', async ({ browser }) => {
      test.setTimeout(240_000)
      const admin = await as(browser, 'siteAdmin')
      await openSite(admin.page)
      const ids = await admin.page.locator('[data-testid^="overview-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''))
      const order = ['overview-objectives', 'overview-notifications', 'overview-requests', 'overview-office-link']
      expect(ids.filter((i) => order.includes(i))).toEqual(order.filter((i) => ids.includes(i)))
      await shot(admin.page, '60-overview-admin')
      // The bell: 44 x 44, search still usable.
      const box = await admin.page.getByTestId('shell-bell').boundingBox()
      expect(Math.round(box!.width)).toBe(44)
      expect(Math.round(box!.height)).toBe(44)
      await shot(admin.page, '60-bell')
      await admin.ctx.close()

      const idle = await as(browser, 'siteSupervisorIdle')
      await openSite(idle.page)
      await expect(idle.page.getByTestId('overview-notifications')).toHaveCount(0)
      await expect(idle.page.getByTestId('overview-requests')).toHaveCount(0)
      await shot(idle.page, '60-overview-empty')
      await idle.ctx.close()

      // Real org, read-only: look, never click anything that writes.
      const real = await as(browser, 'admin')
      await openSite(real.page)
      await shot(real.page, '60-real-org-overview')
      await real.ctx.close()
    })

    test('the old assign address lands on the SOP edit surface (rendered place, not status) (60-17)', async ({ browser }) => {
      test.setTimeout(120_000)
      const { data: sopRow } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).eq('title', EVAL_SITE_SOP_TITLE).single()
      const sopId = sopRow!.id as string
      const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signInAs(adminCtx, 'siteAdmin')
      const page = await adminCtx.newPage()
      await page.goto(`/admin/sops/${sopId}/assign`)
      await expect(page.getByTestId('this-sop')).toHaveCount(1, SLOW)
      expect(page.url()).toContain(`/sops/${sopId}`)
      expect(page.url()).not.toContain('/assign')
      await shot(page, '60-legacy-assign')
      await adminCtx.close()
    })
  })
})
