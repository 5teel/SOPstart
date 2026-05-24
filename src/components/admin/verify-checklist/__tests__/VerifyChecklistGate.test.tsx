/**
 * Phase 21 (Plan 21-04 Task 1) — Static-analysis tests for VerifyChecklistGate.
 *
 * These tests run via Playwright's test runner (no separate Vitest harness
 * in this repo) and exercise the file source — NOT a rendered component
 * (no DOM harness). The component behaviour itself is covered by the
 * integration tests under `tests/integration/scp-verify-checklist.test.ts`.
 *
 * Two locks:
 *   1. SCP-VERIFY-05 — no bulk-verify UI / language in the file source.
 *   2. Keyboard map = Spike 004 contract (j/k/a/d/Enter).
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const HERE = __dirname
const GATE = path.join(HERE, '..', 'VerifyChecklistGate.tsx')
const KEYBINDS = path.join(HERE, '..', 'keyboard-bindings.ts')

test('SCP-VERIFY-05 lock: VerifyChecklistGate.tsx contains no bulk-verify language', () => {
  const source = fs.readFileSync(GATE, 'utf8').toLowerCase()

  // Banned phrases — case-insensitive. Allow mentions inside comments that
  // explicitly say "MUST NOT" (the lock comment itself) by stripping the
  // documentation marker line beforehand.
  const banned = [
    'approve all',
    'verify all',
    'select all',
    'bulk verify',
    'trust score',
    'skip remaining',
  ]

  // Strip the lock docblock so we only catch ACCIDENTAL bulk-verify language.
  // The lock comment intentionally enumerates the forbidden phrases.
  const sourceMinusDocblock = source.replace(
    /\/\*\*[\s\S]*?scp-verify-05 lock[\s\S]*?\*\//,
    '',
  )

  for (const phrase of banned) {
    expect(
      sourceMinusDocblock.includes(phrase),
      `VerifyChecklistGate.tsx contains banned phrase "${phrase}" — SCP-VERIFY-05 (D-21-07) violation`,
    ).toBe(false)
  }
})

test('Spike 004 contract: keyboard-bindings.ts pins j/k/a/d/Enter', () => {
  const source = fs.readFileSync(KEYBINDS, 'utf8')

  // Must export CHECKLIST_KEYBINDS.
  expect(source).toContain('CHECKLIST_KEYBINDS')

  // Must define exactly the Spike 004 letters.
  expect(source).toMatch(/NAV_NEXT\s*=\s*'j'/)
  expect(source).toMatch(/NAV_PREV\s*=\s*'k'/)
  expect(source).toMatch(/APPROVE\s*=\s*'a'/)
  expect(source).toMatch(/DECLINE\s*=\s*'d'/)
  expect(source).toMatch(/FOCUS_SOURCE\s*=\s*'Enter'/)

  // Must gate on editable target.
  expect(source).toContain('isEditableTarget')
})

test('VerifyChecklistGate.tsx calls verifyBlock/unverifyBlock via the hook', () => {
  // The Gate itself doesn't import verifyBlock directly — it goes through
  // useVerifyChecklist. Confirm the hook is the link.
  const hookSource = fs.readFileSync(
    path.join(HERE, '..', 'useVerifyChecklist.ts'),
    'utf8',
  )
  expect(hookSource).toContain("from '@/actions/sop-section-blocks'")
  expect(hookSource).toMatch(/\bverifyBlock\b/)
  expect(hookSource).toMatch(/\bunverifyBlock\b/)
})

test('VerifyProgressIndicator publish button is hard-disabled until isReady', () => {
  const source = fs.readFileSync(
    path.join(HERE, '..', 'VerifyProgressIndicator.tsx'),
    'utf8',
  )
  // The disabled prop must be wired to isReady (defence-in-depth UI layer).
  expect(source).toMatch(/disabled=\{!isReady\}/)
  // The button must carry the data-testid that the integration test grep
  // assertion looks for.
  expect(source).toContain('data-testid="publish-button"')
})
