/**
 * Deployed-site eval -- Phase 56 "A simpler SOP + the decision ledger".
 *
 * Provision fixtures first: `node scripts/eval-fixtures.mjs`. Runs via
 * `npm run eval -- --phase 56` against EVAL_BASE_URL.
 *
 * Writes only to the isolated "SOPstart Eval Site" org, never the real SOPstart
 * org. Decisions it writes are permanent by design (the ledger refuses UPDATE and
 * DELETE for every role) and live in the eval-site org.
 *
 * Two minted sessions for the whole file (admin + worker) -- one shared OTP budget.
 * Self-skips when EVAL_BASE_URL is unset so the normal suite never touches production.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import {
  EVAL_BASE_URL,
  EVAL_ENV_READY,
  EVAL_CONVERT_SOP_TITLE,
  EVAL_WALK_SOP_TITLE,
  EVAL_PLANT_SOP_TITLE,
  EVAL_SITE_SOP_TITLE,
  signInAs,
} from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'

export const SLOW = { timeout: 25_000 }
const STD = 'EVAL LOTO'
const STD2 = 'EVAL LOTO 2'
// SOPs the converter legitimately could not convert (56-07-SUMMARY.md: "Needs Simon: none").
const NEEDS_SIMON_TITLES: string[] = []

test.describe.serial('Phase 56 -- simpler SOP + decision ledger (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) -- run via `npm run eval`')

  let db: SupabaseClient
  let siteOrgId: string
  let startedAt: string
  let adminCtx: BrowserContext
  let workerCtx: BrowserContext
  let adminId: string
  let workerId: string
  let siteDraftSopId: string
  const sopIds: Record<'convert' | 'walk' | 'plant', string> = { convert: '', walk: '', plant: '' }

  const cleanupStandards = async () => {
    if (!db || !siteOrgId) return
    await db.from('standards').delete().eq('organisation_id', siteOrgId).like('name', 'EVAL LOTO%')
  }

  test.beforeAll(async ({ browser }) => {
    if (!EVAL_ENV_READY) return
    startedAt = new Date().toISOString()
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    const fixture = await ensurePlantFixture(db)
    siteOrgId = fixture.siteOrgId
    if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')

    for (const [key, title] of [
      ['convert', EVAL_CONVERT_SOP_TITLE],
      ['walk', EVAL_WALK_SOP_TITLE],
      ['plant', EVAL_PLANT_SOP_TITLE],
    ] as const) {
      const { data, error } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).eq('title', title).maybeSingle()
      if (error || !data) throw new Error(`"${title}" not found in the eval-site org -- run node scripts/eval-fixtures.mjs`)
      sopIds[key] = data.id
    }
    const { data: draft, error: draftErr } = await db
      .from('sops')
      .select('id')
      .eq('organisation_id', siteOrgId)
      .eq('title', EVAL_SITE_SOP_TITLE)
      .maybeSingle()
    if (draftErr || !draft) throw new Error(`"${EVAL_SITE_SOP_TITLE}" not found in the eval-site org`)
    siteDraftSopId = draft.id

    await cleanupStandards()
    await deleteEvalCompletions(db, sopIds.walk)

    const opts = { viewport: { width: 1440, height: 900 }, baseURL: EVAL_BASE_URL }
    adminCtx = await browser.newContext(opts)
    workerCtx = await browser.newContext(opts)
    adminId = (await signInAs(adminCtx, 'siteAdmin')).user.id
    workerId = (await signInAs(workerCtx, 'siteWorker')).user.id
  })

  test.afterAll(async () => {
    if (!EVAL_ENV_READY) return
    await cleanupStandards()
    if (sopIds.plant) await db.from('sops').update({ owner_user_id: null }).eq('id', sopIds.plant)
    if (sopIds.walk) await deleteEvalCompletions(db, sopIds.walk)
    if (siteDraftSopId) await db.from('sops').update({ title: EVAL_SITE_SOP_TITLE }).eq('id', siteDraftSopId)
    await adminCtx?.close()
    await workerCtx?.close()
  })

  /** Worker opens the SOP (browse state of the focus screen) and returns the standard labels in its summary card. */
  const workerLabels = async (page: Page, sopId: string) => {
    await page.goto(`/sops/${sopId}`)
    await expect(page.getByTestId('focus-summary')).toBeVisible(SLOW)
    return page.getByTestId('focus-summary').getByTestId('standard-label').allInnerTexts()
  }

  test('A -- every SOP has an ok conversion run; convert fixture counts match the known answer; library-linked SOPs converted', async () => {
    const { data: sops, error: sopsErr } = await db.from('sops').select('id, title, created_at').limit(5000)
    expect(sopsErr).toBeNull()
    const { data: runs, error: runsErr } = await db
      .from('sop_conversion_runs')
      .select('sop_id, ok, before, after, created_at')
      .order('created_at', { ascending: false })
      .limit(20000)
    expect(runsErr).toBeNull()
    const latest = new Map<string, { ok: boolean; before: Record<string, number>; after: Record<string, number> }>()
    for (const r of runs ?? []) if (!latest.has(r.sop_id as string)) latest.set(r.sop_id as string, r as never)

    // The converter runs on demand until Phase 58: a SOP created after the last run (a live probe
    // spec's throwaway org, a real upload) is not yet converted and is out of scope here.
    const lastRunAt = (runs ?? [])[0]?.created_at as string
    const inScope = (sops ?? []).filter((s) => (s.created_at as string) <= lastRunAt)
    // 'EVAL focus ...' are Phase 58 fixtures: editor-native (new:/edit: keys) or still parsing, which the retired
    // converter leaves alone by rule, so they never get a run row (58-18).
    const bad = inScope.filter(
      (s) => !NEEDS_SIMON_TITLES.includes(s.title as string) && !((s.title as string | null) ?? '').startsWith('EVAL focus') && !latest.get(s.id as string)?.ok,
    )
    expect(bad.map((s) => s.title), 'SOPs without an ok conversion run').toEqual([])
    console.log(`A: ${inScope.length} of ${sops?.length} SOPs predate the last run; all have an ok latest run`)

    const { data: steps, error: stepsErr } = await db
      .from('sop_focus_steps')
      .select('kind, text, sort_order, section_id, photo_required')
      .eq('sop_id', sopIds.convert)
    expect(stepsErr).toBeNull()
    const count = (k: string) => (steps ?? []).filter((s) => s.kind === k).length
    expect(count('hazard')).toBe(4)
    expect(count('ppe')).toBe(1)
    expect(count('check')).toBe(1)
    const ppe = (steps ?? []).find((s) => s.kind === 'ppe')!
    expect(ppe.text).toContain('Safety glasses')
    expect(ppe.text).toContain('Cut-resistant gloves')
    expect((steps ?? []).filter((s) => s.photo_required).length).toBe(1)

    const by = (text: string) => (steps ?? []).find((s) => (s.text as string).includes(text))!
    const stored = by('Stored energy')
    const isolate = by('Isolate the press.')
    const guard = by('Do not reach past the guard')
    const photo = by('Photograph the isolation lock.')
    expect(stored.section_id).toBe(isolate.section_id)
    expect(stored.sort_order).toBeLessThan(isolate.sort_order)
    expect(guard.section_id).toBe(photo.section_id)
    expect(guard.sort_order).toBeLessThan(photo.sort_order)

    const run = latest.get(sopIds.convert)!
    expect(run.after.hazard).toBeGreaterThanOrEqual(run.before.hazardSources)

    // Library-linked content: a junction whose block is not a parsed_inline one.
    const { data: junctions, error: jErr } = await db
      .from('sop_section_blocks')
      .select('blocks(category), sop_sections(sop_id)')
      .limit(20000)
    expect(jErr).toBeNull()
    const linkedSops = new Set<string>()
    for (const j of (junctions ?? []) as unknown as { blocks: { category: string | null } | null; sop_sections: { sop_id: string } | null }[]) {
      if (j.blocks?.category !== 'parsed_inline' && j.sop_sections) linkedSops.add(j.sop_sections.sop_id)
    }
    const inScopeIds = new Set(inScope.map((s) => s.id as string))
    const unconverted = [...linkedSops].filter((id) => inScopeIds.has(id) && !latest.get(id)?.ok)
    expect(unconverted).toEqual([])
    console.log(`A: ${linkedSops.size} library-linked SOPs, all converted`)
  })

  test('B -- the focus screen (browse) and the editor render the converted fixture', async () => {
    const page = await workerCtx.newPage()
    const errors = watchConsole(page)
    await page.goto(`/sops/${sopIds.convert}`)
    const browse = page.getByTestId('focus-browse')
    await expect(browse).toBeVisible(SLOW)
    await expect(browse.getByText('Pinch point at the rollers.')).toHaveCount(1, SLOW)
    await expect(browse.getByText('Hot surface on the oven door.')).toHaveCount(1)
    await expect(browse.getByText('Safety glasses').first()).toBeVisible(SLOW)
    await expect(browse.getByText('Cut-resistant gloves').first()).toBeVisible(SLOW)
    await expect(browse.getByText('Isolate the press.')).toHaveCount(1)
    await expect(browse.getByText('Photograph the isolation lock.')).toHaveCount(1)
    // Hazards and PPE come first in walking order (D-07).
    const kinds = await browse.getByTestId('focus-browse-step').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
    // Source order within them: the PPE card sits between the hazards of its own section, so assert the group, not the sequence.
    expect([...kinds.slice(0, 5)].sort()).toEqual(['hazard', 'hazard', 'hazard', 'hazard', 'ppe'])
    expect(['hazard', 'ppe']).not.toContain(kinds[5])
    await shot(page, 'ledger-b-browse')
    expect(errors, errors.join('\n')).toEqual([])
    await page.close()

    const admin = await adminCtx.newPage()
    await admin.goto(`/sops/${sopIds.convert}?mode=edit`)
    // The editor lists every section in one document, converted steps included.
    await expect(admin.getByTestId('edit-document')).toBeVisible({ timeout: 40_000 })
    await expect(admin.getByText('Pinch point at the rollers.').first()).toBeVisible(SLOW)
    await shot(admin, 'ledger-b-editor-hazards')
    await expect(admin.getByText('Hydraulic pressure').first()).toBeVisible(SLOW)
    await expect(admin.getByText('Stored energy in the hydraulic line.').first()).toBeVisible(SLOW)
    await shot(admin, 'ledger-b-editor')
    await admin.close()
  })

  test('C -- standards: add, attach to the SOP and a section, worker sees the label, rename, remove', async () => {
    test.setTimeout(240_000)
    const admin = await adminCtx.newPage()
    const worker = await workerCtx.newPage()
    await admin.goto(`/sops/${sopIds.convert}?mode=edit`)
    const addStandard = admin.getByTestId('this-sop').getByRole('button', { name: '+ Standard' })
    await expect(addStandard).toHaveCount(1, { timeout: 40_000 })
    await addStandard.click()
    const panel = admin.getByTestId('standards-panel')
    await expect(panel).toBeVisible(SLOW)

    await panel.getByTestId('standard-add-input').fill(STD)
    await panel.getByTestId('standard-add').click()
    const row = (name: string) => panel.locator(`[data-testid="standard-row"][data-standard-name="${name}"]`)
    await expect(row(STD)).toHaveCount(1, SLOW)

    const sopToggle = panel.locator(`[data-testid="standard-toggle"][data-target-kind="sop"][data-standard-name="${STD}"]`)
    await expect(sopToggle).toHaveCount(1, { timeout: 10_000 })
    await sopToggle.click()
    await expect(sopToggle).toHaveAttribute('aria-pressed', 'true', SLOW)
    const sectionToggle = panel.locator(
      `xpath=//span[normalize-space()="Procedure"]/following-sibling::div[1]//button[@data-target-kind="section" and @data-standard-name="${STD}"]`
    )
    await expect(sectionToggle).toHaveCount(1, { timeout: 10_000 })
    await sectionToggle.click()
    await expect(sectionToggle).toHaveAttribute('aria-pressed', 'true', SLOW)
    await expect(panel.getByText('Saved ✓')).toBeVisible(SLOW)
    await shot(admin, 'ledger-c-panel')

    // Worker sees it on the SOP summary and on the section heading of the focus screen's browse state.
    await expect(async () => {
      expect(await workerLabels(worker, sopIds.convert)).toContain(STD)
    }).toPass(SLOW)
    await expect(
      worker.locator('h2').filter({ hasText: 'Procedure' }).filter({ has: worker.getByTestId('standard-label') }).first()
    ).toBeVisible(SLOW)
    await shot(worker, 'ledger-c-worker-read')

    // Rename.
    await row(STD).getByRole('button', { name: 'Rename', exact: true }).click()
    await panel.getByLabel(`Rename ${STD}`).fill(STD2)
    await panel.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(row(STD2)).toHaveCount(1, SLOW)
    await expect(async () => {
      const labels = await workerLabels(worker, sopIds.convert)
      expect(labels).toContain(STD2)
      expect(labels).not.toContain(STD)
    }).toPass(SLOW)
    await shot(worker, 'ledger-c-worker-renamed')

    // Remove (two-step confirm).
    await row(STD2).getByRole('button', { name: 'Remove', exact: true }).click()
    await row(STD2).getByRole('button', { name: /^Remove —/ }).click()
    await expect(row(STD2)).toHaveCount(0, SLOW)
    await expect(async () => {
      const labels = await workerLabels(worker, sopIds.convert)
      expect(labels.filter((l) => l.startsWith(STD))).toEqual([])
    }).toPass(SLOW)
    await shot(worker, 'ledger-c-worker-removed')
    await admin.close()
    await worker.close()
  })

  test('D -- placement: machine + department, or Whole site', async () => {
    const page = await workerCtx.newPage()
    await page.goto(`/sops/${sopIds.plant}`)
    const meta = page.getByTestId('sop-meta')
    await expect(meta).toContainText('EVAL Press', SLOW)
    await expect(meta).toContainText('Forming')
    await shot(page, 'ledger-d-machine')
    await page.goto(`/sops/${sopIds.walk}`)
    await expect(page.getByTestId('sop-meta')).toContainText('Whole site', SLOW)
    await shot(page, 'ledger-d-whole-site')
    await page.close()
  })

  test('E -- owner change, completion reject and an AI write each write one decision; the AI one names the agent', async () => {
    test.setTimeout(240_000)
    const since = async (filter: Record<string, string>) => {
      let q = db.from('decisions').select('*').eq('organisation_id', siteOrgId).gte('created_at', startedAt)
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v)
      const { data, error } = await q
      expect(error).toBeNull()
      return data ?? []
    }

    // (1) owner change through the Office inbox
    const { error: resetErr } = await db.from('sops').update({ owner_user_id: null }).eq('id', sopIds.plant)
    expect(resetErr).toBeNull()
    const { data: readBack } = await db.from('sops').select('owner_user_id').eq('id', sopIds.plant).single()
    expect(readBack?.owner_user_id).toBeNull()

    const admin = await adminCtx.newPage()
    await admin.goto('/?place=office')
    const fixtureRow = admin.getByTestId('office-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
    await expect(fixtureRow).toHaveCount(1, SLOW)
    await fixtureRow.getByTestId('office-row-action').click()
    // The popover labels people by name or by role, so pick the first member option (the plant SOP is unowned).
    const options = fixtureRow.locator('ul button')
    await expect(options.nth(1)).toBeVisible(SLOW)
    await options.nth(1).click()
    await expect(async () => {
      const rows = await since({ kind: 'owner_change', sop_id: sopIds.plant })
      expect(rows.length).toBe(1)
      expect(rows[0].actor_id).toBe(adminId)
      expect(rows[0].actor_kind).toBe('person')
    }).toPass(SLOW)
    await shot(admin, 'ledger-e-owner')

    // (2) completion rejection through the Office inbox sign-off row (59-15: no page of its own)
    const completionId = randomUUID()
    const { error: insErr } = await db.from('sop_completions').insert({
      id: completionId,
      organisation_id: siteOrgId,
      sop_id: sopIds.walk,
      worker_id: workerId,
      sop_version: 1,
      content_hash: 'eval-ledger',
      status: 'pending_sign_off',
      step_data: {},
    })
    expect(insErr).toBeNull()
    await admin.goto('/?place=office')
    const signOffRow = admin.locator(`[data-testid="office-row"][data-key="signoff-${completionId}"]`)
    await expect(signOffRow).toHaveCount(1, { timeout: 40_000 })
    await signOffRow.getByTestId('office-row-action').click()
    await signOffRow.getByTestId('signoff-reject').click()
    const dialog = admin.getByTestId('reason-dialog')
    await expect(dialog).toBeVisible(SLOW)
    await dialog.getByTestId('reason-dialog-field').fill('Eval: the guard was not closed in the photo.')
    await dialog.getByTestId('reason-dialog-confirm').click()
    await expect(async () => {
      const rows = await since({ kind: 'reject', subject_kind: 'completion', subject_id: completionId })
      expect(rows.length).toBe(1)
      expect(rows[0].actor_id).toBe(adminId)
    }).toPass(SLOW)
    await shot(admin, 'ledger-e-reject')

    // (3) AI field write through the agent endpoint
    const res = await admin.request.post('/api/ai-fields/write', {
      data: {
        fieldId: 'sop.title',
        context: { organisationId: siteOrgId, sopId: siteDraftSopId },
        newValue: 'Eval site fixture SOP (agent edit)',
        agentName: 'SOPstart assistant',
      },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).result.outcome).toBe('applied')
    await expect(async () => {
      const rows = await since({ kind: 'ai_field_write', sop_id: siteDraftSopId })
      expect(rows.length).toBe(1)
      expect(rows[0].actor_kind).toBe('agent')
      expect(rows[0].actor_name).toBe('SOPstart assistant')
    }).toPass(SLOW)
    await db.from('sops').update({ title: EVAL_SITE_SOP_TITLE }).eq('id', siteDraftSopId)
    await admin.close()
  })

  test('F -- ledger is non-empty, refuses service-key update and delete, refuses an unnamed agent', async () => {
    const { count, error } = await db.from('decisions').select('id', { count: 'exact', head: true }).eq('source', 'backfill')
    expect(error).toBeNull()
    expect(count ?? 0).toBeGreaterThan(0)

    const { data: oldest } = await db
      .from('decisions')
      .select('id, summary, created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    expect(oldest).toBeTruthy()

    const upd = await db.from('decisions').update({ summary: 'tampered' }).eq('id', oldest!.id)
    expect(upd.error).not.toBeNull()
    const del = await db.from('decisions').delete().eq('id', oldest!.id)
    expect(del.error).not.toBeNull()
    const { data: after } = await db.from('decisions').select('summary, created_at').eq('id', oldest!.id).single()
    expect(after).toEqual({ summary: oldest!.summary, created_at: oldest!.created_at })

    const unnamed = await db.from('decisions').insert({
      organisation_id: siteOrgId,
      kind: 'verify',
      actor_kind: 'agent',
      actor_name: null,
      subject_kind: 'probe',
      summary: 'eval unnamed agent probe',
    })
    expect(unnamed.error?.code).toBe('23514')
  })
})
