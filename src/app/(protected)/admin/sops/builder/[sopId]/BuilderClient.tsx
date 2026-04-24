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
          <span className="font-mono text-[11px] uppercase tracking-wider text-steel-400 border border-steel-600 rounded px-2 py-0.5">
            SAVED
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
              onChange={(data) => {
                // Plan 04 wires useBuilderAutosave; log-only for Plan 02.
                console.log('[builder] onChange', data)
              }}
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
