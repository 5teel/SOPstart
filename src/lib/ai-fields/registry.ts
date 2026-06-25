/**
 * Phase 23 (Plan 23-02) — Unified AI field descriptor registry.
 *
 * BACKEND/SERVER-ONLY: This module is consumed by server actions and API routes.
 * Do NOT import from client components (no React dependency).
 *
 * Exports:
 *   - registerField(descriptor)  — idempotent registration (HMR-safe)
 *   - getField(id)               — lookup by field ID
 *   - getAllFields()              — all registered descriptors
 *
 * v5.0-consumable (D-04): the registry is a plain module-level Map with no
 * React context dependency. Server actions, API routes, and the future
 * conversational agent can all drive it programmatically without a React tree.
 *
 * Field IDs use dot-notation: {namespace}.{name}, e.g. 'sop.title'.
 *
 * Sources:
 *   - 23-CONTEXT.md D-01/D-02/D-04 — tiered approval model; v5.0-consumable
 *   - 23-RESEARCH.md Pattern 1 — registry design (lines 188-269)
 *   - 23-PATTERNS.md § registry.ts — typed Map pattern (lines 100-153)
 */

// Re-export FieldContext from validators — single source of truth.
export type { FieldContext, StakeLevel } from '@/lib/validators/ai-fields'
import type { FieldContext, StakeLevel } from '@/lib/validators/ai-fields'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WriteResult =
  | { outcome: 'applied'; value: unknown }
  | { outcome: 'pending_approval'; proposalId: string }

export interface FieldDescriptor<T = unknown> {
  /** Dot-notation field ID, e.g. 'sop.title' (D-04). */
  id: string
  /** Human-readable label, e.g. 'SOP Title'. */
  label: string
  /**
   * Stake level for the approval gate (D-01/D-02).
   * low  — auto-applied immediately.
   * high — routes to pending proposal for admin review.
   */
  stakeLevel: StakeLevel
  /** AFL-AI-01: universal read — always allowed, no gate. */
  read: (ctx: FieldContext) => Promise<T>
  /** AFL-AI-02: write is gated by approval.ts gateWrite based on stakeLevel + context. */
  write?: (ctx: FieldContext, newValue: T) => Promise<WriteResult>
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// Module-level Map — persists across requests in the same Node.js process.
// Do NOT use a React context (server actions and API routes need it without
// a React tree — anti-pattern per 23-RESEARCH.md).
const registry = new Map<string, FieldDescriptor>()

/**
 * Register a field descriptor.
 *
 * Idempotent — re-registration on the same ID is a no-op.
 * HMR-safe: if the module re-executes, the existing registration is preserved.
 * (23-RESEARCH.md Pitfall 3 / D-04)
 *
 * @param descriptor  FieldDescriptor to register.
 */
export function registerField<T>(descriptor: FieldDescriptor<T>): void {
  if (registry.has(descriptor.id)) {
    // Idempotent — re-registration on HMR is a no-op (RESEARCH.md Pitfall 3)
    return
  }
  registry.set(descriptor.id, descriptor as FieldDescriptor)
}

/**
 * Look up a registered field by ID.
 * Returns undefined if not found — callers must guard: if (!descriptor) return error.
 *
 * @param id  Dot-notation field ID, e.g. 'sop.title'.
 */
export function getField(id: string): FieldDescriptor | undefined {
  return registry.get(id)
}

/**
 * Return all registered field descriptors.
 * Used by admin tooling + test scaffold to enumerate available fields.
 */
export function getAllFields(): FieldDescriptor[] {
  return Array.from(registry.values())
}
