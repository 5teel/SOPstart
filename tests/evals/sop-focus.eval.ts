/**
 * Deployed-site eval -- Phase 58 "The SOP Focus Screen: Walk & Edit".
 *
 * SKELETON (58-02). 58-11, 58-13, 58-14 and 58-17 fill the cases in as each
 * surface lands; 58-18 runs them (`npm run eval -- --phase 58`) and reads
 * every screenshot before declaring a pass.
 *
 * Proves the five roadmap success criteria as fixture accounts of the isolated
 * "SOPstart Eval Site" org (eval-site-worker, eval-site-admin). Fixtures are
 * created by 58-03 (`node scripts/eval-fixtures.mjs`): the walk fixture SOP,
 * "EVAL focus jump" (jump-ahead on), "EVAL focus draft", "EVAL focus blank",
 * "EVAL focus lineage" (published v1 + v2 + a draft v3), "EVAL focus parsing"
 * (in-flight parse job) and "EVAL focus parse failed" (failed job).
 *
 * Rules (CLAUDE.md Learnings):
 *  - assert by NAME, never a total count -- the eval-site org is shared with
 *    sibling evals (2026-09-29);
 *  - every assertion after a fresh navigation carries SLOW (2026-09-29);
 *  - `toHaveCount(1)` with a short timeout BEFORE a click -- an empty locator
 *    makes click() wait out the whole budget (2026-09-28);
 *  - walk TWICE in one session -- in-memory walk state can leak between
 *    records and one pass cannot see it (2026-10-03);
 *  - read the screenshots: CSS-token and sizing bugs are invisible to
 *    assertions (2026-07-14).
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test } from '@playwright/test'
import { EVAL_ENV_READY } from './lib/session'

export const SLOW = { timeout: 30_000 }

test.describe('Phase 58 — the SOP focus screen (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')
  test.use({ viewport: { width: 1440, height: 900 } })

  // ------------------------------------------------ SC1 -- the focus frame
  test.describe('SC1 frame', () => {
    test.fixme('58-browse-worker: top bar is Back + title, rail 300 px, column <= 820, Start walking visible, no map or list', async () => {})
    test.fixme('no shell or inbox testid on the focus screen', async () => {})
    test.fixme('compiled CSS contains text-step, max-w-205, w-75, bg-accent-signoff', async () => {})
  })

  // ------------------------------------------------ SC2 -- the walk
  test.describe('SC2 walk', () => {
    test.fixme('58-walk-hazard: red tint card + chip, 28 px text, "I understand — continue"', async () => {})
    test.fixme('58-walk-ppe: amber chip, "I\'m wearing it — continue"', async () => {})
    test.fixme('58-walk-photo-required: photo button 60 px, primary disabled with hint', async () => {})
    test.fixme('58-walk-locked-rail: ahead rows locked, done rows ticked, current marked', async () => {})
    test.fixme('58-walk-jump-on: ahead rows clickable, hazard dots hollow', async () => {})
    test.fixme('58-review: grouped list, thumbnails, green Send for sign-off', async () => {})
    test.fixme('58-sent: one line + Back to the site', async () => {})
    test.fixme('58-resume: reopen mid-walk shows "Resume where you left off"', async () => {})
    test.fixme('walk twice in one session: second walk starts clean', async () => {})
  })

  // ------------------------------------------------ SC3 -- the editor
  test.describe('SC3 edit', () => {
    test.fixme('58-edit-admin: version slot, AI banner at top, kind borders, tick per step, bottom bar count', async () => {})
    test.fixme('58-edit-ai-findings: violet markers, Publish disabled with reasons', async () => {})
    test.fixme('58-edit-publish-dialog: all ticked + cleared, green Publish enabled, dialog recessed', async () => {})
    test.fixme('58-edit-blank: empty state copy', async () => {})
    test.fixme('58-this-sop: version list, standards, jump-ahead switch', async () => {})
  })

  // ------------------------------------------------ SC4 -- still parsing
  test.describe('SC4 parsing', () => {
    test.fixme('58-parsing: stage line, rough time, skeleton rail, frame never empty', async () => {})
    test.fixme('58-parse-failed: error card + Try again', async () => {})
  })

  // ------------------------------------------------ SC5 -- versions + Back
  test.describe('SC5 versions and Back', () => {
    test.fixme('58-superseded: "v2 — superseded" badge, no Start walking', async () => {})
    test.fixme('58-back-place: Back lands on /?place=… with the originating place still selected', async () => {})
    test.fixme('58-phone-walk (390x844): sticky dock, rail hidden, "Steps · n of N" button, 28 px text wraps', async () => {})
    test.fixme('58-phone-rail (390x844): full-screen sheet, 44 px rows', async () => {})
  })
})
