/**
 * Deployed-site eval -- Phase 60 "Requests, notifications and objectives".
 *
 * Skeleton (60-01): one fixme case per owning plan. 60-11, 60-12, 60-13, 60-14,
 * 60-16 and 60-17 turn their cases live; 60-18 runs the lot
 * (`npm run eval -- --phase 60`) against the deployed site and reads every
 * screenshot before declaring a pass.
 *
 * Fixtures come from `node scripts/eval-fixtures.mjs` in the isolated
 * "SOPstart Eval Site" org: admin, worker, supervisor (supervises the worker),
 * an idle supervisor, a second worker and a safety manager (the second approver
 * of a two-step chain). The zero-SOP machine comes from ensureZeroSopMachine.
 *
 * Rules (CLAUDE.md Learnings):
 *  - assert by NAME, never a total count: the eval-site org is shared with
 *    sibling evals (2026-09-29);
 *  - every assertion after a fresh navigation carries SLOW (2026-09-29);
 *  - toHaveCount(1) with a short timeout BEFORE a click (2026-09-28);
 *  - exercise requests and notifications TWICE in one session: state can leak
 *    between records (2026-10-03);
 *  - a not-found boundary serves HTTP 200: assert rendered content, never the
 *    raw status (2026-09-29);
 *  - read the screenshots: CSS-token and sizing bugs are invisible to
 *    assertions (2026-07-14); fixed geometry gets one zoomed shot (2026-10-05);
 *  - the real-org case is read-only;
 *  - one minted session per role for the whole file (shared OTP budget);
 *  - requests, notifications and objectives rows are cleaned up in afterAll,
 *    eval-site org only; ledger rows are permanent by design.
 * Comments describe retired routes in words (2026-09-28).
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID } from './lib/plant-fixture'
import { deleteEvalRequestRows, ensureZeroSopMachine } from './lib/requests-fixture'

export const SLOW = { timeout: 30_000 }

test.describe('Phase 60 -- requests, notifications and objectives (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')
  test.use({ viewport: { width: 1440, height: 900 } })

  test.describe.serial('requests cases', () => {
    let db: SupabaseClient
    let siteOrgId: string

    test.beforeAll(async () => {
      if (!EVAL_ENV_READY) return
      db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const fixture = await ensurePlantFixture(db)
      siteOrgId = fixture.siteOrgId
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')
      // The agent-request case needs a machine with no linked SOP.
      await ensureZeroSopMachine(db, siteOrgId)
    })

    test.afterAll(async () => {
      if (!EVAL_ENV_READY || !db || !siteOrgId || siteOrgId === REAL_SOPSTART_ORG_ID) return
      await deleteEvalRequestRows(db, siteOrgId).catch(() => null)
    })

    test.fixme('supervisor Requests tab and pin: tab bar shows Inbox and Requests, pin equals inbox plus requests (60-11)', async () => {})
    test.fixme('agent new-SOP request from the machines sweep appears with the agent chip; declined; a second run raises nothing (60-11)', async () => {})
    test.fixme('composer opens from the machine panel; the ask picker works in role mode and person mode (60-12)', async () => {})
    test.fixme('objective on a machine, a department and a person; an agent-set objective is confirmed (60-13)', async () => {})
    test.fixme('SOP objective in browse and This SOP; a second request raised from browse (60-14)', async () => {})
    test.fixme('worker raises, admin accepts, bell count shows, the notification opens its place, mark-read clears it; a second round (60-16)', async () => {})
    test.fixme('decline with a note; the asker sees the answer (60-16)', async () => {})
    test.fixme('supervisor asks a worker: due on the badge and the Now card; a new version is published and the worker is told; the worker declines (60-16)', async () => {})
    test.fixme('review-due sweep notifies the SOP owner (60-16)', async () => {})
    test.fixme('two-step approval chain notifies the next approver at the divert and after a non-final approval (60-16)', async () => {})
    test.fixme('a sent walk notifies the supervisor (60-16)', async () => {})
    test.fixme('overview order, empty states and Office line; zoomed bell shot; real-org overview read-only (60-16)', async () => {})
    test.fixme('the old assign address lands on the SOP (assert rendered place, not status) (60-17)', async () => {})
  })
})
