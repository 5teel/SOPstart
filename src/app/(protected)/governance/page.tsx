import { redirect } from 'next/navigation'
import { requireAdminContext } from '@/lib/auth/guards'
import { loadInbox } from '@/lib/governance/load-inbox'
import { GovernanceInbox } from '@/components/admin/governance/GovernanceInbox'

/**
 * Phase 54 (D-01/D-02), Phase 57 (D-17): /governance is the Office bridge — a
 * server-rendered inbox of one-action rows, no `?view=` deep link. Other
 * roles never reach it (requireAdminContext redirects). Reads through
 * loadInbox() (Phase 57 D-16: the same read the Office counts) and hands plain data to the client
 * GovernanceInbox — no fetching happens there, so a cleared row (Approve /
 * Assign owner / Confirm current) drains on router.refresh() alone.
 */
export default async function GovernancePage() {
  const ctx = await requireAdminContext()
  if ('error' in ctx) redirect('/')

  const inbox = await loadInbox()

  if ('error' in inbox) {
    return (
      <div className="max-w-6xl mx-auto w-full px-4 py-4">
        <h1 className="text-base font-semibold text-[var(--ink-900)] mb-4">Governance</h1>
        <p data-testid="gov-error" className="text-sm text-accent-escalate">
          {inbox.error}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-4">
      <h1 className="text-base font-semibold text-[var(--ink-900)] mb-4">Governance</h1>
      <GovernanceInbox items={inbox.items} />
    </div>
  )
}
