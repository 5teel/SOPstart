'use client'

/**
 * Phase 35 Plan 03 — training matrix as the third /admin/team view mode
 * (MTX-01, D-06/D-07/D-08/D-09/D-10). Department-first cut with a
 * department switcher (D-06), MTX-03 worker/SOP filters, both-axis rollups
 * (D-08), and fit-driven progressive compaction (D-07 — RESEARCH Pitfall 5:
 * no hardcoded column-count threshold). Every cell deep-links via
 * onSelectCell (D-09) to the PersonPanel training record — no second
 * evidence renderer. Cells are passive buttons only; nothing here is ever
 * disabled/locked on competency state (CMP-04).
 *
 * D-16 Export CSV (entry point 1 of 2 — the matrix's current filtered cut):
 * the header button's onClick calls exportTrainingCsv(filters) and streams
 * the returned { csv, filename } to downloadCsv(). Native date inputs feed
 * the completion-date range filter (no picker library, ladder rung 4).
 */

import { useEffect, useRef, useState } from 'react'
import { getTrainingMatrix, exportTrainingCsv } from '@/actions/competency'
import { downloadCsv } from '@/lib/competency/download-csv'
import { StatePill } from './StatePill'
import type { MatrixPerson, MatrixSop, MatrixCell, TrainingMatrix } from '@/lib/competency/matrix'
import type { Department } from '@/types/sop'

interface TrainingMatrixViewProps {
  departments: Department[]
  onSelectCell: (personId: string, sopId: string) => void
}

// Estimated labelled-pill column width (px) used to compute how many columns
// fit the current container before switching to compact cells (D-07) — a
// measured-width calculation, never a hardcoded column-count threshold.
const COLUMN_WIDTH_PX = 130

const COMPACT_LEGEND: Array<{ label: string; accentVar: string }> = [
  { label: 'Signed off', accentVar: '--accent-signoff' },
  { label: 'Observed', accentVar: '--accent-step' },
  { label: 'Awaiting sign-off', accentVar: '--accent-decision' },
  { label: 'Read / Not started', accentVar: '--ink-500' },
]

function compactAccentVar(cell: Pick<MatrixCell, 'state' | 'awaitingSignOff'>): string {
  if (cell.state === 'competent_signed_off') return '--accent-signoff'
  if (cell.state === 'supervised') return '--accent-step'
  if (cell.state === 'read' && cell.awaitingSignOff) return '--accent-decision'
  return '--ink-500'
}

