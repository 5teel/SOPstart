/**
 * Phase 23 Plan 23-04 — gateWrite tiered approval gate unit tests.
 *
 * Registered under `phase23-unit` (testDir: './src/lib/ai-fields/__tests__').
 * Uses STATIC imports — dynamic import('@/...') fails in Playwright Node runner.
 * (CLAUDE.md 2026-04-24)
 *
 * 5 behaviors under test (D-01/D-02/A6):
 *   1. low-stake auto-applies    — gateWrite returns {outcome:'applied'} + calls descriptor.write exactly once
 *   2. high-stake → pending      — gateWrite returns {outcome:'pending_approval', proposalId} + NEVER calls write()
 *   3. published SOP forces high — even a low-stake descriptor returns pending_approval when sopIsPublished===true (D-02)
 *   4. ambiguity fails safe      — sopIsPublished===undefined on SOP-scoped field → require approval (A6 fail-safe)
 *   5. org-scope self-enforced   — proposal insert includes organisation_id from context
 *
 * Injectable seams: fake adminInsert fn + fake descriptor with spy write() so
 * tests never hit a real DB.
 *
 * Sources:
 *   - 23-04-PLAN.md Task 1 <behavior> block
 *   - 23-RESEARCH.md § Pattern 2 (lines 274–326)
 *   - 23-CONTEXT.md D-01/D-02, A6 fail-safe
 */
import { test, expect } from '@playwright/test'
import {
  gateWrite,
  isHighStakeContext,
  type AdminInsertFn,
} from '@/lib/ai-fields/approval'
import type { FieldDescriptor } from '@/lib/ai-fields/registry'
import type { FieldContext } from '@/lib/validators/ai-fields'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A minimal FieldContext with mandatory organisationId */
function ctx(overrides?: Partial<FieldContext>): FieldContext {
  return {
    organisationId: 'a0000001-0000-4000-8000-000000000001',
    ...overrides,
  }
}

/** Fake admin insert that returns a stable proposalId */
const FAKE_PROPOSAL_ID = 'b0000001-0000-4000-8000-000000000001'
const fakeAdminInsert: AdminInsertFn = async () => FAKE_PROPOSAL_ID

/** A write spy that records invocations */
function makeWriteSpy() {
  const calls: unknown[] = []
  const spy = async (_ctx: FieldContext, value: unknown) => {
    calls.push(value)
    return { outcome: 'applied' as const, value }
  }
  return { spy, calls }
}

// ─────────────────────────────────────────────────────────────────────────────
// Behavior 1: low-stake auto-applies
// D-01: stakeLevel:'low' + no published SOP flag → gateWrite calls descriptor.write() once
// ─────────────────────────────────────────────────────────────────────────────

