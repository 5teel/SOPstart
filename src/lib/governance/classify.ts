// ------------------------------------------------------------
// classifyGovernanceRow
// Pure helper — classifies a single SOP's governance flags (unowned /
// overdue / due_soon / stale_role) from already-fetched, RLS-scoped inputs.
// No server-action directive, no I/O, no supabase import — sync export so it
// stays directly unit-testable (2026-06-27 learning: a sync export inside a
// server-action module breaks `next build`). Mirrors the extraction
// discipline of src/lib/builder/version-lineage.ts.
// ------------------------------------------------------------

export type GovernanceFlag = 'overdue' | 'due_soon' | 'unowned' | 'stale_role' | 'awaiting_approval'

export interface GovernanceInput {
  reviewDueAt: string | null // sops.review_due_at
  ownerUserId: string | null // sops.owner_user_id
  ownerIsActiveMember: boolean // computed via LEFT JOIN organisation_members
  danglingDepartmentRefs: boolean // sop_departments row references archived/missing department
  departmentRenamedSinceReview: boolean // departments.updated_at > sops.last_reviewed_at
  // Phase 29: sops.approval_state === 'pending'. Informational — visible to
  // EVERY admin regardless of whether they can act (GQ-01 glanceable
  // surface); who CAN act (isCallerNextApprover) is a per-viewer concern
  // surfaced on GovernanceRow, deliberately NOT part of this pure classifier.
  hasPendingApproval: boolean
  now?: Date
}

export const DUE_SOON_WINDOW_DAYS = 30

export function classifyGovernanceRow(input: GovernanceInput): GovernanceFlag[] {
  const now = input.now ?? new Date()
  const flags: GovernanceFlag[] = []

  if (input.ownerUserId === null || !input.ownerIsActiveMember) flags.push('unowned')

  if (input.reviewDueAt) {
    const due = new Date(input.reviewDueAt)
    if (due < now) flags.push('overdue')
    else if (due.getTime() - now.getTime() <= DUE_SOON_WINDOW_DAYS * 86_400_000) flags.push('due_soon')
  }

  if (input.danglingDepartmentRefs || input.departmentRenamedSinceReview) flags.push('stale_role')

  if (input.hasPendingApproval) flags.push('awaiting_approval')

  return flags
}
