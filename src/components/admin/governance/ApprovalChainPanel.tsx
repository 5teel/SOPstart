'use client'

/**
 * Phase 29 Plan 04 — ApprovalChainPanel (APR-03/APR-04).
 *
 * Controlled / presentational component, same contract as PublishStage.tsx:
 * props in (`steps`/`approvals`/`nextStepIndex`/`canAct`), callbacks out
 * (`onApprove`/`onRequestChanges`). Does NOT call fetch/Supabase/action
 * functions directly — BuilderStageShell owns approveStep/requestChanges.
 *
 * "Request changes" requires a non-empty one-line comment before it can fire
 * (D29-03 specifics — the comment is the accuracy signal back to the owner).
 */

import { useState } from 'react'
import type { ChainStep } from '@/lib/governance/approvals'

export interface ApprovalRow {
  stepIndex: number
  action: 'approved' | 'changes_requested'
  comment: string | null
}

export interface ApprovalChainPanelProps {
  steps: ChainStep[]
  approvals: ApprovalRow[]
  nextStepIndex: number
  canAct: boolean
  onApprove: (comment?: string) => void
  onRequestChanges: (comment: string) => void
  pending?: boolean
  error?: string | null
}

export function ApprovalChainPanel({
  steps,
  approvals,
  nextStepIndex,
  canAct,
  onApprove,
  onRequestChanges,
  pending = false,
  error = null,
}: ApprovalChainPanelProps): React.JSX.Element {
  const [comment, setComment] = useState('')
  const approvedIndexes = new Set(approvals.filter((a) => a.action === 'approved').map((a) => a.stepIndex))

  return (
    <div
      data-testid="approval-chain-panel"
      className="blueprint-frame space-y-3 p-4"
      style={{ borderColor: 'var(--accent-signoff)' }}
    >
      <span className="mono text-[11px] uppercase tracking-wider text-[var(--accent-signoff)]">
        Awaiting approval
      </span>

      <ol className="space-y-1">
        {steps.map((step, i) => {
          const state = approvedIndexes.has(i) ? 'approved' : i === nextStepIndex ? 'current' : 'waiting'
          return (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span
                className="mono text-[10px] uppercase"
                style={{
                  color:
                    state === 'approved'
                      ? '#10b981'
                      : state === 'current'
                        ? 'var(--accent-signoff)'
                        : 'var(--ink-500)',
                }}
              >
                {state === 'approved' ? '✓ approved' : state === 'current' ? "who's next" : 'waiting'}
              </span>
              <span className="text-[var(--ink-900)]">{step.label}</span>
            </li>
          )
        })}
      </ol>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {canAct && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="approve-button"
            disabled={pending}
            onClick={() => onApprove(comment.trim() || undefined)}
            className="evidence-btn !min-h-[36px] text-sm"
          >
            {pending ? 'Working…' : 'Approve'}
          </button>

          <input
            type="text"
            aria-label="Request-changes comment"
            placeholder="Reason for requesting changes (required)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-w-[14rem] flex-1 rounded border border-[var(--ink-100)] bg-[var(--paper-1)] px-2 py-1 text-sm"
          />

          <button
            type="button"
            data-testid="request-changes-button"
            disabled={pending || comment.trim().length === 0}
            onClick={() => onRequestChanges(comment.trim())}
            className="evidence-btn !min-h-[36px] text-sm disabled:opacity-40"
          >
            Request changes
          </button>
        </div>
      )}
    </div>
  )
}
