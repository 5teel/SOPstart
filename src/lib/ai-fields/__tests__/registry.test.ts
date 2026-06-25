/**
 * Phase 23 — AFL-AI-03: Field registry behavioral unit tests (static imports).
 *
 * Registered under the `phase23-unit` Playwright project:
 *   testDir: './src/lib/ai-fields/__tests__'
 * This ensures Playwright's TS compiler resolves @/ path aliases via static imports.
 *
 * CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
 * outside a testDir-scoped project. Use STATIC @/ imports here (mirrors intent-classifier.test.ts
 * pattern in src/lib/voice/__tests__/ under phase15-unit).
 *
 * NEVER use `await import('@/lib/ai-fields/registry')` here — it will fail at runtime
 * in the Playwright Node runner with "SyntaxError: Unexpected token 'export'".
 *
 * Plan 23-02: test.fixme markers removed — registry.ts full implementation is live.
 *
 * The 4 behavioral contracts:
 *   1. round-trip  — registerField + getField returns same descriptor
 *   2. idempotent  — re-registering same ID does not duplicate (HMR-safe)
 *   3. read        — getField('id').read(context) resolves to the registered value
 *   4. getAllFields — getAllFields() includes a registered descriptor
 *
 * Sources:
 *   - 23-RESEARCH.md Pattern 1 — registry contract (lines 188–247)
 *   - 23-PATTERNS.md § src/lib/ai-fields/__tests__/registry.test.ts
 *   - 23-CONTEXT.md D-04 — field IDs use {namespace}.{name} dot-notation
 */
import { test, expect } from '@playwright/test'
import { registerField, getField, getAllFields } from '@/lib/ai-fields/registry'

// ---------------------------------------------------------------------------
// Behavioral test 1: registry round-trip
// AFL-AI-03: registerField stores a descriptor; getField retrieves it by ID
// ---------------------------------------------------------------------------

test(
  'AFL-AI-03 [round-trip]: registerField + getField returns descriptor with matching id + label',
  async () => {
    registerField({
      id: 'test.round-trip',
      label: 'Round Trip Test',
      stakeLevel: 'low',
      read: async () => 'round-trip-value',
    })

    const descriptor = getField('test.round-trip')

    expect(descriptor).toBeDefined()
    expect(descriptor?.id).toBe('test.round-trip')
    expect(descriptor?.label).toBe('Round Trip Test')
  },
)

// ---------------------------------------------------------------------------
// Behavioral test 2: idempotent registration (HMR-safe)
// AFL-AI-03 / D-04 / RESEARCH Pitfall 3: re-registering the same ID is a no-op
// ---------------------------------------------------------------------------

test(
  'AFL-AI-03 [idempotent]: registering the same ID twice does not throw and getAllFields count does not increase',
  async () => {
    const id = 'test.idempotent'
    const descriptor = {
      id,
      label: 'Idempotent Test',
      stakeLevel: 'low' as const,
      read: async () => 'v1',
    }

    registerField(descriptor)
    const countAfterFirst = getAllFields().length

    // Second registration of same ID — must be a no-op, not an addition
    registerField(descriptor)
    const countAfterSecond = getAllFields().length

    expect(countAfterSecond).toBe(countAfterFirst)
  },
)

// ---------------------------------------------------------------------------
// Behavioral test 3: read returns current value
// AFL-AI-01: the `read` function on FieldDescriptor is callable with a FieldContext
// ---------------------------------------------------------------------------

test(
  'AFL-AI-03 [read]: getField(id).read(context) resolves to the value returned by the registered read function',
  async () => {
    registerField({
      id: 'test.read',
      label: 'Read Test',
      stakeLevel: 'low',
      read: async (_ctx) => 'expected-read-value',
    })

    const descriptor = getField('test.read')
    expect(descriptor).toBeDefined()

    const value = await descriptor!.read({
      // FieldContext shape from 23-RESEARCH.md Pattern 1 + validators/ai-fields.ts
      organisationId: 'a0000001-0000-4000-8000-000000000001',
    })

    expect(value).toBe('expected-read-value')
  },
)

// ---------------------------------------------------------------------------
// Behavioral test 4: getAllFields lists registered descriptors
// AFL-AI-03: getAllFields() must return at least the descriptors registered above
// ---------------------------------------------------------------------------

test(
  'AFL-AI-03 [getAllFields]: getAllFields() includes a descriptor registered during this suite',
  async () => {
    const id = 'test.list-check'
    registerField({
      id,
      label: 'List Check',
      stakeLevel: 'high',
      read: async () => null,
    })

    const all = getAllFields()
    const found = all.find((d) => d.id === id)

    expect(found).toBeDefined()
    expect(found?.label).toBe('List Check')
  },
)
