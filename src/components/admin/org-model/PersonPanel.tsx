'use client'

/**
 * Phase 34-06 — Entry point A (D-03): side panel opened by clicking a named
 * person chip in either org view. Info + observation history + a "Record
 * observation" CTA that opens the shared RecordObservationModal with the
 * worker pre-filled. Body is a plain section list so Phase 35's per-worker
 * training record can be appended below without a rewrite (D-03 growth-point
 * note) — no derived-state logic ships this phase.
 */

import { useEffect, useState } from 'react'
import {
  listObservationsForPerson,
  getObservationLabels,
  type ObservationRow as ObservationRowData,
} from '@/actions/observations'
import { ObservationRow } from '@/components/observations/ObservationRow'
import { RecordObservationModal } from '@/components/observations/RecordObservationModal'

interface PersonPanelProps {
  person: { id: string; name: string; roleLabel?: string } | null
  onClose: () => void
}

const DEFAULT_LABELS = { performed_to_sop: 'Performed to SOP', needs_support: 'Needs support' }

export function PersonPanel({ person, onClose }: PersonPanelProps) {
  const [history, setHistory] = useState<ObservationRowData[]>([])
  const [labels, setLabels] = useState(DEFAULT_LABELS)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const personId = person?.id ?? null

  // Reset history/loading at the moment the selected person changes, during
  // render (not inside an effect) — mirrors RecordObservationModal's
  // "adjusting state when a prop changes" pattern (react-hooks/set-state-in-effect).
  const [prevPersonId, setPrevPersonId] = useState(personId)
  if (prevPersonId !== personId) {
    setPrevPersonId(personId)
    setHistory([])
    setLoading(Boolean(personId))
  }

  useEffect(() => {
    if (!personId) return
    let cancelled = false
    Promise.all([listObservationsForPerson(personId), getObservationLabels()]).then(
      ([obs, fetchedLabels]) => {
        if (cancelled) return
        setHistory(obs)
        setLabels(fetchedLabels)
        setLoading(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [personId, refreshKey])

  if (!person) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Person details" className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-[var(--paper)] shadow-xl overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ink-100)]">
          <div>
            <div className="text-base font-semibold text-[var(--ink-900)]">{person.name}</div>
            {person.roleLabel && (
              <div className="text-xs text-[var(--ink-500)] mt-0.5">{person.roleLabel}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Record CTA — ink-900 idiom, not --brand-yellow */}
          <section>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full py-3 rounded text-sm font-bold uppercase tracking-wide bg-[var(--ink-900)] text-white"
            >
              + Record observation
            </button>
            <p className="text-xs text-[var(--ink-500)] text-center mt-1.5">
              ~30 seconds · worker pre-filled, just pick the SOP
            </p>
          </section>

          {/* Observation history */}
          <section>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] mb-1.5">
              Observation history
            </div>
            <div className="rounded border border-[var(--ink-100)] divide-y divide-[var(--ink-100)]">
              {loading && <div className="px-3.5 py-3 text-xs text-[var(--ink-500)]">Loading…</div>}
              {!loading && history.length === 0 && (
                <div className="px-3.5 py-3 text-xs text-[var(--ink-500)]">No observations yet.</div>
              )}
              {!loading &&
                history.map((obs) => (
                  <ObservationRow
                    key={obs.id}
                    sopTitle={obs.sopTitle}
                    sopVersion={obs.sopVersion}
                    verdict={obs.verdict}
                    note={obs.note}
                    observerName={obs.observerName}
                    createdAt={obs.createdAt}
                    labels={labels}
                  />
                ))}
            </div>
          </section>

          {/* Growth point (Phase 35): this section list is where the
              per-worker training record will be appended. Nothing to
              render here yet — intentionally lean. */}
        </div>
      </div>

      <RecordObservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        worker={{ id: person.id, name: person.name, roleLabel: person.roleLabel }}
        onRecorded={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