test(
  'gateWrite [low-stake]: returns {outcome:"applied"} and calls descriptor.write exactly once',
  async () => {
    const { spy, calls } = makeWriteSpy()

    const lowDescriptor: FieldDescriptor = {
      id: 'test.low-field',
      label: 'Low Field',
      stakeLevel: 'low',
      read: async () => 'current',
      write: spy,
    }

    const result = await gateWrite(
      lowDescriptor,
      ctx(),
      'new-value',
      'old-value',
      fakeAdminInsert,
    )

    expect(result.outcome).toBe('applied')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe('new-value')
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Behavior 2: high-stake → pending_approval; write spy NOT called
// D-01: stakeLevel:'high' → creates pending proposal, NEVER calls descriptor.write()
// ─────────────────────────────────────────────────────────────────────────────

test(
  'gateWrite [high-stake]: returns {outcome:"pending_approval"} and does NOT call descriptor.write()',
  async () => {
    const { spy, calls } = makeWriteSpy()

    const highDescriptor: FieldDescriptor = {
      id: 'test.high-field',
      label: 'High Field',
      stakeLevel: 'high',
      read: async () => 'current',
      write: spy,
    }

    const result = await gateWrite(
      highDescriptor,
      ctx(),
      'proposed-value',
      'old-value',
      fakeAdminInsert,
    )

    expect(result.outcome).toBe('pending_approval')
    if (result.outcome === 'pending_approval') {
      expect(result.proposalId).toBe(FAKE_PROPOSAL_ID)
    }
    // CRITICAL: write spy must NOT have been invoked (T-23-04-01 mitigation)
    expect(calls).toHaveLength(0)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Behavior 3: published SOP forces high-stake even for low-stake descriptor
// D-02: "anything on a published SOP (content/metadata/assignments)" is high-stake
// ─────────────────────────────────────────────────────────────────────────────

test(
  'gateWrite [published-SOP forces high-stake]: low-stake descriptor returns pending_approval when sopIsPublished===true',
  async () => {
    const { spy, calls } = makeWriteSpy()

    const lowDescriptor: FieldDescriptor = {
      id: 'test.low-but-published',
      label: 'Low Field on Published SOP',
      stakeLevel: 'low',
      read: async () => 'current',
      write: spy,
    }

    const result = await gateWrite(
      lowDescriptor,
      ctx({
        sopId: 'c0000001-0000-4000-8000-000000000001',
        sopIsPublished: true,
      }),
      'proposed-value',
      'old-value',
      fakeAdminInsert,
    )

    expect(result.outcome).toBe('pending_approval')
    // Write spy must NOT have been invoked even though stakeLevel is 'low'
    expect(calls).toHaveLength(0)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Behavior 4: ambiguity fails safe (A6)
// When sopIsPublished===undefined for a SOP-scoped field, gateWrite treats as high-stake
// (fail-safe: require approval on ambiguity — RESEARCH.md A6)
// ─────────────────────────────────────────────────────────────────────────────

test(
  'gateWrite [A6 fail-safe]: sopIsPublished===undefined on SOP-scoped field → require approval (pending_approval)',
  async () => {
    const { spy, calls } = makeWriteSpy()

    const lowDescriptor: FieldDescriptor = {
      id: 'test.ambiguous-field',
      label: 'Ambiguous Field',
      stakeLevel: 'low',
      read: async () => 'current',
      write: spy,
    }

    // sopId present but sopIsPublished NOT set (undefined) → ambiguous → high-stake
    const result = await gateWrite(
      lowDescriptor,
      ctx({
        sopId: 'd0000001-0000-4000-8000-000000000001',
        // sopIsPublished: undefined (omitted)
      }),
      'proposed-value',
      'old-value',
      fakeAdminInsert,
    )

    expect(result.outcome).toBe('pending_approval')
    expect(calls).toHaveLength(0)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Behavior 5: org-scope self-enforced
// The proposal insert must include organisation_id from context (CLAUDE.md 2026-06-15)
// ─────────────────────────────────────────────────────────────────────────────

test(
  'gateWrite [org-scope]: proposal insert receives organisation_id from context',
  async () => {
    const capturedInserts: Array<{ organisationId: string }> = []

    const trackingInsert: AdminInsertFn = async (row) => {
      capturedInserts.push({ organisationId: row.organisation_id })
      return FAKE_PROPOSAL_ID
    }

    const highDescriptor: FieldDescriptor = {
      id: 'test.org-scope-field',
      label: 'Org Scope Field',
      stakeLevel: 'high',
      read: async () => 'current',
      write: async () => ({ outcome: 'applied', value: '' }),
    }

    const orgId = 'e0000001-0000-4000-8000-000000000001'
    await gateWrite(
      highDescriptor,
      ctx({ organisationId: orgId }),
      'proposed-value',
      'old-value',
      trackingInsert,
    )

    expect(capturedInserts).toHaveLength(1)
    expect(capturedInserts[0].organisationId).toBe(orgId)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// isHighStakeContext unit tests
// ─────────────────────────────────────────────────────────────────────────────

test(
  'isHighStakeContext: returns true for stakeLevel:"high" descriptor',
  () => {
    const d: FieldDescriptor = {
      id: 'x', label: 'X', stakeLevel: 'high', read: async () => null,
    }
    expect(isHighStakeContext(d, ctx())).toBe(true)
  },
)

test(
  'isHighStakeContext: returns true when sopIsPublished===true (D-02)',
  () => {
    const d: FieldDescriptor = {
      id: 'x', label: 'X', stakeLevel: 'low', read: async () => null,
    }
    expect(isHighStakeContext(d, ctx({ sopId: 'f0000001-0000-4000-8000-000000000001', sopIsPublished: true }))).toBe(true)
  },
)

test(
  'isHighStakeContext: returns true when sopId present but sopIsPublished undefined (A6 fail-safe)',
  () => {
    const d: FieldDescriptor = {
      id: 'x', label: 'X', stakeLevel: 'low', read: async () => null,
    }
    expect(isHighStakeContext(d, ctx({ sopId: 'g0000001-0000-4000-8000-000000000001' }))).toBe(true)
  },
)

test(
  'isHighStakeContext: returns false for low-stake with no SOP context (clear auto-apply case)',
  () => {
    const d: FieldDescriptor = {
      id: 'x', label: 'X', stakeLevel: 'low', read: async () => null,
    }
    expect(isHighStakeContext(d, ctx())).toBe(false)
  },
)
