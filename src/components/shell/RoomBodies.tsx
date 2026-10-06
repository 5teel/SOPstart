'use client'

/**
 * Worker-safe room bodies (D-03, D-12): every role can open every room, and
 * these are the reduced views. Presentational -- the SOP rows come from the
 * caller, and nothing here classifies a SOP or imports an admin module.
 */
import Link from 'next/link'
import { SopRows } from '@/components/sop/plant/MachinePanel'
import { useWorkerCompletions } from '@/hooks/useCompletions'
import type { WorkerSop } from '@/lib/sop/worker-signal'
import type { CompletionStatus } from '@/types/sop'

const STATUS_WORDS: Record<CompletionStatus, string> = {
  pending_sign_off: 'Waiting for sign-off',
  signed_off: 'Signed off',
  rejected: 'Sent back',
}

const TITLE = 'text-lg font-semibold text-ink-900'
const LINK =
  'flex min-h-tap items-center justify-center rounded-lg border border-ink-300 bg-white px-4 text-ui font-semibold text-ink-900'

function day(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function OfficeWorkerBody({ onMyRequests }: { onMyRequests?(): void } = {}) {
  const { data: completions = [] } = useWorkerCompletions()
  const counts = (Object.keys(STATUS_WORDS) as CompletionStatus[]).map((s) => ({
    status: s,
    n: completions.filter((c) => c.status === s).length,
  }))
  return (
    <div data-testid="room-body" data-room-id="office" className="flex flex-col gap-3 p-4 pr-16">
      <h2 className={TITLE}>Office</h2>
      <p className="text-ui text-ink-500">Your requests are on the site overview.</p>
      {onMyRequests && (
        <button type="button" onClick={onMyRequests} className={`min-h-tap self-start ${LINK}`}>
          Go to my requests
        </button>
      )}
      <ul className="flex flex-col gap-1 text-ui text-ink-900">
        {counts.map((c) => (
          <li key={c.status}>
            {STATUS_WORDS[c.status]}: {c.n}
          </li>
        ))}
      </ul>
      <Link href="/activity" className={LINK}>
        Open sign-offs
      </Link>
    </div>
  )
}

export function SmokoBody({ children }: { children?: React.ReactNode }) {
  const { data: completions = [] } = useWorkerCompletions()
  const latest = completions[0]
  return (
    <div data-testid="room-body" data-room-id="smoko" className="flex flex-col gap-3 p-4 pr-16">
      <h2 className={TITLE}>Smoko room</h2>
      <p className="text-ui text-ink-900">
        {completions.length === 0
          ? 'You have not walked a SOP yet.'
          : `${completions.length} ${completions.length === 1 ? 'walk' : 'walks'} on your record.`}
      </p>
      {latest && (
        <p className="text-ui text-ink-500">
          Latest: {latest.sop_title ?? 'Untitled SOP'}, {day(latest.submitted_at)}
        </p>
      )}
      <Link href="/activity" className={LINK}>
        Open my record
      </Link>
      {children}
    </div>
  )
}

export function WorkshopWorkerBody() {
  return (
    <div data-testid="room-body" data-room-id="workshop" className="flex flex-col gap-3 p-4 pr-16">
      <h2 className={TITLE}>Workshop</h2>
      <p className="text-ui font-semibold text-ink-900">Ask for a change</p>
      <p className="text-ui text-ink-500">Asking for a change to a SOP arrives with requests in a later update.</p>
    </div>
  )
}

export function NoticeboardWorkerBody({ sops }: { sops: WorkerSop[] }) {
  return (
    <div data-testid="room-body" data-room-id="noticeboard" className="flex flex-col gap-3 p-4 pr-16">
      <h2 className={TITLE}>Noticeboard</h2>
      <SopRows sops={sops} empty="No site-wide SOPs yet." from="noticeboard" />
    </div>
  )
}
