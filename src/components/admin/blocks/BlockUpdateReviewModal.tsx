'use client'

/**
 * Phase 13 plan 13-04 — Block Update Review Modal.
 *
 * Side-by-side diff of junction.snapshot_content (CURRENT in this SOP) vs
 * junction.latestVersion.content (NEW from the source block) with Accept /
 * Decline footer.
 *
 * Accept routes through accept_block_update RPC + the publish gate (Phase 12) —
 * if the parent SOP was 'published', acceptBlockUpdate flips it back to
 * 'draft' so workers don't see the new content until admin re-publishes.
 *
 * Decline records the decision in sop_block_update_decisions so the same
 * version doesn't re-trigger the badge.
 */

import { useMemo, useState, useTransition } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import type { SopSectionBlockWithUpdate } from '@/types/sop'
import {
  acceptBlockUpdate,
  declineBlockUpdate,
} from '@/actions/sop-section-blocks'
import { diffBlockContent } from '@/lib/builder/diff-block-content'

export type BlockUpdateReviewModalProps = {
  open: boolean
  onClose: () => void
  junction: SopSectionBlockWithUpdate
  onReviewed?: () => void
}

export function BlockUpdateReviewModal({
  open,
  onClose,
  junction,
  onReviewed,
}: BlockUpdateReviewModalProps) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const latest = junction.latestVersion ?? null

  const diff = useMemo(() => {
    if (!latest?.content) return null
    return diffBlockContent(junction.snapshot_content, latest.content)
  }, [junction.snapshot_content, latest])

  if (!open) return null

  function handleAccept() {
    setError(null)
    setToast(null)
    if (!latest) {
      setError('No latest version to accept')
      return
    }
    const versionId = latest.id
    startTransition(async () => {
      const res = await acceptBlockUpdate({
        sopSectionBlockId: junction.id,
        newVersionId: versionId,
        note: note || undefined,
      })
      if ('error' in res) {
        setError(res.error)
        return
      }
      setToast(
        res.sopReturnedToDraft
          ? 'Block updated. SOP returned to draft for re-publish.'
          : 'Block updated.'
      )
      onReviewed?.()
    })
  }

  function handleDecline() {
    setError(null)
    setToast(null)
    if (!latest) {
      setError('No latest version to decline')
      return
    }
    const versionId = latest.id
    startTransition(async () => {
      const res = await declineBlockUpdate({
        sopSectionBlockId: junction.id,
        newVersionId: versionId,
        note: note || undefined,
      })
      if ('error' in res) {
        setError(res.error)
        return
      }
      setToast('Update declined. Existing content kept.')
      onReviewed?.()
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-update-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-steel-900/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-steel-800 border border-steel-700 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-steel-700">
          <div>
            <h2
              id="block-update-review-title"
              className="text-base font-semibold text-steel-100"
            >
              Block update available — review changes
            </h2>
            <p className="mt-1 text-xs text-steel-400">
              This block&apos;s source has been updated. Review the changes and
              decide whether to apply them to this SOP.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-steel-400 hover:text-steel-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {!latest && (
            <div className="text-sm text-amber-300 bg-amber-950/30 border border-amber-700/40 rounded-md p-3">
              No latest version is available to compare against. The badge will
              clear once you reload.
            </div>
          )}

          {diff?.kindChanged && (
            <div className="flex items-start gap-2 text-sm text-amber-200 bg-amber-950/30 border border-amber-700/40 rounded-md p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong>Block kind changed.</strong> Accepting will replace the
                block entirely (
                {diff.fields[0]?.oldValue} → {diff.fields[0]?.newValue}).
              </div>
            </div>
          )}

          {diff && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-steel-400 px-2">
                Current (in this SOP)
              </div>
              <div className="text-[10px] uppercase tracking-wider text-steel-400 px-2">
                New (latest version)
              </div>

              {diff.fields.map((f) => {
                const fieldChanged = f.oldValue !== f.newValue
                const cellClass = fieldChanged
                  ? 'bg-amber-900/30 border border-amber-600/50'
                  : 'bg-steel-900 border border-steel-700'
                return (
                  <div key={f.key} className="contents">
                    <div className={`${cellClass} rounded-md p-2`}>
                      <div className="text-[10px] uppercase tracking-wider text-steel-500 mb-1">
                        {f.key}
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-steel-100">
                        {f.oldValue || <span className="text-steel-500">(empty)</span>}
                      </pre>
                    </div>
                    <div className={`${cellClass} rounded-md p-2`}>
                      <div className="text-[10px] uppercase tracking-wider text-steel-500 mb-1">
                        {f.key}
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-steel-100">
                        {f.newValue || <span className="text-steel-500">(empty)</span>}
                      </pre>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div>
            <label
              htmlFor="decision-note"
              className="block text-xs uppercase tracking-wider text-steel-400 mb-1"
            >
              Decision note (optional)
            </label>
            <textarea
              id="decision-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-steel-900 border border-steel-700 rounded-md px-3 py-2 text-sm text-steel-100 focus:border-brand-yellow focus:outline-none"
              placeholder="Why are you accepting / declining?"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-700/40 rounded-md p-3">
              {error}
            </div>
          )}
          {toast && (
            <div className="text-sm text-green-400 bg-green-950/30 border border-green-700/40 rounded-md p-3">
              {toast}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-steel-700 bg-steel-900/40">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isPending || !latest}
            className="bg-steel-800 border border-steel-700 text-steel-300 hover:text-steel-100 hover:bg-steel-700 font-semibold px-4 h-[40px] rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            Decline (keep current)
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isPending || !latest}
            className="bg-brand-yellow text-steel-900 font-semibold px-4 h-[40px] rounded-lg hover:bg-amber-400 transition-colors text-sm disabled:opacity-50"
          >
            Accept update
          </button>
        </div>
      </div>
    </div>
  )
}
