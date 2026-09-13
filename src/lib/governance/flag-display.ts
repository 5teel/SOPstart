// Phase 41 Plan 02 — governance flag display maps, extracted verbatim from
// `src/app/(protected)/admin/sops/page.tsx` (:50-111) so the new admin lenses
// (client `useQuery` fetchers, next/dynamic-wrapped per D-03) can import
// them. Plain module — no 'use server' / 'use client' — because a pure sync
// export in a 'use server' file fails `next build` with "Server Actions must
// be async functions" while passing `tsc` (CLAUDE.md 2026-06-27).
//
// `src/components/admin/governance/GovernanceQueueRow.tsx` deliberately keeps
// its OWN private copies of FLAG_STYLE/FLAG_LABEL (it is 'use client' and
// pre-dates this module). Do NOT refactor that file to import from here —
// `tests/phase30/list-rows.spec.ts` is the sync contract between the two and
// that sync contract is out of scope for this plan.

import type { GovernanceFlag } from '@/lib/governance/classify'

// UX-06 one-line rows: ONE flag chip per row, worst-first. Styling mirrors
// GovernanceQueueRow's FLAG_STYLE/FLAG_LABEL (that file is 'use client', so
// its consts can't be imported into this server component — kept in sync by
// the phase30 list-rows spec).
export const FLAG_PRIORITY: GovernanceFlag[] = ['overdue', 'due_soon', 'awaiting_approval', 'unowned', 'stale_role']

export const FLAG_STYLE: Record<GovernanceFlag, string> = {
  overdue: 'bg-red-500/20 text-red-600',
  due_soon: 'bg-amber-500/20 text-amber-700',
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
