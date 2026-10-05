/**
 * Phase 59 / DEC-02 (D-09) -- the read side of the decision ledger: which filter
 * group a kind sits in, what each kind is called in plain words, how many rows a
 * page holds and how the next page is addressed. Plain module, no directive --
 * importable from the Decisions tab (client) and listDecisions (server).
 *
 * Every DECISION_KINDS value sits in exactly one group (spec-pinned). The
 * server action validates a cursor before it reaches cursorFilter; this only
 * formats it.
 */
import type { DecisionKind } from '@/lib/decisions/shape'

export type DecisionGroupKey = 'all' | 'approvals' | 'signoffs' | 'ownership' | 'publishing' | 'reviews' | 'ai' | 'other'

export const DECISION_GROUPS: ReadonlyArray<{ key: DecisionGroupKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'signoffs', label: 'Sign-offs' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'publishing', label: 'Publishing' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'ai', label: 'AI' },
  { key: 'other', label: 'Other' },
]

export const KIND_GROUPS: Record<Exclude<DecisionGroupKey, 'all'>, ReadonlyArray<DecisionKind>> = {
  approvals: ['approve', 'reject'],
  signoffs: ['sign_off', 'countersign'],
  ownership: ['owner_change', 'assign', 'unassign'],
  publishing: ['publish'],
  reviews: ['review', 'cadence_change'],
  ai: ['ai_finding_cleared', 'ai_field_write', 'verify', 'verify_withdrawn'],
  other: ['observation', 'role_change', 'member_invited', 'member_removed'],
}

export const KIND_WORDS: Record<DecisionKind, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  sign_off: 'Signed off',
  countersign: 'Counter-signed',
  assign: 'Assigned',
  unassign: 'Unassigned',
  publish: 'Published',
  owner_change: 'Changed owner',
  review: 'Marked reviewed',
  cadence_change: 'Changed review timing',
  observation: 'Observed',
  verify: 'Checked a step',
  verify_withdrawn: 'Withdrew a check',
  ai_finding_cleared: 'Cleared an AI finding',
  ai_field_write: 'AI filled in a field',
  role_change: 'Changed a role',
  member_invited: 'Invited someone',
  member_removed: 'Removed someone',
}

/**
 * The kinds that count as "cleared today" on the inbox. A sign-off is counted
 * through its counter-signature (written on every approval), so the worker's own
 * sign_off row on submit is never counted.
 * ponytail: an AI proposal accepted or rejected also writes approve / reject and
 * is counted; split by actor_kind if that ever matters.
 */
export const CLEARED_KINDS: ReadonlyArray<DecisionKind> = ['countersign', 'reject', 'approve', 'owner_change', 'review']

export const PAGE_SIZE = 50

/** PostgREST `.or()` filter for the page after (createdAt, id), newest first. */
export function cursorFilter(c: { createdAt: string; id: string }): string {
  return `created_at.lt.${c.createdAt},and(created_at.eq.${c.createdAt},id.lt.${c.id})`
}
