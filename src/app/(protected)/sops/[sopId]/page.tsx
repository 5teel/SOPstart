'use client'
import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSopDetail } from '@/hooks/useSopDetail'
import { SopTabNav, useActiveTab } from '@/components/sop/SopTabNav'
import { WorkerPreviewToggle, WorkerPreviewClamp } from '@/components/sop/WorkerPreviewToggle'
import {
  OverviewTab, ToolsTab, HazardsTab, FlowTab, ModelTab, WalkthroughTab,
} from '@/components/sop/tabs'
import { CommandPalette } from '@/components/sop/CommandPalette'

function SopDetailInner() {
  const params = useParams<{ sopId: string }>()
  const sopId = params?.sopId ?? ''
  const { data: sop, isLoading, isError } = useSopDetail(sopId)
  const active = useActiveTab()

  const [cmdOpen, setCmdOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      // Don't open over the escalation modal
      if (document.querySelector('[data-escalation-modal]')) return
      setCmdOpen((prev) => !prev)
    }
    if (e.key === 'Escape') setCmdOpen(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        {/* Skeleton header */}
        <div className="sticky top-0 z-10 bg-[var(--paper)]/95 border-b border-[var(--ink-100)] px-4 flex items-center gap-3 h-[56px]">
          <div className="w-16 h-4 rounded bg-[var(--ink-100)] animate-pulse" />
          <div className="flex-1 h-4 rounded bg-[var(--ink-100)] animate-pulse max-w-[200px]" />
        </div>
        {/* Skeleton tab bar */}
        <div className="h-[48px] bg-[var(--paper)] border-b border-[var(--ink-100)] flex items-center px-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-16 h-3 rounded bg-[var(--ink-100)] animate-pulse" />
          ))}
        </div>
        {/* Skeleton content */}
        <div className="p-8 flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-[var(--ink-50)] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !sop) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center p-8 gap-4 text-center">
        <p className="text-lg font-semibold text-[var(--ink-900)]">SOP not found</p>
        <p className="text-sm text-[var(--ink-500)] max-w-xs">
          This SOP may have been deleted or you may not have access to it.
        </p>
        <Link
          href="/sops"
          className="mt-2 inline-flex items-center gap-2 px-4 h-[44px] border border-[var(--ink-300)] rounded-lg text-sm font-medium text-[var(--ink-700)] hover:border-[var(--ink-900)] transition-colors"
        >
          ← Library
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink-900)]">
      <header className="sticky top-0 z-10 bg-[var(--paper)]/95 backdrop-blur border-b border-[var(--ink-100)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/sops" className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)] flex-shrink-0">
              ← Library
            </Link>
            <h1 className="text-base font-semibold truncate">{sop.title ?? 'Untitled SOP'}</h1>
          </div>
          <WorkerPreviewToggle />
        </div>
        <div className="max-w-5xl mx-auto px-4">
          <SopTabNav />
        </div>
      </header>

      <main>
        <WorkerPreviewClamp>
          {active === 'overview'    && <OverviewTab sop={sop} />}
          {active === 'tools'       && <ToolsTab sop={sop} />}
          {active === 'hazards'     && <HazardsTab sop={sop} />}
          {active === 'flow'        && <FlowTab sop={sop} />}
          {active === 'model'       && <ModelTab sop={sop} />}
          {active === 'walkthrough' && <WalkthroughTab sop={sop} />}
        </WorkerPreviewClamp>
      </main>

      <CommandPalette
        sop={sop}
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
      />
    </div>
  )
}

export default function SopDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--ink-500)]">Loading SOP…</div>}>
      <SopDetailInner />
    </Suspense>
  )
}
