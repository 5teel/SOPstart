/**
 * Deployed-site eval -- Phase 59 "The Office".
 *
 * 59-07 owns the owner / review meta case; 59-09 owns the inbox, sign-off (admin and
 * supervisor), owner-review, reject and approve cases below; the later cases are still
 * test.fixme and name the plan that flips each one live. 59-16 runs the lot
 * (`npm run eval -- --phase 59`) after 59-12 mounts the pane, and reads every
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

const officeRow = (page: Page, title: string | RegExp) => page.getByTestId('office-row').filter({ hasText: title })
/** Sign-off rows share one SOP title, so each is told apart by its photo count: "1 photo", "2 photos", ... */
const photosRow = (page: Page, n: number) =>
  officeRow(page, EVAL_WALK_SOP_TITLE).filter({ hasText: new RegExp(`\\b${n} photos?\\b`) })

/** The Office room pin text and the Inbox tab count text ('' when either is absent, i.e. nothing waiting). */
async function pinAndTab(page: Page) {
  const read = async (l: Locator) => ((await l.count()) ? ((await l.first().textContent()) ?? '').trim() : '')
  return {
    pin: await read(page.locator('[data-testid="shell-room-row"][data-room-id="office"] .mono')),
    tab: await read(page.getByTestId('office-tab-inbox').locator('.mono')),
  }
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
        expect(c.pin).toBe(c.tab)
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
        expect(c.pin).toBe(c.tab)
      }).toPass(SLOW)
      await shot(page, '59-receipt')
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
        expect(c.pin).toBe(c.tab)
      }).toPass(SLOW)
      await page.close()
    })

    test('idle supervisor: a true empty inbox reads "Nothing needs you. That\'s the goal." with no tab control, chips or cleared-today line (59-09)', async () => {
      const page = await idleCtx.newPage()
      await openOffice(page)
      await expect(page.getByTestId('office-empty')).toHaveText("Nothing needs you. That's the goal.", SLOW)
      await expect(page.getByRole('tablist')).toHaveCount(0)
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
        expect(c.pin).toBe(c.tab)
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

      // A supervisor has the Inbox alone: no tab control, no chips, no cleared-today line.
      await expect(page.getByRole('tablist')).toHaveCount(0)
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
      const sentBack = async (p: Page) => {
        await p.goto('/?place=office')
        const line = p.getByText(/^Sent back: \d+$/)
        await expect(line).toHaveCount(1, SLOW)
        return Number(((await line.textContent()) ?? '').replace(/\D/g, ''))
      }
      const workerPage = await workerCtx.newPage()
      const before = await sentBack(workerPage)

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
      expect(await sentBack(workerPage)).toBe(before + 1)
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

    test.fixme('decisions: wide pane, newest first, a kind chip narrows, Show older only past 50 (59-10)', async () => {})
    test.fixme('people: wide pane, invite with a role, Invited chip, role change, remove with confirmation (59-11)', async () => {})
    test.fixme('access: the wiring screen renders in the wide pane and the map re-centres (data-scale changes) (59-11)', async () => {})
    test.fixme('supervisor Office: inbox tab only, a people tab address falls back to the inbox (59-13)', async () => {})
    test.fixme('legacy addresses (governance, team, access with a sop, attention view) land on the right Office place; assert the rendered place, not the status (59-13)', async () => {})
    test.fixme('a non-owner completion address lands on the Office (59-15)', async () => {})
  })
})