export function TrainingMatrixView({ departments, onSelectCell }: TrainingMatrixViewProps) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '')
  const [workerId, setWorkerId] = useState('')
  const [sopId, setSopId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Unfiltered per-department option lists for the worker/SOP filter
  // dropdowns (MTX-03) — fetched once per department change, independent of
  // the filtered matrix fetch below so filter options never shrink to match
  // the current selection.
  const [allPeople, setAllPeople] = useState<MatrixPerson[]>([])
  const [allSops, setAllSops] = useState<MatrixSop[]>([])

  const [matrix, setMatrix] = useState<TrainingMatrix | null>(null)
  const [people, setPeople] = useState<MatrixPerson[]>([])
  const [sops, setSops] = useState<MatrixSop[]>([])
  const [loading, setLoading] = useState(false)
  // A returned { error } must render as an error, never as the "no people"
  // empty state — an authorization regression must not look like an empty
  // department (2026-07-20 silent-dead-feature class).
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [containerWidth, setContainerWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!departmentId) return
    let cancelled = false
    getTrainingMatrix({ departmentId }).then((result) => {
      if (cancelled) return
      if ('error' in result) {
        // Never leave the previous department's filter options in place.
        setAllPeople([])
        setAllSops([])
        return
      }
      setAllPeople(result.people)
      setAllSops(result.sops)
    })
    return () => {
      cancelled = true
    }
  }, [departmentId])

  // MTX-03 — re-fetches the matrix on every department/worker/SOP filter
  // change. `cancelled` guard (mirrors TrainingRecordSection) so an earlier,
  // slower department's response can never overwrite a later selection.
  useEffect(() => {
    if (!departmentId) return
    let cancelled = false
    setLoading(true)
    getTrainingMatrix({ departmentId, workerId: workerId || undefined, sopId: sopId || undefined }).then((result) => {
      if (cancelled) return
      setLoading(false)
      if ('error' in result) {
        setFetchError(result.error)
        setMatrix(null)
        setPeople([])
        setSops([])
        return
      }
      setFetchError(null)
      setMatrix(result.matrix)
      setPeople(result.people)
      setSops(result.sops)
    })
    return () => {
      cancelled = true
    }
  }, [departmentId, workerId, sopId])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const isCompact = containerWidth > 0 && sops.length * COLUMN_WIDTH_PX > containerWidth

  // D-16 entry point 1 — exports the CURRENT filtered cut (dept/worker/SOP +
  // date-range). Passive action, never gated on competency state (CMP-04).
  async function handleExport() {
    setExporting(true)
    setExportError(null)
    const result = await exportTrainingCsv({
      departmentId,
      workerId: workerId || undefined,
      sopId: sopId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
    setExporting(false)
    if ('error' in result) {
      setExportError(result.error)
      return
    }
    downloadCsv(result.csv, result.filename)
  }

  const cellFor = (personId: string, forSopId: string) => matrix?.cells.find((c) => c.personId === personId && c.sopId === forSopId)
  const rowRollupFor = (personId: string) => matrix?.rowRollups.find((r) => r.personId === personId)
  const colRollupFor = (forSopId: string) => matrix?.colRollups.find((r) => r.sopId === forSopId)

  if (departments.length === 0) {
    return <div className="text-sm text-[var(--ink-500)] py-8 text-center">No departments yet — create one in Columns view first.</div>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--ink-500)]">
          Department
          <select
            className="border border-[var(--ink-100)] rounded px-2 py-1.5 text-sm"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value)
              setWorkerId('')
              setSopId('')
            }}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--ink-500)]">
          Worker
          <select
            className="border border-[var(--ink-100)] rounded px-2 py-1.5 text-sm"
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
          >
            <option value="">All workers</option>
            {allPeople.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--ink-500)]">
          SOP
          <select
            className="border border-[var(--ink-100)] rounded px-2 py-1.5 text-sm"
            value={sopId}
            onChange={(e) => setSopId(e.target.value)}
          >
            <option value="">All SOPs</option>
            {allSops.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--ink-500)]">
          From
          <input
            type="date"
            className="border border-[var(--ink-100)] rounded px-2 py-1.5 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--ink-500)]">
          To
          <input
            type="date"
            className="border border-[var(--ink-100)] rounded px-2 py-1.5 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={() => void handleExport()}
          className="ml-auto px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide bg-[var(--ink-900)] text-white"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {exportError && <div className="text-xs text-[var(--accent-decision)]">{exportError}</div>}

      {loading && <div className="text-sm text-[var(--ink-500)] py-8 text-center">Loading matrix…</div>}

      {!loading && fetchError && (
        <div className="text-sm text-[var(--accent-decision)] py-8 text-center">{fetchError}</div>
      )}

      {!loading && !fetchError && people.length === 0 && (
        <div className="text-sm text-[var(--ink-500)] py-8 text-center">No people with required SOPs in this cut.</div>
      )}

      {!loading && people.length > 0 && (
        <div ref={scrollRef} className="overflow-x-auto border border-[var(--ink-100)] rounded">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ink-100)]">
                <th className="text-left px-3 py-2 font-semibold text-[var(--ink-900)] sticky left-0 bg-[var(--paper)]">Worker</th>
                {sops.map((sop) => {
                  const rollup = colRollupFor(sop.id)
                  return (
                    <th key={sop.id} className="text-left px-3 py-2 font-semibold text-[var(--ink-900)] whitespace-nowrap">
                      {sop.title}
                      {rollup && (
                        <div className="text-[10px] font-normal text-[var(--ink-500)] mt-0.5">
                          {rollup.signedOffCount}/{rollup.total} signed off
                          {rollup.needsSupportCount > 0 && (
                            <span className="text-[var(--accent-decision)]"> · {rollup.needsSupportCount} needs support</span>
                          )}
                          {rollup.outdatedCount > 0 && (
                            <span className="text-[var(--accent-voice)]"> · {rollup.outdatedCount} on outdated version</span>
                          )}
                          {rollup.refresherOverdueCount > 0 && (
                            <span className="text-[var(--accent-decision)]"> · {rollup.refresherOverdueCount} refresher overdue</span>
                          )}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const rollup = rowRollupFor(person.id)
                return (
                  <tr key={person.id} className="border-b border-[var(--ink-100)] last:border-b-0">
                    <td className="px-3 py-2 font-medium text-[var(--ink-900)] sticky left-0 bg-[var(--paper)] whitespace-nowrap">
                      {person.displayName}
                      {rollup && (
                        <div className="text-[10px] font-normal text-[var(--ink-500)] mt-0.5">
                          {rollup.competentCount}/{rollup.total} competent
                          {rollup.needsSupportCount > 0 && (
                            <span className="text-[var(--accent-decision)]"> · {rollup.needsSupportCount} needs support</span>
                          )}
                          {rollup.outdatedCount > 0 && (
                            <span className="text-[var(--accent-voice)]"> · {rollup.outdatedCount} on outdated version</span>
                          )}
                          {rollup.refresherOverdueCount > 0 && (
                            <span className="text-[var(--accent-decision)]"> · {rollup.refresherOverdueCount} refresher overdue</span>
                          )}
                        </div>
                      )}
                    </td>
                    {sops.map((sop) => {
                      const cell = cellFor(person.id, sop.id)
                      if (!cell) return <td key={sop.id} className="px-3 py-2" />
                      return (
                        <td key={sop.id} className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => onSelectCell(person.id, sop.id)}
                            className="cursor-pointer"
                            aria-label={`${person.displayName} — ${sop.title}`}
                          >
                            {isCompact ? (
                              <span
                                className="inline-block w-3 h-3 rounded-full"
                                style={{ background: `var(${compactAccentVar(cell)})` }}
                                title={cell.state}
                              />
                            ) : (
                              <StatePill result={cell} />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isCompact && (
        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--ink-500)]">
          {COMPACT_LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: `var(${item.accentVar})` }} />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
