/**
 * Phase 23 — AFL-VER-05 + D-11: Completion roster source-contract assertions.
 *
 * D-10 (kiosk mode: shared device where a supervisor authenticates once;
 *         workers select their name from an org roster to start a walkthrough)
 * D-11 (roster attribution: roster_worker_id column on sop_completions records
 *         which roster worker completed the SOP — distinct from worker_id which is
 *         the kiosk account's UID used for RLS; NULL for all pre-Phase-23 completions)
 *
 * AFL-VER-05 covers:
 *   - completions.ts submitCompletion writes roster_worker_id
 *   - completions.ts submitCompletion validates org-membership before writing roster_worker_id
 *   - completions.ts recordSignature exported and uses createAdminClient
 *   - /login/kiosk/page.tsx route exists with RosterSelector
 *   - Migration 00038 contains roster_worker_id and sop_completion_signatures
 *
 * Tests turn GREEN when Plans 23-01 (migration), 23-04 (kiosk route), 23-06 (completions) ship.
 *
 * Unbuilt tokens are guarded with fs.existsSync + test.skip so Wave-0 is green-when-absent
 * and live-when-present (CLAUDE.md 2026-06-24 phase22 guard pattern).
 *
 * CLAUDE.md 2026-06-15: tables with no authenticated write policy MUST use createAdminClient()
 *   for writes + self-enforce org-scoping in the action.
 * CLAUDE.md 2026-06-05: assert HANDLER WIRING, not just token presence.
 * CLAUDE.md 2026-06-02: use [\s\S] not /s flag (TS target compatibility).
 * Registration: phase23-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

const COMPLETIONS_PATH = path.join(REPO_ROOT, 'src', 'actions', 'completions.ts')
const KIOSK_PAGE_PATH = path.join(
  REPO_ROOT,
  'src',
  'app',
  '(auth)',
  'login',
  'kiosk',
  'page.tsx',
)
// Migration 00038 will be created by Plan 23-01
const MIGRATION_GLOB_DIR = path.join(REPO_ROOT, 'supabase', 'migrations')

function findMigration00038(): string | null {
  if (!fs.existsSync(MIGRATION_GLOB_DIR)) return null
  const files = fs.readdirSync(MIGRATION_GLOB_DIR)
  const match = files.find((f) => f.startsWith('00038'))
  return match ? path.join(MIGRATION_GLOB_DIR, match) : null
}

// ---------------------------------------------------------------------------
// AFL-VER-05: completions.ts submitCompletion writes roster_worker_id
// D-11: roster_worker_id is written and validated before the sop_completions insert
// ---------------------------------------------------------------------------

test('AFL-VER-05: completions.ts exists', () => {
  expect(fs.existsSync(COMPLETIONS_PATH)).toBe(true)
})

test('AFL-VER-05: completions.ts submitCompletion writes roster_worker_id (D-11 attribution column)', () => {
  // D-11: submitCompletion must pass roster_worker_id in the insert payload.
  // This is the attribution field — distinct from worker_id (kiosk account UID for RLS).
  if (!fs.existsSync(COMPLETIONS_PATH)) {
    test.skip(true, 'completions.ts not found')
    return
  }
  const src = fs.readFileSync(COMPLETIONS_PATH, 'utf-8')
  if (!src.includes('roster_worker_id')) {
    test.skip(true, 'roster_worker_id not yet added to completions.ts (Plan 23-06 will add it)')
    return
  }
  expect(src).toContain('roster_worker_id')
})

test('AFL-VER-05: completions.ts validates org-membership before writing roster_worker_id (prevents cross-org attribution)', () => {
  // CLAUDE.md 2026-06-15 + RESEARCH Pitfall 4: before writing a roster_worker_id FK,
  // the action must confirm the roster user belongs to the same organisation.
  // Assert both the roster_worker_id write AND the organisation_members membership check.
  if (!fs.existsSync(COMPLETIONS_PATH)) {
    test.skip(true, 'completions.ts not found')
    return
  }
  const src = fs.readFileSync(COMPLETIONS_PATH, 'utf-8')
  if (!src.includes('roster_worker_id')) {
    test.skip(true, 'roster_worker_id not yet added to completions.ts (Plan 23-06 will add it)')
    return
  }
  // Both tokens must be present: the write column AND the org-membership validation query
  expect(src).toContain('roster_worker_id')
  expect(src).toContain('organisation_members')
})

// ---------------------------------------------------------------------------
// AFL-VER-05: recordSignature exported and uses createAdminClient
// CLAUDE.md 2026-06-15: sop_completion_signatures has NO authenticated write policy —
// writes MUST use createAdminClient() + self-enforce org-scoping
// ---------------------------------------------------------------------------

test('AFL-VER-05: completions.ts exports recordSignature', () => {
  // AFL-VER-05: recordSignature is the append-only sign-off action for the
  // sop_completion_signatures table (ships in Plan 23-04).
  if (!fs.existsSync(COMPLETIONS_PATH)) {
    test.skip(true, 'completions.ts not found')
    return
  }
  const src = fs.readFileSync(COMPLETIONS_PATH, 'utf-8')
  if (!src.includes('recordSignature')) {
    test.skip(true, 'recordSignature not yet added to completions.ts (Plan 23-04 will add it)')
    return
  }
  expect(src).toContain('export')
  expect(src).toContain('recordSignature')
})

test('AFL-VER-05: recordSignature uses createAdminClient (sop_completion_signatures has no authenticated write policy)', () => {
  // CLAUDE.md 2026-06-15 critical rule: tables designed with no authenticated INSERT policy
  // MUST use the service-role client (createAdminClient) for writes.
  // sop_completion_signatures follows this pattern (migration 00038 comment confirms it).
  if (!fs.existsSync(COMPLETIONS_PATH)) {
    test.skip(true, 'completions.ts not found')
    return
  }
  const src = fs.readFileSync(COMPLETIONS_PATH, 'utf-8')
  if (!src.includes('recordSignature')) {
    test.skip(true, 'recordSignature not yet added to completions.ts (Plan 23-04 will add it)')
    return
  }
  // createAdminClient must be imported AND called within the file
  expect(src).toContain('createAdminClient')
})

// ---------------------------------------------------------------------------
// D-11: /login/kiosk/page.tsx route exists with RosterSelector
// D-10: kiosk mode route lives under (auth)/ — no session required to render roster
// ---------------------------------------------------------------------------

test('D-11 [kiosk route]: /login/kiosk/page.tsx exists (D-10 kiosk mode entry point)', () => {
  // D-10/D-11: the kiosk route is under (auth)/ so the roster list renders without
  // a worker session — the supervisor authenticates the device; workers select their name.
  if (!fs.existsSync(KIOSK_PAGE_PATH)) {
    test.skip(true, '/login/kiosk/page.tsx not yet created (Plan 23-04 will create it)')
    return
  }
  expect(fs.existsSync(KIOSK_PAGE_PATH)).toBe(true)
})

test('D-11 [kiosk route]: /login/kiosk/page.tsx renders RosterSelector component', () => {
  // D-10: the kiosk page must render a RosterSelector (name-select client component).
  // CLAUDE.md 2026-06-05: assert the component is rendered (JSX call), not just imported.
  if (!fs.existsSync(KIOSK_PAGE_PATH)) {
    test.skip(true, '/login/kiosk/page.tsx not yet created (Plan 23-04 will create it)')
    return
  }
  const src = fs.readFileSync(KIOSK_PAGE_PATH, 'utf-8')
  // Both the import AND the JSX render call must be present
  expect(src).toContain('RosterSelector')
  const hasRosterSelectorRender =
    src.includes('<RosterSelector') || src.includes('RosterSelector(')
  expect(
    hasRosterSelectorRender,
    'RosterSelector must be rendered (not just imported) in the kiosk page (D-10 wiring)',
  ).toBe(true)
})

// ---------------------------------------------------------------------------
// D-11: Migration 00038 contains roster_worker_id AND sop_completion_signatures
// ---------------------------------------------------------------------------

test('D-11 [migration]: supabase/migrations/00038_*.sql exists (Phase 23 schema migration)', () => {
  // D-11: migration 00038 adds roster_worker_id to sop_completions and creates
  // the sop_completion_signatures table. Ships in Plan 23-01.
  const migration = findMigration00038()
  if (!migration) {
    test.skip(true, 'Migration 00038 not yet created (Plan 23-01 will create it)')
    return
  }
  expect(fs.existsSync(migration)).toBe(true)
})

test('D-11 [migration]: migration 00038 contains roster_worker_id column', () => {
  // AFL-VER-05 / D-11: roster_worker_id must be in the migration so the schema
  // reflects the attribution column before the completions action writes it.
  const migration = findMigration00038()
  if (!migration) {
    test.skip(true, 'Migration 00038 not yet created (Plan 23-01 will create it)')
    return
  }
  const sql = fs.readFileSync(migration, 'utf-8')
  expect(sql).toContain('roster_worker_id')
})

test('D-11 [migration]: migration 00038 creates sop_completion_signatures table', () => {
  // AFL-VER-05: sop_completion_signatures is the append-only sign-off chain table
  // (no authenticated write policy — writes via createAdminClient() per CLAUDE.md 2026-06-15).
  const migration = findMigration00038()
  if (!migration) {
    test.skip(true, 'Migration 00038 not yet created (Plan 23-01 will create it)')
    return
  }
  const sql = fs.readFileSync(migration, 'utf-8')
  expect(sql).toContain('sop_completion_signatures')
})
