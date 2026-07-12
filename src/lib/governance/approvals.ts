// ------------------------------------------------------------
// Chain-progression logic — PURE, no I/O, no supabase import, no
// 'use server' directive. Mirrors the extraction discipline of
// src/lib/governance/classify.ts (2026-06-27 learning: a sync export
// inside a 'use server' module breaks `next build`).
//
// resolveNextStepIndex / stepMatchesCaller / isChainComplete are the single
// source of truth for "who's next" / "is this chain done" across every
// approval surface (builder PublishStage, governance queue, approveStep
// server action) — Phase 29 D29-04.
// ------------------------------------------------------------

import type { AppRole } from '@/types/auth'

export interface ChainStep {
  role?: AppRole
  userId?: string
  label: string
}

/**
 * Returns the index of the first step with no APPROVED row, or -1 when every
 * step has been approved (chain complete). `approvedStepIndexes` must be
 * built from `sop_approvals` rows where action = 'approved' ONLY — a
 * 'changes_requested' row must never be treated as satisfying a step
 * (RESEARCH Pitfall 4).
 */
export function resolveNextStepIndex(stepCount: number, approvedStepIndexes: Set<number>): number {
  for (let i = 0; i < stepCount; i++) {
    if (!approvedStepIndexes.has(i)) return i
  }
  return -1
}

/** A step matches when its userId equals the caller's, OR its role equals the caller's role. */
export function stepMatchesCaller(step: ChainStep, caller: { userId: string; role: AppRole }): boolean {
  if (step.userId && step.userId === caller.userId) return true
  if (step.role && step.role === caller.role) return true
  return false
}

export function isChainComplete(stepCount: number, approvedStepIndexes: Set<number>): boolean {
  return resolveNextStepIndex(stepCount, approvedStepIndexes) === -1
}
