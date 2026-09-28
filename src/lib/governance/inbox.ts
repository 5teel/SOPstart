/**
 * Phase 54 (D-02): the inbox is derived on read from the governance queue,
 * the library rows and the site links -- no table, no stored state. It
 * classifies rows into chips/severity only; it never decides who may act --
 * GovernanceQueueRow and approveStep own that (D-03). Plain module, no
 * directive -- importable from both client and server code.
 */
import type { GovernanceRow } from '@/actions/governance'
import type { MillerSop } from '@/lib/sop-list/admin-rows'
import type { SopMachineLink } from '@/lib/validators/site'
import { machinesWithoutSops } from '@/lib/sop/admin-health'

export type InboxChip = 'owner' | 'overdue' | 'approve' | 'stuck' | 'machines'
export type InboxSeverity = 'bad' | 'warn' | 'info' | 'grey'

export interface InboxItem {
  key: string
  kind: 'governance' | 'stuck' | 'machines'
  chips: InboxChip[]
  severity: InboxSeverity
  title: string
  meta: string
  age: string
  gov: GovernanceRow | null
  action: { label: 'Retry' | 'Add'; href: string } | null
}

export const INBOX_CHIPS: ReadonlyArray<{ key: 'all' | InboxChip; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'owner', label: 'No owner' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'approve', label: 'Approve' },
  { key: 'stuck', label: 'Stuck' },
  { key: 'machines', label: 'Machines' },
]

const SEVERITY_RANK: Record<InboxSeverity, number> = { bad: 0, warn: 1, info: 2, grey: 3 }

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
  machines: ReadonlyArray<{ id: string; name: string }>
  links: ReadonlyArray<SopMachineLink>
}): InboxItem[] {
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
      action: { label: 'Retry', href: `/admin/sops/builder/${lib.id}` },
    })
  }

  for (const machine of machinesWithoutSops(input.machines, input.links)) {
    items.push({
      key: `machines-${machine.id}`,
      kind: 'machines',
      chips: ['machines'],
      severity: 'grey',
      title: machine.name,
      meta: 'no procedures yet',
      age: '',
      gov: null,
      action: { label: 'Add', href: '/admin/sops/new' },
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
    stuck: 0,
    machines: 0,
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
