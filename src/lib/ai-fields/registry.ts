/**
 * Phase 23 (Plan 23-02) — Unified AI field descriptor registry.
 *
 * STUB: This file is a Wave-0 scaffold placeholder.
 * Plan 23-02 replaces this stub with the full implementation.
 *
 * BACKEND/SERVER-ONLY: This module is consumed by server actions and API routes.
 * Do NOT import from client components (no React dependency).
 *
 * Exports (full implementation in Plan 23-02):
 *   - registerField(descriptor)  — idempotent registration (HMR-safe)
 *   - getField(id)               — lookup by field ID
 *   - getAllFields()              — all registered descriptors
 *
 * Sources:
 *   - 23-CONTEXT.md D-01/D-02/D-04 — tiered approval model
 *   - 23-RESEARCH.md Pattern 1 — registry design
 *   - 23-PATTERNS.md § registry.ts — typed Map pattern
 */

export type StakeLevel = 'low' | 'high'

export interface FieldContext {
  organisationId: string
  sopId?: string
  sectionId?: string
  stepId?: string
  memberId?: string
  sopIsPublished?: boolean
}

export type WriteResult =
  | { status: 'applied'; fieldId: string }
  | { status: 'pending_approval'; fieldId: string; proposalId: string }

export interface FieldDescriptor<T = unknown> {
  id: string
  label: string
  stakeLevel: StakeLevel
  /** AFL-AI-01: universal AI read — always allowed, no gate. */
  read: (ctx: FieldContext) => Promise<T>
  /** AFL-AI-02: write is gated by approval.ts gateWrite based on stakeLevel + context. */
  write?: (ctx: FieldContext, newValue: T) => Promise<WriteResult>
}

// Module-level Map — persists across requests in the same Node.js process.
// Do NOT use a React context (server actions and API routes need it without a React tree).
const registry = new Map<string, FieldDescriptor>()

/**
 * Register a field descriptor. Idempotent — re-registration on the same ID is a no-op.
 * HMR-safe: if the module re-executes, the existing registration is preserved.
 * (RESEARCH.md Pitfall 3 / D-04)
 *
 * STUB: Plan 23-02 adds full implementation. This no-op stub allows static imports
 * to resolve during Wave-0 test discovery.
 */
export function registerField<T>(descriptor: FieldDescriptor<T>): void {
  if (registry.has(descriptor.id)) {
    // Idempotent — re-registration on HMR is a no-op
    return
  }
  registry.set(descriptor.id, descriptor as FieldDescriptor)
}

/**
 * Look up a registered field by ID.
 * Returns undefined if not found — callers must guard: if (!descriptor) return error
 *
 * STUB: Plan 23-02 adds full implementation.
 */
export function getField(id: string): FieldDescriptor | undefined {
  return registry.get(id)
}

/**
 * Return all registered field descriptors.
 * Used by admin UI + test scaffold to enumerate available fields.
 *
 * STUB: Plan 23-02 adds full implementation.
 */
export function getAllFields(): FieldDescriptor[] {
  return Array.from(registry.values())
}
