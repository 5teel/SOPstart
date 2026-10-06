/**
 * Deployed-site eval -- Phase 59 "The Office".
 *
 * 59-07 owns the owner / review meta case; 59-09 owns the inbox, sign-off (admin and
 * supervisor), owner-review, reject and approve cases below; every later case is live
 * and names its owning plan. 59-16 runs the lot
 * (`npm run eval -- --phase 59`) against the deployed site, and reads every
 * screenshot before declaring a pass. Replaces the governance eval (deleted by 59-14).
 *
 * Fixtures come from `node scripts/eval-fixtures.mjs` in the isolated
 * "SOPstart Eval Site" org: eval-site admin, worker, supervisor (supervises the
 * worker), an idle supervisor (supervises nobody, owns nothing: its inbox is
 * empty by construction) and a second worker nobody supervises (a walk seeded
 * for it must never reach a supervisor's inbox).
 *
 * Rules (CLAUDE.md Learnings):
 *  - assert by NAME, never a total count: the eval-site org is shared with
 *    sibling evals (2026-09-29). Seeded sign-off rows share one SOP title, so each
 *    is told apart by its photo count ("1 photo", "2 photos", ...);
 *  - every assertion after a fresh navigation carries SLOW (2026-09-29);
 *  - toHaveCount(1) with a short timeout BEFORE a click (2026-09-28);
 *  - exercise every flow TWICE in one session: state can leak between records
 *    (2026-10-03) -- the admin signs off two walks in one pane session;
 *  - a not-found boundary serves HTTP 200: assert rendered content, never the
 *    raw status (2026-09-29);
 *  - read the screenshots: CSS-token and sizing bugs are invisible to
 *    assertions (2026-07-14); fixed geometry gets one zoomed shot on the real
 *    scene (2026-10-05);
 *  - one minted session per role for the whole file (shared OTP budget);
 *  - completions are append-only: clean up with deleteEvalCompletions; ledger
 *    rows are permanent by design, written only to the eval-site org.
 * Comments describe retired routes in words (2026-09-28).
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import {
  EVAL_ENV_READY,
  EVAL_PLANT_SOP_TITLE,
  EVAL_SITE_SOP_TITLE,
  EVAL_SITE_WORKER2_EMAIL,
  EVAL_USERS,
  EVAL_WALK_SOP_TITLE,
  signInAs,
} from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'
import { newMachineCode } from '@/lib/site/scene'

export const SLOW = { timeout: 30_000 }
const SHORT = { timeout: 10_000 }

// 1x1 PNG, uploaded as a completion photo so the review thumbnail has something real to load.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const PHOTO_BUCKET = 'completion-photos'
const APPROVE_BACK_TITLE = 'EVAL approve send back'
const APPROVE_PUBLISH_TITLE = 'EVAL approve publish'
const OWNER_REVIEW_TITLE = 'EVAL owner review'
const DAY_MS = 86_400_000
const LEDGER = ' · logged in the decision ledger'
// Disposable people for the People tab: non-deliverable addresses in the eval-site org only (T-59-46).
const RUN = randomUUID().slice(0, 8)
const INVITE_EMAIL = `eval-invite-${RUN}@sopstart.com`
const DISPOSABLE_EMAIL = `eval-site-disposable-${RUN}@sopstart.invalid`

const officeRow = (page: Page, title: string | RegExp) => page.getByTestId('office-row').filter({ hasText: title })
/** Sign-off rows share one SOP title, so each is told apart by its photo count: "1 photo", "2 photos", ... */
const photosRow = (page: Page, n: number) =>
  officeRow(page, EVAL_WALK_SOP_TITLE).filter({ hasText: new RegExp(`\\b${n} photo`) }) // no trailing \b: the row text runs on into the button ("photoSign off")

/**
 * The Office room pin text, the Inbox tab count text and the Requests tab count text ('' when absent, i.e.
 * nothing waiting). `total` is what the pin must read: Inbox rows plus open requests (60-05, D-03); the
 * Requests tab itself lands in 60-11, so until then its count is simply absent.
 */
async function pinAndTab(page: Page) {
  const read = async (l: Locator) => ((await l.count()) ? ((await l.first().textContent()) ?? '').trim() : '')
  const pin = await read(page.locator('[data-testid="shell-room-row"][data-room-id="office"] .mono'))
  const tab = await read(page.getByTestId('office-tab-inbox').locator('.mono'))
  const requests = await read(page.getByTestId('office-tab-requests').locator('.mono'))
  const sum = (Number(tab) || 0) + (Number(requests) || 0)
  return { pin, tab, requests, total: sum ? String(sum) : '' }
}

async function openOffice(page: Page) {
  await page.goto('/?place=office')
  await expect(page.getByTestId('office-pane')).toHaveCount(1, SLOW)
}

async function expectThumbnailLoads(row: Locator) {
  const img = row.getByTestId('signoff-photo').first().locator('img')
  await expect(img).toHaveCount(1, SLOW)
  await expect.poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), SLOW).toBeGreaterThan(0)
}

/** Open a sign-off row and wait for its panel; returns the panel. */
async function openSignOff(row: Locator) {
  const action = row.getByTestId('office-row-action')
  await expect(action).toHaveCount(1, SHORT)
  await expect(action).toHaveText('Sign off')
  await action.click()
  const panel = row.getByTestId('signoff-panel')
  await expect(panel).toBeVisible(SLOW)
  await expect(panel.getByTestId('signoff-approve')).toHaveCount(1, SLOW)
  return panel
}

