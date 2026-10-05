/**
 * Phase 54 (D-02): the inbox is derived on read from the governance queue,
 * the library rows -- no table, no stored state. Machines with no SOP are no
 * longer a row here: they reach the Office as agent-raised new-SOP requests
 * (Phase 60 D-05). Phase 59
 * adds completions waiting for sign-off and the caller's own due reviews as
 * OPTIONAL inputs, so every older call shape stays valid. It classifies rows
 * into chips/severity only; it never decides who may act -- the server
 * actions own that (D-03). Plain module, no directive -- importable from both
 * client and server code.
 */
import type { GovernanceRow } from '@/actions/governance'
import type { MillerSop } from '@/lib/sop-list/admin-rows'
import { focusHref } from '@/lib/sop/focus-path'
import { DUE_SOON_WINDOW_DAYS } from '@/lib/governance/classify'
import { relativeWhen } from '@/lib/office/format'

export type InboxChip = 'owner' | 'overdue' | 'approve' | 'signoff' | 'stuck'
export type InboxSeverity = 'bad' | 'warn' | 'info' | 'grey'

/** A completion waiting for a counter-signature (never the caller's own walk). */
export interface PendingSignOff {
  completionId: string
  sopId: string
  sopTitle: string
  sopVersion: number
  workerId: string
  workerLabel: string
  submittedAt: string
  photoCount: number
}

/** A published SOP the caller owns, with its review date. */
export interface OwnedReview {
  sopId: string
  title: string
  reviewDueAt: string
}

export interface InboxItem {
  key: string
  kind: 'governance' | 'stuck' | 'signoff' | 'review'
  chips: InboxChip[]
  severity: InboxSeverity
  title: string
  meta: string
  age: string
  gov: GovernanceRow | null
  signOff: PendingSignOff | null
  review: OwnedReview | null
  /** The row's one button when it is a link or a retry; null where the row opens its own panel. */
  action: {
    label: 'Try again' | 'Open'
    href: string
    retry: { sopId: string; isVideo: boolean } | null
  } | null
}

export const INBOX_CHIPS: ReadonlyArray<{ key: 'all' | InboxChip; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'owner', label: 'No owner' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'approve', label: 'Approve' },
  { key: 'signoff', label: 'Sign-off' },
  { key: 'stuck', label: 'Stuck' },
]

const SEVERITY_RANK: Record<InboxSeverity, number> = { bad: 0, warn: 1, info: 2, grey: 3 }

function stuckAction(lib: MillerSop): InboxItem['action'] {
  const href = focusHref(lib.id, { mode: 'edit', from: 'office' })
  const pr = lib.parseRetry
  return pr?.canRetry
    ? { label: 'Try again', href, retry: { sopId: lib.id, isVideo: pr.isVideo } }
    : { label: 'Open', href, retry: null }
}

function statusWord(status: string): string {
  if (status === 'published') return 'live'
  if (status === 'draft') return 'draft'
  return 'converting'
}

/** unowned -> bad+chip 'owner'; overdue -> warn+chip 'overdue'; awaiting
 *  approval where the caller is next -> info+chip 'approve'; stale_role ->
 *  grey, no chip of its own. Worst-of severity across whichever fired; a row
 *  with none of these (e.g. due_soon-only, or awaiting_approval where the
 *  caller isn't next) is excluded entirely. */
function classifyGovernanceRow(row: GovernanceRow): { chips: InboxChip[]; severity: InboxSeverity } | null {
  const chips: InboxChip[] = []
  const severities: InboxSeverity[] = []

  if (row.flags.includes('unowned')) {
    chips.push('owner')
    severities.push('bad')
  }
  if (row.flags.includes('overdue')) {
    chips.push('overdue')
    severities.push('warn')
  }
  if (row.flags.includes('awaiting_approval') && row.isCallerNextApprover) {
    chips.push('approve')
    severities.push('info')
  }
  if (row.flags.includes('stale_role')) {
    severities.push('grey')
  }

  if (severities.length === 0) return null
  const severity = severities.reduce((worst, s) => (SEVERITY_RANK[s] < SEVERITY_RANK[worst] ? s : worst))
  return { chips, severity }
}

export function deriveInbox(input: {
  governance: ReadonlyArray<GovernanceRow>
  library: ReadonlyArray<MillerSop>
  signOffs?: ReadonlyArray<PendingSignOff>
  ownedReviews?: ReadonlyArray<OwnedReview>
  now?: Date
}): InboxItem[] {
  const now = input.now ?? new Date()
  const libraryById = new Map(input.library.map((l) => [l.id, l]))
  const items: InboxItem[] = []

  for (const row of input.governance) {
    const classified = classifyGovernanceRow(row)
    if (!classified) continue
    const lib = libraryById.get(row.id)
    const machineNames = lib?.machines ?? []
    const title = lib?.displayTitle ?? row.title ?? 'Untitled SOP'
    const meta = [...machineNames, statusWord(row.status)].join(' · ')
    items.push({
      key: `gov-${row.id}`,
      kind: 'governance',
      chips: classified.chips,
      severity: classified.severity,
      title,
      meta,
      age: lib?.age ?? '',
      gov: row,
      signOff: null,
      review: null,
      action: null,
    })
  }

  for (const lib of input.library) {
    if (!lib.stuck && !lib.parseFailed) continue
    const reason = lib.stuck ? 'stopped while converting' : 'conversion failed'
    const meta = [...lib.machines, reason].join(' · ')
    items.push({
      key: `stuck-${lib.id}`,
      kind: 'stuck',
      chips: ['stuck'],
      severity: 'bad',
      title: lib.displayTitle,
      meta,
      age: lib.age,
      gov: null,
      signOff: null,
      review: null,
      action: stuckAction(lib),
    })
  }

  for (const so of input.signOffs ?? []) {
    items.push({
      key: `signoff-${so.completionId}`,
      kind: 'signoff',
      chips: ['signoff'],
      severity: 'warn',
      title: so.sopTitle,
      meta: `From ${so.workerLabel} · ${so.photoCount} ${so.photoCount === 1 ? 'photo' : 'photos'}`,
      age: relativeWhen(so.submittedAt, now),
      gov: null,
      signOff: so,
      review: null,
      action: null,
    })
  }

  // A SOP already in the queue is not listed twice.
  const queued = new Set(items.filter((i) => i.gov).map((i) => i.gov!.id))
  for (const r of input.ownedReviews ?? []) {
    if (queued.has(r.sopId)) continue
    const due = new Date(r.reviewDueAt)
    const overdue = due < now
    if (!overdue && due.getTime() - now.getTime() > DUE_SOON_WINDOW_DAYS * 86_400_000) continue
    items.push({
      key: `review-${r.sopId}`,
      kind: 'review',
      chips: overdue ? ['overdue'] : [],
      severity: overdue ? 'warn' : 'grey',
      title: libraryById.get(r.sopId)?.displayTitle ?? r.title,
      meta: 'You own this SOP.',
      age: '',
      gov: null,
      signOff: null,
      review: r,
      action: null,
    })
  }

  return items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}

export function inboxCounts(items: ReadonlyArray<InboxItem>): Record<'all' | InboxChip, number> {
  const counts: Record<'all' | InboxChip, number> = {
    all: items.length,
    owner: 0,
    overdue: 0,
    approve: 0,
    signoff: 0,
    stuck: 0,
  }
  for (const item of items) {
    for (const chip of item.chips) counts[chip]++
  }
  return counts
}

export function chipMatches(item: InboxItem, chip: 'all' | InboxChip): boolean {
  if (chip === 'all') return true
  return item.chips.includes(chip)
}
