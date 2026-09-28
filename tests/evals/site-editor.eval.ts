/**
 * Deployed-site eval — Phase 51 site model & machine editor; activated by
 * 51-07; self-skips without EVAL_BASE_URL.
 *
 * Auto-registered by the existing broad `evals` project regex
 * (tests/evals/*.eval.ts) — no playwright.config.ts edit needed.
 */
import { test } from '@playwright/test'
import { EVAL_ENV_READY } from './lib/session'

test.describe('Phase 51 — site editor (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) — run via `npm run eval`')

  // activated by plan 51-07
  test.fixme('admin uploads a scene, draws two machines, names them, picks a department', () => {})

  // activated by plan 51-07
  test.fixme('a SOP is linked from the builder Tools menu and listed on the machine', () => {})

  // activated by plan 51-07
  test.fixme('reload shows both machines and the link; polygons are stored in scene pixels', () => {})

  // activated by plan 51-07
  test.fixme('a worker is sent away from /admin/site', () => {})
})
