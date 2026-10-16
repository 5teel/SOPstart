'use client'

/**
 * ADR-0019 (sketch 012 F) -- the training lanes. Replaces the Phase 35 matrix of state pills.
 * Where a face sits is how far that person has got: five lanes left to right in training order
 * (Not started, Read it, Observed, Waiting for you, Signed off). No symbols to learn; anything
 * else (needs support, an old version, a refresher) is written in words beside the name.
 *
 * Two views over the same department cut (getTrainingMatrix):
 *  - By SOP: one row per SOP, faces in the lanes. SOPs are grouped by library area or type, the
 *    same grouping as the home's All SOPs (ADR-0016); a closed group shows how many people sit
 *    in each lane.
 *  - By person: the same lanes for one person, one row per SOP, a track running as far as they
 *    have got and ending in words. Groups they are signed off on throughout stay closed.
 *
 * "Waiting for you" is an open assessment request for that person and SOP (listAssessmentRequests);
 * Assess opens the observation form preset to them. Competency is information only and never a
 * gate (CMP-04): nothing here is disabled or hidden on a state, and the refresher and version
 * flags never move anyone between lanes (Phase 36 D-04).
 */

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTrainingMatrix, exportTrainingCsv } from '@/actions/competency'
import { listAssessmentRequests } from '@/actions/observations'
import { markNotificationRead } from '@/actions/versioning'
import { downloadCsv } from '@/lib/competency/download-csv'
import { LANES, LANE_INDEX, laneFor, type LaneKey } from '@/lib/competency/lanes'
import { SOP_TYPES } from '@/lib/library/sop-type'
import { RecordObservationModal } from '@/components/observations/RecordObservationModal'
import type { MatrixCell, MatrixSop } from '@/lib/competency/matrix'
import type { LibraryRow } from '@/hooks/useLibrary'
import type { LibraryArea } from '@/lib/library/areas'
import type { Department } from '@/types/sop'

// ponytail: a cut this small reads better open; past it, groups start closed.
const OPEN_ALL_UNDER = 12

// A person with no display name arrives as their email; show the part before the @.
const shortName = (name: string) => (name.includes('@') ? name.split('@')[0]! : name)
const initials = (name: string) =>
  shortName(name)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'
const firstName = (name: string) => shortName(name).split(/\s+/)[0] || name
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : '')

interface Group {
  key: string
  name: string
  sops: MatrixSop[]
}

interface Request {
  id: string
  personId: string
  sopId: string
  personName: string
  createdAt: string
}

