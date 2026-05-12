/**
 * SB-LINE-04 — Voice Q&A grounding scope (2-SOP fixture).
 *
 * Verifies that:
 *   1. A question whose answer exists in a DIFFERENT SOP returns
 *      "I can't find that in this procedure" — current SOP is the
 *      only grounding source (D-05, prevents cross-SOP leak T-15-02).
 *   2. Verifier-flagged claims render with a yellow Verification badge
 *      and the unverified phrase highlighted (D-18) — explicit safety
 *      bias toward "I'm not certain" over "wrong but confident".
 *
 * Requires the 2-SOP fixture: the Visy ENF4-03-031 SOP plus a second
 * decoy SOP seeded in beforeAll via the Supabase admin client.
 *
 * Status: Wave-0 scaffold — Wave 3 plan implements voice route + verifier.
 */
import { test } from '@playwright/test'
import {
  ADVERSARIAL_QUESTION_PRESET,
  mockAnswerCall,
  mockVerifierCall,
} from '../fixtures/anthropic-voice-mock'

test.describe('SB-LINE-04 — Voice grounding scope', () => {
  test.beforeAll(async () => {
    // TODO(wave-3):
    // 1. Use Supabase admin client to seed Visy ENF4-03-031 from
    //    tests/fixtures/visy-enf4-03-031.sql
    // 2. Seed a decoy SOP (e.g. "ENF7-Loader Cleaning") containing the
    //    phrase "use leather gloves for loader cleaning"
    // 3. Stash sop ids in test state for use below
  })

  test.fixme(
    'question whose answer exists in a DIFFERENT SOP returns "I cant find that in this procedure"',
    async ({ page }) => {
      // TODO(wave-3):
      // 1. Open Visy SOP walkthrough as worker
      // 2. Stub /api/voice/query: route forwards to real /api/voice/query
      //    BUT Anthropic SDK is mocked to return ADVERSARIAL_QUESTION_PRESET
      //    when asked about leather gloves (decoy-SOP content)
      // 3. Open modal, ask "Can I use leather gloves instead?"
      // 4. await expect(page.locator('[data-testid="answer"]')).toContainText("I'm not certain")
      // 5. await expect(page.locator('[data-testid="answer"]')).not.toContainText('loader')
      void page
      void ADVERSARIAL_QUESTION_PRESET
    }
  )

  test.fixme(
    'verifier flagged claim renders with yellow Verification badge and original claim highlighted',
    async ({ page }) => {
      // TODO(wave-3):
      // 1. Stub Anthropic answer call → returns a confident but UNGROUNDED
      //    claim (e.g. "Yes, leather gloves are fine")
      // 2. Stub verifier call → returns one warning flag describing the
      //    unverified phrase
      // 3. Open modal, submit question
      // 4. await expect(page.locator('[data-testid="verification-badge"]')).toBeVisible()
      // 5. await expect(page.locator('[data-testid="verification-badge"]')).toHaveCSS('background-color', /yellow|amber/i)
      // 6. await expect(page.locator('[data-testid="flagged-phrase"]')).toContainText('leather gloves are fine')
      void page
      void mockAnswerCall
      void mockVerifierCall
    }
  )
})
