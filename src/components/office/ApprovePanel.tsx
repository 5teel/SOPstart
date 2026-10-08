'use client'

/**
 * Phase 59 (OFF-03, D-07) -- the expanded Approve row. Read it, approve it or send it back,
 * from one panel. Publishing is not done here: on the last step `approveStep` runs the same
 * publish path (and gates) it always has, and this panel only reports what it answered.
 * Admin-chunk component: the Office pane is its only importer.
 */
import { HOME, homeFrom } from '@/lib/shell/home-state'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Check, Circle, Loader2 } from 'lucide-react'
import { approveStep, getApprovalStatus, requestChanges } from '@/actions/approvals'
import { getOrgMembers } from '@/actions/assignments'
import { nzDay } from '@/lib/office/format'
import { focusHref } from '@/lib/sop/focus-path'
import { ReasonDialog } from './ReasonDialog'

type Receipt = { receipt: string; logged: boolean }

const LABEL = 'mono text-meta uppercase text-ink-500'
const FAILED_COPY = "That didn't work. Nothing was changed — try again."

export function ApprovePanel({ sopId, title, onDone }: { sopId: string; title: string; onDone(r: Receipt): void }) {
  const status = useQuery({
    queryKey: ['office-approval', sopId],
    queryFn: () => getApprovalStatus(sopId),
  })
  // Labels only: a slow or failed member read leaves the role words, it never blocks the panel.
  const members = useQuery({ queryKey: ['office-members'], queryFn: () => getOrgMembers() })

  if (status.isLoading) {
    return (
      <div data-testid="approve-panel" className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-paper-1 p-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-18 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
        ))}
      </div>
    )
  }
  const result = status.data
  if (status.isError || !result || !('success' in result)) {
    return (
      <div data-testid="approve-panel" className="flex flex-col items-start gap-2 rounded-lg border border-ink-200 bg-paper-1 p-4">
        <p role="alert" className="text-ui text-ink-700">
          {result && 'error' in result ? result.error : "Couldn't load this. Check your signal and try again."}
        </p>
        <button
          type="button"
          onClick={() => void status.refetch()}
          className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900"
        >
          Try again
        </button>
      </div>
    )
  }

  const emailById = new Map<string, string>()
  const list = members.data
  if (list && list.success) for (const m of list.members) emailById.set(m.user_id, m.email ?? m.full_name ?? m.role)

  return <ApproveBody key={sopId} sopId={sopId} title={title} status={result.status} emailById={emailById} onDone={onDone} />
}

function ApproveBody({
  sopId,
  title,
  status,
  emailById,
  onDone,
}: {
  sopId: string
  title: string
  status: Extract<Awaited<ReturnType<typeof getApprovalStatus>>, { success: true }>['status']
  emailById: ReadonlyMap<string, string>
  onDone(r: Receipt): void
}) {
  const { steps, approvals, nextStepIndex, isCallerNextApprover, version } = status
  const [pending, setPending] = useState<'approve' | 'send' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendOpen, setSendOpen] = useState(false)

  const waiting = status.state === 'pending'
  const yourTurn = waiting && isCallerNextApprover
  const isLast = yourTurn && nextStepIndex === steps.length - 1
  const busy = pending !== null

  async function approve() {
    if (busy || !yourTurn) return
    setPending('approve')
    setError(null)
    try {
      const result = await approveStep(sopId)
      if ('success' in result) {
        onDone({ receipt: result.published ? `Approved and published v${version}` : 'Approved', logged: result.logged })
        return
      }
      // On the last step a refusal is the publish gate speaking: say so, keep the row.
      setError(
        isLast
          ? `v${version} can't be published yet: ${result.error.replace(/[.\s]+$/, '')}. Open it to fix that.`
          : result.error,
      )
    } catch {
      setError(FAILED_COPY)
    } finally {
      setPending(null)
    }
  }

  async function sendBack(note: string) {
    if (busy) return
    setPending('send')
    setError(null)
    try {
      const result = await requestChanges(sopId, note)
      if ('success' in result) {
        setSendOpen(false)
        onDone({ receipt: 'Sent back', logged: result.logged })
        return
      }
      setError(result.error)
    } catch {
      setError(FAILED_COPY)
    } finally {
      setPending(null)
    }
  }

  return (
    <div data-testid="approve-panel" className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-paper-1 p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 truncate text-ui font-semibold text-ink-900">{title}</h3>
          <span className="mono shrink-0 rounded border border-ink-200 bg-paper-2 px-2 text-meta text-ink-500">v{version}</span>
        </div>
        <Link
          href={focusHref(sopId, { from: homeFrom({ ...HOME, s: 'signoffs' }) })}
          className="inline-flex min-h-tap items-center self-start text-ui underline"
        >
          Open it to read it
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <span className={LABEL}>
          Approval chain · step {Math.min(Math.max(nextStepIndex, 0) + 1, steps.length)} of {steps.length}
        </span>
        <ol className="flex flex-col">
          {steps.map((st, i) => {
            const done = approvals.find((a) => a.action === 'approved' && a.stepIndex === i)
            const mine = !done && i === nextStepIndex && yourTurn
            return (
              <li
                key={i}
                data-testid="approve-chain-step"
                className={`flex min-h-tap items-center gap-2 px-2 text-ui ${mine ? 'rounded bg-paper-2 font-semibold text-ink-900' : done ? 'text-ink-900' : 'text-ink-500'}`}
              >
                {done ? (
                  <Check size={16} className="shrink-0 text-accent-ok" aria-hidden="true" />
                ) : (
                  <Circle size={16} className="shrink-0 text-ink-400" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  {mine
                    ? 'Your turn'
                    : [
                        st.label,
                        done?.approverUserId ? emailById.get(done.approverUserId) : null,
                        done ? nzDay(done.createdAt) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {isLast && (
        <p className="text-ui text-ink-700">You&apos;re the last approver. Approving publishes v{version} to workers.</p>
      )}
      {!waiting && <p className="text-ui text-ink-700">This isn&apos;t waiting for approval any more.</p>}
      {waiting && !yourTurn && <p className="text-ui text-ink-700">It isn&apos;t your turn to approve yet.</p>}

      <div className="flex gap-2">
        <button
          type="button"
          data-testid="approve-commit"
          disabled={busy || !yourTurn}
          onClick={() => void approve()}
          className="flex min-h-tap flex-1 items-center justify-center gap-2 rounded-lg bg-accent-signoff text-ui font-semibold text-white disabled:opacity-50"
        >
          {pending === 'approve' && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {isLast ? `Approve and publish v${version}` : `Approve v${version}`}
        </button>
        <button
          type="button"
          data-testid="approve-send-back"
          disabled={busy || !yourTurn}
          onClick={() => setSendOpen(true)}
          className="flex min-h-tap flex-1 items-center justify-center rounded-lg border border-ink-300 bg-paper-1 text-ui font-semibold text-ink-900 disabled:opacity-50"
        >
          Send back
        </button>
      </div>
      {error && !sendOpen && (
        <p role="alert" className="text-ui text-accent-escalate">
          {error}
        </p>
      )}

      {sendOpen && (
        <ReasonDialog
          title={`Send v${version} back?`}
          body="It goes back to the draft with your note, and its owner will see it."
          label="What needs changing?"
          confirmLabel="Send back"
          confirmTone="ink"
          pending={pending === 'send'}
          error={error}
          onConfirm={(note) => void sendBack(note)}
          onCancel={() => {
            setSendOpen(false)
            setError(null)
          }}
        />
      )}
    </div>
  )
}
