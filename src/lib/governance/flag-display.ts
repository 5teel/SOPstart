// Phase 41 Plan 02 — governance flag display maps, extracted verbatim from
// `src/app/(protected)/admin/sops/page.tsx` (:50-111) so the new admin lenses
// (client `useQuery` fetchers, next/dynamic-wrapped per D-03) can import
// them. Plain module — no 'use server' / 'use client' — because a pure sync
// export in a 'use server' file fails `next build` with "Server Actions must
// be async functions" while passing `tsc` (CLAUDE.md 2026-06-27).
//
// The old governance queue row (deleted in Phase 59) kept private copies of
// these maps; this module is now their only home.

import type { GovernanceFlag } from '@/lib/governance/classify'

// UX-06 one-line rows: ONE flag chip per row, worst-first.
export const FLAG_PRIORITY: GovernanceFlag[] = ['overdue', 'due_soon', 'awaiting_approval', 'unowned', 'stale_role']

export const FLAG_STYLE: Record<GovernanceFlag, string> = {
  overdue: 'bg-accent-escalate/20 text-accent-escalate',
  due_soon: 'bg-accent-decision/20 text-accent-decision',
  unowned: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  stale_role: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  awaiting_approval: 'bg-[var(--accent-signoff)]/20 text-[var(--accent-signoff)]',
}

export const FLAG_LABEL: Record<GovernanceFlag, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  unowned: 'No owner',
  stale_role: 'Owner role gone',
  awaiting_approval: 'Awaiting approval',
}

// Plain-language group blurbs for the attention view (sketch 004: the queue
// is grouped by problem, worst first — no chip row).
export const FLAG_DESC: Record<GovernanceFlag, string> = {
  overdue: 'past their review date',
  due_soon: 'review due within 30 days',
  unowned: 'nobody is responsible for keeping these current',
  stale_role: 'the owning role was deleted from Team',
  awaiting_approval: 'waiting on an approval step',
}
