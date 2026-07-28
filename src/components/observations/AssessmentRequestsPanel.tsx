'use client'

import { useEffect, useState } from 'react'
import { listAssessmentRequests, type AssessmentRequest } from '@/actions/observations'
import { markNotificationRead } from '@/actions/versioning'
import { RecordObservationModal } from './RecordObservationModal'

/**
 * Phase 37 ASR-01 (D-08 actionability, Pitfall 1) — the ONLY surface that
 * makes incoming assessment requests visible/actionable. Fetches its own
 * data; listAssessmentRequests is already role-gated to admin/safety_manager
 * and returns [] for anyone else, so this is safe to mount unconditionally
 * on a page whose own guard already restricts to those roles.
 */
export function AssessmentRequestsPanel() {
  const [requests, setRequests] = useState<AssessmentRequest[] | null>(null)
  const [modalRequest, setModalRequest] = useState<AssessmentRequest | null>(null)

  useEffect(() => {
    let cancelled = false
    listAssessmentRequests().then((rows) => {
      if (cancelled) return
      setRequests(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function dismiss(id: string) {
    markNotificationRead(id)
    setRequests((prev) => (prev ?? []).filter((r) => r.id !== id))
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-NZ', {
      day: '2-digit',
      month: 'short',
    })
  }

  if (requests === null) return null
  if (requests.length === 0) return null

  return (
    <>
      <div className="mb-6 rounded border border-[var(--ink-100)] bg-[var(--paper)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--ink-100)]">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-900)]">
            Assessment requests
          </span>
          <span className="text-[10px] font-bold text-[var(--ink-500)] bg-[var(--paper-2)] rounded-full px-2 py-0.5">
            {requests.length}
          </span>
        </div>
        <div className="divide-y divide-[var(--ink-100)]">
          {requests.map((req) => (
            <div key={req.id} className="flex items-center gap-3 px-4 py-2.5">
              <p className="text-sm text-[var(--ink-900)] flex-1 min-w-0">
                <span className="font-medium">{req.subjectName}</span> asked to be signed off on{' '}
                <span className="font-medium">{req.sopTitle ?? 'Untitled SOP'}</span>
                <span className="ml-2 text-xs text-[var(--ink-500)]">{formatDate(req.createdAt)}</span>
              </p>
              <button
                type="button"
                onClick={() => setModalRequest(req)}
                className="text-xs font-semibold text-[var(--ink-900)] underline flex-shrink-0"
              >
                Assess now
              </button>
              <button
                type="button"
                onClick={() => dismiss(req.id)}
                className="text-xs text-[var(--ink-500)] hover:text-[var(--ink-900)] flex-shrink-0"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      </div>

      <RecordObservationModal
        open={modalRequest !== null}
        onClose={() => setModalRequest(null)}
        worker={{ id: modalRequest?.subjectUserId ?? '', name: modalRequest?.subjectName ?? '' }}
        presetSopId={modalRequest?.sopId}
        onRecorded={() => {
          if (modalRequest) dismiss(modalRequest.id)
          setModalRequest(null)
        }}
      />
    </>
  )
}
