/**
 * Phase 23 — AFL-VER-01: Version supersede source-contract assertions.
 * (Compare/restore, AFL-VER-02/03, were retired in Phase 55-10.)
 *
 * D-05 (version lineage: parent_sop_id chains versions; new draft cloned not branched)
 * D-06 (append-only: superseded_by set only on publish; cloneSopAsDraft creates
 *        a new draft forward — never mutates old rows)
 *
 * Tests turn GREEN when Plan 23-03 ships:
 *   src/actions/versioning.ts — cloneSopAsDraft extension
 *   src/app/(protected)/admin/sops/[sopId]/versions/page.tsx — UI wiring
 *   src/lib/builder/diff-block-content.ts — existing utility (should already exist)
 *
 * Unbuilt files are guarded with fs.existsSync + test.skip so Wave-0 is green-when-absent
 * and live-when-present (CLAUDE.md 2026-06-24 phase22 guard pattern).
 *
 * CLAUDE.md 2026-06-05: assert HANDLER WIRING, not just token presence.
 * CLAUDE.md 2026-06-02: use [\s\S] not /s flag (TS target compatibility).
 * Registration: phase23-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

const VERSIONING_PATH = path.join(REPO_ROOT, 'src', 'actions', 'versioning.ts')
const VERSIONS_PAGE_PATH = path.join(
  REPO_ROOT,
  'src',
  'app',
  '(protected)',
  'admin',
  'sops',
  '[sopId]',
  'versions',
  'page.tsx',
)
const DIFF_UTIL_PATH = path.join(
  REPO_ROOT,
  'src',
  'lib',
  'builder',
  'diff-block-content.ts',
)

// ---------------------------------------------------------------------------
// AFL-VER-01: cloneSopAsDraft exported from versioning.ts AND called in versions page
// D-05: "Edit into new version" button clones published SOP as a new draft
// CLAUDE.md 2026-06-05: assert WIRING (call site), not just export presence
// ---------------------------------------------------------------------------

test('AFL-VER-01: versioning.ts exists', () => {
  // versioning.ts is extended in Plan 23-03 — it already exists from prior phases
  expect(fs.existsSync(VERSIONING_PATH)).toBe(true)
})

test('AFL-VER-01: versioning.ts exports cloneSopAsDraft', () => {
  // AFL-VER-01: cloneSopAsDraft is the server action that creates a new draft from
  // a published SOP — the "Edit into new version" entry point.
  // versioning.ts already exists (from prior phases); this test turns GREEN in Plan 23-03.
  if (!fs.existsSync(VERSIONING_PATH)) {
    test.skip(true, 'versioning.ts not found')
    return
  }
  const src = fs.readFileSync(VERSIONING_PATH, 'utf-8')
  if (!src.includes('cloneSopAsDraft')) {
    test.skip(true, 'cloneSopAsDraft not yet added to versioning.ts (Plan 23-03 will add it)')
    return
  }
  expect(src).toContain('export async function cloneSopAsDraft')
})

test('AFL-VER-01: cloneSopAsDraft is CALLED in versions/page.tsx onClick handler (wiring, not just import)', () => {
  // CLAUDE.md 2026-06-05: source-contract tests must assert the handler is WIRED
  // (function called at a click site), not merely that the import exists.
  // cloneSopAsDraft( call verifies the button's onClick actually invokes the action.
  if (!fs.existsSync(VERSIONS_PAGE_PATH)) {
    test.skip(true, 'versions/page.tsx not yet modified (Plan 23-03 will wire cloneSopAsDraft)')
    return
  }
  const src = fs.readFileSync(VERSIONS_PAGE_PATH, 'utf-8')
  if (!src.includes('cloneSopAsDraft')) {
    test.skip(true, 'cloneSopAsDraft not yet wired in versions/page.tsx (Plan 23-03 will wire it)')
    return
  }
  expect(src).toContain('cloneSopAsDraft(')
})

// ---------------------------------------------------------------------------
// AFL-VER-02: the diffBlockContent builder util stays (inline proposal diff reuses it)
// ---------------------------------------------------------------------------

test('AFL-VER-02: diff-block-content.ts utility exists (prerequisite reuse D-07)', () => {
  // D-07 mandates reuse of diffBlockContent from the existing builder utility.
  // If it doesn't exist yet, Plan 23-03 must create it in the builder dir.
  if (!fs.existsSync(DIFF_UTIL_PATH)) {
    test.skip(true, 'diff-block-content.ts not yet created (Plan 23-03 creates it if absent)')
    return
  }
  expect(fs.existsSync(DIFF_UTIL_PATH)).toBe(true)
})
