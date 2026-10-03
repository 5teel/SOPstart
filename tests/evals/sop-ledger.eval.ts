/**
 * Deployed-site eval -- Phase 56 "A simpler SOP + the decision ledger".
 *
 * Skeleton from Plan 56-01 (fixme stubs, completed in 56-10). Provision
 * fixtures first: `node scripts/eval-fixtures.mjs`. Runs via
 * `npm run eval -- --phase 56` against EVAL_BASE_URL.
 *
 * Writes only to the isolated "SOPstart Eval Site" org, never the real SOPstart
 * org. Decisions it writes can never be deleted -- that is the point of the
 * ledger -- and live in the eval-site org.
 *
 * Self-skips when EVAL_BASE_URL is unset so the normal suite never touches production.
 */
import { test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_CONVERT_SOP_TITLE, EVAL_WALK_SOP_TITLE, EVAL_PLANT_SOP_TITLE } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID } from './lib/plant-fixture'

// Used by the 56-10 test bodies.
export const SLOW = { timeout: 25_000 }

test.describe.serial('Phase 56 -- simpler SOP + decision ledger (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) -- run via `npm run eval`')

  let db: SupabaseClient
  let siteOrgId: string
  const sopIds: Record<'convert' | 'walk' | 'plant', string> = { convert: '', walk: '', plant: '' }

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
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
  })

  test.fixme('A -- every SOP has an ok conversion run; convert fixture counts match the known answer; library-linked SOPs converted', async () => {})
  test.fixme('B -- old SOP page and builder render the converted fixture exactly as before', async () => {})
  test.fixme('C -- standards: add, attach to the SOP and a section, worker sees the label, rename, remove', async () => {})
  test.fixme('D -- placement: machine + department, or Whole site', async () => {})
  test.fixme('E -- owner change, completion reject and an AI write each write one decision; the AI one names the agent', async () => {})
  test.fixme('F -- ledger is non-empty, refuses service-key update and delete, refuses an unnamed agent', async () => {})
})