export function TrainingLanes({
  departments,
  rows,
  areas,
  onOpenRecord,
}: {
  departments: Department[]
  rows: readonly LibraryRow[]
  areas: readonly LibraryArea[]
  onOpenRecord: (personId: string, sopId: string | null) => void
}) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'sop' | 'person'>('sop')
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '')
  const [personId, setPersonId] = useState<string | null>(null)
  const [focusSopId, setFocusSopId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'area' | 'type'>('area')
  const [open, setOpen] = useState<Set<string> | null>(null)
  const [assess, setAssess] = useState<{ personId: string; name: string; sopId?: string; requestId?: string } | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const matrixQ = useQuery({
    queryKey: ['training-matrix', departmentId],
    enabled: !!departmentId,
    queryFn: () => getTrainingMatrix({ departmentId }),
  })
  const requestsQ = useQuery({ queryKey: ['assessment-requests'], queryFn: () => listAssessmentRequests() })

  const data = matrixQ.data && !('error' in matrixQ.data) ? matrixQ.data : null
  const people = useMemo(() => data?.people ?? [], [data])
  const sops = useMemo(() => data?.sops ?? [], [data])
  const cellOf = useMemo(() => {
    const m = new Map<string, MatrixCell>()
    for (const c of data?.matrix.cells ?? []) m.set(`${c.personId}:${c.sopId}`, c)
    return (p: string, s: string) => m.get(`${p}:${s}`)
  }, [data])

  // The library row for a matrix SOP: the same row, or the latest published row of its lineage.
  const rowFor = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r]))
    const byRoot = new Map(rows.map((r) => [r.rootId, r]))
    return (sopId: string) => byId.get(sopId) ?? byRoot.get(sopId) ?? null
  }, [rows])

  const requests = useMemo<Request[]>(() => {
    const rootOf = (id: string) => rowFor(id)?.rootId ?? id
    return (requestsQ.data ?? []).flatMap((r) => {
      const sop = sops.find((s) => s.id === r.sopId || rootOf(s.id) === rootOf(r.sopId))
      return sop ? [{ id: r.id, personId: r.subjectUserId, sopId: sop.id, personName: r.subjectName, createdAt: r.createdAt }] : []
    })
  }, [requestsQ.data, sops, rowFor])

  const laneOf = (p: string, s: string): LaneKey | null => {
    const c = cellOf(p, s)
    return c ? laneFor(c.state, requests.some((r) => r.personId === p && r.sopId === s)) : null
  }

  const groups = useMemo<Group[]>(() => {
    const out = new Map<string, Group>()
    const order = (key: string) =>
      groupBy === 'area' ? areas.findIndex((a) => a.id === key) : SOP_TYPES.indexOf(key as (typeof SOP_TYPES)[number])
    for (const s of sops) {
      const row = rowFor(s.id)
      const key = row ? (groupBy === 'area' ? row.areaId : row.type) : 'other'
      const name = row ? (groupBy === 'area' ? row.areaName : row.type) : 'Other'
      if (!out.has(key)) out.set(key, { key, name, sops: [] })
      out.get(key)!.sops.push(s)
    }
    const rank = (k: string) => (k === 'other' ? Number.MAX_SAFE_INTEGER : order(k) < 0 ? Number.MAX_SAFE_INTEGER - 1 : order(k))
    for (const g of out.values()) g.sops.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))
    return [...out.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.name.localeCompare(b.name))
  }, [sops, rowFor, groupBy, areas])

  const person = people.find((p) => p.id === personId) ?? null
  const mySops = (p: string) => sops.filter((s) => !!cellOf(p, s.id))

  // Which groups start open: everything when the cut is small; otherwise none in By SOP, and in
  // By person the groups that still hold something short of signed off.
  const defaultOpen = (): Set<string> => {
    if (sops.length <= OPEN_ALL_UNDER) return new Set(groups.map((g) => g.key))
    if (view === 'sop' || !person) return new Set()
    return new Set(groups.filter((g) => g.sops.some((s) => cellOf(person.id, s.id) && laneOf(person.id, s.id) !== 'signed')).map((g) => g.key))
  }
  const openSet = open ?? defaultOpen()
  const toggle = (key: string) => {
    const next = new Set(openSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setOpen(next)
  }
  const allOpen = groups.length > 0 && groups.every((g) => openSet.has(g.key))

  const showPerson = (id: string, sopId: string | null) => {
    setView('person')
    setPersonId(id)
    setFocusSopId(sopId)
    setOpen(null)
  }

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    const result = await exportTrainingCsv({
      departmentId,
      workerId: view === 'person' && person ? person.id : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
    setExporting(false)
    if ('error' in result) return setExportError(result.error)
    downloadCsv(result.csv, result.filename)
  }

  const face = (id: string, name: string, sopId: string) => {
    const c = cellOf(id, sopId)
    return (
      <button key={id} type="button" className="face" onClick={() => showPerson(id, sopId)} data-testid="lanes-face">
        <span className="face-av">{initials(name)}</span>
        {firstName(name)}
        {c?.needsSupportFlag && <span className="lane-note">needs support</span>}
        {c?.isOutdatedVersion && <span className="lane-note-quiet">old version</span>}
        {c?.isRefresherOverdue && <span className="lane-note-quiet">refresher overdue</span>}
      </button>
    )
  }

  const countCell = (lane: LaneKey, n: number, total: number, unit: string) => (
    <div key={lane} data-lane={lane} data-name={LANES[LANE_INDEX[lane]].name}>
      {n > 0 && (
        <span className="lane-count">
          <span>
            <b>{n}</b> {unit}
          </span>
          <span className="lane-fill">
            <i style={{ width: `${(n / total) * 100}%` }} />
          </span>
        </span>
      )}
    </div>
  )

  const sopTitle = (s: MatrixSop) => (
    <>
      <span className="min-w-0">
        <span className="block text-ui font-semibold text-ink-900">{s.title}</span>
        {s.currentVersion !== null && <span className="block text-micro text-ink-500">v{s.currentVersion}</span>}
      </span>
    </>
  )

  const groupHead = (g: Group, counts: number[], total: number, unit: (n: number) => string, note?: string) => (
    <div key={`g-${g.key}`} className="lane-row lane-group" data-testid="lanes-group">
      <button type="button" onClick={() => toggle(g.key)} aria-expanded={openSet.has(g.key)}>
        <span className="text-ink-500" aria-hidden>
          {openSet.has(g.key) ? '▾' : '▸'}
        </span>
        <span className="min-w-0">
          {g.name} <span className="font-normal text-ink-500">{note ?? `${g.sops.length} SOP${g.sops.length === 1 ? '' : 's'}`}</span>
        </span>
      </button>
      {LANES.map((l, i) => countCell(l.key, counts[i], total, unit(counts[i])))}
    </div>
  )

  const bySop = () =>
    groups.map((g) => {
      const counts = LANES.map((l) => g.sops.reduce((n, s) => n + people.filter((p) => laneOf(p.id, s.id) === l.key).length, 0))
      const total = Math.max(1, counts.reduce((a, b) => a + b, 0))
      return [
        groupHead(g, counts, total, (n) => (n === 1 ? 'person' : 'people')),
        ...(openSet.has(g.key)
          ? g.sops.map((s) => (
              <div key={s.id} className="lane-row lane-sub" data-testid="lanes-sop">
                <div>{sopTitle(s)}</div>
                {LANES.map((l) => {
                  const here = people.filter((p) => laneOf(p.id, s.id) === l.key)
                  return (
                    <div key={l.key} data-lane={l.key} data-name={l.name}>
                      {l.key !== 'wait'
                        ? here.map((p) => face(p.id, p.displayName, s.id))
                        : here.map((p) => {
                            const req = requests.find((r) => r.personId === p.id && r.sopId === s.id)!
                            return (
                              <span key={p.id} className="flex w-full flex-wrap items-center gap-1.5">
                                {face(p.id, p.displayName, s.id)}
                                <button
                                  type="button"
                                  className="min-h-tap flex-1 rounded-lg bg-ink-900 px-3 text-ui font-semibold text-paper"
                                  onClick={() => setAssess({ personId: p.id, name: p.displayName, sopId: s.id, requestId: req.id })}
                                >
                                  Assess
                                </button>
                              </span>
                            )
                          })}
                    </div>
                  )
                })}
              </div>
            ))
          : []),
      ]
    })

  const byPerson = (pid: string) =>
    groups.map((g) => {
      const mine = g.sops.filter((s) => !!cellOf(pid, s.id))
      if (mine.length === 0) return null
      const counts = LANES.map((l) => mine.filter((s) => laneOf(pid, s.id) === l.key).length)
      const all = counts[4] === mine.length
      return [
        groupHead({ ...g, sops: mine }, counts, mine.length, (n) => (n === 1 ? 'SOP' : 'SOPs'), all ? `all ${mine.length} signed off` : undefined),
        ...(openSet.has(g.key)
          ? mine.map((s) => {
              const c = cellOf(pid, s.id)!
              const lane = laneOf(pid, s.id)!
              const at = LANE_INDEX[lane]
              const req = requests.find((r) => r.personId === pid && r.sopId === s.id)
              const words =
                lane === 'none' ? 'Not started'
                : lane === 'read' ? `Read it${c.latestCompletionAt ? ` · ${day(c.latestCompletionAt)}` : ''}`
                : lane === 'obs' ? 'Observed'
                : lane === 'wait' ? `Asked ${day(req?.createdAt ?? null)}`
                : 'Signed off'
              return (
                <div key={s.id} className={`lane-row lane-sub lane-person${focusSopId === s.id ? ' lane-focus' : ''}`} data-testid="lanes-person-sop">
                  <div>{sopTitle(s)}</div>
                  {LANES.map((l, i) => (
                    <div key={l.key} data-lane={l.key} data-name={l.name} data-here={i === at ? '' : undefined}>
                      {lane !== 'none' && i < at && <span className={`lane-track${i === 0 ? ' lane-track-start' : ''}`} />}
                      {i === at &&
                        (lane === 'wait' && req ? (
                          <button
                            type="button"
                            className="mx-2.5 min-h-tap rounded-lg bg-ink-900 px-3 text-ui font-semibold text-paper"
                            onClick={() => setAssess({ personId: pid, name: person?.displayName ?? '', sopId: s.id, requestId: req.id })}
                          >
                            Assess
                          </button>
                        ) : (
                          <span className={`lane-label${lane === 'none' ? ' lane-label-quiet' : ''}`}>
                            {words}
                            {c.needsSupportFlag && <span className="lane-note">needs support</span>}
                            {c.isOutdatedVersion && (
                              <span className="lane-note-quiet">
                                on v{c.latestCompletionVersion}, now v{s.currentVersion}
                              </span>
                            )}
                            {c.refresherDueAt && (
                              <span className="lane-note-quiet">
                                {c.isRefresherOverdue ? 'Refresher overdue' : `Refresher due ${day(c.refresherDueAt)}`}
                              </span>
                            )}
                          </span>
                        ))}
                    </div>
                  ))}
                </div>
              )
            })
          : []),
      ]
    })

  if (departments.length === 0) {
    return <p data-testid="training-lanes" className="py-8 text-center text-ui text-ink-500">No departments yet. Add one in People first.</p>
  }

  const personSops = person ? mySops(person.id) : []
  const signedCount = person ? personSops.filter((s) => laneOf(person.id, s.id) === 'signed').length : 0

  return (
    <div className="flex flex-col gap-3" data-testid="training-lanes">
      <div className="flex flex-wrap items-center gap-2">
        <span className="seg">
          <button type="button" aria-pressed={view === 'sop'} onClick={() => { setView('sop'); setFocusSopId(null); setOpen(null) }}>
            By SOP
          </button>
          <button
            type="button"
            aria-pressed={view === 'person'}
            onClick={() => showPerson(personId && people.some((p) => p.id === personId) ? personId : people[0]?.id ?? '', null)}
          >
            By person
          </button>
        </span>
        <span className="seg">
          {departments.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={d.id === departmentId}
              onClick={() => {
                setDepartmentId(d.id)
                setPersonId(null)
                setFocusSopId(null)
                setOpen(null)
              }}
            >
              {d.name}
            </button>
          ))}
        </span>
        <span className="seg seg-quiet">
          {(['area', 'type'] as const).map((g) => (
            <button key={g} type="button" aria-pressed={groupBy === g} onClick={() => { setGroupBy(g); setOpen(null) }}>
              {g === 'area' ? 'Area' : 'Type'}
            </button>
          ))}
        </span>
        <button
          type="button"
          className="ml-auto min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900"
          onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.key)))}
        >
          {allOpen ? 'Close all' : 'Open all'}
        </button>
      </div>

      {view === 'person' && people.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => (
              <button key={p.id} type="button" className="face" aria-pressed={p.id === person?.id} onClick={() => showPerson(p.id, null)}>
                <span className="face-av">{initials(p.displayName)}</span>
                {firstName(p.displayName)}
              </button>
            ))}
          </div>
          {person && (
            <div className="flex flex-wrap items-center gap-3" data-testid="lanes-person-head">
              <span className="face-av face-av-lg">{initials(person.displayName)}</span>
              <span className="text-reading font-semibold text-ink-900">{person.displayName}</span>
              <span className="flex min-w-60 items-center gap-2">
                <span className="lane-fill flex-1">
                  <i style={{ width: `${personSops.length ? (signedCount / personSops.length) * 100 : 0}%` }} />
                </span>
                <span className="text-meta text-ink-500">
                  {signedCount} of {personSops.length} signed off
                </span>
              </span>
              <span className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper"
                  onClick={() => setAssess({ personId: person.id, name: person.displayName })}
                >
                  + Record observation
                </button>
                <button
                  type="button"
                  className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900"
                  onClick={() => onOpenRecord(person.id, focusSopId)}
                >
                  Full record
                </button>
              </span>
            </div>
          )}
        </>
      )}

      {matrixQ.isLoading && <p className="py-8 text-center text-ui text-ink-500">Loading…</p>}
      {(matrixQ.isError || (matrixQ.data && 'error' in matrixQ.data)) && (
        <p className="py-8 text-center text-ui text-accent-escalate">
          Could not load training{matrixQ.data && 'error' in matrixQ.data ? `: ${matrixQ.data.error}` : '.'}
        </p>
      )}
      {data && people.length === 0 && <p className="py-8 text-center text-ui text-ink-500">No people with required SOPs in this department.</p>}

      {data && people.length > 0 && (view === 'sop' || person) && (
        <div className="lanes">
          <div className="lane-row lane-head">
            <div>SOP</div>
            {LANES.map((l) => (
              <div key={l.key} data-lane={l.key}>
                {l.name}
                <small>{l.sub}</small>
              </div>
            ))}
          </div>
          {view === 'sop' ? bySop() : byPerson(person!.id)}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-micro text-ink-500">
          From
          <input type="date" className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-micro text-ink-500">
          To
          <input type="date" className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => void handleExport()}
          className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900"
        >
          {exporting ? 'Exporting…' : view === 'person' && person ? `Export ${firstName(person.displayName)}'s record` : 'Export CSV'}
        </button>
        {exportError && <span className="text-micro text-accent-decision">{exportError}</span>}
      </div>

      <RecordObservationModal
        open={assess !== null}
        onClose={() => setAssess(null)}
        worker={{ id: assess?.personId ?? '', name: assess?.name ?? '' }}
        presetSopId={assess?.sopId}
        onRecorded={() => {
          if (assess?.requestId) void markNotificationRead(assess.requestId)
          setAssess(null)
          void queryClient.invalidateQueries({ queryKey: ['training-matrix'] })
          void queryClient.invalidateQueries({ queryKey: ['assessment-requests'] })
        }}
      />
    </div>
  )
}
