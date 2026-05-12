/**
 * SB-LINE-03 — Voice Q&A happy path (Wave 2 contract).
 *
 * Wave 2 ships the WalkthroughVoiceButton + WalkthroughVoiceModal SHELL
 * with stubbed `/api/voice/query`. Wave 3 will ship the real API route
 * and wire Deepgram streaming ASR. The fully live Playwright happy-path
 * (open modal, mock fetch, click citation chip, assert scrollIntoView)
 * is deferred to Wave 3 + phase verification UAT (chromium binary not
 * installed locally — per Plan 15-01 Rule-3 finding).
 *
 * This file verifies right now (source-contract level):
 *   1. WalkthroughVoiceButton renders a fixed bottom-right pill with
 *      env(safe-area-inset-bottom) padding (D-14).
 *   2. WalkthroughVoiceModal renders role="dialog" aria-modal="true"
 *      with title element id + aria-live transcript region (D-15 a11y).
 *   3. ESC closes the modal + onClose callback wired.
 *   4. Backdrop click closes; inner card click does NOT.
 *   5. Stop button is focused on open.
 *   6. `/api/voice/query` is fetched on submit (Wave 3 wires the route).
 *   7. Answer rendering parses `[section: "X"]` markers into clickable
 *      chips (D-17).
 *   8. Verifier flags render a yellow badge using `amber-*` Tailwind
 *      tokens (D-18).
 *   9. Citations are rendered as React text children — NO
 *      `dangerouslySetInnerHTML` (XSS mitigation T-15-02-03).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PPE_QUESTION_PRESET } from '../fixtures/anthropic-voice-mock'

const ROOT = path.resolve(__dirname, '..', '..')
const BUTTON = path.join(ROOT, 'src', 'components', 'sop', 'voice', 'WalkthroughVoiceButton.tsx')
const MODAL = path.join(ROOT, 'src', 'components', 'sop', 'voice', 'WalkthroughVoiceModal.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SB-LINE-03 — Voice Q&A happy path (Wave 2 shell contract)', () => {
  test('WalkthroughVoiceButton.tsx + WalkthroughVoiceModal.tsx exist', () => {
    expect(fs.existsSync(BUTTON)).toBe(true)
    expect(fs.existsSync(MODAL)).toBe(true)
  })

  test('Voice button is fixed bottom-right with safe-area inset padding (D-14)', () => {
    const src = read(BUTTON)
    expect(src).toContain('fixed')
    expect(src).toContain('right-4')
    expect(src).toContain('bottom-4')
    expect(src).toMatch(/env\(safe-area-inset-bottom\)/)
  })

  test('Voice button has accessible label + data-testid for UAT', () => {
    const src = read(BUTTON)
    expect(src).toMatch(/aria-label=["']Ask a question/)
    expect(src).toContain('data-testid="voice-mic"')
  })

  test('Modal renders role="dialog" aria-modal="true" with title id (D-15)', () => {
    const src = read(MODAL)
    expect(src).toMatch(/role=["']dialog["']/)
    expect(src).toMatch(/aria-modal=["']true["']/)
    expect(src).toMatch(/aria-labelledby=["']walkthrough-voice-title["']/)
    expect(src).toMatch(/id=["']walkthrough-voice-title["']/)
  })

  test('Modal transcript region uses aria-live="polite" (D-15)', () => {
    const src = read(MODAL)
    expect(src).toMatch(/aria-live=["']polite["']/)
  })

  test('ESC key closes modal (keydown listener + Escape branch)', () => {
    const src = read(MODAL)
    expect(src).toMatch(/addEventListener\(['"]keydown['"]/)
    expect(src).toMatch(/e\.key\s*===\s*['"]Escape['"]/)
    expect(src).toMatch(/onClose\(\)/)
  })

  test('Backdrop click closes; inner card click does NOT (stopPropagation)', () => {
    const src = read(MODAL)
    // Backdrop onClick checks e.target === e.currentTarget then calls onClose
    expect(src).toMatch(/e\.target\s*===\s*e\.currentTarget/)
    // Inner card stops propagation
    expect(src).toMatch(/e\.stopPropagation\(\)/)
  })

  test('Stop button is focused on modal open (focus trap entry)', () => {
    const src = read(MODAL)
    expect(src).toMatch(/stopBtnRef\.current\?\.focus\(\)/)
  })

  test('Modal POSTs to /api/voice/query with sopId + question body', () => {
    const src = read(MODAL)
    expect(src).toMatch(/fetch\(['"]\/api\/voice\/query['"]/)
    expect(src).toMatch(/method:\s*['"]POST['"]/)
    expect(src).toMatch(/JSON\.stringify\(\{\s*sopId,?\s*question\b/)
  })

  test('Answer renders [section: "X"] markers as clickable citation chips (D-17)', () => {
    const src = read(MODAL)
    // splitAnswer regex matches [section: "..."] in the source body
    expect(src).toContain('[section:')
    expect(src).toContain('data-testid="citation-chip"')
    expect(src).toContain('data-testid="answer"')
  })

  test('Verifier flag renders yellow badge (D-18) with amber tokens', () => {
    const src = read(MODAL)
    expect(src).toContain('verifier_flags')
    expect(src).toMatch(/amber-/) // amber-50 / amber-500 / amber-600 / amber-900
    expect(src).toContain('data-testid="verifier-flag"')
    // role=alert per ARIA spec for assertive notification
    expect(src).toMatch(/role=["']alert["']/)
  })

  test('Answer text is rendered as React children, NOT dangerouslySetInnerHTML (XSS T-15-02-03)', () => {
    const modalSrc = read(MODAL)
    // Strip line comments and block comments before checking; the file
    // intentionally references dangerouslySetInnerHTML in its header
    // comment as the explicit anti-pattern this component avoids.
    const stripped = modalSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/^\s*\*.*$/gm, '')
    expect(stripped).not.toMatch(/\bdangerouslySetInnerHTML\b/)
  })

  test('Fixture mock preset still references "heat-resistant gloves" wording', () => {
    // Sanity check the fixture used by Wave 3 still surfaces the
    // grounding string the SPEC tests rely on.
    expect(JSON.stringify(PPE_QUESTION_PRESET)).toMatch(/heat-resistant gloves/i)
  })
})
