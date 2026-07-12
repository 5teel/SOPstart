'use client'

/**
 * Phase 21.5 (Plan 21.5-03, Task 1) — Dedicated Publish stage surface.
 *
 * Controlled / presentational component. Renders:
 *   1. Stage heading "Publish this SOP"
 *   2. Subtext
 *   3. Progress summary (only when hasSourceDoc === true)
 *   4. Inline publish-gate blocked reason strip (always visible when !isReady)
 *   5. Gated "Publish SOP" button
 *   6. "← Back to Review" link (only when hasSourceDoc === true)
 *   7. Publish error banner (reuses the legacy Phase-21 shell markup)
 *
 * Does NOT call fetch / Supabase / publish route directly. Invokes
 * `onPublish` callback only (the existing handlePublish chain supplied by
 * the parent shell — Req 10 callback-chain preservation).
 *
 * Safety gate: no bulk-verify wording anywhere in this file (D-21-07).
 *
 * Phase 29 (29-04) — optional `approvalStatus` prop. When state === 'pending'
 * renders ApprovalChainPanel alongside the existing content; no-chain SOPs
 * (approvalStatus undefined/null) render exactly as before (D29-03).
 */

import { ApprovalChainPanel, type ApprovalRow } from '@/components/admin/governance/ApprovalChainPanel'
import type { ChainStep } from '@/lib/governance/approvals'

export type PublishStageProps = {
  /** Number of steps that have been verified */
  verifiedCount: number
  /** Total number of steps in this SOP */
  totalCount: number
  /** True when all steps are verified and the button should be active */
  isReady: boolean
  /** Controls whether the verify progress summary + Back-to-Review link render */
  hasSourceDoc: boolean
  /** True while the publish network request is in flight */
  publishing: boolean
  /** Non-null when the publish API returned an error */
  publishError: string | null
  /** Fires when the user clicks "Publish SOP" — must be the existing handlePublish */
  onPublish: () => void
  /** Fires when the user clicks the error banner to dismiss it */
  onDismissError: () => void
  /** Fires when the user clicks "← Back to Review" */
  onBackToReview: () => void
  /** Phase 29 — non-null when this SOP's category has a chain and a publish has been requested */
  approvalStatus?: {
    state: 'pending' | 'approved' | null
    steps: ChainStep[]
    approvals: ApprovalRow[]
    nextStepIndex: number
    isCallerNextApprover: boolean
  } | null
  /** Fires when the matching approver clicks Approve */
  onApproveStep?: (comment?: string) => void
  /** Fires when the matching approver submits Request changes (comment required) */
  onRequestChanges?: (comment: string) => void
  /** True while approve/request-changes is in flight */
  approvalActionPending?: boolean
  /** Non-null when approveStep/requestChanges returned an error */
  approvalError?: string | null
}

export function PublishStage({
  verifiedCount,
  totalCount,
  isReady,
  hasSourceDoc,
  publishing,
  publishError,
  onPublish,
  onDismissError,
  onBackToReview,
  approvalStatus,
  onApproveStep,
  onRequestChanges,
  approvalActionPending = false,
  approvalError = null,
}: PublishStageProps): React.JSX.Element {
  const remaining = Math.max(0, totalCount - verifiedCount)

  return (
    <div
      data-testid="publish-stage"
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* 1. Stage heading */}
      <h1
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 17,
          fontWeight: 700,
          lineHeight: 1.2,
          color: 'var(--ink-900, #09090b)',
          margin: 0,
        }}
      >
        Publish this SOP
      </h1>

      {/* 2. Subtext */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.5,
          color: 'var(--ink-500, #71717a)',
          margin: 0,
        }}
      >
        Once published, workers assigned to this SOP will see it in their library.
      </p>

      {/* 3. Progress summary — only when hasSourceDoc */}
      {hasSourceDoc && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--accent-ok, #10b981)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          <span aria-hidden style={{ fontSize: 14 }}>&#10003;</span>
          <span>{verifiedCount} steps verified</span>
        </div>
      )}

      {/* 3b. Pending approval chain — only when this category has a chain and a publish was requested */}
      {approvalStatus?.state === 'pending' && (
        <ApprovalChainPanel
          steps={approvalStatus.steps}
          approvals={approvalStatus.approvals}
          nextStepIndex={approvalStatus.nextStepIndex}
          canAct={approvalStatus.isCallerNextApprover}
          onApprove={(comment) => onApproveStep?.(comment)}
          onRequestChanges={(comment) => onRequestChanges?.(comment)}
          pending={approvalActionPending}
          error={approvalError}
        />
      )}

      {/* 4. Inline publish-gate blocked reason — always visible when !isReady */}
      {!isReady && (
        <div
          data-testid="publish-blocked-reason"
          style={{
            border: '1px solid #fdba74',
            background: '#fff7ed',
            borderRadius: 4,
            padding: '8px 16px',
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              fontWeight: 500,
              color: '#c2410c',
            }}
          >
            {remaining} of {totalCount} steps left to verify before you can publish
          </span>
        </div>
      )}

      {/* 5. Publish button */}
      <button
        type="button"
        data-testid="publish-button"
        disabled={!isReady || publishing}
        onClick={onPublish}
        style={
          isReady && !publishing
            ? {
                background: 'var(--brand-yellow, #fbbf24)',
                color: 'var(--ink-900, #09090b)',
                fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                padding: '10px 20px',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }
            : {
                background: 'var(--steel-700, #3f3f46)',
                color: 'var(--ink-500, #71717a)',
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                padding: '10px 20px',
                border: 'none',
                borderRadius: 4,
                cursor: 'not-allowed',
                alignSelf: 'flex-start',
              }
        }
      >
        Publish SOP
      </button>

      {/* 7. Publish error banner — reuses the legacy Phase-21 shell markup */}
      {publishError && (
        <div
          role="alert"
          data-testid="publish-error-banner"
          onClick={onDismissError}
          style={{
            padding: '8px 12px',
            background: 'rgba(239,68,68,0.1)',
            borderTop: '1px solid rgba(239,68,68,0.3)',
            color: '#b91c1c',
            fontSize: 13,
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          {publishError} (click to dismiss)
        </div>
      )}

      {/* 6. Back to Review link — only when hasSourceDoc */}
      {hasSourceDoc && (
        <button
          type="button"
          onClick={onBackToReview}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            color: 'var(--ink-500, #71717a)',
            cursor: 'pointer',
            alignSelf: 'flex-start',
            textDecoration: 'underline',
          }}
        >
          &#8592; Back to Review
        </button>
      )}
    </div>
  )
}
