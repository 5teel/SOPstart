'use client'

/**
 * Phase 15 / Wave 4 — Sub-trade tag picker.
 *
 * Multi-select pill picker bound to the 5-row seed vocabulary
 * (operator / fitter / sparky / maintainer / other). Used inline on:
 *   - /admin/team page — per-worker row, mode="user"
 *   - /admin/sops/[sopId]/assign — alongside the role picker, mode="sop"
 *
 * Behaviour: clicking a pill toggles selection. Each toggle fires the
 * matching server action (assignUserSubTrades / assignSopSubTrades) with
 * replace-semantics, so the on-screen pill state is always the persisted
 * state. Optimistic update; reverts on server error.
 *
 * Accessibility: each pill is a real <button> with aria-pressed. Errors
 * render inline as a short red text.
 *
 * Design tokens follow sketch-findings-SOPstart paper/ink palette: pill
 * class + var(--ink-*) / var(--paper) — same chip language used on the
 * builder block picker.
 */

import { useEffect, useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import {
  listSubTrades,
  assignUserSubTrades,
  assignSopSubTrades,
  getUserSubTrades,
  getSopSubTrades,
} from '@/actions/sub-trades'
import type { SubTrade } from '@/types/sop'

type Props =
  | { mode: 'user'; userId: string; onChange?: (ids: string[]) => void }
  | { mode: 'sop'; sopId: string; onChange?: (ids: string[]) => void }

export function SubTradePicker(props: Props) {
  const targetKey = props.mode === 'user' ? props.userId : props.sopId

  const [vocab, setVocab] = useState<SubTrade[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listSubTrades(),
      props.mode === 'user'
        ? getUserSubTrades(props.userId)
        : getSopSubTrades(props.sopId),
    ])
      .then(([v, ids]) => {
        if (cancelled) return
        setVocab(v)
        setSelectedIds(new Set(ids))
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, props.mode])

  function toggle(id: string) {
    const prev = new Set(selectedIds)
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
    startTransition(async () => {
      setError(null)
      const result =
        props.mode === 'user'
          ? await assignUserSubTrades(props.userId, Array.from(next))
          : await assignSopSubTrades(props.sopId, Array.from(next))
      if ('error' in result) {
        setError(result.error)
        // Revert optimistic update on error
        setSelectedIds(prev)
      } else {
        props.onChange?.(Array.from(next))
      }
    })
  }

  if (!loaded) {
    return (
      <div className="text-xs text-[var(--ink-500)]" data-testid="sub-trade-picker-loading">
        Loading sub-trades…
      </div>
    )
  }

  const testIdRoot =
    props.mode === 'user'
      ? `sub-trade-picker-user-${props.userId}`
      : `sub-trade-picker-sop-${props.sopId}`

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={testIdRoot}
    >
      {vocab.map(st => {
        const isOn = selectedIds.has(st.id)
        return (
          <button
            key={st.id}
            type="button"
            onClick={() => toggle(st.id)}
            disabled={pending}
            aria-pressed={isOn}
            data-testid={`sub-trade-pill-${st.slug}`}
            className={`pill inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isOn
                ? 'bg-[var(--ink-900)] text-[var(--paper)] border-[var(--ink-900)]'
                : 'bg-[var(--paper)] text-[var(--ink-700)] border-[var(--ink-200)] hover:border-[var(--ink-500)]'
            } disabled:opacity-60`}
          >
            {isOn && <Check className="h-3 w-3" aria-hidden="true" />}
            {st.label}
          </button>
        )
      })}
      {error && (
        <span className="text-xs text-red-600 ml-2" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
