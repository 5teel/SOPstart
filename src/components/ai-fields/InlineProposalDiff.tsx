'use client'

/**
 * Phase 23 Plan 23-04 — InlineProposalDiff (D-03).
 *
 * Renders an inline Accept / Reject diff card AT THE FIELD where a pending
 * AI proposal exists. No central queue — this is the ONLY review surface (D-03).
 *
 * Props: a pending AiFieldProposal row (field_label, current_value, proposed_value).
 * After Accept or Reject, calls router.refresh() so the server component re-fetches.
 *
 * Diff rendering:
 *   - Block-content fields: reuses diffBlockContent (D-07)
 *   - Scalar fields: plain old → new display
 *
 * Design tokens (paper/ink palette from sketch-findings):
 *   - Accept button: green accent (text-green-400, bg-green-950/40, border-green-700/40)
 *   - Reject button: ink-neutral (text-[var(--ink-500)])
 *   - Old value: struck-through, text-[var(--ink-500)] (neutral/dim)
 *   - New value: highlighted, text-[var(--ink-900)] (prominent)
 *   - Card: paper bg (var(--paper)), ink border
 *   - diff values: JetBrains Mono (font-mono)
 *
 * Security: handlers call acceptProposal/rejectProposal server actions (not empty —
 *   CLAUDE.md 2026-06-05 wiring learning)
 *
 * Test hook: data-inline-proposal-diff on root element.
 *
 * Sources:
 *   - 23-04-PLAN.md Task 3
 *   - 23-CONTEXT.md D-03 (inline diff at the field, no central queue)
 *   - src/components/admin/blocks/BlockUpdateReviewModal.tsx (diff card pattern)
 *   - src/lib/builder/diff-block-content.ts (D-07 diff utility)
 *   - CLAUDE.md 2026-06-05 (wire the handler, not just render the affordance)
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { acceptProposal, rejectProposal } from '@/actions/ai-fields'
import { diffBlockContent } from '@/lib/builder/diff-block-content'
import type { BlockContent } from '@/types/sop'

// ---------------------------------------------------------------------------
// AiFieldProposal type (matches database.types.ts ai_field_proposals Row)
// ---------------------------------------------------------------------------

export interface AiFieldProposal {
  id: string
  field_label: string
  current_value: unknown
  proposed_value: unknown
  status: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stringify any value for display — handles strings, objects, null, arrays.
 */
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * Check if a value looks like a BlockContent object (has a 'kind' discriminator).
 * Used to decide whether to use diffBlockContent or plain old→new display.
 */
function isBlockContent(value: unknown): value is BlockContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as Record<string, unknown>)['kind'] === 'string'
  )
}

// ---------------------------------------------------------------------------
// InlineProposalDiff
// ---------------------------------------------------------------------------

export interface InlineProposalDiffProps {
  proposal: AiFieldProposal
  /** Optional: called after successful accept/reject for parent cleanup. */
  onResolved?: () => void
}

