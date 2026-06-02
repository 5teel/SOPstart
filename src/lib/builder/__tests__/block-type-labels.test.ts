/**
 * Phase 21.5 (Plan 21.5-01) — Unit tests for BLOCK_TYPE_LABELS + humanizeBlockType.
 *
 * TDD RED phase: tests written before implementation.
 *
 * R4 invariant: humanizeBlockType must NEVER return a string ending in 'Block'
 * or containing 'Grid' (unless the explicit 'Photo grid' label is returned).
 */

import { test, expect } from '@playwright/test'
import { BLOCK_TYPE_LABELS, humanizeBlockType } from '../block-type-labels'

// ---------------------------------------------------------------------------
// BLOCK_TYPE_LABELS shape
// ---------------------------------------------------------------------------

test('BLOCK_TYPE_LABELS exports a record with at least 14 keys', () => {
  expect(Object.keys(BLOCK_TYPE_LABELS).length).toBeGreaterThanOrEqual(14)
})

test('BLOCK_TYPE_LABELS entries have label and pillVariant fields', () => {
  for (const [key, val] of Object.entries(BLOCK_TYPE_LABELS)) {
    expect(val, `Entry for ${key} missing label`).toHaveProperty('label')
    expect(val, `Entry for ${key} missing pillVariant`).toHaveProperty('pillVariant')
    expect(typeof val.label).toBe('string')
    expect(typeof val.pillVariant).toBe('string')
  }
})

// ---------------------------------------------------------------------------
// humanizeBlockType — exact PascalCase lookups from SPEC table
// ---------------------------------------------------------------------------

test('humanizeBlockType("StepBlock") === "Step"', () => {
  expect(humanizeBlockType('StepBlock')).toBe('Step')
})

test('humanizeBlockType("HazardCardBlock") === "Hazard"', () => {
  expect(humanizeBlockType('HazardCardBlock')).toBe('Hazard')
})

test('humanizeBlockType("PhotoBlock") === "Photo"', () => {
  expect(humanizeBlockType('PhotoBlock')).toBe('Photo')
})

test('humanizeBlockType("MeasurementBlock") === "Measure"', () => {
  expect(humanizeBlockType('MeasurementBlock')).toBe('Measure')
})

test('humanizeBlockType("InspectBlock") === "Inspect"', () => {
  expect(humanizeBlockType('InspectBlock')).toBe('Inspect')
})

test('humanizeBlockType("DecisionBlock") === "Decision"', () => {
  expect(humanizeBlockType('DecisionBlock')).toBe('Decision')
})

test('humanizeBlockType("EscalateBlock") === "Escalate"', () => {
  expect(humanizeBlockType('EscalateBlock')).toBe('Escalate')
})

test('humanizeBlockType("SignOffBlock") === "Sign-off"', () => {
  expect(humanizeBlockType('SignOffBlock')).toBe('Sign-off')
})

test('humanizeBlockType("TextBlock") === "Text"', () => {
  expect(humanizeBlockType('TextBlock')).toBe('Text')
})

test('humanizeBlockType("HeadingBlock") === "Heading"', () => {
  expect(humanizeBlockType('HeadingBlock')).toBe('Heading')
})

test('humanizeBlockType("CalloutBlock") === "Callout"', () => {
  expect(humanizeBlockType('CalloutBlock')).toBe('Callout')
})

test('humanizeBlockType("PPECardBlock") === "PPE"', () => {
  expect(humanizeBlockType('PPECardBlock')).toBe('PPE')
})

test('humanizeBlockType("VoiceNoteBlock") === "Voice note"', () => {
  expect(humanizeBlockType('VoiceNoteBlock')).toBe('Voice note')
})

test('humanizeBlockType("ZoneBlock") === "Zone"', () => {
  expect(humanizeBlockType('ZoneBlock')).toBe('Zone')
})

// ---------------------------------------------------------------------------
// PhotoGrid legacy alias (SPEC R4 acceptance text names it explicitly)
// ---------------------------------------------------------------------------

