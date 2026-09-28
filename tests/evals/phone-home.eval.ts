/**
 * Deployed-site eval -- Phase 53 "Phone: Scan or Ask" (D-12).
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval`) at 390x844 as the eval-site worker/admin fixtures, plus the
 * real-org eval-worker (no site). Provision fixtures first:
 * `node scripts/eval-fixtures.mjs`.
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite
 * never touches production.
 */
import { test } from '@playwright/test'
import { EVAL_ENV_READY } from './lib/session'

test.describe('Phase 53 — phone home (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')

  test.fixme(
    'eval-site worker at 390×844: ask bar, Now card (Walk it / Read), floor picture, Scan; floor picture → machine sheet lists EVAL Press under Forming with a to-do count; row → /m/<code> → Walk it',
    async () => {}
  )
  test.fixme('Scan with no camera falls back to typing the code, which opens /m/<code>', async () => {})
  test.fixme(
    'logged out, /m/<code> goes to /login?next=…, and a signed-in visit to that login URL lands on the machine',
    async () => {}
  )
  test.fixme('a worker in another org gets a 404 for the EVAL Press code', async () => {})
  test.fixme(
    'eval-site admin: the plate page renders at A6 with the QR, name, department and code; print hides the controls',
    async () => {}
  )
  test.fixme("a worker whose org has no site still sees today's phone list", async () => {})
})
