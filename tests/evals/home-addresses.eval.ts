/**
 * Deployed-site eval -- Phase 63 home addresses. Skeleton (63-01): every case is
 * test.fixme until 63-14 (address sweep) and 63-13 (notification places, Back bars)
 * fill it. Runs via `npm run eval -- --phase 63`.
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY } from './lib/session'
import { ensurePlantFixture } from './lib/plant-fixture'
import { ensureLibraryAreas } from './lib/library-fixture'

test.describe.serial('Phase 63 -- home addresses (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await ensurePlantFixture(db)
    await ensureLibraryAreas(db)
  })

  test.fixme('HOME-05 legacy ?place= addresses land on their section', async () => {})
  test.fixme('HOME-05 /activity, /admin/training and /?place=edit land on My record, Training and Site & departments', async () => {})
  test.fixme('HOME-05 a stored notification place opens the right section', async () => {})
  test.fixme('HOME-05 Back from a bridged page returns to its section', async () => {})
})
