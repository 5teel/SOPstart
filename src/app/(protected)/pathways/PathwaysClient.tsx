'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Play,
  Flag,
  Monitor,
  Zap,
  GitBranch,
  ArrowUpRight,
  LayoutGrid,
  Link2,
  Check,
} from 'lucide-react'
import { JOURNEY_GROUPS } from '@/lib/journeys/journeys'
import type { Journey, JourneyStep, StepType } from '@/lib/journeys/journeys'
import type { AppRoute } from '@/lib/journeys/routes'

interface Props {
  journeys: Journey[]
  routes: AppRoute[]
}

const TYPE_META: Record<StepType, { icon: React.ReactNode; ring: string; bg: string; label: string }> = {
  start: { icon: <Play className="h-3.5 w-3.5" />, ring: '#16a34a', bg: '#16a34a', label: 'Start' },
  screen: { icon: <Monitor className="h-3.5 w-3.5" />, ring: '#2563eb', bg: '#2563eb', label: 'Screen' },
  action: { icon: <Zap className="h-3.5 w-3.5" />, ring: '#78756e', bg: '#78756e', label: 'Action' },
  decision: { icon: <GitBranch className="h-3.5 w-3.5" />, ring: '#b45309', bg: '#b45309', label: 'Decision' },
  end: { icon: <Flag className="h-3.5 w-3.5" />, ring: '#1c1b19', bg: '#1c1b19', label: 'End' },
}

