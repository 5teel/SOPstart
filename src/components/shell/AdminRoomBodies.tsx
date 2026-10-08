'use client'

/**
 * Admin room bodies (D-12, D-13, D-15c, D-16, D-20). Presentational: every
 * number and row arrives from the one admin read in AdminShell. Lives in the
 * lazy admin module only.
 */
import { HOME, homeFrom } from '@/lib/shell/home-state'
import Link from 'next/link'
import { AdminSopRows } from '@/components/admin/governance/AdminMachinePanel'
import { OwnerReviewMeta } from '@/components/admin/governance/OwnerReviewMeta'
import { focusHref } from '@/lib/sop/focus-path'
import type { AdminPanelSop } from '@/lib/sop/admin-health'

const TITLE = 'text-lg font-semibold text-ink-900'
const LINK =
  'flex min-h-tap items-center justify-center rounded-lg border border-ink-300 bg-white px-4 text-ui font-semibold text-ink-900'

export function AdminWorkshopBody({
  drafts,
}: {
  drafts: Array<{
    id: string
    title: string
    status: string
    stuck: boolean
    ownerLabel: string | null
    reviewDueAt: string | null
  }>
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
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-ui text-ink-900"
            >
              <div className="flex min-h-tap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{d.title}</span>
                <span className="mono text-meta text-ink-500">{d.stuck ? 'stuck' : d.status}</span>
                <Link href={focusHref(d.id, { mode: 'edit', from: homeFrom({ ...HOME, s: 'manage' }) })} className="mono text-meta text-ink-500">
                  Open
                </Link>
              </div>
              <OwnerReviewMeta ownerLabel={d.ownerLabel} reviewDueAt={d.reviewDueAt} />
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
