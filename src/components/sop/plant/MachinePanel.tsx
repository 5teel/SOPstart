'use client'

/**
 * The worker-variant machine body (D-11) -- sprite, department, machine
 * name, then the machine's SOPs to-do first with the shared badge, a Walk
 * link and a plain Read link. The one screen's detail pane renders it; the
 * old slide-over panel is gone (Phase 57). Nothing here names who is responsible for a
 * procedure or what revision it is on -- that governance view belongs to
 * the admin variant Phase 54 adds. Ordering comes from the caller
 * (worker-signal's machineSops/narrowForAsk) -- this component renders
 * what it is handed, it never re-sorts.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { plantRelState, type WorkerSop } from '@/lib/sop/worker-signal'
import { RelBadge } from '@/components/sop/plant/RelBadge'
import { focusHref } from '@/lib/sop/focus-path'

/**
 * The rows: badge + Walk link per SOP. Renders what it is handed, never re-sorts.
 * `from` is the place token the row was opened from (machine id or room name),
 * so the focus screen's Back returns to it.
 */
export function SopRows({
  sops,
  empty,
  from,
  rowAction,
}: {
  sops: WorkerSop[]
  empty: string
  from: string | null
  /** An extra control after Walk, supplied by the shell (a lazy module); none for a worker. */
  rowAction?: (sop: WorkerSop) => ReactNode
}) {
  if (sops.length === 0) {
    return (
      <div
        data-testid="plant-panel-empty"
        className="rounded-lg border border-dashed border-[var(--ink-300)] p-5 text-center text-ui text-[var(--ink-500)]"
      >
        {empty}
      </div>
    )
  }
  return (
    <>
      {sops.map((sop) => {
        const rel = plantRelState(sop)
        return (
          <div
            key={sop.id}
            data-testid="plant-panel-row"
            className="mb-1.5 flex min-h-13 items-center gap-2.5 rounded-lg border border-[var(--ink-200)] bg-[var(--paper-1)] px-3 py-2.5 hover:border-[var(--ink-900)]"
          >
            <Link href={focusHref(sop.id, { from })} className="min-w-0 flex-1 text-sm font-semibold leading-snug">
              {sop.title}
            </Link>
            {rel && <RelBadge rel={rel} />}
            <Link
              href={focusHref(sop.id, { from })}
              data-testid="plant-panel-walk"
              className="mono text-meta text-[var(--ink-500)]"
            >
              Walk ›
            </Link>
            {rowAction?.(sop)}
          </div>
        )
      })}
    </>
  )
}

/** Sprite, department, name and the machine's SOPs -- no overlay chrome. */
export function MachineBody({
  machine,
  department,
  sops,
  onClose,
  rowAction,
  footer,
}: {
  machine: { id: string; name: string; spriteUrl: string | null }
  department: { name: string; colour: string } | null
  sops: WorkerSop[]
  onClose?(): void
  rowAction?: (sop: WorkerSop) => ReactNode
  /** Under the rows, supplied by the shell (a lazy module). */
  footer?: ReactNode
}) {
  return (
    <>
      <div className="relative grid h-50 place-items-center border-b border-[var(--ink-200)] bg-[var(--paper-2)]">
        {machine.spriteUrl ? (
          <img src={machine.spriteUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="mono text-meta text-[var(--ink-400)]">no photo yet</span>
        )}
        {onClose && (
          <button
            type="button"
            data-testid="plant-panel-close"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full border border-[var(--ink-300)] bg-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        {department && (
          <span className="mono text-meta uppercase tracking-widest" style={{ color: department.colour }}>
            {department.name}
          </span>
        )}
        <h2 className="mb-2.5 text-xl font-semibold leading-tight text-[var(--ink-900)]">{machine.name}</h2>
        <SopRows sops={sops} empty="No procedures for this machine yet." from={machine.id} rowAction={rowAction} />
        {footer}
      </div>
    </>
  )
}
