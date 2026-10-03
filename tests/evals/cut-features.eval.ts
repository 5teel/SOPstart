/**
 * Deployed-site eval -- Phase 55 "Cut the Dropped Features & One Organisation".
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com) via
 * `npm run eval -- --phase 55`. Provision fixtures first:
 * `node scripts/eval-fixtures.mjs` (adds the "Eval walk fixture SOP" to the
 * isolated eval-site org -- never the real SOPstart org).
 *
 * Skeleton from 55-01: the walk tests are authored in 55-03, the rest in
 * 55-14. Every test self-skips without EVAL_BASE_URL so `npm run test`
 * never touches production. Dead addresses are asserted by RENDERED not-found
 * content, never response.status() (custom not-found serves 200).
 */
import { test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, EVAL_WALK_SOP_TITLE } from './lib/session'
import { ensurePlantFixture } from './lib/plant-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'

const SLOW = { timeout: 30_000 }
void SLOW

test.describe('Phase 55 — cut features (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')

  let db: SupabaseClient
  let walkSopId: string

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    const { data: org } = await db.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).maybeSingle()
    if (!org) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found — run node scripts/eval-fixtures.mjs`)
    const { data: walk } = await db
      .from('sops')
      .select('id')
      .eq('organisation_id', org.id)
      .eq('title', EVAL_WALK_SOP_TITLE)
      .maybeSingle()
    if (!walk) throw new Error(`"${EVAL_WALK_SOP_TITLE}" not found — run node scripts/eval-fixtures.mjs`)
    walkSopId = walk.id
    await ensurePlantFixture(db)
    await deleteEvalCompletions(db, walkSopId)
  })

  test.afterAll(async () => {
    if (!EVAL_ENV_READY || !walkSopId) return
    await deleteEvalCompletions(db, walkSopId)
  })

  // 55-14
  test.fixme('worker at 1440 sees pins and the next-SOP card — no install prompt, no offline banner, no microphone, no service worker', async () => {})

  // 55-03
  test.describe.serial('walk with a photo, then it waits for sign-off', () => {
    test.fixme('worker on a phone walks the walk fixture, takes the photo it asks for and submits — nothing queued', async () => {})
    test.fixme('admin sees that completion waiting for sign-off with its photo', async () => {})
  })

  // 55-14
  test.fixme('existing SOPs, completions and photos still open', async () => {})

  // 55-14
  test.fixme('admin sees none of the dropped authoring tools; dead addresses show the not-found page', async () => {})

  // 55-14
  test.fixme('sign-up says ask your admin; login has no register link; profile has no organisation switch', async () => {})
})
