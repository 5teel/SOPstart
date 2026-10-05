/**
 * Phase 21 (Plan 21-04 Task 2) — publish-gate integration tests.
 *
 * Source-contract style: this file walks the publish-route source AND the
 * getPublishGateStatus action source to assert the gate is wired correctly
 * end-to-end. Live DB seeding would require a hosted Supabase project —
 * deferred to manual UAT per Wave-1/2/3 convention (see Phase 12 / 13 UAT
 * scripting in CLAUDE.md).
 *
 * What this guards (Phase 58 D-16: the gate counts focus steps, not blocks):
 *   - The gate in publish-core counts sop_focus_steps (none / unticked) and open
 *     sop_ai_findings, for every SOP, with no ai_prompt / no-source bypass.
 *   - It returns `{ error: 'unverified_steps', count }` on 400.
 *   - getPublishGateStatus answers from the same three tables.
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
const STATUS_ACTION = path.join(REPO_ROOT, 'src', 'actions', 'publish-gate.ts')
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

test('publish gate counts focus steps, ticks and open findings (publish-core)', () => {
  const src = fs.readFileSync(GATE_CORE, 'utf8')
  expect(src).toContain("from('sop_focus_steps')")
  expect(src).toContain("from('sop_ai_findings')")
  expect(src).toContain(".is('verified_by_admin_id', null)")
  expect(src).toContain(".is('cleared_at', null)")
  // The route still delegates to the gate (end-to-end wiring).
  const route = fs.readFileSync(PUBLISH_ROUTE, 'utf8')
  expect(route).toContain('performPublish(')
})

test('publish gate rejects with 400 + { error: "unverified_steps", count }', () => {
  const src = fs.readFileSync(GATE_CORE, 'utf8')
  expect(src).toContain("error: 'unverified_steps'")
  // The numeric count must be in the response body for the UI to render.
  expect(src).toMatch(/count:\s*unticked/)
  expect(src).toContain('status: 400')
})

test('publish gate has no bypass for any source (D-16)', () => {
  const src = fs.readFileSync(GATE_CORE, 'utf8')
  const start = src.indexOf('export async function assertPublishGates(')
  const end = src.indexOf('\nexport ', start + 1)
  const body = src.slice(start, end)
  expect(body).not.toContain('ai_prompt')
  expect(body).not.toContain('source_file_path')
})

test('getPublishGateStatus answers from the same three counts as the gate', () => {
  const src = fs.readFileSync(STATUS_ACTION, 'utf8')
  expect(src).toContain('export async function getPublishGateStatus')
  expect(src).toContain("from('sop_focus_steps')")
  expect(src).toContain("from('sop_ai_findings')")
  expect(src).toContain(".is('verified_by_admin_id', null)")
  expect(src).toContain(".is('cleared_at', null)")
  expect(src).not.toContain('ai_prompt')
})

test('BuilderStageShell wires handlePublish to POST /publish with the gate rules', () => {
  const src = fs.readFileSync(BUILDER, 'utf8')
  // Shared source of gate truth for stepper + stages.
  expect(src).toContain('useVerifyChecklist')
  // POST endpoint URL used.
  expect(src).toMatch(/\/api\/sops\/\$\{sopId\}\/publish/)
  // Method must be POST.
  expect(src).toMatch(/method:\s*'POST'/)
  // Error-banner UI for the unverified_steps response.
  expect(src).toContain("'unverified_steps'")
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
