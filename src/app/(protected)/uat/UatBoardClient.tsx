'use client'

import { useMemo, useState } from 'react'
import { Check, ArrowLeftRight, SlidersHorizontal, Eye } from 'lucide-react'
import { UatTestModal } from './UatTestModal'
import type { UatTest, UatFeedbackRow } from '@/lib/uat/tests'

interface Props {
  tests: UatTest[]
  feedback: UatFeedbackRow[]
  currentUserId: string
}

function thumb(t: UatTest): string | null {
  return t.comparison?.after.image ?? t.directions?.[0]?.screenshot ?? t.screenshots?.[0] ?? null
}

function kind(t: UatTest): { label: string; icon: React.ReactNode } {
  if (t.comparison) return { label: 'Before & after', icon: <ArrowLeftRight className="h-3.5 w-3.5" /> }
  if (t.directions && t.directions.length) return { label: 'Compare options', icon: <SlidersHorizontal className="h-3.5 w-3.5" /> }
  return { label: 'Have a look', icon: <Eye className="h-3.5 w-3.5" /> }
}

export function UatBoardClient({ tests, feedback, currentUserId }: Props) {
  const [myRows, setMyRows] = useState<Map<string, UatFeedbackRow>>(() => {
    const m = new Map<string, UatFeedbackRow>()
    for (const r of feedback) if (r.user_id === currentUserId) m.set(r.test_id, r)
    return m
  })
  const othersByTest = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of feedback) {
      if (r.user_id === currentUserId) continue
      m.set(r.test_id, (m.get(r.test_id) ?? 0) + 1)
    }
    return m
  }, [feedback, currentUserId])

  const categories = useMemo(() => ['All', ...Array.from(new Set(tests.map((t) => t.category)))], [tests])
  const [category, setCategory] = useState('All')
  const [showArchived, setShowArchived] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const activeTests = tests.filter((t) => t.status === 'active')
  const reviewed = activeTests.filter((t) => myRows.has(t.id)).length

  const visible = tests.filter(
    (t) => (category === 'All' || t.category === category) && (showArchived || t.status === 'active')
  )
  const openTest = tests.find((t) => t.id === openId) ?? null

  return (
    <div>
      {/* How this works */}
      <div className="rounded-xl border border-[var(--ink-100)] bg-white p-4 mb-6">
        <p className="text-sm font-semibold text-[var(--ink-900)] mb-2">How this works</p>
        <ol className="grid sm:grid-cols-3 gap-3 text-sm text-[var(--ink-700)]">
          <Howto n={1} text="Pick a card to open it." />
          <Howto n={2} text="Compare the before & after, then answer a few quick questions." />
          <Howto n={3} text="Add any comments and save." />
        </ol>
        <p className="text-xs text-[var(--ink-500)] mt-3">
          Takes a minute or two each. You can change your answers any time.
          {activeTests.length > 0 && (
            <> &nbsp;·&nbsp; You&apos;ve done <strong className="text-[var(--ink-900)]">{reviewed} of {activeTests.length}</strong>.</>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-[var(--ink-100)] mb-6 overflow-x-auto">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className="tab" data-active={category === c ? 'true' : undefined}>
            {c}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-[var(--ink-500)] pl-4 whitespace-nowrap">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="w-4 h-4 accent-[var(--ink-900)]" />
          Show finished
        </label>
      </div>

      {/* Card grid */}
      <ul className="grid sm:grid-cols-2 gap-4">
        {visible.map((t) => {
          const k = kind(t)
          const img = thumb(t)
          const done = myRows.has(t.id)
          const others = othersByTest.get(t.id) ?? 0
          return (
            <li key={t.id}>
              <button
                onClick={() => setOpenId(t.id)}
                className="group w-full text-left rounded-xl border border-[var(--ink-100)] bg-white overflow-hidden hover:border-[var(--ink-900)] hover:shadow-sm transition-all flex flex-col h-full"
              >
                {/* thumbnail */}
                <div className="relative bg-[var(--paper)] border-b border-[var(--ink-100)] h-40 flex items-center justify-center overflow-hidden">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="max-h-36 w-auto object-contain drop-shadow-sm" />
                  ) : (
                    <Eye className="h-8 w-8 text-[var(--ink-300)]" />
                  )}
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-700)] bg-white/90 rounded-full px-2 py-0.5 border border-[var(--ink-100)]">
                    {k.icon} {k.label}
                  </span>
                  {done && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-green-600 rounded-full px-2 py-0.5">
                      <Check className="h-3 w-3" /> Done
                    </span>
                  )}
                </div>
                {/* body */}
                <div className="p-4 flex-1 flex flex-col">
                  <span className="pill mb-1.5 self-start">{t.category}</span>
                  <p className="text-base font-semibold text-[var(--ink-900)] leading-snug">{t.title}</p>
                  <p className="text-sm text-[var(--ink-500)] mt-1 line-clamp-2">{t.summary}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--ink-100)]">
                    <span className="text-sm font-semibold text-[var(--ink-900)] group-hover:underline">
                      {done ? 'Review your answers →' : 'Open & compare →'}
                    </span>
                    {others > 0 && <span className="text-xs text-[var(--ink-500)]">{others} other{others === 1 ? '' : 's'}</span>}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 && (
        <div className="rounded-xl border border-[var(--ink-100)] bg-white text-center py-10 text-sm text-[var(--ink-500)]">
          Nothing to review here right now.
        </div>
      )}

      {openTest && (
        <UatTestModal
          test={openTest}
          existingRow={myRows.get(openTest.id)}
          onClose={() => setOpenId(null)}
          onSaved={(row) => setMyRows((m) => new Map(m).set(row.test_id, row))}
        />
      )}
    </div>
  )
}

function Howto({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex-shrink-0 mono text-[11px] font-bold text-white bg-[var(--ink-900)] rounded-full h-5 w-5 flex items-center justify-center">
        {n}
      </span>
      <span>{text}</span>
    </li>
  )
}
