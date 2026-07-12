/**
 * Phase 21 (Plan 21-04 Task 2) — publish-gate integration tests.
 *
 * Source-contract style: this file walks the publish-route source AND the
 * getPublishGateStatus action source to assert the gate is wired correctly
 * end-to-end. Live DB seeding would require a hosted Supabase project —
 * deferred to manual UAT per Wave-1/2/3 convention (see Phase 12 / 13 UAT
 * scripting in CLAUDE.md).
 *
 * What this guards:
 *   - POST /api/sops/[sopId]/publish has the verify-gate branch wired
 *     (queries sop_section_blocks for verified_by_admin_id IS NULL).
 *   - The branch is bypassed for source_type === 'ai_prompt' (CONV-12)
 *     and for SOPs with no source_file_path (pre-Phase-20).
 *   - The branch returns `{ error: 'unverified_blocks', count }` on 400.
 *   - getPublishGateStatus mirrors the server-side bypass logic.
 *   - BuilderStageShell wires onPublish through to the POST.
 *
 * Phase 30 (30-01): repointed off the deleted legacy Phase-21 shell onto
 * BuilderStageShell, and gate reads onto src/lib/governance/publish-core.ts
 * (Phase 29 factored assertPublishGates/performPublish out of the route).
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..')
const PUBLISH_ROUTE = path.join(
  REPO_ROOT,
  'src',
  'app',
  'api',
  'sops',
  '[sopId]',
  'publish',
  'route.ts',
)
const ACTIONS = path.join(REPO_ROOT, 'src', 'actions', 'sop-section-blocks.ts')
// Phase 29 factored the publish gates out of the route into publish-core.
const GATE_CORE = path.join(REPO_ROOT, 'src', 'lib', 'governance', 'publish-core.ts')
const BUILDER = path.join(
  REPO_ROOT,
  'src',
  'app',
  '(protected)',
  'admin',
  'sops',
  'builder',
  '[sopId]',
  'BuilderStageShell.tsx',
)

test('publish gate queries sop_section_blocks for verified_by_admin_id IS NULL (publish-core)', () => {
  const src = fs.readFileSync(GATE_CORE, 'utf8')
  expect(src).toContain('verified_by_admin_id')
  expect(src).toContain("sop_section_blocks")
  // The actual count-via-PostgREST pattern.
  expect(src).toContain(".is('verified_by_admin_id', null)")
  // The route still delegates to the gate (end-to-end wiring).
  const route = fs.readFileSync(PUBLISH_ROUTE, 'utf8')
  expect(route).toContain('performPublish(')
})

test('publish gate rejects with 400 + { error: "unverified_blocks", count }', () => {
  const src = fs.readFileSync(GATE_CORE, 'utf8')
  expect(src).toContain("error: 'unverified_blocks'")
  // The numeric count must be in the response body for the UI to render.
  expect(src).toMatch(/count:\s*unverifiedCount/)
  expect(src).toContain('status: 400')
})

test('publish gate bypasses verify gate for ai_prompt sources (CONV-12)', () => {
  const src = fs.readFileSync(GATE_CORE, 'utf8')
  expect(src).toContain("sourceType !== 'ai_prompt'")
})

test('publish gate bypasses verify gate for pre-Phase-20 SOPs (no source_file_path)', () => {
  const src = fs.readFileSync(GATE_CORE, 'utf8')
  expect(src).toMatch(/!!sourceFilePath/)
})

test('getPublishGateStatus mirrors server-side bypass for ai_prompt + no-source', () => {
  const src = fs.readFileSync(ACTIONS, 'utf8')
  expect(src).toContain('export async function getPublishGateStatus')
  expect(src).toMatch(/sourceType === 'ai_prompt'/)
  expect(src).toMatch(/!sourceFilePath/)
  // Bypassed payload shape.
  expect(src).toMatch(/bypassed:\s*true/)
})

test('getPublishGateStatus returns ready=true only when verifiedCount === totalCount', () => {
  const src = fs.readFileSync(ACTIONS, 'utf8')
  expect(src).toMatch(/ready:\s*totalNum\s*>\s*0\s*&&\s*unverifiedNum\s*===\s*0/)
})

test('BuilderStageShell wires handlePublish to POST /publish with the gate rules', () => {
  const src = fs.readFileSync(BUILDER, 'utf8')
  // Shared source of gate truth for stepper + stages.
  expect(src).toContain('useVerifyChecklist')
  // POST endpoint URL used.
  expect(src).toMatch(/\/api\/sops\/\$\{sopId\}\/publish/)
  // Method must be POST.
  expect(src).toMatch(/method:\s*'POST'/)
  // Error-banner UI for the unverified_blocks response.
  expect(src).toContain("'unverified_blocks'")
  // Gate visibility honours the same bypass rules.
  expect(src).toMatch(/showVerifyGate/)
})

test('Publish button on builder header is REMOVED (gate owns publish surface)', () => {
  // Wave 1 placeholder span lived at data-testid="publish-button-placeholder"
  // in BuilderClient.tsx. Wave 4 removes it; verify it's gone.
  const builderClient = fs.readFileSync(
    path.join(
      REPO_ROOT,
      'src',
      'app',
      '(protected)',
      'admin',
      'sops',
      'builder',
      '[sopId]',
      'BuilderClient.tsx',
    ),
    'utf8',
  )
  expect(builderClient).not.toContain('publish-button-placeholder')
  // The replacement comment must mention the gate so future readers find it.
  expect(builderClient).toContain('VerifyChecklistGate')
})

test('Migration 00032 trigger clears verification on content change (Wave 1 contract)', () => {
  // Wave 1 DB trigger is the mechanism that handles SCP-VERIFY-04. Re-state
  // here so the publish-gate test suite locks the contract end-to-end.
  const migration = fs.readFileSync(
    path.join(
      REPO_ROOT,
      'supabase',
      'migrations',
      '00032_phase21_verified_by_and_ai_review_results.sql',
    ),
    'utf8',
  )
  expect(migration).toContain('clear_block_verification_on_content_change')
  expect(migration).toContain('snapshot_content is distinct from old.snapshot_content')
  expect(migration).toContain('new.verified_by_admin_id := null')
})
