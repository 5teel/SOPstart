'use client'

/**
 * The admin sibling of the worker MachineBody (D-05, D-19) -- governance fields
 * (owner, review) live only here, so they never enter the worker bundle.
 * Renders what it is handed (order comes from machinePanelSops) -- these
 * components never classify or fetch. The frame owns the close button.
 */
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { AdminPanelSop, AdminSopBadge } from '@/lib/sop/admin-health'
import { focusHref } from '@/lib/sop/focus-path'
import { OwnerReviewMeta } from '@/components/admin/governance/OwnerReviewMeta'

// The ask picker is a lazy module (60 A-07); this panel is already in the lazy admin chunk.
const AskTrigger = dynamic(() => import('@/components/requests/AskPicker').then((m) => m.AskTrigger), {
  ssr: false,
  loading: () => null,
})

const BADGE_CLASS: Record<AdminSopBadge, string> = {
  'NO OWNER': 'bg-accent-escalate/12 text-accent-escalate',
  'REVIEW DUE': 'bg-accent-decision/16 text-accent-decision',
  OK: 'bg-accent-ok/14 text-accent-ok',
  DRAFT: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
}

/** One row per SOP: badge, Walk (published only), Edit, owner and review line. */
export function AdminSopRows({ sops, empty, from }: { sops: AdminPanelSop[]; empty: string; from: string | null }) {
  if (sops.length === 0) {
    return (
      <div
        data-testid="admin-panel-empty"
        className="rounded-lg border border-dashed border-[var(--ink-300)] p-5 text-center text-ui text-[var(--ink-500)]"
      >
        {empty}
      </div>
    )
  }
  return (
    <>
      {sops.map((sop) => (
        <div
          key={sop.id}
          data-testid="admin-panel-row"
          className="mb-1.5 rounded-lg border border-[var(--ink-200)] bg-[var(--paper-1)] px-3 py-2.5 hover:border-[var(--ink-900)]"
        >
          <div className="flex min-h-9 items-center gap-2.5">
            <Link href={focusHref(sop.id, { from })} className="min-w-0 flex-1 text-sm font-semibold leading-snug">
              {sop.title}
            </Link>
            <span
              data-testid="admin-panel-badge"
              data-badge={sop.badge}
              className={`mono rounded-full px-2 py-0.5 text-micro uppercase tracking-wide ${BADGE_CLASS[sop.badge]}`}
            >
              {sop.badge}
            </span>
            {sop.status === 'published' && (
              <Link
                href={focusHref(sop.id, { from })}
                data-testid="admin-panel-walk"
                className="mono text-meta text-[var(--ink-500)]"
              >
                Walk ›
              </Link>
            )}
            <Link
              href={focusHref(sop.id, { mode: 'edit', from })}
              data-testid="admin-panel-edit"
              className="mono text-meta text-[var(--ink-500)]"
            >
              Edit
            </Link>
            {sop.status === 'published' && <AskTrigger sopId={sop.id} sopTitle={sop.title} variant="row" align="end" />}
          </div>
          <OwnerReviewMeta ownerLabel={sop.ownerLabel} reviewDueAt={sop.reviewDueAt} />
        </div>
      ))}
    </>
  )
}

export function AdminMachineBody({
  machine,
  department,
  sops,
  objective,
}: {
  machine: { id: string; name: string; spriteUrl: string | null }
  department: { name: string; colour: string } | null
  sops: AdminPanelSop[]
  /** The machine's objective line or editor, supplied by the shell. */
  objective?: ReactNode
}) {
  return (
    <div data-testid="admin-panel">
      <div className="relative grid h-50 place-items-center border-b border-[var(--ink-200)] bg-[var(--paper-2)]">
        {machine.spriteUrl ? (
          <img src={machine.spriteUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="mono text-meta text-[var(--ink-400)]">no photo yet</span>
        )}
      </div>

      <div className="px-4 py-3.5">
        {department && (
          <span className="mono text-meta uppercase tracking-widest" style={{ color: department.colour }}>
            {department.name}
          </span>
        )}
        <h2 className="mb-2.5 text-xl font-semibold leading-tight text-[var(--ink-900)]">{machine.name}</h2>
        {objective && <div className="mb-3">{objective}</div>}
        <AdminSopRows sops={sops} empty="No procedures for this machine yet." from={machine.id} />
        <Link
          href={`/admin/sops/new/blank?machine=${machine.id}`}
          data-testid="admin-panel-new-sop"
          className="mt-2 flex min-h-tap items-center justify-center rounded-lg border border-ink-300 bg-white px-4 text-ui font-semibold text-ink-900"
        >
          New SOP for this machine
        </Link>
      </div>
    </div>
  )
}
