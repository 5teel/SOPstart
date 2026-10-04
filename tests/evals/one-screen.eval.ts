/**
 * Deployed-site eval -- Phase 57 "The One Screen & Its Places" (skeleton, 57-01).
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval -- --phase 57`) as fixture accounts of the isolated "SOPstart Eval
 * Site" org: eval-site-worker (worker), eval-site-admin (admin) and
 * eval-site-supervisor (supervisor, Phase 57 D-06). Provision first with
 * `node scripts/eval-fixtures.mjs` (57-10 runs it).
 *
 * Every body is fixme until 57-10 fills it. Assert by NAME ("EVAL Press"),
 * never exact counts (the eval-site org is shared with sibling evals,
 * CLAUDE.md 2026-09-29), and put the SLOW timeout on every assertion that
 * follows a fresh navigation. Comments describe retired URLs in words.
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test } from '@playwright/test'
import {
  EVAL_ENV_READY,
  EVAL_PLANT_MACHINE,
  EVAL_PLANT_SOP_TITLE,
  EVAL_CONVERT_SOP_TITLE,
  signInAs,
} from './lib/session'
import { shot, watchConsole } from './lib/plant-fixture'

// Referenced by the bodies 57-10 writes; kept imported so the skeleton type-checks the real helpers.
void [EVAL_PLANT_MACHINE, EVAL_PLANT_SOP_TITLE, EVAL_CONVERT_SOP_TITLE, signInAs, shot, watchConsole]

export const SLOW = { timeout: 30_000 }

test.describe('Phase 57 — the one screen (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')

  test.fixme('SHL-01 PLC-01: worker lands on three panes with four signposts and no header', async () => {})
  test.fixme('SHL-02: map click equals list click, and Esc returns to the overview', async () => {})
  test.fixme('SHL-02: second-iteration leak -- machine, then Office, then another machine shows no stale detail', async () => {})
  test.fixme('SHL-04: search lights matching machine and room shapes', async () => {})
  test.fixme('SHL-05: the Now card names the due SOP and opens it', async () => {})
  test.fixme('PLC-03: the Noticeboard lists the convert fixture SOP', async () => {})
  test.fixme('D-11: a place deep link selects on load; a worker edit-mode link falls back to the overview', async () => {})
  test.fixme('D-12 D-15: a bridge page shows Back to the site and returns to its room', async () => {})
  test.fixme('D-16 PLC-04: admin Office count equals the governance page open count', async () => {})
  test.fixme('PLC-04: worker due pin on EVAL Press', async () => {})
  test.fixme('PLC-04: admin health pin on EVAL Press', async () => {})
  test.fixme('PLC-02 D-19: admin machine panel offers Walk, Edit and new SOP for the machine', async () => {})
  test.fixme('D-12 D-13: the Workshop lists the org drafts and links to the new-SOP flow', async () => {})
  test.fixme('PLC-05 D-08 D-22: edit mode shows the site workspace and the departments strip', async () => {})
  test.fixme('D-10 D-17: retired URLs (dashboard, list, departments, site, governance views) redirect to the one screen', async () => {})
  test.fixme('D-06: the supervisor sees the Office card with the sign-off count', async () => {})
  test.fixme('Pitfall 7: real-org overview screenshot, read-only', async () => {})
  test.fixme('D-10: signed-out root shows the landing page', async () => {})
})
