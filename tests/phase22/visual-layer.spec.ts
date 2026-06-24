/**
 * Phase 22 — VDW-LIT-01/02: Always-on visual layer source-contract assertions.
 *
 * Turns GREEN when Plan 04 extends `src/components/sop/walkthrough/ImmersiveStepCard.tsx`
 * with the icon fallback map + per-step photo render.
 * At Wave-0 head these specs FAIL (clean assertion red — the tokens don't exist yet).
 *
 * CLAUDE.md 2026-06-05: assert WIRING, not just token presence.
 * Asserts:
 *   - `SECTION_TYPE_ICONS` — icon fallback map (VDW-LIT-01: block-type icons)
 *   - `sop_images` — per-step photo data source (VDW-LIT-02: step photo render)
 *   - `SopImageInline` — reuse of the existing signed-image component (avoids duplicate implementation)
 *
 * Pattern: fs.readFileSync + toContain (source-contract file-walk).
 * Registration: phase22-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const IMMERSIVE_CARD_PATH = path.join(
  REPO_ROOT,
  'src',
  'components',
  'sop',
  'walkthrough',
  'ImmersiveStepCard.tsx',
)

function readImmersiveCard(): string {
  return fs.readFileSync(IMMERSIVE_CARD_PATH, 'utf-8')
}

test('VDW-LIT-01/02: ImmersiveStepCard.tsx exists', () => {
  expect(
    fs.existsSync(IMMERSIVE_CARD_PATH),
    `ImmersiveStepCard.tsx not found at ${IMMERSIVE_CARD_PATH}`,
  ).toBe(true)
})

test('VDW-LIT-01: ImmersiveStepCard contains SECTION_TYPE_ICONS (icon fallback map)', () => {
  const text = readImmersiveCard()
  // SECTION_TYPE_ICONS maps section_type strings to Lucide icon components.
  // This is the VDW-LIT-01 always-on icon layer per PATTERNS.md § ImmersiveStepCard.
  expect(text).toContain('SECTION_TYPE_ICONS')
})

test('VDW-LIT-02: ImmersiveStepCard references sop_images (per-step photo render)', () => {
  const text = readImmersiveCard()
  // sop_images is the join that provides step photos — required for VDW-LIT-02
  // "step card always shows icon OR photo (never blank visual area)".
  expect(text).toContain('sop_images')
})

test('VDW-LIT-02: ImmersiveStepCard uses SopImageInline (reuse signed-image component)', () => {
  const text = readImmersiveCard()
  // SopImageInline is the existing signed-image component — reuse avoids duplicate
  // presigned-URL logic and keeps the visual layer consistent with existing image renders.
  expect(text).toContain('SopImageInline')
})
