'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  recordObservation,
  getObservationLabels,
  listWorkerSopsForPicker,
  getAssessorStatusForSop,
  requestAssessorReview,
  type WorkerSopOption,
  type AssessorStatus,
} from '@/actions/observations'
import { VerdictButtons } from './VerdictButtons'
import type { Verdict } from '@/lib/validators/observations'

interface RecordObservationModalProps {
  open: boolean
  onClose: () => void
  worker: { id: string; name: string; roleLabel?: string }
  presetSopId?: string
  presetCompletionId?: string
  onRecorded?: () => void
}

const DEFAULT_LABELS = { performed_to_sop: 'Performed to SOP', needs_support: 'Needs support' }

// Phase 37 ASR-01/D-08: plain-language copy for a recorder blocked from
// the advancing verdict because they are not themselves signed off on
// this SOP. Mirrors the exact copy used on the sign-off surface (37-04).
const NOT_ASSESSOR_COPY = 'You need to be signed off on this SOP yourself before you can assess others on it'
// D-05: honesty copy shown before an admin/safety_manager override commits.
const OVERRIDE_DISCLOSURE_COPY = 'This will be recorded as an assessor override with your reason, visible in the audit trail.'

function mapObservationError(error: string): string {
  if (error === 'NOT_SIGNED_OFF_ASSESSOR') return NOT_ASSESSOR_COPY + '.'
  if (error === 'ASSESSOR_OVERRIDE_REQUIRED') {
    return 'Add a reason (at least 10 characters) to record this as an assessor override.'
  }
  return error
}

