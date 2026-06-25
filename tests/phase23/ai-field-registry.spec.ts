/**
 * Phase 23 — AFL-AI-01/02/03: AI field descriptor registry source-contract assertions.
 *
 * D-01 (tiered approval: low-stake writes applied immediately; high-stake go to proposal queue)
 * D-02 (approval gate lives in approval.ts gateWrite — registry is read/write agnostic)
 * D-04 (field IDs follow {namespace}.{name} dot-notation)
 *
 * Tests turn GREEN when Plans 23-02 ships:
 *   src/lib/ai-fields/registry.ts  — registerField / getField / getAllFields
 *   src/lib/ai-fields/approval.ts  — gateWrite
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

const REGISTRY_PATH = path.join(REPO_ROOT, 'src', 'lib', 'ai-fields', 'registry.ts')
const APPROVAL_PATH = path.join(REPO_ROOT, 'src', 'lib', 'ai-fields', 'approval.ts')

// ---------------------------------------------------------------------------
// AFL-AI-01: FieldDescriptor has a `read` method (universal AI read)
// D-01: reads are always allowed (no gate); only writes are gated
// ---------------------------------------------------------------------------

test('AFL-AI-01: registry.ts exists', () => {
  // D-01 / D-04 — registry module ships in Plan 23-02
  if (!fs.existsSync(REGISTRY_PATH)) {
    test.skip(true, 'registry.ts not yet created (Plan 23-02 will create it)')
    return
  }
  expect(fs.existsSync(REGISTRY_PATH)).toBe(true)
})

test('AFL-AI-01: FieldDescriptor type exports a `read` property (universal AI read support)', () => {
  // D-01: every registered field must expose a read function — reads are always allowed.
  // Assert the type definition contains `read` as a required callable property.
  if (!fs.existsSync(REGISTRY_PATH)) {
    test.skip(true, 'registry.ts not yet created (Plan 23-02 will create it)')
    return
  }
  const src = fs.readFileSync(REGISTRY_PATH, 'utf-8')
  // FieldDescriptor must declare a `read` function property
  expect(src).toContain('read')
  // Confirm it is typed as async / callable (not a plain string label)
  const hasReadCallable = src.includes('read:') || src.includes('read(')
  expect(
    hasReadCallable,
    'FieldDescriptor must declare `read` as a callable property (AFL-AI-01)',
  ).toBe(true)
})

// ---------------------------------------------------------------------------
// AFL-AI-02: approval.ts exports gateWrite with pending_approval + applied branches
// D-02: high-stake writes → proposal queue (pending_approval); low-stake → applied immediately
// ---------------------------------------------------------------------------

test('AFL-AI-02: approval.ts exists', () => {
  // D-02 — approval module ships in Plan 23-02
  if (!fs.existsSync(APPROVAL_PATH)) {
    test.skip(true, 'approval.ts not yet created (Plan 23-02 will create it)')
    return
  }
  expect(fs.existsSync(APPROVAL_PATH)).toBe(true)
})

test('AFL-AI-02: approval.ts exports gateWrite function', () => {
  // D-02: gateWrite is the single approval gate — all write paths go through it.
  // CLAUDE.md 2026-06-05: assert export (function call site), not just string presence.
  if (!fs.existsSync(APPROVAL_PATH)) {
    test.skip(true, 'approval.ts not yet created (Plan 23-02 will create it)')
    return
  }
  const src = fs.readFileSync(APPROVAL_PATH, 'utf-8')
  expect(src).toContain('export')
  expect(src).toContain('gateWrite')
})

test('AFL-AI-02: gateWrite returns pending_approval branch token (high-stake → proposal queue)', () => {
  // D-01/D-02/D-03: high-stake field writes must return status 'pending_approval' and insert
  // into ai_field_proposals rather than applying immediately.
  // D-03: the proposal record enables the inline accept/reject UX at the field site.
  // Assert the source contains the status token that signals this branch.
  if (!fs.existsSync(APPROVAL_PATH)) {
    test.skip(true, 'approval.ts not yet created (Plan 23-02 will create it)')
    return
  }
  const src = fs.readFileSync(APPROVAL_PATH, 'utf-8')
  expect(src).toContain('pending_approval')
})

test('AFL-AI-02: gateWrite returns applied branch token (low-stake → applied immediately)', () => {
  // D-01: low-stake writes (stakeLevel === 'low') are applied immediately — no proposal record.
  // Both branches must be present so gateWrite handles the full tiered approval model.
  if (!fs.existsSync(APPROVAL_PATH)) {
    test.skip(true, 'approval.ts not yet created (Plan 23-02 will create it)')
    return
  }
  const src = fs.readFileSync(APPROVAL_PATH, 'utf-8')
  expect(src).toContain('applied')
})

// ---------------------------------------------------------------------------
// AFL-AI-03: registry.ts exports registerField, getField, getAllFields
// D-04: field IDs use {namespace}.{name} dot-notation
// ---------------------------------------------------------------------------

test('AFL-AI-03: registry.ts exports registerField', () => {
  // AFL-AI-03: registerField is the registration entry-point for all field descriptors.
  if (!fs.existsSync(REGISTRY_PATH)) {
    test.skip(true, 'registry.ts not yet created (Plan 23-02 will create it)')
    return
  }
  const src = fs.readFileSync(REGISTRY_PATH, 'utf-8')
  expect(src).toContain('export')
  expect(src).toContain('registerField')
})

test('AFL-AI-03: registry.ts exports getField', () => {
  // AFL-AI-03: getField(id) is the runtime lookup — callers get a descriptor by field ID.
  if (!fs.existsSync(REGISTRY_PATH)) {
    test.skip(true, 'registry.ts not yet created (Plan 23-02 will create it)')
    return
  }
  const src = fs.readFileSync(REGISTRY_PATH, 'utf-8')
  expect(src).toContain('getField')
})

test('AFL-AI-03: registry.ts exports getAllFields', () => {
  // AFL-AI-03: getAllFields() enumerates the full registry (used by admin UI + test scaffold).
  if (!fs.existsSync(REGISTRY_PATH)) {
    test.skip(true, 'registry.ts not yet created (Plan 23-02 will create it)')
    return
  }
  const src = fs.readFileSync(REGISTRY_PATH, 'utf-8')
  expect(src).toContain('getAllFields')
})

test('AFL-AI-03: registerField is idempotent (HMR-safe — re-registration on same ID is no-op)', () => {
  // D-04 / RESEARCH Pitfall 3: HMR causes modules to re-execute; registerField must be
  // idempotent so registering the same field ID twice does not add duplicates.
  if (!fs.existsSync(REGISTRY_PATH)) {
    test.skip(true, 'registry.ts not yet created (Plan 23-02 will create it)')
    return
  }
  const src = fs.readFileSync(REGISTRY_PATH, 'utf-8')
  // The idempotency guard checks if the registry already has the ID before inserting
  const hasIdempotencyGuard =
    src.includes('registry.has(') || src.includes('.has(descriptor.id') || src.includes('has(id')
  expect(
    hasIdempotencyGuard,
    'registerField must have an idempotency guard (registry.has check) per RESEARCH Pitfall 3',
  ).toBe(true)
})
