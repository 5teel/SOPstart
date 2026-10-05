'use client'

/**
 * Admin room bodies (D-12, D-13, D-15c, D-16, D-20). Presentational: every
 * number and row arrives from the one admin read in AdminShell. Lives in the
 * lazy admin module only.
 */
import Link from 'next/link'
import { AdminSopRows } from '@/components/admin/governance/AdminMachinePanel'
import type { AdminPanelSop } from '@/lib/sop/admin-health'

const TITLE = 'text-lg font-semibold text-ink-900'
const LINK =
  'flex min-h-tap items-center justify-center rounded-lg border border-ink-300 bg-white px-4 text-ui font-semibold text-ink-900'

const CHIP_WORDS = [
  ['owner', 'No owner'],
  ['overdue', 'Overdue'],
  ['approve', 'Approve'],
  ['stuck', 'Stuck'],
  ['machines', 'Machines'],
] as const

export function AdminOfficeBody({
  inboxCount,
  inboxChips,
  pendingSignOffs,
}: {
  inboxCount: number
  inboxChips: Record<string, number>
  pendingSignOffs: number
}) {
  return (
    <div data-testid="room-body" data-room-id="office" className="flex flex-col gap-3 p-4 pr-16">
      <h2 className={TITLE}>Office</h2>
      <p className="text-ui text-ink-900">
        <span className="mono text-lg font-semibold">{inboxCount}</span> {inboxCount === 1 ? 'thing needs' : 'things need'} you.
      </p>
      <p data-testid="room-office-chips" className="text-ui text-ink-500">
        {CHIP_WORDS.map(([key, word]) => `${word} ${inboxChips[key] ?? 0}`).join(' · ')}
      </p>
      <Link href="/governance" data-testid="room-office-inbox" className={LINK}>
        Open the Office inbox
      </Link>
      <Link href="/activity" data-testid="room-office-signoffs" className={LINK}>
        {pendingSignOffs} {pendingSignOffs === 1 ? 'completion' : 'completions'} waiting for sign-off
      </Link>
      <Link href="/admin/access" data-testid="room-office-access" className={LINK}>
        Access — who sees which SOPs
      </Link>
      <div className="flex gap-2">
        <Link href="/admin/team" className={`${LINK} flex-1`}>
          People &amp; roles
        </Link>
        <Link href="/admin/settings" className={`${LINK} flex-1`}>
          Settings
        </Link>
      </div>
    </div>
  )
}

export function AdminWorkshopBody({
  drafts,
}: {
  drafts: Array<{ id: string; title: string; status: string; stuck: boolean }>
}) {
  return (
    <div data-testid="room-body" data-room-id="workshop" className="flex flex-col gap-3 p-4 pr-16">
      <h2 className={TITLE}>Workshop</h2>
      {drafts.length === 0 ? (
        <p className="text-ui text-ink-500">No drafts. Everything is published.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {drafts.map((d) => (
            <li
              key={d.id}
              data-testid="room-workshop-draft"
              className="flex min-h-tap items-center gap-2 rounded-lg border border-ink-200 px-3 text-ui text-ink-900"
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{d.title}</span>
              <span className="mono text-meta text-ink-500">{d.stuck ? 'stuck' : d.status}</span>
              <Link href={`/admin/sops/builder/${d.id}`} className="mono text-meta text-ink-500">
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/admin/sops/new" data-testid="room-workshop-new" className={LINK}>
        Write a new SOP
      </Link>
    </div>
  )
}

export function AdminNoticeboardBody({ sops }: { sops: AdminPanelSop[] }) {
  return (
    <div data-testid="room-body" data-room-id="noticeboard" className="flex flex-col gap-3 p-4 pr-16">
      <h2 className={TITLE}>Noticeboard</h2>
      <AdminSopRows sops={sops} empty="No site-wide SOPs yet." from="noticeboard" />
    </div>
  )
}