export function RecordObservationModal({
  open,
  onClose,
  worker,
  presetSopId,
  presetCompletionId,
  onRecorded,
}: RecordObservationModalProps) {
  const [labels, setLabels] = useState(DEFAULT_LABELS)
  const [sops, setSops] = useState<WorkerSopOption[]>([])
  const [loadingSops, setLoadingSops] = useState(false)
  const [search, setSearch] = useState('')
  const [sopId, setSopId] = useState<string | null>(presetSopId ?? null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Phase 37 ASR-01: assessor gate UI state.
  const [assessorStatus, setAssessorStatus] = useState<AssessorStatus | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [requestSent, setRequestSent] = useState(false)
  const [requestingAssessment, setRequestingAssessment] = useState(false)

  // Reset form state at the moment `open` transitions, during render (not
  // inside an effect) — React's documented pattern for adjusting state on a
  // prop change without a cascading-render effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    setSopId(open ? presetSopId ?? null : null)
    setVerdict(null)
    setNote('')
    setSearch('')
    setError(null)
    setLoadingSops(open)
    setAssessorStatus(null)
    setOverrideOpen(false)
    setOverrideReason('')
    setRequestSent(false)
  }

  // Fetch fresh picker data + labels every time the modal opens. All state
  // updates happen inside the async .then callback, never synchronously in
  // the effect body.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([getObservationLabels(), listWorkerSopsForPicker(worker.id)]).then(
      ([fetchedLabels, fetchedSops]) => {
        if (cancelled) return
        setLabels(fetchedLabels)
        setSops(fetchedSops)
        setLoadingSops(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [open, worker.id])

  // Phase 37 ASR-01: assessor status for the selected SOP. While the fetch
  // is in flight, assessorStatus stays null (its prior reset), so `blocked`
  // below stays false — the UI never flashes a blocked state.
  useEffect(() => {
    if (!sopId) return
    let cancelled = false
    getAssessorStatusForSop(sopId).then((status) => {
      if (cancelled) return
      setAssessorStatus(status)
    })
    return () => {
      cancelled = true
    }
  }, [sopId])

  const filteredSops = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return sops
    return sops.filter(
      (s) =>
        (s.title ?? '').toLowerCase().includes(term) ||
        (s.code ?? '').toLowerCase().includes(term)
    )
  }, [sops, search])

  const selectedSop = sops.find((s) => s.id === sopId) ?? null

  // Phase 37 ASR-01/D-08/D-09: blocked is derived, never trusted as the
  // authority — recordObservation recomputes the gate server-side (D-03).
  const blocked = Boolean(sopId) && assessorStatus !== null && !assessorStatus.isAssessor
  const canOverride = assessorStatus?.canOverride ?? false
  // While the override sheet is open, the advancing verdict becomes
  // selectable again (the override IS the permission) — VerdictButtons only
  // disables it outside that state.
  const blockedVerdict: Verdict | null = blocked && !overrideOpen ? 'performed_to_sop' : null

  const overrideReasonValid = overrideReason.trim().length >= 10
  const canSave =
    Boolean(sopId && verdict) &&
    !busy &&
    !(overrideOpen && verdict === 'performed_to_sop' && !overrideReasonValid)

  async function handleSave() {
    if (!sopId || !verdict) return
    setBusy(true)
    setError(null)
    const result = await recordObservation({
      workerId: worker.id,
      sopId,
      verdict,
      note: note.trim() || undefined,
      completionId: presetCompletionId,
      overrideReason: overrideOpen && verdict === 'performed_to_sop' ? overrideReason.trim() : undefined,
    })
    setBusy(false)
    if (!result.success) {
      setError(mapObservationError(result.error))
      return
    }
    onRecorded?.()
    onClose()
  }

  async function handleRequestAssessment() {
    if (!sopId || requestingAssessment) return
    setRequestingAssessment(true)
    try {
      const result = await requestAssessorReview(sopId)
      if (result.success) setRequestSent(true)
    } finally {
      setRequestingAssessment(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Record observation"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-[var(--paper)] rounded-xl max-w-lg w-full shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--ink-100)]">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-900)]">
            Record observation
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* Worker (locked / pre-filled) */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] mb-1.5">
              Worker
            </div>
            <div className="flex items-center gap-2 w-full px-3 py-2.5 border border-[var(--ink-900)] rounded text-sm text-[var(--ink-900)]">
              <span>
                👤 {worker.name}
                {worker.roleLabel ? ` — ${worker.roleLabel}` : ''}
              </span>
              <span className="ml-auto text-[9px] text-[var(--ink-500)]">PRE-FILLED</span>
            </div>
          </div>

          {/* SOP picker — worker's required SOPs listed first (D-06) */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] mb-1.5">
              SOP observed
            </div>
            {selectedSop ? (
              <div className="flex items-center gap-2 w-full px-3 py-2.5 border border-[var(--ink-300)] rounded text-sm text-[var(--ink-900)]">
                <span>🔍 {selectedSop.title ?? 'Untitled SOP'}</span>
                <button
                  type="button"
                  onClick={() => setSopId(null)}
                  disabled={busy}
                  className="ml-auto text-[var(--ink-500)] hover:text-[var(--ink-900)] text-xs"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search SOPs…"
                  disabled={busy || loadingSops}
                  className="w-full px-3 py-2.5 border border-[var(--ink-300)] rounded text-sm text-[var(--ink-900)] bg-[var(--paper-1)] outline-none focus:border-[var(--ink-900)]"
                />
                <div className="mt-1.5 max-h-40 overflow-y-auto border border-[var(--ink-100)] rounded divide-y divide-[var(--ink-100)]">
                  {loadingSops && (
                    <div className="px-3 py-2 text-xs text-[var(--ink-500)]">Loading SOPs…</div>
                  )}
                  {!loadingSops && filteredSops.length === 0 && (
                    <div className="px-3 py-2 text-xs text-[var(--ink-500)]">No SOPs found.</div>
                  )}
                  {filteredSops.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSopId(s.id)}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)]"
                    >
                      {s.title ?? 'Untitled SOP'}
                      {s.assigned && (
                        <span className="ml-2 text-[9px] text-[var(--ink-500)] uppercase">
                          Required
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="text-xs text-[var(--ink-500)] mt-1">
              Picker lists this worker&apos;s required SOPs first.
            </p>
          </div>

          {/* Verdict */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] mb-1.5">
              Verdict
            </div>
            <VerdictButtons
              value={verdict}
              onChange={setVerdict}
              labels={labels}
              blockedVerdict={blockedVerdict}
              blockedHint={blockedVerdict ? NOT_ASSESSOR_COPY : undefined}
            />
          </div>

          {/* Phase 37 ASR-01/D-08/D-05: blocked-advancing state */}
          {blocked && (
            <div className="p-3 rounded bg-[var(--paper-2)] border border-[var(--ink-100)]">
              <p className="text-sm text-[var(--ink-900)] mb-2">{NOT_ASSESSOR_COPY}</p>

              {!canOverride && (
                requestSent ? (
                  <p className="text-sm text-[var(--ink-900)] font-medium">
                    Request sent — an admin or safety manager will be notified.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestAssessment}
                    disabled={requestingAssessment}
                    className="text-sm font-semibold text-[var(--ink-900)] underline disabled:opacity-50"
                  >
                    {requestingAssessment ? 'Sending…' : 'Request assessment'}
                  </button>
                )
              )}

              {canOverride && !overrideOpen && (
                <button
                  type="button"
                  onClick={() => setOverrideOpen(true)}
                  className="text-sm font-semibold text-[var(--ink-900)] underline"
                >
                  Use assessor override
                </button>
              )}

              {canOverride && overrideOpen && (
                <div className="flex flex-col gap-2 mt-1">
                  <p className="text-xs text-[var(--ink-500)]">{OVERRIDE_DISCLOSURE_COPY}</p>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value.slice(0, 500))}
                    maxLength={500}
                    disabled={busy}
                    placeholder="Reason for override (min. 10 characters)…"
                    className="w-full min-h-[64px] px-3 py-2 border border-[var(--ink-300)] rounded text-sm text-[var(--ink-900)] bg-[var(--paper-1)] outline-none focus:border-[var(--ink-900)] resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] mb-1.5">
              Note (optional)
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 2000))}
              maxLength={2000}
              disabled={busy}
              placeholder='e.g. "Correct lock order, verified zero energy without prompting."'
              className="w-full min-h-[72px] px-3 py-2.5 border border-dashed border-[var(--ink-300)] rounded text-sm text-[var(--ink-900)] bg-[var(--paper-1)] outline-none focus:border-[var(--ink-900)] resize-none"
            />
          </div>

          {error && <p className="text-sm text-[var(--accent-escalate)]">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-3 rounded text-sm font-bold uppercase tracking-wide bg-[var(--ink-900)] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Save observation'}
          </button>

          <p className="text-xs text-[var(--ink-500)] text-center border-t border-[var(--ink-300)] pt-2.5">
            🔒 Permanent record — cannot be edited or deleted after saving. Visible to{' '}
            {worker.name}.
          </p>
        </div>
      </div>
    </div>
  )
}