export function PathwaysClient({ journeys, routes }: Props) {
  const [selected, setSelected] = useState<string>(journeys[0]?.id ?? 'all-screens')

  // Deep-linking: keep the selection in sync with the URL hash (#pathway-id) so
  // a specific flow can be shared or bookmarked. Hash-only changes don't trigger
  // an RSC fetch, so this stays cheap. Read on mount (SSR-safe) + on hashchange/
  // popstate for pasted links and back/forward.
  useEffect(() => {
    const isValid = (id: string) => id === 'all-screens' || journeys.some((j) => j.id === id)
    const apply = () => {
      const h = decodeURIComponent(window.location.hash.replace(/^#/, ''))
      if (h && isValid(h)) setSelected(h)
    }
    apply()
    window.addEventListener('hashchange', apply)
    window.addEventListener('popstate', apply)
    return () => {
      window.removeEventListener('hashchange', apply)
      window.removeEventListener('popstate', apply)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const select = (id: string) => {
    setSelected(id)
    if (typeof window !== 'undefined') window.history.pushState(null, '', '#' + id)
  }

  const grouped = useMemo(
    () =>
      JOURNEY_GROUPS.map((group) => ({ group, items: journeys.filter((j) => j.group === group) })).filter(
        (g) => g.items.length > 0
      ),
    [journeys]
  )

  const journey = journeys.find((j) => j.id === selected) ?? null

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
      {/* ---------------- Index (navigable) ---------------- */}
      <nav className="lg:sticky lg:top-4 rounded-xl border border-[var(--ink-100)] bg-white overflow-hidden">
        <button
          onClick={() => select('all-screens')}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border-b border-[var(--ink-100)] transition-colors"
          style={{
            background: selected === 'all-screens' ? 'var(--ink-900)' : 'white',
            color: selected === 'all-screens' ? 'white' : 'var(--ink-900)',
          }}
        >
          <LayoutGrid className="h-4 w-4" /> All screens
          <span className="ml-auto text-[11px] font-normal opacity-70">{routes.length} live</span>
        </button>
        <div className="max-h-[70vh] overflow-y-auto py-1">
          {grouped.map((g) => (
            <div key={g.group} className="py-1">
              <p className="mono text-[10px] uppercase tracking-wider text-[var(--ink-500)] px-3 pt-2 pb-1">{g.group}</p>
              {g.items.map((j) => {
                const active = selected === j.id
                return (
                  <button
                    key={j.id}
                    onClick={() => select(j.id)}
                    className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                    style={{
                      background: active ? 'var(--paper-2)' : 'transparent',
                      color: active ? 'var(--ink-900)' : 'var(--ink-700)',
                      borderLeft: active ? '2px solid var(--ink-900)' : '2px solid transparent',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {j.title}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* ---------------- Detail ---------------- */}
      <div className="min-w-0">
        {selected === 'all-screens' ? (
          <ScreenInventory journeys={journeys} routes={routes} onOpenJourney={select} />
        ) : journey ? (
          <JourneyView journey={journey} />
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Journey diagram
// ---------------------------------------------------------------------------

function JourneyView({ journey }: { journey: Journey }) {
  const [copied, setCopied] = useState(false)
  const labelOf = (id: string) =>
    id === 'end' ? 'End' : id === 'continue' ? 'Continue' : journey.steps.find((s) => s.id === id)?.label ?? id

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${journey.id}`
    void navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div>
      <div className="rounded-xl border border-[var(--ink-100)] bg-white p-5 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="pill">{journey.group}</span>
              <span className="text-[11px] font-semibold text-[var(--ink-500)]">· {journey.persona}</span>
            </div>
            <h2 className="text-xl font-semibold text-[var(--ink-900)] leading-snug">{journey.title}</h2>
          </div>
          <button
            onClick={copyLink}
            className="flex-shrink-0 evidence-btn !min-h-[34px] text-xs inline-flex items-center gap-1.5"
            title="Copy a link straight to this pathway"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <p className="text-sm text-[var(--ink-700)] mt-2 leading-relaxed">{journey.summary}</p>
      </div>

      <ol className="rounded-xl border border-[var(--ink-100)] bg-white p-5">
        {journey.steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            last={i === journey.steps.length - 1}
            labelOf={labelOf}
          />
        ))}
      </ol>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 px-1">
        {(['start', 'screen', 'action', 'decision', 'end'] as StepType[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-500)]">
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-white" style={{ background: TYPE_META[t].bg }}>
              {TYPE_META[t].icon}
            </span>
            {TYPE_META[t].label}
          </span>
        ))}
      </div>
    </div>
  )
}

function StepRow({
  step,
  last,
  labelOf,
}: {
  step: JourneyStep
  last: boolean
  labelOf: (id: string) => string
}) {
  const m = TYPE_META[step.type]
  return (
    <li className="flex gap-3">
      {/* node + connector */}
      <div className="flex flex-col items-center">
        <span
          className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-white shadow-sm"
          style={{ background: m.bg }}
        >
          {m.icon}
        </span>
        {!last && <span className="w-px flex-1 my-1" style={{ background: 'var(--ink-200, #d4d4d8)' }} />}
      </div>

      {/* content */}
      <div className={last ? 'flex-1 pb-1' : 'flex-1 pb-5'}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-semibold text-[var(--ink-900)]">{step.label}</span>
          {step.route && (
            <a
              href={step.route.includes('[') ? undefined : step.route}
              target={step.route.includes('[') ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="mono text-[11px] inline-flex items-center gap-1 rounded px-1.5 py-0.5 border"
              style={{
                color: 'var(--accent-step,#2563eb)',
                borderColor: 'color-mix(in srgb, var(--accent-step,#2563eb) 30%, transparent)',
                background: 'color-mix(in srgb, var(--accent-step,#2563eb) 6%, white)',
                pointerEvents: step.route.includes('[') ? 'none' : undefined,
              }}
              title={step.route.includes('[') ? 'Dynamic route' : `Open ${step.route}`}
            >
              {step.route}
              {!step.route.includes('[') && <ArrowUpRight className="h-3 w-3" />}
            </a>
          )}
        </div>
        {step.detail && <p className="text-[13px] text-[var(--ink-500)] mt-0.5 leading-snug">{step.detail}</p>}
        {step.branches && step.branches.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {step.branches.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] rounded-md px-2 py-1 border border-[var(--ink-100)] bg-[var(--paper)] text-[var(--ink-700)]"
              >
                <span className="font-semibold">{b.label}</span>
                <span className="text-[var(--ink-300)]">→</span>
                <span className="text-[var(--ink-500)]">{labelOf(b.to)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Live screen inventory (auto from the route tree)
// ---------------------------------------------------------------------------

function ScreenInventory({
  journeys,
  routes,
  onOpenJourney,
}: {
  journeys: Journey[]
  routes: AppRoute[]
  onOpenJourney: (id: string) => void
}) {
  const byRoute = useMemo(() => {
    const m = new Map<string, Journey[]>()
    for (const j of journeys) {
      for (const s of j.steps) {
        if (!s.route) continue
        const list = m.get(s.route) ?? []
        if (!list.includes(j)) list.push(j)
        m.set(s.route, list)
      }
    }
    return m
  }, [journeys])

  const mapped = routes.filter((r) => byRoute.has(r.route)).length
  const gaps = routes.length - mapped

  const AREA_LABEL: Record<AppRoute['area'], string> = { auth: 'Sign-in', protected: 'In-app', public: 'Public' }

  return (
    <div>
      <div className="rounded-xl border border-[var(--ink-100)] bg-white p-5 mb-5">
        <h2 className="text-xl font-semibold text-[var(--ink-900)]">All screens</h2>
        <p className="text-sm text-[var(--ink-700)] mt-2 leading-relaxed">
          Read live from the app’s route tree. New screens appear here automatically; any screen not yet covered by a
          pathway is flagged so nothing is missed.
        </p>
        <div className="flex gap-4 mt-3 text-sm">
          <span className="text-[var(--ink-900)] font-semibold">{routes.length} screens</span>
          <span className="text-green-700">{mapped} in a pathway</span>
          <span className={gaps > 0 ? 'text-amber-700 font-semibold' : 'text-[var(--ink-500)]'}>{gaps} not mapped yet</span>
        </div>
        {routes.length === 0 && (
          <p className="text-xs text-[var(--ink-500)] mt-2">(Route tree not readable in this environment — showing pathways only.)</p>
        )}
      </div>

      <ul className="rounded-xl border border-[var(--ink-100)] bg-white divide-y divide-[var(--ink-100)] overflow-hidden">
        {routes.map((r) => {
          const js = byRoute.get(r.route) ?? []
          return (
            <li key={r.route} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
              <span className="mono text-[12px] text-[var(--ink-900)] flex-1 min-w-[200px]">{r.route}</span>
              <span className="text-[10px] mono uppercase tracking-wider text-[var(--ink-500)] border border-[var(--ink-100)] rounded px-1.5 py-0.5">
                {AREA_LABEL[r.area]}
              </span>
              {js.length > 0 ? (
                <span className="flex flex-wrap gap-1 justify-end">
                  {js.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => onOpenJourney(j.id)}
                      className="text-[11px] rounded-md px-2 py-0.5 border border-[var(--ink-100)] bg-[var(--paper)] text-[var(--ink-700)] hover:border-[var(--ink-900)] transition-colors"
                    >
                      {j.title}
                    </button>
                  ))}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                  Not mapped yet
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
