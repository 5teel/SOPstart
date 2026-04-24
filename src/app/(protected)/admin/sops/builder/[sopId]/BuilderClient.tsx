'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { Data } from '@puckeditor/core'
import type { SopWithSections } from '@/types/sop'
import {
  puckConfig,
  puckOverrides,
  sanitizeLayoutContent,
} from '@/lib/builder/puck-config'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'
import { useBuilderAutosave } from '@/hooks/useBuilderAutosave'
import { useDraftLayoutSync } from '@/hooks/useDraftLayoutSync'
import { useNetworkStore } from '@/stores/network'
import { db } from '@/lib/offline/db'

const Puck = dynamic(
  () => import('@puckeditor/core').then((m) => m.Puck),
  {
    ssr: false,
    loading: () => <div className="p-8 text-steel-400">Loading editor…</div>,
  }
)

const emptyData: Data = { content: [], root: { props: {} } }

interface BuilderClientProps {
  sopId: string
  initialSop: SopWithSections
}

export function BuilderClient({ sopId, initialSop }: BuilderClientProps) {
  const sections = [...(initialSop.sop_sections ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '')
  const activeSection = sections.find((s) => s.id === activeSectionId)

  // Plan 04: autosave + sync hooks. useDraftLayoutSync registers the
  // mount/online/visibility triggers that call flushDraftLayouts.
  const { syncing, lastSyncResult } = useDraftLayoutSync()
  const isOnline = useNetworkStore((s) => s.isOnline)
  const handleChange = useBuilderAutosave(activeSectionId, sopId)

  // Track last-synced timestamp for the SAVED pill. Polls Dexie every 2s
  // while mounted and reads the most recent `updated_at` across this SOP's
  // draftLayouts rows with `syncState: 'synced'`.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [savedTick, setSavedTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const rows = await db.draftLayouts
          .where('sop_id')
          .equals(sopId)
          .toArray()
        const synced = rows.filter((r) => r.syncState === 'synced')
        const latest = synced.reduce(
          (acc, r) => (r.updated_at > acc ? r.updated_at : acc),
          0
        )
        if (!cancelled) setLastSavedAt(latest > 0 ? latest : null)
      } catch {
        // Dexie not ready / SSR — leave lastSavedAt as-is
      }
    }
    void refresh()
    const poll = setInterval(refresh, 2_000)
    // Separate tick interval so the "Ns AGO" label ticks every second without
    // hitting Dexie.
    const tick = setInterval(() => setSavedTick((t) => t + 1), 1_000)
    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [sopId])

  // D-07: when flushDraftLayouts reports a cross-admin overwrite, surface a
  // quiet toast naming the affected section titles. Auto-clears after ~4s.
  const [overwriteToast, setOverwriteToast] = useState<string | null>(null)
  useEffect(() => {
    if (!lastSyncResult?.overwrittenByServer?.length) return
    const overwrittenTitles = lastSyncResult.overwrittenByServer.map(
      (id) => sections.find((s) => s.id === id)?.title ?? id.slice(0, 8)
    )
    setOverwriteToast(
      `Updated by another admin - ${overwrittenTitles.join(', ')}`
    )
    const t = setTimeout(() => setOverwriteToast(null), 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncResult])

  // D-16: surface a section-level toast when activeSection.layout_data is
  // structurally broken. The sanitized initial data path below falls back to
  // emptyData so the editor still mounts.
  const [layoutErrorToast, setLayoutErrorToast] = useState<string | null>(null)
  useEffect(() => {
    if (!activeSection || activeSection.layout_data == null) {
      setLayoutErrorToast(null)
      return
    }
    const parsed = LayoutDataSchema.safeParse(activeSection.layout_data)
    setLayoutErrorToast(
      parsed.success
        ? null
        : `Section "${activeSection.title}" has broken layout data - revert to last save?`
    )
  }, [activeSection])

  // Derive the save-state pill label. OFFLINE when network is down (rows stay
  // in Dexie with syncState: 'dirty'); SAVING while a flush is in-flight;
  // SAVED {N}s AGO when lastSavedAt is known; plain SAVED otherwise.
  const savePillLabel = !isOnline
    ? 'OFFLINE · QUEUED'
    : syncing
      ? 'SAVING…'
      : lastSavedAt
        ? `SAVED ${Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000))}s AGO`
        : 'SAVED'
  // savedTick is consumed by the label computation above — reference it so
  // React re-runs the render each tick.
  void savedTick

  // D-13: sanitize unknown block types before passing data to <Puck>.
  const sanitizedInitial: Data = useMemo(() => {
    if (!activeSection || activeSection.layout_data == null) return emptyData
    const parsed = LayoutDataSchema.safeParse(activeSection.layout_data)
    if (!parsed.success) return emptyData
    const sanitizedContent = sanitizeLayoutContent(
      (parsed.data.content ?? []) as unknown[]
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ...parsed.data, content: sanitizedContent } as any as Data
  }, [activeSection])

  return (
    <div className="flex flex-col h-screen bg-steel-900 text-steel-100">
      {/* Top chrome — SAVED pill + SEND TO REVIEW (Plan 04 wires real save state) */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-steel-700">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sops"
            className="text-sm text-steel-400 hover:text-brand-yellow transition-colors"
          >
            ← Library
          </Link>
          <h1 className="text-base font-semibold">
            {initialSop.title ?? 'Untitled SOP'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {layoutErrorToast && (
            <div
              role="alert"
              className="px-3 py-1.5 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-mono uppercase tracking-wider cursor-pointer"
              onClick={() => setLayoutErrorToast(null)}
            >
              {layoutErrorToast} (click to dismiss)
            </div>
          )}
          {overwriteToast && (
            <span
              role="status"
              className="px-3 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-mono uppercase tracking-wider"
            >
              {overwriteToast}
            </span>
          )}
          <span className="font-mono text-[11px] uppercase tracking-wider text-steel-400 border border-steel-600 rounded px-2 py-0.5">
            {savePillLabel}
          </span>
          <Link
            href={`/admin/sops/${sopId}/review`}
            className="px-3 py-1.5 bg-brand-yellow text-steel-900 text-sm font-bold rounded"
          >
            SEND TO REVIEW
          </Link>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — section list (Plan 04 wires drag handles) */}
        <nav
          aria-label="Sections"
          className="w-64 shrink-0 border-r border-steel-700 overflow-y-auto"
        >
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setActiveSectionId(s.id)}
                  className={`w-full text-left px-4 py-3 text-sm ${
                    s.id === activeSectionId
                      ? 'bg-steel-800 text-brand-yellow'
                      : 'text-steel-300 hover:bg-steel-800'
                  }`}
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {/* Canvas — remount Puck per active section (Research Open Question 2) */}
        <main className="flex-1 min-w-0 overflow-auto">
          {activeSection ? (
            <Puck
              key={activeSection.id}
              config={puckConfig}
              overrides={puckOverrides}
              data={sanitizedInitial}
              onChange={handleChange}
            />
          ) : (
            <div className="p-8 text-steel-400">
              No sections yet — add one from the sidebar.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
