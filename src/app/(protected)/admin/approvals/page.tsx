import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin-guard'
import { listNewAccounts } from '@/lib/auth/new-accounts'
import { ApprovalRow } from './ApprovalRow'

export const metadata: Metadata = { title: 'New accounts — SOPstart' }

/** ADR-0018: every new account waits here for a SOPstart (platform) admin. */
export default async function ApprovalsPage() {
  await requirePlatformAdmin()
  const people = await listNewAccounts()
  const waiting = people.filter((p) => p.status === 'pending')
  const declined = people.filter((p) => p.status === 'declined')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">New accounts</h1>
        <p className="mt-1 text-reading text-ink-600">Nobody can open a site until you approve their account.</p>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="section-heading">Waiting ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <p data-testid="approvals-empty" className="text-reading text-ink-600">Nobody is waiting.</p>
        ) : (
          <ul className="list">{waiting.map((p) => <ApprovalRow key={p.userId} person={p} />)}</ul>
        )}
      </section>
      {declined.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-heading">Turned down</h2>
          <ul className="list">{declined.map((p) => <ApprovalRow key={p.userId} person={p} />)}</ul>
        </section>
      )}
    </div>
  )
}
