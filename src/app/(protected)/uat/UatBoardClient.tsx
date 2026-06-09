'use client'

import { useMemo, useState } from 'react'
import { Check, X, Minus, ExternalLink, Loader2 } from 'lucide-react'
import { saveFeedback } from '@/actions/uat'
import type {
  UatTest,
  UatFeedbackRow,
  CriterionResponse,
  OverallVerdict,
} from '@/lib/uat/tests'

interface Props {
  tests: UatTest[]
  feedback: UatFeedbackRow[]
  currentUserId: string
}

interface Draft {
  criteria: Record<string, CriterionResponse>
  preferredDirection: string | null
  verdict: OverallVerdict | null
  rating: number | null
  notes: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const VERDICTS: { id: OverallVerdict; label: string; color: string }[] = [
  { id: 'approve', label: 'Approve', color: 'var(--accent-step, #2563eb)' },
  { id: 'needs_work', label: 'Needs work', color: '#b45309' },
  { id: 'reject', label: 'Reject', color: 'var(--accent-hazard, #dc2626)' },
]

function emptyDraft(): Draft {
  return { criteria: {}, preferredDirection: null, verdict: null, rating: null, notes: '' }
}

function draftFromRow(row: UatFeedbackRow | undefined): Draft {
  if (!row) return emptyDraft()
  return {
    criteria: { ...(row.criteria_responses ?? {}) },
    preferredDirection: row.preferred_direction ?? null,
    verdict: row.overall_verdict ?? null,
    rating: row.rating ?? null,
    notes: row.notes ?? '',
  }
}

export function UatBoardClient({ tests, feedback, currentUserId }: Props) {
  const myByTest = useMemo(() => {
    const m = new Map<string, UatFeedbackRow>()
    for (const r of feedback) if (r.user_id === currentUserId) m.set(r.test_id, r)
    return m
  }, [feedback, currentUserId])

  const allByTest = useMemo(() => {
    const m = new Map<string, UatFeedbackRow[]>()
    for (const r of feedback) {
      const list = m.get(r.test_id) ?? []
      list.push(r)
      m.set(r.test_id, list)
    }
    return m
  }, [feedback])

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(tests.map((t) => t.category)))],
    [tests]
  )

  const [category, setCategory] = useState('All')
  const [showArchived, setShowArchived] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {}
    for (const t of tests) init[t.id] = draftFromRow(myByTest.get(t.id))
    return init
  })
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})

  const visible = tests.filter(
    (t) =>
      (category === 'All' || t.category === category) &&
      (showArchived || t.status === 'active')
  )

  function patch(testId: string, p: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [testId]: { ...d[testId], ...p } }))
    setSaveStates((s) => ({ ...s, [testId]: 'idle' }))
  }

  function setCriterion(testId: string, critId: string, value: CriterionResponse) {
    setDrafts((d) => {
      const cur = d[testId]
      const next = { ...cur.criteria }
      if (next[critId] === value) delete next[critId]
      else next[critId] = value
      return { ...d, [testId]: { ...cur, criteria: next } }
    })
    setSaveStates((s) => ({ ...s, [testId]: 'idle' }))
  }

  async function save(testId: string) {
    const d = drafts[testId]
    setSaveStates((s) => ({ ...s, [testId]: 'saving' }))
    const res = await saveFeedback({
      testId,
      criteriaResponses: d.criteria,
      preferredDirection: d.preferredDirection,
      overallVerdict: d.verdict,
      rating: d.rating,
      notes: d.notes.trim() ? d.notes.trim() : null,
    })
    setSaveStates((s) => ({ ...s, [testId]: res.success ? 'saved' : 'error' }))
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-[var(--ink-100)] mb-6 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="tab"
            data-active={category === c ? 'true' : undefined}
          >
            {c}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-[var(--ink-500)] pl-4 whitespace-nowrap">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 accent-[var(--ink-900)]"
          />
          Show archived
        </label>
      </div>

      <ul className="space-y-6">
        {visible.map((t) => {
          const draft = drafts[t.id]
          const others = (allByTest.get(t.id) ?? []).filter((r) => r.user_id !== currentUserId)
          const saveState = saveStates[t.id] ?? 'idle'
          return (
            <li key={t.id} className="blueprint-frame">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="pill">{t.category}</span>
                    {t.status === 'archived' && (
                      <span className="pill" style={{ opacity: 0.6 }}>ARCHIVED</span>
                    )}
                    <span className="mono text-[11px] text-[var(--ink-500)]">Added {t.dateAdded}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-[var(--ink-900)]">{t.title}</h2>
                </div>
                {t.links && t.links.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {t.links.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="evidence-btn !min-h-[36px] text-xs inline-flex items-center gap-1.5"
                      >
                        {l.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Meta */}
              <dl className="grid sm:grid-cols-3 gap-3 mb-4">
                <Meta label="Purpose" value={t.purpose} />
                <Meta label="Under test" value={t.target} />
                <Meta label="Intended outcome" value={t.intendedOutcome} />
              </dl>

              {t.howToTest && t.howToTest.length > 0 && (
                <div className="mb-4">
                  <FieldLabel>How to test</FieldLabel>
                  <ol className="list-decimal list-inside text-sm text-[var(--ink-700)] space-y-0.5">
                    {t.howToTest.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {t.screenshots && t.screenshots.length > 0 && (
                <div className="flex gap-3 flex-wrap mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.screenshots.map((src) => (
                    <img key={src} src={src} alt="" className="max-h-48 rounded border border-[var(--ink-100)]" />
                  ))}
                </div>
              )}

              {/* Directions picker */}
              {t.directions && t.directions.length > 0 && (
                <div className="mb-4">
                  <FieldLabel>Which direction do you prefer?</FieldLabel>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {t.directions.map((dir) => {
                      const active = draft.preferredDirection === dir.id
                      return (
                        <button
                          key={dir.id}
                          onClick={() => patch(t.id, { preferredDirection: active ? null : dir.id })}
                          className="text-left rounded-lg border p-3 transition-colors"
                          style={{
                            borderColor: active ? 'var(--ink-900)' : 'var(--ink-100)',
                            background: active ? 'var(--paper-2)' : 'white',
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-4 w-4 rounded-full border items-center justify-center"
                              style={{ borderColor: active ? 'var(--ink-900)' : 'var(--ink-300)' }}
                            >
                              {active && <span className="h-2 w-2 rounded-full bg-[var(--ink-900)]" />}
                            </span>
                            <span className="text-sm font-semibold text-[var(--ink-900)]">{dir.label}</span>
                          </div>
                          {dir.screenshot && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={dir.screenshot} alt="" className="mt-2 w-full rounded border border-[var(--ink-100)]" />
                          )}
                          <p className="text-xs text-[var(--ink-500)] mt-1.5">{dir.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Criteria */}
              <div className="mb-4">
                <FieldLabel>Criteria</FieldLabel>
                <ul className="divide-y divide-[var(--ink-100)] border-y border-[var(--ink-100)]">
                  {t.criteria.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1 text-sm text-[var(--ink-900)]">{c.text}</span>
                      <TriState
                        value={draft.criteria[c.id]}
                        onChange={(v) => setCriterion(t.id, c.id, v)}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              {/* Verdict + rating */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
                <div>
                  <FieldLabel>Overall</FieldLabel>
                  <div className="flex gap-1.5">
                    {VERDICTS.map((v) => {
                      const active = draft.verdict === v.id
                      return (
                        <button
                          key={v.id}
                          onClick={() => patch(t.id, { verdict: active ? null : v.id })}
                          className="px-3 h-[34px] rounded-md text-xs font-semibold border transition-colors"
                          style={{
                            borderColor: active ? v.color : 'var(--ink-300)',
                            background: active ? v.color : 'white',
                            color: active ? 'white' : 'var(--ink-700)',
                          }}
                        >
                          {v.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel>Rating</FieldLabel>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (draft.rating ?? 0) >= n
                      return (
                        <button
                          key={n}
                          aria-label={`Rate ${n}`}
                          onClick={() => patch(t.id, { rating: draft.rating === n ? null : n })}
                          className="h-[34px] w-[28px] rounded-md border text-sm font-mono transition-colors"
                          style={{
                            borderColor: active ? 'var(--ink-900)' : 'var(--ink-300)',
                            background: active ? 'var(--ink-900)' : 'white',
                            color: active ? 'white' : 'var(--ink-500)',
                          }}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  value={draft.notes}
                  onChange={(e) => patch(t.id, { notes: e.target.value })}
                  placeholder="What worked, what didn't, and why — this is read back by the AI analysis."
                  rows={3}
                  className="w-full rounded-lg border border-[var(--ink-100)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--ink-900)] focus:outline-none resize-y"
                />
              </div>

              {/* Footer: save + team summary */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => save(t.id)}
                    disabled={saveState === 'saving'}
                    className="evidence-btn !min-h-[40px] text-sm !bg-[var(--ink-900)] !text-white !border-[var(--ink-900)] hover:!bg-[var(--ink-700)] disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {saveState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saveState === 'saved' ? 'Saved ✓' : 'Save feedback'}
                  </button>
                  {saveState === 'error' && (
                    <span className="text-xs text-red-500">Couldn&apos;t save — try again.</span>
                  )}
                </div>
                <TeamSummary rows={others} mine={myByTest.get(t.id)} />
              </div>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 && (
        <div className="blueprint-frame text-center py-10 text-sm text-[var(--ink-500)]">
          No tests in this view.
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p className="text-sm text-[var(--ink-700)] leading-snug">{value}</p>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono text-[10px] uppercase tracking-wider text-[var(--ink-500)] mb-1">{children}</p>
  )
}

function TriState({
  value,
  onChange,
}: {
  value: CriterionResponse | undefined
  onChange: (v: CriterionResponse) => void
}) {
  const opts: { v: CriterionResponse; icon: React.ReactNode; on: string }[] = [
    { v: 'pass', icon: <Check className="h-4 w-4" />, on: 'var(--accent-step, #2563eb)' },
    { v: 'fail', icon: <X className="h-4 w-4" />, on: 'var(--accent-hazard, #dc2626)' },
    { v: 'na', icon: <Minus className="h-4 w-4" />, on: 'var(--ink-500)' },
  ]
  return (
    <div className="flex gap-1 flex-shrink-0">
      {opts.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            aria-label={o.v}
            aria-pressed={active}
            onClick={() => onChange(o.v)}
            className="h-8 w-8 rounded-md border flex items-center justify-center transition-colors"
            style={{
              borderColor: active ? o.on : 'var(--ink-300)',
              background: active ? o.on : 'white',
              color: active ? 'white' : 'var(--ink-500)',
            }}
          >
            {o.icon}
          </button>
        )
      })}
    </div>
  )
}

function TeamSummary({ rows, mine }: { rows: UatFeedbackRow[]; mine?: UatFeedbackRow }) {
  const total = rows.length + (mine ? 1 : 0)
  if (total === 0) {
    return <span className="text-xs text-[var(--ink-500)]">No team responses yet</span>
  }
  const all = mine ? [mine, ...rows] : rows
  const counts = all.reduce<Record<string, number>>((acc, r) => {
    const v = r.overall_verdict ?? 'no verdict'
    acc[v] = (acc[v] ?? 0) + 1
    return acc
  }, {})
  const label = (k: string) =>
    k === 'needs_work' ? 'needs work' : k === 'no verdict' ? 'no verdict' : k
  return (
    <span className="text-xs text-[var(--ink-500)]">
      {total} response{total === 1 ? '' : 's'}
      {' · '}
      {Object.entries(counts)
        .map(([k, n]) => `${n} ${label(k)}`)
        .join(', ')}
    </span>
  )
}
