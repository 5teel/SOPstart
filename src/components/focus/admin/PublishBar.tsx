'use client'

/**
 * Phase 58 (58-12, D-16, D-25) -- the editor's bottom bar: "Checked n of N steps"
 * and why Publish is blocked, from the same three counts the server gate uses
 * (getPublishGateStatus). Publish is offered only when `ready`; the server gate
 * still decides. A SOP waiting on an approval chain shows who has it, and no
 * Publish. Admins and safety managers get the button; other editors see the count.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getApprovalStatus } from '@/actions/approvals'
import { getPublishGateStatus } from '@/actions/publish-gate'
import { PublishDialog } from '@/components/focus/admin/PublishDialog'
import { useFocusLineage, useFocusSop } from '@/hooks/useFocusSop'
import type { FocusSop } from '@/lib/sop/focus-read'

export interface PublishBarProps {
  sopId: string
  initial: FocusSop
  /** Admins and safety managers: the Publish button. */
  isAdmin: boolean
  /** Lets the document show "Published v4 · logged in the decision ledger". */
  onPublished?: () => void
}

export function PublishBar({ sopId, initial, isAdmin, onPublished }: PublishBarProps) {
  const { focus } = useFocusSop(sopId, initial)
  const lineage = useFocusLineage(sopId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sentNow, setSentNow] = useState(false)

  const gate = useQuery({
    queryKey: ['focus-gate', sopId],
    queryFn: async () => {
      const res = await getPublishGateStatus(sopId)
      if ('error' in res) throw new Error(res.error)
      return res
    },
  })
  const approval = useQuery({
    queryKey: ['focus-approval', sopId],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await getApprovalStatus(sopId)
      return 'error' in res ? null : res.status
    },
  })

  if (focus.sop.status !== 'draft') return null

  const total = gate.data?.total ?? 0
  const checked = total - (gate.data?.unchecked ?? 0)
  const ready = gate.data?.ready === true
  const pending = approval.data?.state === 'pending' || sentNow
  const approver = approval.data ? approval.data.steps[approval.data.nextStepIndex]?.label : undefined

  const live = lineage.find((v) => v.state === 'live')
  const publishLabel = live ? `Publish v${focus.sop.version}` : 'Publish SOP'

  return (
    <div
      data-testid="publish-bar"
      className="sticky bottom-0 flex min-h-tap-row flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink-200 bg-paper-1 px-4 py-2 lg:px-8"
    >
      <div className="flex min-w-40 flex-col gap-1">
        <span data-testid="publish-count" className="text-ui font-semibold text-ink-900">
          Checked {checked} of {total} steps
        </span>
        <span className="flex h-1 w-full rounded-full bg-ink-100" aria-hidden="true">
          <span className="h-1 rounded-full bg-accent-ok" style={{ width: total === 0 ? '0%' : `${(checked / total) * 100}%` }} />
        </span>
      </div>

      <p data-testid="publish-reasons" className="min-w-0 flex-1 text-ui text-ink-500">
        {pending
          ? `Sent to ${approver ?? 'its approver'} for approval — it publishes when they approve.`
          : gate.data && !ready
            ? gate.data.reasons.join(' · ')
            : ''}
      </p>

      {isAdmin && !pending && (
        <button
          type="button"
          data-testid="publish-button"
          aria-disabled={!ready}
          onClick={() => {
            if (ready) setDialogOpen(true)
          }}
          className={`min-h-tap rounded-lg px-4 text-reading font-semibold ${
            ready ? 'bg-accent-signoff text-white' : 'bg-ink-300 text-ink-500'
          }`}
        >
          {publishLabel}
        </button>
      )}

      <PublishDialog
        open={dialogOpen}
        sopId={sopId}
        version={focus.sop.version}
        liveVersion={live?.version ?? null}
        onClose={() => setDialogOpen(false)}
        onPublished={() => onPublished?.()}
        onPendingApproval={() => setSentNow(true)}
      />
    </div>
  )
}
