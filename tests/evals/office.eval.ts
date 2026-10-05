/**
 * Deployed-site eval -- Phase 59 "The Office" (skeleton; Wave 0 / 59-01).
 *
 * One test.fixme per case, each naming the plan that flips it live. 59-16 runs
 * the lot (`npm run eval -- --phase 59`) and reads every screenshot before
 * declaring a pass. Replaces the governance eval (deleted by 59-14).
 *
 * Fixtures come from `node scripts/eval-fixtures.mjs` in the isolated
 * "SOPstart Eval Site" org: eval-site admin, worker, supervisor (supervises the
 * worker), an idle supervisor (supervises nobody, owns nothing: its inbox is
 * empty by construction) and a second worker nobody supervises (a walk seeded
 * for it must never reach a supervisor's inbox).
 *
 * Rules (CLAUDE.md Learnings):
 *  - assert by NAME, never a total count: the eval-site org is shared with
 *    sibling evals (2026-09-29);
 *  - every assertion after a fresh navigation carries SLOW (2026-09-29);
 *  - toHaveCount(1) with a short timeout BEFORE a click (2026-09-28);
 *  - exercise every flow TWICE in one session: state can leak between records
 *    (2026-10-03);
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
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_PLANT_SOP_TITLE, EVAL_SITE_SOP_TITLE, signInAs } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'

export const SLOW = { timeout: 30_000 }

test.describe('Phase 59 -- the Office (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')
  test.use({ viewport: { width: 1440, height: 900 } })

  test.describe.serial('office cases', () => {
    let db: SupabaseClient
    let siteOrgId: string
    let plantSopId: string
    let siteAdminId: string

    test.beforeAll(async () => {
      if (!EVAL_ENV_READY) return
      db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const fixture = await ensurePlantFixture(db)
      siteOrgId = fixture.siteOrgId
      plantSopId = fixture.plantSopId
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')
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
    test.fixme('inbox: tabs, count equals the pin, the unowned row has Assign owner, assigning clears it by title and the receipt ends "logged in the decision ledger" (59-09)', async () => {})
    test.fixme('inbox: Mark reviewed on an overdue row clears it (59-09)', async () => {})
    test.fixme('idle supervisor: a true empty inbox reads "Nothing needs you. That\'s the goal." with a cleared-today number (59-09)', async () => {})
    test.fixme('admin sign-off: pending completion with a photo, thumbnail loads, lightbox opens, Escape closes the lightbox only, override reason enables Sign off, row leaves, pin patched; twice (59-09)', async () => {})
    test.fixme('supervisor sign-off: the supervised worker walk with a photo appears, a non-assessor sees the teaching callout and can reject; the unsupervised worker walk is absent (59-09)', async () => {})
    test.fixme('supervisor owner marks reviewed on their own SOP (59-09)', async () => {})
    test.fixme('reject with a reason; the worker then sees the SOP as not done; second iteration (59-09)', async () => {})
    test.fixme('approve end to end and send back on a pending-approval SOP (59-09)', async () => {})
    test.fixme('real org: inbox screenshot, read only, no writes (59-09)', async () => {})
    test.fixme('decisions: wide pane, newest first, a kind chip narrows, Show older only past 50 (59-10)', async () => {})
    test.fixme('people: wide pane, invite with a role, Invited chip, role change, remove with confirmation (59-11)', async () => {})
    test.fixme('access: the wiring screen renders in the wide pane and the map re-centres (data-scale changes) (59-11)', async () => {})
    test.fixme('supervisor Office: inbox tab only, a people tab address falls back to the inbox (59-13)', async () => {})
    test.fixme('legacy addresses (governance, team, access with a sop, attention view) land on the right Office place; assert the rendered place, not the status (59-13)', async () => {})
    test.fixme('a non-owner completion address lands on the Office (59-15)', async () => {})
  })
})
