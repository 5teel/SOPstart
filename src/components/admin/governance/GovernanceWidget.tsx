/**
 * Phase 28 Plan 05 — dashboard governance counts widget (GQ-04/D28-09).
 * Server component: counts overdue/unowned/due_soon from listGovernanceQueue()
 * and deep-links each count to /admin/governance?filter=. Mounted on the
 * /admin/sops header (the admin home in practice).
 */

import Link from 'next/link'
import { listGovernanceQueue } from '@/actions/governance'

export async function GovernanceWidget() {
  const result = await listGovernanceQueue()
  if ('error' in result) return null

  const counts = { overdue: 0, unowned: 0, due_soon: 0 }
  for (const row of result.rows) {
    if (row.flags.includes('overdue')) counts.overdue++
    if (row.flags.includes('unowned')) counts.unowned++
    if (row.flags.includes('due_soon')) counts.due_soon++
  }

  const total = counts.overdue + counts.unowned + counts.due_soon
  if (total === 0) {
    return (
      <div className="blueprint-frame px-3 py-2 flex items-center">
        <span className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider">All current</span>
      </div>
    )
  }

  return (
    <div className="blueprint-frame px-3 py-2 flex items-center gap-2 flex-wrap">
      <Link
        href="/admin/governance?filter=overdue"
        className="mono text-[11px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-600"
      >
        {counts.overdue} overdue
      </Link>
      <Link
        href="/admin/governance?filter=unowned"
        className="mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--paper-2)] text-[var(--ink-500)]"
      >
        {counts.unowned} unowned
      </Link>
      <Link
        href="/admin/governance?filter=due_soon"
        className="mono text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700"
      >
        {counts.due_soon} due soon
      </Link>
    </div>
  )
}
