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
 *
 * Phase 32-09 — optional `wireUpHref` prop (D-12a). When set (the parent
 * shell supplies it once initialSop.status === 'published'), renders a
 * "Choose who sees it" CTA to /admin/sops?view=access&sop={sopId}, pinning
 * the SOP on the access map for organic wire-up (33-09 SC-5: plain
 * language, href unchanged).
 */

import Link from 'next/link'
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
  /** Phase 32-09 (D-12a) — set by the parent shell once this SOP is published; links to the wiring surface with this SOP pinned. */
  wireUpHref?: string
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
  wireUpHref,
}: PublishStageProps): React.JSX.Element {
  const remaining = Math.max(0, totalCount - verifiedCount)

  return (
    <div
      data-testid="publish-stage"
      className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-6 py-12"
    >
      {/* 1. Stage heading */}
      <h1 className="m-0 text-[17px] leading-tight font-bold text-[var(--ink-900)]">
        Publish this SOP
      </h1>

      {/* 2. Subtext */}
      <p className="m-0 text-sm leading-normal text-[var(--ink-500)]">
        Once published, workers assigned to this SOP will see it in their library.
      </p>

      {/* 3. Progress summary — only when hasSourceDoc */}
      {hasSourceDoc && (
        <div className="mono flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--accent-signoff)]">
          <span aria-hidden className="text-sm">&#10003;</span>
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
          className="rounded border border-[var(--accent-decision)]/40 bg-[var(--accent-decision)]/10 px-4 py-2"
        >
          <span className="mono text-[10px] font-medium text-[var(--accent-decision)]">
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
        className={
          isReady && !publishing
            ? 'self-start cursor-pointer rounded border-none bg-[var(--ink-900)] px-5 py-2.5 text-sm font-bold text-[var(--paper)]'
            : 'self-start cursor-not-allowed rounded border-none bg-[var(--ink-100)] px-5 py-2.5 text-sm text-[var(--ink-500)]'
        }
      >
        Publish SOP
      </button>

      {/* 5b. Reversibility — UX-07: publishing is not a one-way door */}
      <p className="m-0 text-xs leading-normal text-[var(--ink-500)]">
        You can unpublish or edit later.
      </p>

      {/* 5c. Choose who sees it — D-12a post-publish CTA to the access map */}
      {wireUpHref && (
        <Link
          href={wireUpHref}
          data-testid="wire-up-access-cta"
          className="self-start rounded border border-[var(--ink-900)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--ink-900)] no-underline"
        >
          Choose who sees it →
        </Link>
      )}

      {/* 7. Publish error banner — reuses the legacy Phase-21 shell markup */}
      {publishError && (
        <div
          role="alert"
          data-testid="publish-error-banner"
          onClick={onDismissError}
          className="cursor-pointer rounded border-t border-[var(--accent-escalate)]/30 bg-[var(--accent-escalate)]/10 px-3 py-2 text-[13px] text-[var(--accent-escalate)]"
        >
          {publishError} (click to dismiss)
        </div>
      )}

      {/* 6. Back to Check link — only when hasSourceDoc */}
      {hasSourceDoc && (
        <button
          type="button"
          onClick={onBackToReview}
          className="mono self-start cursor-pointer border-none bg-transparent p-0 text-[12px] text-[var(--ink-500)] underline"
        >
          &#8592; Back to Check
        </button>
      )}
    </div>
  )
}
