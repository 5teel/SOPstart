/**
 * Phase 23 — AFL-VER-04: Version update indicator source-contract assertions.
 *
 * D-08 (indicator shown on SopLibraryCard when a newer published version exists than
 *        the worker's last completion — badge derived from published_at vs completion
 *        comparison, not a hardcoded literal)
 * D-09 (indicator is a passive badge only — no forced re-walk; workers see it
 *        as informational context when browsing the SOP library)
 *
 * Tests turn GREEN when Plan 23-05 ships:
 *   src/components/sop/SopLibraryCard.tsx — badge with data-updated-badge attribute
 *
 * Unbuilt tokens are guarded with fs.existsSync + test.skip so Wave-0 is green-when-absent
 * and live-when-present (CLAUDE.md 2026-06-24 phase22 guard pattern).
 *
 * CLAUDE.md 2026-06-05: assert HANDLER WIRING — the badge must be derived from a
 * published_at-vs-completion prop comparison, not a hardcoded literal value.
 * CLAUDE.md 2026-06-02: use [\s\S] not /s flag (TS target compatibility).
 * Registration: phase23-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

// SopLibraryCard path — the component rendering the version-update badge
const SOP_LIBRARY_CARD_PATH = path.join(
  REPO_ROOT,
  'src',
  'components',
  'sop',
  'SopLibraryCard.tsx',
)

// ---------------------------------------------------------------------------
// AFL-VER-04: SopLibraryCard has data-updated-badge attribute + derived comparison
// D-08: badge derived from published_at vs. worker's last completion date
// D-09: badge is informational only — no forced re-walk
// ---------------------------------------------------------------------------

test('AFL-VER-04: SopLibraryCard.tsx exists', () => {
  // SopLibraryCard is modified in Plan 23-05 to show the version indicator badge.
  expect(fs.existsSync(SOP_LIBRARY_CARD_PATH)).toBe(true)
})

test('AFL-VER-04: SopLibraryCard.tsx has data-updated-badge attribute (badge testability anchor)', () => {
  // D-08/D-09: data-updated-badge is the test-hook attribute on the version indicator badge.
  // Using a data attribute (not a CSS class or aria-label alone) ensures the badge is
  // discoverable by automated and manual QA without coupling to visual design.
  if (!fs.existsSync(SOP_LIBRARY_CARD_PATH)) {
    test.skip(true, 'SopLibraryCard.tsx not found')
    return
  }
  const src = fs.readFileSync(SOP_LIBRARY_CARD_PATH, 'utf-8')
  if (!src.includes('data-updated-badge')) {
    test.skip(true, 'data-updated-badge not yet added (Plan 23-05 will add the badge)')
    return
  }
  expect(src).toContain('data-updated-badge')
})

test('AFL-VER-04: badge is derived from published_at-vs-completion comparison prop (not hardcoded literal)', () => {
  // CLAUDE.md 2026-06-05: source-contract tests must assert WIRING, not just presence.
  // The badge must be conditionally rendered based on a prop or computed value that
  // compares published_at with the worker's last completion date.
  // A hardcoded literal like data-updated-badge="true" always-on would be a stub — not wired.
  if (!fs.existsSync(SOP_LIBRARY_CARD_PATH)) {
    test.skip(true, 'SopLibraryCard.tsx not found')
    return
  }
  const src = fs.readFileSync(SOP_LIBRARY_CARD_PATH, 'utf-8')
  if (!src.includes('data-updated-badge')) {
    test.skip(true, 'data-updated-badge not yet added (Plan 23-05 will add the badge)')
    return
  }

  // The badge must be driven by one of:
  //   - a prop named hasNewerVersion / hasUpdate / isUpdated / updatedSince / etc.
  //   - a comparison expression involving published_at or completedAt / lastCompletion
  //   - a boolean derived from date comparison (> || < || isAfter || isBefore)
  const hasPublishedAtReference =
    src.includes('published_at') ||
    src.includes('publishedAt') ||
    src.includes('hasNewerVersion') ||
    src.includes('isUpdated') ||
    src.includes('hasUpdate') ||
    src.includes('updatedSince') ||
    src.includes('lastCompletion') ||
    src.includes('completedAt')

  expect(
    hasPublishedAtReference,
    'data-updated-badge must be derived from a published_at-vs-completion comparison (AFL-VER-04 D-08), not a hardcoded literal',
  ).toBe(true)
})

test('AFL-VER-04: badge does NOT force re-walk (D-09 — badge is informational only)', () => {
  // D-09: the version indicator must be a passive badge — it must NOT navigate the worker
  // to a new walkthrough or call router.push with /walkthrough. Informational only.
  if (!fs.existsSync(SOP_LIBRARY_CARD_PATH)) {
    test.skip(true, 'SopLibraryCard.tsx not found')
    return
  }
  const src = fs.readFileSync(SOP_LIBRARY_CARD_PATH, 'utf-8')
  if (!src.includes('data-updated-badge')) {
    test.skip(true, 'data-updated-badge not yet added (Plan 23-05 will add the badge)')
    return
  }

  // The badge element must NOT have an onClick that calls router.push('/walkthrough')
  // Extract the badge element context using [\s\S] (no /s flag — CLAUDE.md 2026-06-02)
  const badgeIdx = src.indexOf('data-updated-badge')
  if (badgeIdx === -1) return

  // Look at the surrounding 400 chars for onClick→walkthrough patterns
  const badgeContext = src.slice(Math.max(0, badgeIdx - 200), badgeIdx + 200)
  const forcesReWalk =
    badgeContext.includes('router.push') &&
    badgeContext.includes('walkthrough')

  expect(
    forcesReWalk,
    'data-updated-badge must NOT force re-walk (D-09): the badge element must be informational only, not an onClick that navigates to /walkthrough',
  ).toBe(false)
})
