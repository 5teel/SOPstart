'use client'

/**
 * The admin sibling of the worker MachinePanel (D-05) -- governance fields
 * (owner, review) live only here, so they never enter the worker bundle.
 * Renders what it is handed (order comes from machinePanelSops) -- this
 * component never classifies or fetches.
 */
import Link from 'next/link'
import { X } from 'lucide-react'
import type { AdminPanelSop, AdminSopBadge } from '@/lib/sop/admin-health'

const BADGE_CLASS: Record<AdminSopBadge, string> = {
  'NO OWNER': 'bg-accent-escalate/12 text-accent-escalate',
  'REVIEW DUE': 'bg-accent-decision/16 text-accent-decision',
  OK: 'bg-accent-ok/14 text-accent-ok',
  DRAFT: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
}

function reviewLabel(reviewDueAt: string | null): string {
  if (!reviewDueAt) return '—'
  return new Date(reviewDueAt).toLocaleDateString('en-NZ', {
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  })
}

export function AdminMachinePanel({
  machine,
  department,
  sops,
  onClose,
}: {
  machine: { id: string; name: string; spriteUrl: string | null }
  department: { name: string; colour: string } | null
  sops: AdminPanelSop[]
  onClose(): void
}) {
  return (
    <div
      data-testid="admin-panel"
      className="rounded-lg border border-[var(--ink-300)] bg-[var(--paper-1)] overflow-hidden"
    >
      <div className="relative grid h-36 place-items-center border-b border-[var(--ink-200)] bg-[var(--paper-2)]">
        {machine.spriteUrl ? (
          <img
            src={machine.spriteUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="mono text-meta text-[var(--ink-400)]">no photo yet</span>
        )}
        <button
          type="button"
          data-testid="admin-panel-close"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full border border-[var(--ink-300)] bg-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-4 py-3.5">
        {department && (
          <span className="mono text-meta uppercase tracking-widest" style={{ color: department.colour }}>
            {department.name}
          </span>
        )}
        <h2 className="mb-2.5 text-xl font-semibold leading-tight text-[var(--ink-900)]">{machine.name}</h2>

        {sops.length === 0 ? (
          <div data-testid="admin-panel-empty" className="rounded-lg border border-dashed border-[var(--ink-300)] p-5 text-center text-ui text-[var(--ink-500)]">
            <p className="mb-3">No procedures for this machine yet.</p>
            <Link href="/admin/sops/new" className="evidence-btn !min-h-9 inline-flex text-sm">
              Add one
            </Link>
          </div>
        ) : (
          sops.map((sop) => (
            <div
              key={sop.id}
              data-testid="admin-panel-row"
              className="mb-1.5 rounded-lg border border-[var(--ink-200)] bg-[var(--paper-1)] px-3 py-2.5 hover:border-[var(--ink-900)]"
            >
              <div className="flex min-h-9 items-center gap-2.5">
                <Link href={`/sops/${sop.id}`} className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                  {sop.title}
                </Link>
                <span
                  data-testid="admin-panel-badge"
                  data-badge={sop.badge}
                  className={`mono rounded-full px-2 py-0.5 text-micro uppercase tracking-wide ${BADGE_CLASS[sop.badge]}`}
                >
                  {sop.badge}
                </span>
                <Link href={`/sops/${sop.id}`} data-testid="admin-panel-open" className="mono text-meta text-[var(--ink-500)]">
                  Open ›
                </Link>
                <Link
                  href={`/admin/sops/builder/${sop.id}`}
                  data-testid="admin-panel-edit"
                  className="mono text-meta text-[var(--ink-500)]"
                >
                  Edit
                </Link>
              </div>
              <p className="mono text-meta text-[var(--ink-500)]">
                owner {sop.ownerLabel ?? 'none'} · review due {reviewLabel(sop.reviewDueAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