export function InlineProposalDiff({ proposal, onResolved }: InlineProposalDiffProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<'accepted' | 'rejected' | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Accept handler ─────────────────────────────────────────────────────────
  // MUST call acceptProposal() — not an empty handler (CLAUDE.md 2026-06-05)
  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptProposal(proposal.id)
      if (!result.success) {
        setError(result.error)
        return
      }
      setResolved('accepted')
      router.refresh()
      onResolved?.()
    })
  }

  // ── Reject handler ─────────────────────────────────────────────────────────
  // MUST call rejectProposal() — not an empty handler (CLAUDE.md 2026-06-05)
  function handleReject() {
    setError(null)
    startTransition(async () => {
      const result = await rejectProposal(proposal.id)
      if (!result.success) {
        setError(result.error)
        return
      }
      setResolved('rejected')
      router.refresh()
      onResolved?.()
    })
  }

  // ── Resolved state: show confirmation then nothing ─────────────────────────
  if (resolved === 'accepted') {
    return (
      <div
        data-inline-proposal-diff
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-950/30 border border-green-700/40 text-green-400 text-sm"
      >
        <CheckCircle className="h-4 w-4 shrink-0" />
        <span>Change applied.</span>
      </div>
    )
  }
  if (resolved === 'rejected') {
    return (
      <div
        data-inline-proposal-diff
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--paper-2)] border border-[var(--ink-100)] text-[var(--ink-500)] text-sm"
      >
        <XCircle className="h-4 w-4 shrink-0" />
        <span>Change discarded.</span>
      </div>
    )
  }

  // ── Diff rendering ─────────────────────────────────────────────────────────
  const isBlockDiff =
    isBlockContent(proposal.current_value) || isBlockContent(proposal.proposed_value)

  const blockDiff =
    isBlockDiff &&
    isBlockContent(proposal.current_value) &&
    isBlockContent(proposal.proposed_value)
      ? diffBlockContent(proposal.current_value, proposal.proposed_value)
      : null

  return (
    <div
      data-inline-proposal-diff
      className="rounded-xl border border-[var(--ink-100)] bg-[var(--paper)] overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--ink-100)] bg-[var(--paper-2)]">
        <div>
          <span className="text-xs font-semibold text-[var(--ink-900)] uppercase tracking-wider">
            AI Suggestion
          </span>
          <span className="ml-2 text-xs text-[var(--ink-500)]">
            {proposal.field_label}
          </span>
        </div>
        {isPending && (
          <Loader2 className="h-3.5 w-3.5 text-[var(--ink-500)] animate-spin" />
        )}
      </div>

      {/* Diff body */}
      <div className="px-4 py-3 space-y-3">
        {blockDiff ? (
          // ── Block-content diff (D-07: reuse diffBlockContent) ──
          <div className="space-y-2">
            {blockDiff.fields.map((field) => {
              const changed = field.oldValue !== field.newValue
              return (
                <div key={field.key} className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-500)] font-medium">
                    {field.key}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`rounded-md px-3 py-2 text-sm font-mono border ${
                      changed
                        ? 'border-[var(--ink-100)] bg-[var(--paper-2)] text-[var(--ink-500)] line-through'
                        : 'border-[var(--ink-100)] bg-[var(--paper-2)] text-[var(--ink-500)]'
                    }`}>
                      {field.oldValue || <span className="italic opacity-50">(empty)</span>}
                    </div>
                    <div className={`rounded-md px-3 py-2 text-sm font-mono border ${
                      changed
                        ? 'border-green-700/40 bg-green-950/20 text-[var(--ink-900)]'
                        : 'border-[var(--ink-100)] bg-[var(--paper-2)] text-[var(--ink-500)]'
                    }`}>
                      {field.newValue || <span className="italic opacity-50">(empty)</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // ── Scalar diff (plain old → new) ──
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-500)] mb-1">
                Current
              </div>
              <div className="rounded-md px-3 py-2 text-sm font-mono border border-[var(--ink-100)] bg-[var(--paper-2)] text-[var(--ink-500)] line-through">
                {toDisplayString(proposal.current_value)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-500)] mb-1">
                Proposed
              </div>
              <div className="rounded-md px-3 py-2 text-sm font-mono border border-green-700/40 bg-green-950/20 text-[var(--ink-900)]">
                {toDisplayString(proposal.proposed_value)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Accept / Reject footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--ink-100)] bg-[var(--paper-2)]">
        {/* Reject — ink-neutral */}
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--ink-500)] hover:text-[var(--ink-900)] hover:bg-[var(--paper)] border border-[var(--ink-100)] transition-colors disabled:opacity-40"
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </button>

        {/* Accept — green accent (signoff/OK) */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-400 bg-green-950/40 hover:bg-green-950/60 border border-green-700/40 transition-colors disabled:opacity-40"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Accept
        </button>
      </div>
    </div>
  )
}
