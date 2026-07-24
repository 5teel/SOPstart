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
 * D-16 per-worker Export CSV button lands here in Task 4.
 */

import { useEffect, useRef, useState } from 'react'
import { getTrainingRecordForPerson, type TrainingRecord } from '@/actions/competency'
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
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Reset at the moment personId changes, during render (not inside an
  // effect) — mirrors PersonPanel's prevPersonId idiom
  // (react-hooks/set-state-in-effect).
  const [prevPersonId, setPrevPersonId] = useState(personId)
  if (prevPersonId !== personId) {
    setPrevPersonId(personId)
    setRecord(null)
    setLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    getTrainingRecordForPerson(personId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if ('record' in result) setRecord(result.record)
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

  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
          Training record
        </div>
        {/* Export CSV button lands here in Task 4 */}
      </div>

      {loading && <div className="px-3.5 py-3 text-xs text-[var(--ink-500)]">Loading…</div>}

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
