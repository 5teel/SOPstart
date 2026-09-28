import { redirect } from 'next/navigation'
import { requireAdminContext } from '@/lib/auth/guards'
import { listGovernanceQueue } from '@/actions/governance'
import { listAdminSopRows } from '@/actions/admin-sop-list'
import { listSiteHealthForOrg } from '@/actions/site'
import { deriveInbox } from '@/lib/governance/inbox'
import { GovernanceInbox } from '@/components/admin/governance/GovernanceInbox'

/**
 * Phase 54 (D-01/D-02): /governance is the admin's home for the work — a
 * server-rendered inbox of one-action rows, no `?view=` deep link. Other
 * roles never reach it (requireAdminContext redirects). Reads three
 * existing sources in parallel and hands plain data to the client
 * GovernanceInbox — no fetching happens there, so a cleared row (Approve /
 * Assign owner / Confirm current) drains on router.refresh() alone.
 *
 * ponytail: listAdminSopRows recomputes the governance queue a second time
 * internally — accepted, admin page, org-sized data; wrap in React cache()
 * if this ever shows on a trace.
 */
export default async function GovernancePage() {
  const ctx = await requireAdminContext()
  if ('error' in ctx) redirect('/dashboard')

  const [gov, library, floor] = await Promise.all([
    listGovernanceQueue(),
    listAdminSopRows({}),
    listSiteHealthForOrg(),
  ])

  if ('error' in gov || 'error' in library) {
    return (
      <div className="max-w-6xl mx-auto w-full px-4 py-4">
        <h1 className="text-base font-semibold text-[var(--ink-900)] mb-4">Governance</h1>
        <p data-testid="gov-error" className="text-sm text-accent-escalate">
          {'error' in gov ? gov.error : 'error' in library ? library.error : 'Something went wrong'}
        </p>
      </div>
    )
  }

  const floorOk = !('error' in floor)
  const items = deriveInbox({
    governance: gov.rows,
    library: library.sops,
    machines: floorOk ? floor.machines : [],
    links: floorOk ? floor.links : [],
  })

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-4">
      <h1 className="text-base font-semibold text-[var(--ink-900)] mb-4">Governance</h1>
      <GovernanceInbox items={items} />
    </div>
  )
}
