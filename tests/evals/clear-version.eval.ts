/**
 * Deployed-site eval -- ADR-0015: a SOP's clear version sits beside the version as written. Workers
 * see it only after an admin approves it; Read always opens on "As written".
 *
 * Fixture: the eval-site walk SOP, given a small seeded clear version (no AI call) before the run and
 * cleared after. Eval-site org only. Self-skips without EVAL_BASE_URL.
 */
import { test, expect, type Browser } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_WALK_SOP_TITLE, signInAs, type EvalRole } from './lib/session'
import { ensurePlantFixture, shot } from './lib/plant-fixture'
import { ensureLibraryAreas } from './lib/library-fixture'

const SLOW = { timeout: 30_000 }
const PHONE = { width: 390, height: 844 }
const CLEAR_STEP = 'Eval clear version: switch the press off at the panel before you reach in.'

async function open(browser: Browser, role: EvalRole, sopId: string) {
  const ctx = await browser.newContext({ viewport: PHONE, baseURL: process.env.EVAL_BASE_URL })
  await signInAs(ctx, role)
  const page = await ctx.newPage()
  await page.goto(`/?sop=${sopId}`)
  await expect(page.getByTestId('read-start')).toBeVisible(SLOW)
  return { ctx, page }
}

test.describe.serial('ADR-0015 -- direct translation and clear version (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient
  let sopId: string

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await ensurePlantFixture(db)
    const lib = await ensureLibraryAreas(db)
    const { data: walk } = await db.from('sops').select('id').eq('organisation_id', lib.siteOrgId).eq('title', EVAL_WALK_SOP_TITLE).maybeSingle()
    if (!walk) throw new Error(`"${EVAL_WALK_SOP_TITLE}" not found -- run node scripts/eval-fixtures.mjs`)
    sopId = walk.id as string
    const clear = {
      model: 'eval-seed',
      createdAt: new Date().toISOString(),
      sections: [
        { type: 'hazards', title: 'Hazards', content: 'Moving parts', steps: [] },
        { type: 'procedure', title: 'Make safe', content: null, steps: [{ text: CLEAR_STEP, warning: 'Crush injury from moving parts', caution: null, tip: null, image_paths: [] }] },
      ],
      changes: [],
      openItems: ['Step 1: the source does not say how to restart the press.'],
      orderLocked: [],
      check: { model: 'eval-seed', passed: false, issues: [{ severity: 'major', kind: 'altered', direct: 'Isolate the press', clear: CLEAR_STEP, note: 'Eval seeded point to look at.' }] },
    }
    const { error } = await db.from('sops').update({ clear_version: clear, clear_approved_at: null, clear_approved_by: null }).eq('id', sopId)
    if (error) throw new Error(error.message)
  })

  test.afterAll(async () => {
    if (EVAL_ENV_READY && db && sopId) await db.from('sops').update({ clear_version: null, clear_approved_at: null, clear_approved_by: null }).eq('id', sopId)
  })

  test('CLEAR-01 a worker does not see an unapproved clear version', async ({ browser }) => {
    const { ctx, page } = await open(browser, 'siteWorker', sopId)
    try {
      await expect(page.getByTestId('read-steps')).toBeVisible(SLOW)
      await expect(page.getByTestId('read-version')).toHaveCount(0)
    } finally {
      await ctx.close()
    }
  })

  test('CLEAR-02 an admin reads the clear version with its check and gaps, then approves it', async ({ browser }) => {
    const { ctx, page } = await open(browser, 'siteAdmin', sopId)
    try {
      await expect(page.getByTestId('read-version-direct')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('read-version-clear')).toContainText('not approved')
      await page.getByTestId('read-version-clear').click()
      await expect(page.getByTestId('clear-view')).toBeVisible(SLOW)
      await expect(page.getByTestId('clear-check')).toContainText('Eval seeded point to look at.')
      await expect(page.getByTestId('clear-open-items')).toContainText('1 gap for the document owner')
      await expect(page.getByTestId('clear-step')).toContainText(CLEAR_STEP)
      await shot(page, 'clear-01-admin-unapproved')
      await page.getByTestId('clear-approve').click()
      await expect(page.getByTestId('clear-withdraw')).toBeVisible(SLOW)
      await expect(page.getByTestId('clear-review')).toContainText('Workers can read this clear version')
      await shot(page, 'clear-02-admin-approved')
    } finally {
      await ctx.close()
    }
    const { data } = await db.from('decisions').select('kind').eq('subject_kind', 'clear_version').eq('subject_id', sopId).order('created_at', { ascending: false }).limit(1)
    expect(data?.[0]?.kind).toBe('approve')
  })

  test('CLEAR-03 once approved, a worker opens on As written and the clear version is one tap away', async ({ browser }) => {
    const { ctx, page } = await open(browser, 'siteWorker', sopId)
    try {
      await expect(page.getByTestId('read-version-direct')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('read-steps')).toBeVisible(SLOW)
      await expect(page.getByTestId('read-version-clear')).not.toContainText('not approved')
      await page.getByTestId('read-version-clear').click()
      await expect(page.getByTestId('clear-step')).toContainText(CLEAR_STEP)
      await expect(page.getByTestId('clear-review')).toHaveCount(0)
      await shot(page, 'clear-03-worker-clear')
    } finally {
      await ctx.close()
    }
  })
})
