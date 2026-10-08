/**
 * Deployed-site eval -- Phase 63 "the SOPstart start" (the fuse). Skeleton (63-01):
 * every case is test.fixme until 63-15 fills it. Runs via `npm run eval -- --phase 63`.
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY } from './lib/session'
import { ensurePlantFixture } from './lib/plant-fixture'
import { ensureLibraryAreas } from './lib/library-fixture'

test.describe.serial('Phase 63 -- the SOPstart start (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await ensurePlantFixture(db)
    await ensureLibraryAreas(db)
  })

  test.fixme('FUSE-01 start plays the merge into the running SOP (slow-motion frames)', async () => {})
  test.fixme('FUSE-01 the second start of the day is short; reduced motion cuts', async () => {})
  test.fixme('FUSE-02 start lands on the first step and Back returns to Read; a second start works', async () => {})
  test.fixme('FUSE-02 a stopped SOP picks up at step N; begin from step 1 asks first', async () => {})
})
