'use client'

/**
 * Phase 35 Plan 03 Task 2 — per-worker training record (TRN-01, D-11/D-12/
 * D-13). PersonPanel's single evidence renderer for the matrix cell-click
 * deep-link (D-09) — one block per REQUIRED SOP headed by its StatePill,
 * with completions + observations rendered as two separate evidence lists
 * beneath (not a flat merged timeline), plus a distinct "Other completed
 * SOPs" section for evidence outside the person's grants (D-13). When
 * focusSopId is set, the matching required-SOP block scrolls into view.
 * Purely informational — no edit/gate control anywhere (CMP-04).
 *
 * D-16 Export CSV (entry point 2 of 2 — this one worker): the header
 * button's onClick calls exportTrainingCsv({ workerId: personId }) and
 * streams the returned { csv, filename } to downloadCsv() — same shared
 * generator as the matrix header export.
 */

import { useEffect, useRef, useState } from 'react'
import { getTrainingRecordForPerson, exportTrainingCsv, type TrainingRecord } from '@/actions/competency'
import { downloadCsv } from '@/lib/competency/download-csv'
import { StatePill } from './StatePill'

interface TrainingRecordSectionProps {
  personId: string
  focusSopId?: string | null
}

function formatNZDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function TrainingRecordSection({ personId, focusSopId }: TrainingRecordSectionProps) {
  const [record, setRecord] = useState<TrainingRecord | null>(null)
  const [loading, setLoading] = useState(true)
  // A returned { error } must render as a message, never as a silently
  // blank panel (2026-07-20 silent-dead-feature class).
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Reset at the moment personId changes, during render (not inside an
  // effect) — mirrors PersonPanel's prevPersonId idiom
  // (react-hooks/set-state-in-effect).
  const [prevPersonId, setPrevPersonId] = useState(personId)
  if (prevPersonId !== personId) {
    setPrevPersonId(personId)
    setRecord(null)
    setFetchError(null)
    setLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    getTrainingRecordForPerson(personId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if ('record' in result) {
        setRecord(result.record)
      } else {
        setFetchError(result.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [personId])

  // Scroll the focused SOP's evidence block into view once the record loads (D-09).
  useEffect(() => {
    if (!focusSopId || !record) return
    const el = blockRefs.current[focusSopId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusSopId, record])

  // D-16 entry point 2 — exports this ONE worker. Passive action, never
  // gated on competency state (CMP-04).
  async function handleExport() {
    setExporting(true)
    setExportError(null)
    const result = await exportTrainingCsv({ workerId: personId })
    setExporting(false)
    if ('error' in result) {
      setExportError(result.error)
      return
    }
    downloadCsv(result.csv, result.filename)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
          Training record
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-[var(--ink-900)] text-white"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {exportError && <div className="text-xs text-[var(--accent-decision)] mb-1.5">{exportError}</div>}

      {loading && <div className="px-3.5 py-3 text-xs text-[var(--ink-500)]">Loading…</div>}

      {!loading && fetchError && (
        <div className="px-3.5 py-3 text-xs text-[var(--accent-decision)] rounded border border-[var(--ink-100)]">
          {fetchError}
        </div>
      )}

      {!loading && record && record.requiredSops.length === 0 && (
        <div className="px-3.5 py-3 text-xs text-[var(--ink-500)] rounded border border-[var(--ink-100)]">
          No required SOPs for this person yet.
        </div>
      )}

      {!loading && record && record.requiredSops.length > 0 && (
        <div className="flex flex-col gap-3">
          {record.requiredSops.map((sop) => (
            <div
              key={sop.sopId}
              ref={(el) => {
                blockRefs.current[sop.sopId] = el
              }}
              className={`rounded border p-3 ${sop.sopId === focusSopId ? 'border-[var(--accent-step)]' : 'border-[var(--ink-100)]'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[var(--ink-900)]">{sop.sopTitle}</div>
                <StatePill result={sop} />
              </div>
              {sop.completions.length > 0 || sop.observations.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {sop.completions.map((c) => (
                    <div key={c.completionId} className="text-xs text-[var(--ink-700)]">
                      Completed v{c.sopVersion} · {formatNZDate(c.submittedAt)}
                      {c.signOff && (
                        <span className="text-[var(--ink-500)]">
                          {' '}
                          · {c.signOff.decision} by {c.signOff.supervisorName} · {formatNZDate(c.signOff.createdAt)}
                        </span>
                      )}
                    </div>
                  ))}
                  {sop.observations.map((o, i) => (
                    <div key={`${sop.sopId}-obs-${i}`} className="text-xs text-[var(--ink-700)]">
                      Observed — {o.verdict} · by {o.observerName} · {formatNZDate(o.createdAt)}
                      {o.note && <span className="text-[var(--ink-500)]"> — {o.note}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-[var(--ink-500)]">No evidence yet.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && record && record.otherCompletedSops.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] mb-1.5">
            Other completed SOPs
          </div>
          <div className="flex flex-col gap-2">
            {record.otherCompletedSops.map((sop) => (
              <div key={sop.sopId} className="rounded border border-[var(--ink-100)] p-3">
                <div className="text-sm font-semibold text-[var(--ink-900)]">{sop.sopTitle}</div>
                {sop.completions.map((c) => (
                  <div key={c.completionId} className="text-xs text-[var(--ink-700)] mt-1">
                    Completed v{c.sopVersion} · {formatNZDate(c.submittedAt)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
