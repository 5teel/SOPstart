/**
 * Deployed-site eval -- Phase 63 "SOP-first home". Skeleton (63-01): every case is
 * test.fixme until its owning plan fills it (63-12 runs the first deployed pass and
 * reads every screenshot). Runs via `npm run eval -- --phase 63`.
 *
 * Fixtures: `ensurePlantFixture` (machine-linked Forming SOP) plus
 * `ensureLibraryAreas` (two departments and a site-wide SOP) in the isolated
 * "SOPstart Eval Site" org. Assert by NAME, never a total count (CLAUDE.md 2026-09-29).
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY } from './lib/session'
import { ensurePlantFixture } from './lib/plant-fixture'
import { ensureLibraryAreas } from './lib/library-fixture'

test.describe.serial('Phase 63 -- SOP-first home (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await ensurePlantFixture(db)
    await ensureLibraryAreas(db)
  })

  test.fixme('HOME-01 worker sees My SOPs and My record only, no room words', async () => {})
  test.fixme('HOME-01 sections per role (supervisor, safety manager, admin) and a forged section falls back', async () => {})
  test.fixme('HOME-02 Recent, Most used, All SOPs by area and by type', async () => {})
  test.fixme('HOME-02 search by title, by step text, and a miss offers Ask for one (admin also Write it)', async () => {})
  test.fixme('HOME-03 Read shows chip, meta, steps with kinds and the start button; owner hidden for a worker, shown for a supervisor', async () => {})
  test.fixme('HOME-04 Sign-offs, People, Training, Manage SOPs and My record open their bodies', async () => {})
  test.fixme('MAP-03 area click zooms and filters, Esc returns, dimmed area switches, object opens Read', async () => {})
  test.fixme('MAP-04 phone: tab bar, List | Site map, numbered markers and key, Read with back link, no sideways scroll', async () => {})
  test.fixme('EVAL-01 real org map and list, read-only', async () => {})
  test.fixme('DOCS-01 pathways map reports zero unmapped screens', async () => {})
})
