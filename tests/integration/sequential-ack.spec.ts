/**
 * SB-LINE-02 — Sequential walkthrough acknowledgement gate.
 *
 * Verifies that:
 *   1. Forward navigation 1→2→3→4→5 is ONLY possible by clicking the
 *      explicit "I've done this — Next" button on each step (D-19).
 *   2. Deep-linking to ?step=4 without acknowledging step 2/3 redirects
 *      to the highest acknowledged step (D-20) — prevents skip-ahead
 *      attacks against the sequential reading guarantee.
 *
 * Status: Wave-0 scaffold — Wave 2 plan implements the gate and flips
 * these `test.fixme` calls to `test`.
 */
import { test } from '@playwright/test'

test.describe('SB-LINE-02 — Sequential acknowledgement gate', () => {
  test.fixme(
    'Next button advances 1→2→3→4→5 only via sequential acknowledgement',
    async ({ page }) => {
      // TODO(wave-2):
      // 1. Mint worker session cookie for seeded Visy SOP (5 steps)
      // 2. await page.goto('/sops/<sop-id>/walkthrough')
      // 3. for each step 1..4:
      //    - expect step N visible
      //    - click [data-testid="ack-next"]
      //    - expect step N+1 visible
      // 4. expect step 5 visible with completion CTA
      void page
    }
  )

  test.fixme(
    'deep-link to ?step=4 without acking 2/3 redirects to highest acknowledged step',
    async ({ page }) => {
      // TODO(wave-2):
      // 1. Mint worker session, no acknowledgements yet
      // 2. await page.goto('/sops/<sop-id>/walkthrough?step=4')
      // 3. expect URL to be /sops/<sop-id>/walkthrough?step=1
      // 4. ack step 1, deep-link to ?step=4 again
      // 5. expect URL to be /sops/<sop-id>/walkthrough?step=2 (highest acked = 1, next allowed = 2)
      void page
    }
  )
})
