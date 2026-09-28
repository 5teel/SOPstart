/**
 * Deployed-site eval -- Phase 52 "Worker Home: The Plant" (D-16).
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval`) as the eval-site-worker fixture, a worker member of the isolated
 * "SOPstart Eval Site" org (never the shared SOPstart eval org
 * bd2c2b88…), with a PUBLISHED "Eval plant fixture SOP" assigned to it and
 * linked to "EVAL Press".
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite
 * never touches production. Provision fixtures first: `node scripts/eval-fixtures.mjs`.
 *
 * Activated (live) by Plan 52-05.
 */
import { test } from '@playwright/test'
import { EVAL_ENV_READY } from './lib/session'

test.describe('Phase 52 — worker plant home (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')

  test.fixme(
    'eval-site worker at 1440 sees the scene, a pin on EVAL Press, the Now card, the panel, a chip fit, the ask highlight and the voice dialog — no scope column, no console errors',
    () => {}
  )
  test.fixme('a worker whose org has no site still sees the list', () => {})
})
