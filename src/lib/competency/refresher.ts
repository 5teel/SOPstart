// ------------------------------------------------------------
// refresherDueDate / isRefresherOverdue
// Pure helpers — worker refresher due-date math (REF-01/REF-02). No
// server-action directive, no I/O — sync exports so they stay directly
// unit-testable (2026-06-27 learning: a sync export inside a server-action
// module breaks `next build`). Mirrors the extraction discipline of
// src/lib/governance/cadences.ts.
//
// D-01: the worker's re-walkthrough clock, deliberately separate from
// sop_review_cadences (the document's review clock).
// D-02: an unset interval means no refresher at all — no org default, no
// category default. This is a null check, not a fallback ladder: the
// org/category cadence resolver used for the document review clock must
// NEVER be imported here.
// D-03: due-date math delegates to computeReviewDueDate (Phase 28) — never
// a second date implementation.
//
// nowIso is always an explicit parameter, never Date.now()/new Date()
// inside these functions, so the derivation stays deterministic and
// unit-testable.
//
// Consumers: src/lib/competency/matrix.ts, src/actions/competency.ts,
// src/app/(protected)/sops/page.tsx.
// ------------------------------------------------------------

import { computeReviewDueDate } from '@/lib/governance/cadences'

export function refresherDueDate(
  lastCompletionIso: string | null,
  intervalMonths: number | null
): string | null {
  if (lastCompletionIso === null || intervalMonths === null) return null
  return computeReviewDueDate(lastCompletionIso, intervalMonths)
}

export function isRefresherOverdue(dueIso: string | null, nowIso: string): boolean {
  if (dueIso === null) return false
  return nowIso > dueIso
}