test.describe('Phase 59 -- the Office (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')
  test.use({ viewport: { width: 1440, height: 900 } })

  test.describe.serial('office cases', () => {
    let db: SupabaseClient
    let siteOrgId: string
    let plantSopId: string
    let siteAdminId: string
    let walkSopId: string
    let walkSopVersion: number
    let walkStepId: string
    let adminId: string
    let workerId: string
    let supervisorId: string
    let worker2Id: string
    let adminCtx: BrowserContext
    let supervisorCtx: BrowserContext
    let idleCtx: BrowserContext
    let workerCtx: BrowserContext
    let disposableId = ''

    /** Every seed refuses the real org: the eval writes the eval-site org only (T-59-38). */
    function assertEvalOrg() {
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to write -- resolved org id equals the real SOPstart org')
    }

    /** A pending sign-off completion with `photos` photos, written with the service key. */
    async function seedCompletion(forWorkerId: string, photos: number): Promise<string> {
      assertEvalOrg()
      const id = randomUUID()
      const { error } = await db.from('sop_completions').insert({
        id,
        organisation_id: siteOrgId,
        sop_id: walkSopId,
        worker_id: forWorkerId,
        sop_version: walkSopVersion,
        content_hash: 'eval-office',
        status: 'pending_sign_off',
        step_data: {},
      })
      if (error) throw new Error(`completion seed failed: ${error.message}`)
      for (let i = 0; i < photos; i++) {
        const photoId = randomUUID()
        const storagePath = `${siteOrgId}/completions/${id}/${photoId}.png`
        const up = await db.storage.from(PHOTO_BUCKET).upload(storagePath, TINY_PNG, { contentType: 'image/png', upsert: true })
        if (up.error) throw new Error(`photo upload failed: ${up.error.message}`)
        const row = await db.from('completion_photos').insert({
          id: photoId,
          organisation_id: siteOrgId,
          completion_id: id,
          step_id: walkStepId,
          storage_path: storagePath,
          content_type: 'image/png',
        })
        if (row.error) throw new Error(`photo row seed failed: ${row.error.message}`)
      }
      return id
    }

    async function statusOf(completionId: string): Promise<string | undefined> {
      const { data } = await db.from('sop_completions').select('status').eq('id', completionId).maybeSingle()
      return data?.status as string | undefined
    }

    /** A draft with one section and three ticked steps (the "EVAL focus ready" shape), pending one admin approval. */
    async function seedApproveSop(title: string): Promise<string> {
      assertEvalOrg()
      const del = await db.from('sops').delete().eq('organisation_id', siteOrgId).eq('title', title)
      if (del.error) throw new Error(`approve fixture cleanup failed: ${del.error.message}`)
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
          status: 'draft',
          version: 1,
          objective: 'Close the guard.',
          category_slug: 'quality',
          // Owned, so the only inbox row for it is the approval itself.
          owner_user_id: adminId,
          approval_state: 'pending',
          approval_snapshot: [{ role: 'admin', label: 'Safety review' }],
        })
        .select('id')
        .single()
      if (error || !sop) throw new Error(`approve SOP seed failed: ${error?.message}`)
      const sec = await db
        .from('sop_sections')
        .insert({ sop_id: sop.id, section_type: 'procedure', title: 'Procedure', sort_order: 0, approved: true })
        .select('id')
        .single()
      if (sec.error || !sec.data) throw new Error(`approve section seed failed: ${sec.error?.message}`)
      const steps = [
        { key: 'a', kind: 'step', text: 'Isolate the press.', photo: false },
        { key: 'b', kind: 'step', text: 'Fit your own lock.', photo: false },
        { key: 'c', kind: 'step', text: 'Photograph the lock.', photo: true },
      ]
      for (const [i, st] of steps.entries()) {
        const ins = await db.from('sop_focus_steps').insert({
          organisation_id: siteOrgId,
          sop_id: sop.id,
          section_id: sec.data.id,
          source_key: `new:eval-approve-${st.key}`,
          kind: st.kind,
          text: st.text,
          tip: null,
          photo_required: st.photo,
          sort_order: i,
          verified_by_admin_id: adminId,
          verified_at: new Date().toISOString(),
        })
        if (ins.error) throw new Error(`approve step seed failed: ${ins.error.message}`)
      }
      return sop.id as string
    }

    test.beforeAll(async ({ browser }) => {
      if (!EVAL_ENV_READY) return
      db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const fixture = await ensurePlantFixture(db)
      siteOrgId = fixture.siteOrgId
      plantSopId = fixture.plantSopId
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')

      const { data: walk, error: walkErr } = await db
        .from('sops')
        .select('id, version')
        .eq('organisation_id', siteOrgId)
        .eq('title', EVAL_WALK_SOP_TITLE)
        .maybeSingle()
      if (walkErr || !walk) throw new Error(`"${EVAL_WALK_SOP_TITLE}" fixture SOP not found -- run node scripts/eval-fixtures.mjs`)
      walkSopId = walk.id as string
      walkSopVersion = walk.version as number
      const { data: step } = await db.from('sop_focus_steps').select('id').eq('sop_id', walkSopId).eq('photo_required', true).limit(1).maybeSingle()
      walkStepId = (step?.id as string | undefined) ?? randomUUID()

      // A clean walk fixture: no stale completion can be mistaken for a seeded one.
      await deleteEvalCompletions(db, walkSopId)

      // The disposable member the People tab changes and removes (eval-site org, worker, .invalid address).
      const made = await db.auth.admin.createUser({ email: DISPOSABLE_EMAIL, email_confirm: true, user_metadata: { eval_fixture: true } })
      if (made.error || !made.data.user) throw new Error(`disposable member create failed: ${made.error?.message}`)
      disposableId = made.data.user.id
      const joined = await db.from('organisation_members').insert({ organisation_id: siteOrgId, user_id: disposableId, role: 'worker' })
      if (joined.error) throw new Error(`disposable membership failed: ${joined.error.message}`)

      // One minted session per role for the whole file (shared OTP budget).
      const viewport = { width: 1440, height: 900 }
      adminCtx = await browser.newContext({ viewport })
      supervisorCtx = await browser.newContext({ viewport })
      idleCtx = await browser.newContext({ viewport })
      workerCtx = await browser.newContext({ viewport })
      adminId = (await signInAs(adminCtx, 'siteAdmin')).user.id
      supervisorId = (await signInAs(supervisorCtx, 'siteSupervisor')).user.id
      await signInAs(idleCtx, 'siteSupervisorIdle')
      workerId = (await signInAs(workerCtx, 'siteWorker')).user.id
      const users = await db.auth.admin.listUsers({ perPage: 1000 })
      worker2Id = users.data.users.find((u) => u.email === EVAL_SITE_WORKER2_EMAIL)?.id ?? ''
      if (!worker2Id) throw new Error(`${EVAL_SITE_WORKER2_EMAIL} not found -- run node scripts/eval-fixtures.mjs`)
    })

    test.afterAll(async () => {
      if (!EVAL_ENV_READY || !db || !siteOrgId || siteOrgId === REAL_SOPSTART_ORG_ID) return
      // Completions and seeded SOPs go; ledger rows stay (append-only by design).
      await deleteEvalCompletions(db, walkSopId).catch(() => 0)
      await db.from('sops').delete().eq('organisation_id', siteOrgId).in('title', [APPROVE_BACK_TITLE, APPROVE_PUBLISH_TITLE, OWNER_REVIEW_TITLE])
      // The disposable member (membership first, if the remove case failed) and the invited address.
      if (disposableId) {
        await db.from('organisation_members').delete().eq('organisation_id', siteOrgId).eq('user_id', disposableId)
        await db.auth.admin.deleteUser(disposableId).catch(() => {})
      }
      const left = await db.auth.admin.listUsers({ perPage: 1000 }).catch(() => null)
      const invitedUser = left?.data.users.find((u) => u.email === INVITE_EMAIL)
      if (invitedUser) await db.auth.admin.deleteUser(invitedUser.id).catch(() => {})
      for (const c of [adminCtx, supervisorCtx, idleCtx, workerCtx]) await c?.close().catch(() => {})
    })

    test('meta line: owner and review line on a machine panel row, a Noticeboard row and a Workshop draft; This SOP carries Owner and Review (59-07)', async ({ page, context }) => {
      const errors = watchConsole(page)
      // A published site-wide SOP for the Noticeboard row (upsert by title, eval-site org only).
      const NOTICEBOARD_TITLE = 'Eval office noticeboard SOP'
      const { data: nb } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).eq('title', NOTICEBOARD_TITLE).maybeSingle()
      if (!nb) {
        const { data: admin } = await db.from('organisation_members').select('user_id').eq('organisation_id', siteOrgId).eq('role', 'admin').limit(1).maybeSingle()
        siteAdminId = (admin as { user_id: string } | null)?.user_id ?? ''
        const { error } = await db.from('sops').insert({
          organisation_id: siteOrgId,
          title: NOTICEBOARD_TITLE,
          source_file_name: NOTICEBOARD_TITLE,
          source_file_type: 'docx',
          source_file_path: '',
          uploaded_by: siteAdminId,
          status: 'published',
          published_at: new Date().toISOString(),
          version: 1,
          source_type: 'blank',
          placement: 'site',
        })
        if (error) throw new Error(`noticeboard fixture insert failed: ${error.message}`)
      }
      // The plant SOP starts with no owner so "No owner" is a state we know exists.
      const { error: resetErr } = await db.from('sops').update({ owner_user_id: null }).eq('id', plantSopId)
      if (resetErr) throw new Error(`owner reset failed: ${resetErr.message}`)
      const { data: draft } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).eq('title', EVAL_SITE_SOP_TITLE).single()

      await signInAs(context, 'siteAdmin')

      // Machine panel row.
      await page.goto('/')
      const press = page.locator('[data-testid="plant-machine"][data-machine-name="EVAL Press"]')
      await expect(press).toHaveCount(1, SLOW)
      await press.click()
      const panelRow = page.getByTestId('admin-panel').getByTestId('admin-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
      await expect(panelRow).toHaveCount(1, SLOW)
      const panelMeta = panelRow.getByTestId('owner-review-meta')
      await expect(panelMeta).toHaveAttribute('data-owner', 'none', SLOW)
      await expect(panelMeta).toContainText('No owner')
      await expect(panelMeta).toHaveAttribute('data-review', /^(none|due|overdue)$/)
      await shot(page, '59-owner-meta')

      // Noticeboard row.
      await page.goto('/?place=noticeboard')
      const boardRow = page.getByTestId('admin-panel-row').filter({ hasText: NOTICEBOARD_TITLE })
      await expect(boardRow).toHaveCount(1, SLOW)
      await expect(boardRow.getByTestId('owner-review-meta')).toHaveAttribute('data-owner', /^(set|none)$/)

      // Workshop draft.
      await page.goto('/?place=workshop')
      const draftRow = page.getByTestId('room-workshop-draft').filter({ hasText: EVAL_SITE_SOP_TITLE })
      await expect(draftRow).toHaveCount(1, SLOW)
      await expect(draftRow.getByTestId('owner-review-meta')).toHaveAttribute('data-review', /^(none|due|overdue)$/)

      // This SOP in the editor: Owner and Review rows, Mark reviewed for an admin.
      await page.goto(`/sops/${draft!.id}?mode=edit`)
      const block = page.getByTestId('this-sop')
      await expect(block).toBeVisible(SLOW)
      await expect(block.getByTestId('this-sop-owner')).toBeVisible(SLOW)
      await expect(block.getByTestId('this-sop-review')).toBeVisible(SLOW)
      await expect(block.getByRole('button', { name: 'Mark reviewed' })).toBeVisible(SLOW)
      await shot(page, '59-this-sop')
      expect(errors).toEqual([])
    })

    test('inbox: tabs, count equals the pin, the unowned row has Assign owner, assigning clears it by title and the receipt ends "logged in the decision ledger" (59-09)', async () => {
      assertEvalOrg()
      // The plant SOP is unowned and overdue, so it is one "No owner" row until it has an owner.
      const reset = await db
        .from('sops')
        .update({ owner_user_id: null, review_due_at: new Date(Date.now() - 3 * DAY_MS).toISOString() })
        .eq('id', plantSopId)
      expect(reset.error).toBeNull()

      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await openOffice(page)
      await expect(page.getByTestId('office-tab-inbox')).toHaveCount(1, SLOW)
      await expect(page.getByRole('tablist', { name: 'Office' })).toBeVisible(SLOW)

      const row = officeRow(page, EVAL_PLANT_SOP_TITLE)
      await expect(row).toHaveCount(1, SLOW)
      await expect(row.getByTestId('office-row-action')).toHaveCount(1, SHORT)
      await expect(row.getByTestId('office-row-action')).toHaveText('Assign owner')
      await expect(async () => {
        const c = await pinAndTab(page)
        expect(c.tab).not.toBe('')
        expect(c.pin).toBe(c.total)
      }).toPass(SLOW)
      await shot(page, '59-inbox')

      // Assign the eval-site admin (or the first member, if the popover labels people by name).
      await row.getByTestId('office-row-action').click()
      const options = row.locator('ul button')
      await expect(options.nth(1)).toBeVisible(SLOW)
      const byEmail = row.getByRole('button', { name: new RegExp(EVAL_USERS.siteAdmin.split('@')[0]) })
      await ((await byEmail.count()) > 0 ? byEmail.first() : options.nth(1)).click()

      // Receipt, pin patched without a reload, and the row comes back as Mark reviewed (it is overdue).
      await expect(page.getByTestId('office-receipt')).toContainText(`Owner set${LEDGER}`, SLOW)
      await expect(row).toHaveCount(1, SLOW)
      await expect(row.getByTestId('office-row-action')).toHaveText('Mark reviewed', SLOW)
      await expect(async () => {
        const c = await pinAndTab(page)
        expect(c.pin).toBe(c.total)
      }).toPass(SLOW)
      await shot(page, '59-receipt')
      expect(errors).toEqual([])
      await page.close()
    })

    test('inbox: a machine with no SOPs is no longer an inbox row (no Machines chip, no machines-kind row); it reaches the Office as an agent request (60-05, D-05; proved in requests.eval), no real-org title leaks', async () => {
      assertEvalOrg()
      const OVEN = 'EVAL Oven'
      // Fixture: a second machine on the eval-site layout with zero linked SOPs (upsert by name, eval-site org only).
      const { data: dept } = await db.from('departments').select('id').eq('organisation_id', siteOrgId).eq('name', 'Forming').maybeSingle()
      const { data: layout } = await db
        .from('site_layouts')
        .select('id')
        .eq('organisation_id', siteOrgId)
        .not('scene_path', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!dept || !layout) throw new Error('eval-site department or layout missing -- run node scripts/eval-fixtures.mjs')
      let { data: oven } = await db.from('site_machines').select('id').eq('site_layout_id', layout.id).eq('organisation_id', siteOrgId).eq('name', OVEN).maybeSingle()
      if (!oven) {
        const made = await db
          .from('site_machines')
          .insert({
            site_layout_id: layout.id,
            organisation_id: siteOrgId,
            name: OVEN,
            department_id: dept.id,
            polygon: [[80, 180], [280, 180], [280, 420], [80, 420]],
            code: newMachineCode(),
            sort: 1,
          })
          .select('id')
          .single()
        if (made.error || !made.data) throw new Error(`oven seed failed: ${made.error?.message}`)
        oven = made.data
      }
      const unlink = await db.from('sop_machines').delete().eq('machine_id', oven.id)
      expect(unlink.error).toBeNull()
      const real = await db.from('sops').select('title').eq('organisation_id', REAL_SOPSTART_ORG_ID).not('title', 'is', null).limit(1).maybeSingle()
      const realTitle = (real.data as { title: string } | null)?.title

      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await openOffice(page)
      // The Inbox is up (its tab is there) while the zero-SOP machine exists: it contributes no row and no chip.
      await expect(page.getByTestId('office-tab-inbox')).toHaveCount(1, SLOW)
      await expect(page.locator('[data-testid="office-chip"][data-chip="machines"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="office-row"][data-kind="machines"]')).toHaveCount(0)
      await expect(officeRow(page, OVEN)).toHaveCount(0)

      if (realTitle) await expect(page.getByText(realTitle, { exact: true })).toHaveCount(0)
      expect(errors).toEqual([])
      await page.close()
    })

    test('inbox: Mark reviewed on an overdue row clears it (59-09)', async () => {
      const page = await adminCtx.newPage()
      await openOffice(page)
      const row = officeRow(page, EVAL_PLANT_SOP_TITLE)
      await expect(row).toHaveCount(1, SLOW)
      const action = row.getByTestId('office-row-action')
      await expect(action).toHaveText('Mark reviewed', SLOW)
      await action.click()
      await expect(page.getByTestId('office-receipt')).toContainText(`Marked reviewed${LEDGER}`, SLOW)
      await expect(row).toHaveCount(0, SLOW)
      await expect(async () => {
        const c = await pinAndTab(page)
        expect(c.pin).toBe(c.total)
      }).toPass(SLOW)
      await page.close()
    })

    test('idle supervisor: a true empty inbox reads "Nothing needs you. That\'s the goal." with a two-segment tab control (Inbox, Requests) and no chips or cleared-today line (59-09, 60-11)', async () => {
      const page = await idleCtx.newPage()
      await openOffice(page)
      await expect(page.getByTestId('office-empty')).toHaveText("Nothing needs you. That's the goal.", SLOW)
      await expect(page.getByRole('tablist', { name: 'Office' })).toHaveCount(1)
      await expect(page.getByRole('tab')).toHaveCount(2)
      await expect(page.getByTestId('office-tab-requests')).toHaveCount(1)
      await expect(page.getByTestId('office-chip')).toHaveCount(0)
      await expect(page.getByTestId('office-cleared-today')).toHaveCount(0)
      await shot(page, '59-inbox-empty')
      await page.close()
    })

    test('admin sign-off: pending completion with a photo, thumbnail loads, lightbox opens, Escape closes the lightbox only, override reason enables Sign off, row leaves, pin patched; twice (59-09)', async () => {
      test.setTimeout(180_000)
      const first = await seedCompletion(workerId, 1)
      const second = await seedCompletion(workerId, 2)
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await openOffice(page)

      // First walk.
      const rowA = photosRow(page, 1)
      await expect(rowA).toHaveCount(1, SLOW)
      const panelA = await openSignOff(rowA)
      await expect(panelA.getByTestId('signoff-photo')).toHaveCount(1)
      await expectThumbnailLoads(rowA)
      await shot(page, '59-signoff-open')

      // The lightbox: Esc closes it and nothing else.
      await panelA.getByTestId('signoff-photo').first().click()
      const lightbox = page.locator('.yarl__root')
      await expect(lightbox).toBeVisible(SLOW)
      await shot(page, '59-signoff-lightbox')
      await page.keyboard.press('Escape')
      await expect(lightbox).toHaveCount(0, SLOW)
      await expect(page.getByTestId('shell-detail')).toHaveAttribute('data-place', '/?place=office')
      await expect(panelA).toBeVisible()

      // An admin who is not a signed-off assessor must give an override reason.
      const signOff = panelA.getByTestId('signoff-approve')
      const reason = panelA.getByTestId('signoff-override-reason')
      if ((await reason.count()) > 0) {
        await expect(signOff).toBeDisabled()
        await shot(page, '59-signoff-override')
        await reason.fill('Eval: signed off by the admin as an override.')
      }
      await expect(signOff).toBeEnabled(SLOW)
      await signOff.click()
      await expect(page.getByTestId('office-receipt')).toContainText(`Signed off${LEDGER}`, SLOW)
      await expect(rowA).toHaveCount(0, SLOW)
      await expect.poll(() => statusOf(first), SLOW).toBe('signed_off')
      await expect(async () => {
        const c = await pinAndTab(page)
        expect(c.pin).toBe(c.total)
      }).toPass(SLOW)

      // Second walk in the same pane session: its own photos, no stale panel.
      const rowB = photosRow(page, 2)
      await expect(rowB).toHaveCount(1, SLOW)
      const panelB = await openSignOff(rowB)
      await expect(panelB.getByTestId('signoff-photo')).toHaveCount(2, SLOW)
      await expectThumbnailLoads(rowB)
      const reasonB = panelB.getByTestId('signoff-override-reason')
      if ((await reasonB.count()) > 0) await reasonB.fill('Eval: second walk, also an admin override.')
      await expect(panelB.getByTestId('signoff-approve')).toBeEnabled(SLOW)
      await panelB.getByTestId('signoff-approve').click()
      await expect(rowB).toHaveCount(0, SLOW)
      await expect.poll(() => statusOf(second), SLOW).toBe('signed_off')
      expect(errors).toEqual([])
      await page.close()
    })

    test('supervisor sign-off: the supervised worker walk with a photo appears, a non-assessor sees the teaching callout and can reject; the unsupervised worker walk is absent (59-09)', async () => {
      test.setTimeout(180_000)
      const supervised = await seedCompletion(workerId, 1)
      await seedCompletion(worker2Id, 4)
      const page = await supervisorCtx.newPage()
      const errors = watchConsole(page)
      await openOffice(page)

      // A supervisor has the Inbox and Requests: a two-segment tab control, no chips, no cleared-today line.
      await expect(page.getByRole('tab')).toHaveCount(2, SLOW)
      await expect(page.getByTestId('office-chip')).toHaveCount(0)
      await expect(page.getByTestId('office-cleared-today')).toHaveCount(0)

      const row = photosRow(page, 1)
      await expect(row).toHaveCount(1, SLOW)
      // Success criterion 2: never a walk by a worker they do not supervise (by its photo count and its worker).
      await expect(photosRow(page, 4)).toHaveCount(0)
      await expect(page.getByTestId('office-pane')).not.toContainText(EVAL_SITE_WORKER2_EMAIL)
      await shot(page, '59-supervisor')

      const panel = await openSignOff(row)
      await expectThumbnailLoads(row)
      await shot(page, '59-supervisor-signoff')

      // The supervisor is not a signed-off assessor: the teaching callout, Request assessment, Sign off blocked.
      await expect(panel).toContainText('You need to be signed off on this SOP yourself before you can assess others on it.')
      await expect(panel.getByRole('button', { name: 'Request assessment' })).toBeVisible()
      await expect(panel.getByTestId('signoff-approve')).toBeDisabled()
      await expect(panel.getByTestId('signoff-reject')).toBeEnabled()
      await shot(page, '59-signoff-supervisor')

      // Reject keeps working for a non-assessor, with a reason of 10 or more characters.
      await panel.getByTestId('signoff-reject').click()
      const dialog = page.getByTestId('reason-dialog')
      await expect(dialog).toBeVisible(SLOW)
      await expect(dialog.getByTestId('reason-dialog-confirm')).toBeDisabled()
      await dialog.getByTestId('reason-dialog-field').fill('Eval: the guard was not closed in the photo.')
      await dialog.getByTestId('reason-dialog-confirm').click()
      await expect(page.getByTestId('office-receipt')).toContainText(`Rejected${LEDGER}`, SLOW)
      await expect(row).toHaveCount(0, SLOW)
      await expect.poll(() => statusOf(supervised), SLOW).toBe('rejected')
      expect(errors).toEqual([])
      await page.close()
    })

    test('supervisor owner marks reviewed on their own SOP (59-09)', async () => {
      assertEvalOrg()
      // A published SOP the supervisor owns, review overdue; reset on every run.
      const patch = {
        status: 'published',
        published_at: new Date().toISOString(),
        owner_user_id: supervisorId,
        review_due_at: new Date(Date.now() - 2 * DAY_MS).toISOString(),
      }
      const { data: existing } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).eq('title', OWNER_REVIEW_TITLE).maybeSingle()
      if (existing) {
        const up = await db.from('sops').update(patch).eq('id', existing.id)
        expect(up.error).toBeNull()
      } else {
        const ins = await db.from('sops').insert({
          organisation_id: siteOrgId,
          title: OWNER_REVIEW_TITLE,
          source_file_name: OWNER_REVIEW_TITLE,
          source_file_type: 'docx',
          source_file_path: '',
          uploaded_by: adminId,
          source_type: 'blank',
          version: 1,
          ...patch,
        })
        expect(ins.error).toBeNull()
      }

      const page = await supervisorCtx.newPage()
      await openOffice(page)
      const row = officeRow(page, OWNER_REVIEW_TITLE)
      await expect(row).toHaveCount(1, SLOW)
      const action = row.getByTestId('office-row-action')
      await expect(action).toHaveCount(1, SHORT)
      await expect(action).toHaveText('Mark reviewed')
      await action.click()
      await expect(page.getByTestId('office-receipt')).toContainText(`Marked reviewed${LEDGER}`, SLOW)
      await expect(row).toHaveCount(0, SLOW)
      await page.close()
    })

    test('reject with a reason; the worker then sees the walk as sent back; second iteration (59-09)', async () => {
      test.setTimeout(180_000)
      const workerPage = await workerCtx.newPage()
      // The card defaults to 0 until its query lands, so the expected number is read from the
      // database the way the card reads it: the worker's 50 newest completions, rejected ones counted.
      const sentBackInDb = async () => {
        const { data } = await db.from('sop_completions').select('status').eq('worker_id', workerId).order('submitted_at', { ascending: false }).limit(50)
        return (data ?? []).filter((r) => r.status === 'rejected').length
      }

      const rejected = await seedCompletion(workerId, 3)
      const page = await adminCtx.newPage()
      await openOffice(page)
      const row = photosRow(page, 3)
      await expect(row).toHaveCount(1, SLOW)
      const panel = await openSignOff(row)
      await panel.getByTestId('signoff-reject').click()
      const dialog = page.getByTestId('reason-dialog')
      await expect(dialog).toBeVisible(SLOW)
      await expect(dialog.getByTestId('reason-dialog-confirm')).toBeDisabled()
      await shot(page, '59-reject-dialog')
      await dialog.getByTestId('reason-dialog-field').fill('Eval: the lock is not visible in the photo.')
      await dialog.getByTestId('reason-dialog-confirm').click()
      await expect(page.getByTestId('office-receipt')).toContainText(`Rejected${LEDGER}`, SLOW)
      await expect(row).toHaveCount(0, SLOW)
      await expect.poll(() => statusOf(rejected), SLOW).toBe('rejected')
      await page.close()

      // The worker's own view counts it as sent back, not done.
      const expected = await sentBackInDb()
      expect(expected).toBeGreaterThan(0)
      await workerPage.goto('/?place=office')
      await expect(workerPage.getByText(`Sent back: ${expected}`, { exact: true })).toHaveCount(1, SLOW)
      await shot(workerPage, '59-worker-sent-back')
      await workerPage.close()
    })

    test('approve end to end and send back on a pending-approval SOP (59-09)', async () => {
      test.setTimeout(180_000)
      // The chain lives in each draft's snapshot (one admin step), so the org's real chain settings stay untouched.
      await seedApproveSop(APPROVE_BACK_TITLE)
      await seedApproveSop(APPROVE_PUBLISH_TITLE)
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await openOffice(page)

      // Send back, with a note.
      const back = officeRow(page, APPROVE_BACK_TITLE)
      await expect(back).toHaveCount(1, SLOW)
      const backAction = back.getByTestId('office-row-action')
      await expect(backAction).toHaveCount(1, SHORT)
      await expect(backAction).toHaveText('Approve')
      await backAction.click()
      const backPanel = back.getByTestId('approve-panel')
      await expect(backPanel).toBeVisible(SLOW)
      await expect(backPanel.getByTestId('approve-commit')).toHaveText(/Approve and publish v\d+/, SLOW)
      await shot(page, '59-approve-open')
      await backPanel.getByTestId('approve-send-back').click()
      const dialog = page.getByTestId('reason-dialog')
      await expect(dialog).toBeVisible(SLOW)
      await dialog.getByTestId('reason-dialog-field').fill('Eval: please add the isolation step first.')
      await dialog.getByTestId('reason-dialog-confirm').click()
      await expect(page.getByTestId('office-receipt')).toContainText(`Sent back${LEDGER}`, SLOW)
      await expect(back).toHaveCount(0, SLOW)

      // Approve the last step: published, or the publish gate refuses and the row stays with its reason.
      const pub = officeRow(page, APPROVE_PUBLISH_TITLE)
      await expect(pub).toHaveCount(1, SLOW)
      await pub.getByTestId('office-row-action').click()
      const commit = pub.getByTestId('approve-commit')
      await expect(commit).toBeEnabled(SLOW)
      await commit.click()
      let outcome = ''
      await expect(async () => {
        const receipt = (await page.getByTestId('office-receipt').textContent()) ?? ''
        const alert = (await pub.getByRole('alert').count()) > 0 ? ((await pub.getByRole('alert').first().textContent()) ?? '') : ''
        if (new RegExp(`Approved and published v\\d+${LEDGER}`).test(receipt)) outcome = 'published'
        else if (/v\d+ can't be published yet:/.test(alert)) outcome = 'refused-by-gate'
        expect(outcome).not.toBe('')
      }).toPass(SLOW)
      test.info().annotations.push({ type: 'approve-outcome', description: outcome })
      if (outcome === 'published') await expect(pub).toHaveCount(0, SLOW)
      else await expect(pub).toHaveCount(1)
      expect(errors).toEqual([])
      await page.close()
    })

    test('real org: inbox screenshot, read only, no writes (59-09)', async ({ page, context }) => {
      // Read-only: the real SOPstart org's admin looks at the Office; nothing is pressed.
      const errors = watchConsole(page)
      await signInAs(context, 'admin')
      await openOffice(page)
      await expect(page.getByTestId('office-tab-inbox')).toHaveCount(1, SLOW)
      await shot(page, '59-real-org-office')
      expect(errors).toEqual([])
    })

    test('decisions: wide pane, newest first, a kind chip narrows, absolute time on hover, the map re-centres (59-10)', async () => {
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await openOffice(page)
      const world = page.getByTestId('plant-world')
      const camera = async () => `${await world.getAttribute('data-scale')}|${await world.getAttribute('data-x')}`
      const detail = page.getByTestId('shell-detail')
      await expect(detail).toHaveAttribute('data-wide', 'false', SLOW)
      const inboxCamera = await camera()

      await page.getByTestId('office-tab-decisions').click()
      await expect(detail).toHaveAttribute('data-wide', 'true', SLOW)
      const rows = page.getByTestId('decisions-row')
      await expect(rows.first()).toBeVisible(SLOW)
      expect(await detail.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(560)
      // The earlier cases wrote sign-offs and owner changes into the shared eval org, so the ledger has rows.
      await expect.poll(() => rows.count(), SLOW).toBeGreaterThanOrEqual(2)

      const times = await rows.locator('time').evaluateAll((els) => els.map((e) => (e as HTMLTimeElement).dateTime))
      expect(new Date(times[0]).getTime()).toBeGreaterThanOrEqual(new Date(times[1]).getTime())
      await expect.poll(camera, SLOW).not.toBe(inboxCamera)

      // Hover a time: the absolute NZ date and time is its title.
      const firstTime = rows.first().locator('time')
      await firstTime.hover()
      await expect(firstTime).toHaveAttribute('title', /\d{1,2}:\d{2} (am|pm)/)
      await shot(page, '59-decisions-hover')

      // The Ownership chip leaves ownership words only.
      await page.locator('[data-testid="decisions-chip"][data-chip="ownership"]').click()
      const ownership = new Set(['Changed owner', 'Assigned', 'Unassigned'])
      await expect(rows.first()).toBeVisible(SLOW)
      await expect
        .poll(async () => (await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))).every((k) => ['owner_change', 'assign', 'unassign'].includes(k ?? '')), SLOW)
        .toBe(true)
      for (const w of await rows.locator('td:nth-child(3)').allTextContents()) expect(ownership.has(w.trim())).toBe(true)
      await shot(page, '59-decisions')

      // Show older appears only when another page exists; if it does, it adds rows.
      await page.locator('[data-testid="decisions-chip"][data-chip="all"]').click()
      await expect(rows.first()).toBeVisible(SLOW)
      const older = page.getByTestId('decisions-show-older')
      if (await older.count()) {
        const before = await rows.count()
        expect(before).toBe(50)
        await older.click()
        await expect.poll(() => rows.count(), SLOW).toBeGreaterThan(before)
      }
      expect(errors).toEqual([])
      await page.close()
    })
    test('people: wide pane, invite with a role, Invited chip, role change both ways, remove with confirmation (59-11)', async () => {
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await page.goto('/?place=office&tab=people')
      await expect(page.getByTestId('people-tab')).toHaveCount(1, SLOW)
      const detail = page.getByTestId('shell-detail')
      await expect(detail).toHaveAttribute('data-wide', 'true', SLOW)
      expect(await detail.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(560)

      // Rows are told apart by the address this run seeded, never by a count (shared org).
      const row = page.getByTestId('people-row').filter({ hasText: DISPOSABLE_EMAIL })
      await expect(row).toHaveCount(1, SLOW)
      await expect(row.getByTestId('people-role-select')).toBeVisible()
      await expect(row.getByText('No department')).toBeVisible()
      // One line at 1440: nowhere near two stacked lines of tap height.
      expect(await row.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(120)
      await shot(page, '59-people')

      // Invite: Send is disabled until the email is valid.
      await page.getByTestId('people-invite').click()
      const send = page.getByTestId('people-invite-send')
      await expect(send).toBeDisabled()
      await page.getByTestId('people-invite-email').fill('not-an-email')
      await expect(send).toBeDisabled()
      await page.getByTestId('people-invite-email').fill(INVITE_EMAIL)
      await expect(send).toBeEnabled()
      await shot(page, '59-people-invite')
      await send.click()
      const receipt = page.getByTestId('office-receipt')
      await expect(receipt).toContainText('Invite sent', SLOW)
      const invitedRow = page.getByTestId('people-row').filter({ hasText: INVITE_EMAIL })
      await expect(invitedRow).toHaveCount(1, SLOW)
      await expect(invitedRow).toContainText('Invited')
      await expect(invitedRow).toContainText('Waiting to accept')
      await expect(invitedRow.getByTestId('people-remove')).toHaveCount(0)

      // Role change on the disposable member, both ways in one session (state must not leak).
      const select = row.getByTestId('people-role-select')
      await select.selectOption('supervisor')
      await expect(receipt).toContainText('Role changed to Supervisor' + LEDGER, SLOW)
      await expect(select).toHaveValue('supervisor', SLOW)
      await select.selectOption('worker')
      await expect(receipt).toContainText('Role changed to Worker' + LEDGER, SLOW)
      await expect(select).toHaveValue('worker', SLOW)

      // Remove: Keep them leaves the row; Remove takes it away.
      const remove = row.getByTestId('people-remove')
      await expect(remove).toHaveCount(1, SHORT)
      await remove.click()
      const dialog = page.getByTestId('people-remove-dialog')
      await expect(dialog).toBeVisible(SLOW)
      await expect(dialog).toContainText(`Remove ${DISPOSABLE_EMAIL}?`)
      await page.getByTestId('people-remove-cancel').click()
      await expect(dialog).toHaveCount(0)
      await expect(row).toHaveCount(1)
      await remove.click()
      await page.getByTestId('people-remove-confirm').click()
      await expect(receipt).toContainText('Removed' + LEDGER, SLOW)
      await expect(row).toHaveCount(0, SLOW)
      expect(errors).toEqual([])
      await page.close()
    })

    test('people at 1024x768: the stacked layout, nothing clipped (59-11)', async () => {
      const page = await adminCtx.newPage()
      await page.setViewportSize({ width: 1024, height: 768 })
      await page.goto('/?place=office&tab=people')
      await expect(page.getByTestId('people-tab')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('people-invite')).toBeVisible(SLOW)
      const clipped = await page.getByTestId('shell-detail').evaluate((el) => el.scrollWidth > el.clientWidth + 1)
      expect(clipped).toBe(false)
      await shot(page, '59-people-1024')
      await page.close()
    })

    test('access: the wiring screen renders in the wide pane, the map re-centres, a sop address pins it (59-11)', async () => {
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await openOffice(page)
      const world = page.getByTestId('plant-world')
      const camera = async () => `${await world.getAttribute('data-scale')}|${await world.getAttribute('data-x')}`
      const inboxCamera = await camera()

      await page.getByTestId('office-tab-access').click()
      await expect(page.getByTestId('shell-detail')).toHaveAttribute('data-wide', 'true', SLOW)
      await expect(page.getByTestId('office-pane').locator('.bay')).toHaveCount(1, SLOW)
      await expect(world).toBeVisible()
      await expect.poll(camera, SLOW).not.toBe(inboxCamera)

      await page.goto(`/?place=office&tab=access&sop=${plantSopId}`)
      await expect(page.getByTestId('office-pane').locator('.bay')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('office-pane')).toContainText(EVAL_PLANT_SOP_TITLE, SLOW)
      await shot(page, '59-access')
      expect(errors).toEqual([])
      await page.close()
    })
    test('supervisor Office: Inbox and Requests only, a people tab address falls back to the inbox (59-13, 60-11)', async () => {
      const page = await supervisorCtx.newPage()
      const errors = watchConsole(page)
      for (const address of ['/?place=office', '/?place=office&tab=people', '/?place=office&tab=access', '/?place=office&tab=decisions']) {
        await page.goto(address)
        await expect(page.getByTestId('office-pane'), address).toHaveCount(1, SLOW)
        await expect(page.getByTestId('office-pane'), address).toHaveAttribute('data-tab', 'inbox', SLOW)
        await expect(page.getByRole('tab'), address).toHaveCount(2)
        await expect(page.getByTestId('office-chip'), address).toHaveCount(0)
        await expect(page.getByTestId('people-tab'), address).toHaveCount(0)
      }
      await shot(page, '59-supervisor')
      expect(errors).toEqual([])
      await page.close()
    })

    test('legacy addresses (governance, team, access with a sop, attention view) land on the right Office place; assert the rendered place, not the status (59-13)', async () => {
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      const cases: Array<{ from: string; place: string; tab: string; probe: string }> = [
        { from: '/governance', place: '/?place=office', tab: 'inbox', probe: 'office-tab-inbox' },
        { from: '/sops?view=attention', place: '/?place=office', tab: 'inbox', probe: 'office-tab-inbox' },
        { from: '/admin/team', place: '/?place=office&tab=people', tab: 'people', probe: 'people-tab' },
        { from: `/admin/access?sop=${plantSopId}`, place: `/?place=office&tab=access`, tab: 'access', probe: 'office-tab-access' },
      ]
      for (const c of cases) {
        await page.goto(c.from)
        await expect(page.getByTestId('office-pane'), c.from).toHaveCount(1, SLOW)
        await expect(page.getByTestId('office-pane'), c.from).toHaveAttribute('data-tab', c.tab, SLOW)
        await expect(page.getByTestId('shell-detail'), c.from).toHaveAttribute('data-place', c.place, SLOW)
        await expect(page.getByTestId(c.probe).first(), c.from).toBeVisible(SLOW)
        expect(new URL(page.url()).pathname, c.from).toBe('/')
      }
      // an address pinned to a SOP carries it through to the Access tab
      await page.goto(`/admin/access?sop=${plantSopId}`)
      await expect(page.getByTestId('office-pane')).toContainText(EVAL_PLANT_SOP_TITLE, SLOW)
      // the retired library scope goes to the site itself: no Office pane at all
      await page.goto('/governance?view=library')
      await expect(page.getByTestId('plant-world')).toBeVisible(SLOW)
      await expect(page.getByTestId('office-pane')).toHaveCount(0)
      // a sop value that is not an id is dropped, not carried
      await page.goto('/admin/access?sop=not-an-id')
      await expect(page.getByTestId('office-pane')).toHaveAttribute('data-tab', 'access', SLOW)
      expect(new URL(page.url()).search).not.toContain('not-an-id')
      await shot(page, '59-legacy-redirects')
      expect(errors).toEqual([])
      await page.close()
    })

    test('the training bridge: the Smoko room links it, the matrix renders, Back returns to the Smoko room (59-13)', async () => {
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await page.goto('/?place=smoko')
      const link = page.getByRole('link', { name: 'Training matrix' })
      await expect(link).toHaveCount(1, SLOW)
      await link.click()
      await expect(page).toHaveURL(/\/admin\/training$/, SLOW)
      await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible(SLOW)
      await shot(page, '59-training-bridge')
      await page.getByTestId('back-to-site').locator('a').click()
      await expect(page).toHaveURL(/place=smoko/, SLOW)
      expect(errors).toEqual([])
      await page.close()
    })
    test('a non-owner completion address lands on the Office; the walker still sees their own (59-15)', async () => {
      test.setTimeout(180_000)
      const completionId = await seedCompletion(workerId, 1)
      // The supervisor is not the walker: the server page sends them to the Office inbox (content, not status).
      const page = await supervisorCtx.newPage()
      const errors = watchConsole(page)
      await page.goto(`/activity/${completionId}`)
      await expect(page.getByTestId('office-pane')).toHaveCount(1, SLOW)
      await expect(page).toHaveURL(/place=office/, SLOW)
      await expect(page.getByText('Completion Detail')).toHaveCount(0)
      await shot(page, '59-completion-non-owner')
      expect(errors).toEqual([])
      await page.close()

      // The walker opens their own completion: steps and status, no sign-off controls.
      const workerPage = await workerCtx.newPage()
      await workerPage.goto(`/activity/${completionId}`)
      await expect(workerPage.getByText('Completion Detail')).toBeVisible(SLOW)
      await expect(workerPage.getByTestId('signoff-approve')).toHaveCount(0)
      await shot(workerPage, '59-completion-owner')
      await workerPage.close()
    })
  })
})
