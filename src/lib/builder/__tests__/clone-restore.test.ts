/**
 * Phase 23 Plan 03 — Unit tests for version clone/restore lineage logic.
 *
 * TDD RED: tests written before full implementation exists.
 *
 * Tests cover:
 *   1. computeNextVersionLineage — pure lineage helper (N→N+1, parent resolution)
 *   2. restoreVersionAsNew append-only source-contract — no superseded_by:null, no old-row reactivation
 *
 * Static @/ imports used throughout (phase21.5-unit testDir resolves @/).
 * Dynamic import() is NOT used (CLAUDE.md 2026-06-24 learning).
 */

import { test, expect } from '@playwright/test'
import { computeNextVersionLineage } from '@/actions/versioning'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// 1. computeNextVersionLineage — lineage continuation logic
// ---------------------------------------------------------------------------

test('lineage: version increments from N to N+1', () => {
  const result = computeNextVersionLineage({ id: 'a0000000-0000-4000-8000-000000000001', version: 3, parent_sop_id: null })
  expect(result.newVersion).toBe(4)
})

test('lineage: version 1 becomes version 2', () => {
  const result = computeNextVersionLineage({ id: 'a0000000-0000-4000-8000-000000000001', version: 1, parent_sop_id: null })
  expect(result.newVersion).toBe(2)
})

test('lineage: when source has no parent_sop_id, newParentId is the source id (source is root)', () => {
  const sourceId = 'a0000000-0000-4000-8000-000000000001'
  const result = computeNextVersionLineage({ id: sourceId, version: 1, parent_sop_id: null })
  expect(result.newParentId).toBe(sourceId)
})

test('lineage: when source has a parent_sop_id, newParentId propagates the existing root', () => {
  const rootId = 'b0000000-0000-4000-8000-000000000002'
  const sourceId = 'c0000000-0000-4000-8000-000000000003'
  const result = computeNextVersionLineage({ id: sourceId, version: 2, parent_sop_id: rootId })
  expect(result.newParentId).toBe(rootId)
})

test('lineage: newParentId is never the source id when source already has a parent', () => {
  const rootId = 'b0000000-0000-4000-8000-000000000002'
  const sourceId = 'c0000000-0000-4000-8000-000000000003'
  const result = computeNextVersionLineage({ id: sourceId, version: 5, parent_sop_id: rootId })
  expect(result.newParentId).not.toBe(sourceId)
  expect(result.newParentId).toBe(rootId)
})

// ---------------------------------------------------------------------------
// 2. restoreVersionAsNew — append-only source-contract assertions
// D-06: restore never rewrites or reactivates old rows
// ---------------------------------------------------------------------------

const versioningPath = path.resolve(__dirname, '../../../actions/versioning.ts')

test('append-only invariant: restoreVersionAsNew is exported from versioning.ts', () => {
  const src = fs.readFileSync(versioningPath, 'utf-8')
  expect(src).toContain('export async function restoreVersionAsNew')
})

test('append-only invariant: restoreVersionAsNew does NOT set superseded_by to null on any old row', () => {
  const src = fs.readFileSync(versioningPath, 'utf-8')
  // Find the restoreVersionAsNew function body
  const fnStart = src.indexOf('export async function restoreVersionAsNew')
  expect(fnStart).toBeGreaterThan(-1)
  const fnBody = src.slice(fnStart)
  // Should not contain superseded_by: null anywhere in restoreVersionAsNew body
  expect(fnBody).not.toContain("superseded_by: null")
})

test('append-only invariant: restoreVersionAsNew does NOT set status to published on an old id', () => {
  const src = fs.readFileSync(versioningPath, 'utf-8')
  const fnStart = src.indexOf('export async function restoreVersionAsNew')
  expect(fnStart).toBeGreaterThan(-1)
  const fnBody = src.slice(fnStart)
  // Should not contain status: 'published' anywhere in restoreVersionAsNew body
  expect(fnBody).not.toContain("status: 'published'")
})

test('append-only invariant: restoreVersionAsNew delegates to cloneSopAsDraft (reuses deep-copy mechanism)', () => {
  const src = fs.readFileSync(versioningPath, 'utf-8')
  const fnStart = src.indexOf('export async function restoreVersionAsNew')
  expect(fnStart).toBeGreaterThan(-1)
  const fnBody = src.slice(fnStart)
  // restoreVersionAsNew should call cloneSopAsDraft
  expect(fnBody).toContain('cloneSopAsDraft')
})

test('append-only invariant: only static imports at file top-level (CLAUDE.md 2026-06-24)', () => {
  const testSrc = fs.readFileSync(__filename, 'utf-8')
  // Verify imports are static (import keyword at line start, not inside an expression)
  expect(testSrc).toContain("import { computeNextVersionLineage } from '@/actions/versioning'")
  // The imports are at the top — not inside functions or awaited expressions
  const importStatement = "import { computeNextVersionLineage } from '@/actions/versioning'"
  const importIdx = testSrc.indexOf(importStatement)
  expect(importIdx).toBeGreaterThan(-1)
  // Static import should appear before any test() call
  const firstTestIdx = testSrc.indexOf('test(')
  expect(importIdx).toBeLessThan(firstTestIdx)
})