test('humanizeBlockType("PhotoGrid") === "Photo grid"', () => {
  expect(humanizeBlockType('PhotoGrid')).toBe('Photo grid')
})

// ---------------------------------------------------------------------------
// Case-insensitive snapshot kind slug resolution
// ---------------------------------------------------------------------------

test('humanizeBlockType("step") resolves to "Step" (snapshot kind slug)', () => {
  expect(humanizeBlockType('step')).toBe('Step')
})

test('humanizeBlockType("hazard") resolves to "Hazard" (snapshot kind slug)', () => {
  expect(humanizeBlockType('hazard')).toBe('Hazard')
})

test('humanizeBlockType("measurement") resolves to "Measure" (snapshot kind slug)', () => {
  expect(humanizeBlockType('measurement')).toBe('Measure')
})

test('humanizeBlockType("STEP") resolves (case-insensitive)', () => {
  expect(humanizeBlockType('STEP')).toBe('Step')
})

// ---------------------------------------------------------------------------
// Fallback for unknown / empty input — R4 invariant
// ---------------------------------------------------------------------------

test('humanizeBlockType("unknown") returns "Block" fallback (safe non-symbol)', () => {
  expect(humanizeBlockType('unknown')).toBe('Block')
})

test('humanizeBlockType("") returns "Block" fallback', () => {
  expect(humanizeBlockType('')).toBe('Block')
})

test('humanizeBlockType("SomeRandomBlock") returns "Block" fallback, not the raw input', () => {
  const result = humanizeBlockType('SomeRandomBlock')
  // R4 invariant: must NOT echo the raw input (which ends in 'Block')
  // The safe fallback 'Block' is the single-word sentinel, not the raw symbol
  expect(result).not.toBe('SomeRandomBlock')
  expect(result).toBe('Block')
})

test('humanizeBlockType("WeirdGrid") returns "Block" fallback, not a value containing "Grid"', () => {
  const result = humanizeBlockType('WeirdGrid')
  // Must NOT echo raw input containing 'Grid' (except the explicit 'Photo grid' label)
  expect(result).not.toContain('Grid')
  expect(result).toBe('Block')
})

// ---------------------------------------------------------------------------
// R4 invariant sweep — no known type returns a value ending in 'Block'
// ---------------------------------------------------------------------------

test('R4 invariant: no known block type returns a label ending in "Block"', () => {
  const knownTypes = [
    'StepBlock', 'HazardCardBlock', 'MeasurementBlock', 'InspectBlock',
    'DecisionBlock', 'EscalateBlock', 'SignOffBlock', 'PhotoBlock',
    'TextBlock', 'HeadingBlock', 'CalloutBlock', 'PPECardBlock',
    'VoiceNoteBlock', 'ZoneBlock', 'PhotoGrid',
    'step', 'hazard', 'measurement', 'unknown', '',
  ]
  for (const type of knownTypes) {
    const label = humanizeBlockType(type)
    expect(label, `humanizeBlockType("${type}") = "${label}" — must not end in "Block" (except the safe fallback word "Block" itself is the whole string)`).not.toMatch(/.+Block$/)
  }
})

test('R4 invariant: no known block type returns a label containing "Grid" (other than "Photo grid")', () => {
  const knownTypes = [
    'StepBlock', 'HazardCardBlock', 'MeasurementBlock', 'InspectBlock',
    'DecisionBlock', 'EscalateBlock', 'SignOffBlock', 'PhotoBlock',
    'TextBlock', 'HeadingBlock', 'CalloutBlock', 'PPECardBlock',
    'VoiceNoteBlock', 'ZoneBlock',
    'step', 'hazard', 'measurement', 'unknown', '',
  ]
  for (const type of knownTypes) {
    const label = humanizeBlockType(type)
    expect(label, `humanizeBlockType("${type}") = "${label}" — must not contain uppercase "Grid"`).not.toContain('Grid')
  }
})
