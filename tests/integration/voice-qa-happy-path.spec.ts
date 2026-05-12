/**
 * SB-LINE-03 — Voice Q&A happy path (mocked Anthropic).
 *
 * Verifies that:
 *   1. The floating mic button opens the voice modal; transcription
 *      appears within 3s (Deepgram mocked via WebSocket stub).
 *   2. The answer renders with a citation chip; clicking the chip
 *      scrolls the underlying walkthrough to the cited section (D-17).
 *   3. ESC closes the modal; focus returns to the mic button (a11y).
 *
 * Mocks Anthropic via `tests/fixtures/anthropic-voice-mock.ts` so the
 * test is deterministic and free.
 *
 * Status: Wave-0 scaffold — Wave 3 plan ships /api/voice/query and
 * WalkthroughVoiceModal then flips these `test.fixme` calls to `test`.
 */
import { test } from '@playwright/test'
import {
  PPE_QUESTION_PRESET,
} from '../fixtures/anthropic-voice-mock'

test.describe('SB-LINE-03 — Voice Q&A happy path', () => {
  test.fixme(
    'mic button opens voice modal; transcription appears within 3s',
    async ({ page }) => {
      // TODO(wave-3):
      // 1. Mint worker session cookie for seeded Visy SOP
      // 2. Stub /api/voice/token + WebSocket as in sb-ux-voice.test.ts
      // 3. Stub /api/voice/query → returns PPE_QUESTION_PRESET
      // 4. await page.goto('/sops/<sop-id>/walkthrough')
      // 5. await page.locator('[data-testid="voice-mic"]').click()
      // 6. await expect(page.locator('[role="dialog"][data-testid="voice-modal"]')).toBeVisible()
      // 7. await expect(page.locator('[data-testid="transcription"]')).toContainText('PPE', { timeout: 3000 })
      void page
      void PPE_QUESTION_PRESET
    }
  )

  test.fixme(
    'answer renders with citation chip clicking which scrolls walkthrough to section',
    async ({ page }) => {
      // TODO(wave-3):
      // 1. Open modal + submit question (use PPE_QUESTION_PRESET mock)
      // 2. await expect(page.locator('[data-testid="answer"]')).toContainText('heat-resistant gloves')
      // 3. await page.locator('[data-testid="citation-chip"]').first().click()
      // 4. await expect(page.locator('[data-section="hazards"]')).toBeInViewport()
      // 5. await expect(page.locator('[role="dialog"][data-testid="voice-modal"]')).toBeVisible() // modal stays open
      void page
    }
  )

  test.fixme(
    'ESC closes modal; focus returns to mic button',
    async ({ page }) => {
      // TODO(wave-3):
      // 1. Open modal
      // 2. await page.keyboard.press('Escape')
      // 3. await expect(page.locator('[role="dialog"][data-testid="voice-modal"]')).toBeHidden()
      // 4. const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
      // 5. expect(focused).toBe('voice-mic')
      void page
    }
  )
})
