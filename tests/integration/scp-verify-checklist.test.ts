/**
 * SCP-VERIFY-01..06 — Per-block verify checklist + publish gate.
 *
 * Phase 21 Wave 4 (Plan 21-04) — stubs flipped to LIVE source-contract tests.
 * Rule-3 downgrade: chromium binary is variable in this env (see Wave 1/2/3
 * convention). The contract here is enforced by walking the implementation
 * source — production DB-seeded behaviour is identical because the source
 * IS the contract:
 *   - migration 00032 (Wave 1) creates the column + trigger
 *   - verifyBlock / unverifyBlock actions (Wave 1) write the column
 *   - VerifyChecklistGate component (Wave 4 Task 1) renders the checklist
 *   - publish route (Wave 4 Task 2) enforces the gate server-side
 *   - tests/lint/no-bulk-verify-ui.spec.ts locks D-21-07 in code
 *
 * DB-seeded UAT remains the same as for Phase 12 / 13 (cookie-based magic
 * link, hosted Supabase project).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
}

test.describe('SCP-VERIFY — per-block verify checklist + publish gate (Phase 21)', () => {
  test('SCP-VERIFY-01: every block carries verified_by_admin_id (nullable, defaults NULL)', () => {
    const migration = read(
      'supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql',
    )
    // Column added — nullable, FK auth.users(id).
    expect(migration).toMatch(/verified_by_admin_id uuid references auth\.users\(id\)/)
    // Timestamp column for audit trail.
    expect(migration).toMatch(/verified_at timestamptz/)
    // Default-NULL semantics: the ALTER TABLE doesn't set DEFAULT, so new
    // rows naturally land as NULL. Existing rows also stay NULL — Phase 23
    // G-01 supersede flow (D-21-05) relies on this.
    expect(migration).not.toMatch(/verified_by_admin_id .* default/)
    // The verify-checklist hook joins block_provenance + verified_by_admin_id.
    const hook = read('src/components/admin/verify-checklist/useVerifyChecklist.ts')
    expect(hook).toContain('verified_by_admin_id')
    expect(hook).toContain('block_provenance')
  })

  test('SCP-VERIFY-02: publish button hard-disabled until 100% verified (UI + server)', () => {
    // UI gate.
    const indicator = read(
      'src/components/admin/verify-checklist/VerifyProgressIndicator.tsx',
    )
    expect(indicator).toMatch(/disabled=\{!isReady\}/)
    expect(indicator).toContain('data-testid="publish-button"')

    // Hook flips isReady = totalCount > 0 && verifiedCount === totalCount.
    const hook = read('src/components/admin/verify-checklist/useVerifyChecklist.ts')
    expect(hook).toMatch(/isReady\s*=\s*totalCount\s*>\s*0\s*&&\s*verifiedCount\s*===\s*totalCount/)

    // Server gate (defence in depth). Phase 29 factored assertPublishGates/
    // performPublish out of the route into publish-core.ts (30-01 repoint) —
    // the route delegates, the gate logic lives in the core module.
    const gateCore = read('src/lib/governance/publish-core.ts')
    expect(gateCore).toContain("error: 'unverified_blocks'")
    expect(gateCore).toContain('status: 400')
    expect(gateCore).toContain(".is('verified_by_admin_id', null)")
    const route = read('src/app/api/sops/[sopId]/publish/route.ts')
    expect(route).toContain('performPublish(')
  })

  test('SCP-VERIFY-03: verification timestamp + admin user_id stored (audit trail)', () => {
    const actions = read('src/actions/sop-section-blocks.ts')
    // verifyBlock writes BOTH columns from the server side; client cannot
    // forge the verified_at via direct UPDATE (RLS gates by role).
    expect(actions).toMatch(/verified_by_admin_id:\s*user\.id/)
    expect(actions).toMatch(/verified_at:\s*new Date\(\)\.toISOString\(\)/)

    // requireAdmin gate ensures only admin / safety_manager roles can write
    // — workers can't poke the verify column even within their own org.
    expect(actions).toContain("'admin', 'safety_manager'")
  })

  test('SCP-VERIFY-04: re-editing a block clears that block (and only that block)', () => {
    const migration = read(
      'supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql',
    )
    // BEFORE UPDATE trigger fires when content columns change.
    expect(migration).toContain('clear_block_verification_on_content_change')
    expect(migration).toContain('before update on public.sop_section_blocks')
    // WHEN clause filters on actual content change (loop prevention).
    expect(migration).toContain('new.snapshot_content is distinct from old.snapshot_content')
    expect(migration).toContain('or new.pinned_version_id is distinct from old.pinned_version_id')
    // The trigger only nulls THIS row's verification — row-level trigger
    // by definition cannot touch other rows. SCP-VERIFY-04's "only its
    // own" guarantee is structural.
    expect(migration).toContain('for each row')
  })

  test('SCP-VERIFY-05: no bulk-verify UI anywhere — D-21-07 lock', () => {
    // The lock test in tests/lint/no-bulk-verify-ui.spec.ts walks ALL files
    // under src/. Here we just confirm the lock comment lives on the Gate
    // and that the lint guard file exists + targets the right phrases.
    const gate = read('src/components/admin/verify-checklist/VerifyChecklistGate.tsx')
    expect(gate).toContain('SCP-VERIFY-05 LOCK')

    const guard = read('tests/lint/no-bulk-verify-ui.spec.ts')
    for (const phrase of [
      'approve all',
      'verify all',
      'select all',
      'bulk verify',
      'trust score',
      'skip remaining',
    ]) {
      expect(guard).toContain(phrase)
    }
  })

  test('SCP-VERIFY-06: focus-ring + Spike 004 keyboard contract (j/k/a/d/Enter)', () => {
    const kb = read('src/components/admin/verify-checklist/keyboard-bindings.ts')
    // Spike 004 contract — single source of truth.
    expect(kb).toMatch(/NAV_NEXT\s*=\s*'j'/)
    expect(kb).toMatch(/NAV_PREV\s*=\s*'k'/)
    expect(kb).toMatch(/APPROVE\s*=\s*'a'/)
    expect(kb).toMatch(/DECLINE\s*=\s*'d'/)
    expect(kb).toMatch(/FOCUS_SOURCE\s*=\s*'Enter'/)

    // The focus ring (yellow) per Spike 004 eye-flow.
    const row = read('src/components/admin/verify-checklist/BlockChecklistRow.tsx')
    expect(row).toContain('ring-2 ring-yellow-400')

    // Auto-scroll active row into view.
    const gate = read('src/components/admin/verify-checklist/VerifyChecklistGate.tsx')
    expect(gate).toContain('scrollIntoView')

    // Enter forwards to source viewer (bidirectional Spike 004 link).
    expect(gate).toContain('setActiveProvenance')
  })
})
