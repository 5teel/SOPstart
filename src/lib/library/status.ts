/**
 * Phase 63 -- the one line a library row says about the person's own history
 * with a SOP. Information, not a to-do: one fixed precedence. Plain module.
 */
import { currentIndex, type WalkEntry } from '@/lib/sop/focus'
import { nzDay } from '@/lib/office/format'

export type RowStatus =
  | { kind: 'stopped'; step: number; total: number; text: string }
  | { kind: 'waiting'; text: string }
  | { kind: 'updated'; text: string }
  | { kind: 'signed'; text: string }

export interface RowStatusInput {
  walk: { done: readonly string[]; acks?: readonly string[] } | null
  order: readonly WalkEntry[] | null
  /** The person's newest own non-rejected completion of this SOP's lineage. */
  latestCompletion: { sopId: string; status: string; submittedAt: string } | null
  currentId: string
  hasNewerVersion: boolean
  now?: Date
}

export function rowStatus(i: RowStatusInput): RowStatus | null {
  if (i.walk && i.order && i.order.length > 0) {
    const total = i.order.length
    // Same count the Read view prints as "Picks up at step N of M".
    const step = Math.min(currentIndex(i.order, new Set(i.walk.done)) + 1, total)
    return { kind: 'stopped', step, total, text: `You stopped at step ${step}` }
  }
  const c = i.latestCompletion
  if (!c || c.status === 'rejected') return null
  if (c.status === 'pending_sign_off') return { kind: 'waiting', text: 'Waiting for sign-off' }
  if (c.sopId !== i.currentId || i.hasNewerVersion) return { kind: 'updated', text: 'Updated since you last did it' }
  if (c.status === 'signed_off') return { kind: 'signed', text: `Signed off ${nzDay(c.submittedAt, i.now)}` }
  return null
}
