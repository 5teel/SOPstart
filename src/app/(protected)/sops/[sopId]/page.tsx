'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useSopDetail } from '@/hooks/useSopDetail'
import { useIsAdmin } from '@/components/providers/RoleProvider'
import { SopTabNav, useActiveTab } from '@/components/sop/SopTabNav'
import { WorkerPreviewToggle, WorkerPreviewClamp } from '@/components/sop/WorkerPreviewToggle'
import { ReadTab } from '@/components/sop/tabs'
import { WalkthroughSwitcher } from '@/components/sop/walkthrough/WalkthroughSwitcher'
import { procedureSections, scopeSopToJob } from '@/lib/sop/sections'

function SopDetailInner() {
  const params = useParams<{ sopId: string }>()
  const sopId = params?.sopId ?? ''
  const { data: sop, isLoading, isError } = useSopDetail(sopId)
  const active = useActiveTab()
  const isAdmin = useIsAdmin()
  const search = useSearchParams()

  // Which job inside the SOP. A document like OTG Probe Maintenance holds four
  // independent procedures; the worker was sent to do ONE. The choice rides in
  // ?job= (so Read → Walk it keeps it, and a link can point at a job) but is
  // driven from local state and synced with replaceState — a router.push on a
  // search-param change costs an RSC fetch through the service worker
  // (CLAUDE.md 2026-05-13).
  // Back/forward or a router-driven ?job= change re-seeds the choice — derived
  // during render (React's "adjust state on prop change" pattern), not in an
  // effect, so there is no extra render and no set-state-in-effect.
  const urlJob = search.get('job')
  const [jobId, setJobId] = useState<string | null>(urlJob)
  const [seenUrlJob, setSeenUrlJob] = useState<string | null>(urlJob)
  if (urlJob !== seenUrlJob) {
    setSeenUrlJob(urlJob)
    if (urlJob) setJobId(urlJob)
  }
  function handleJobChange(id: string) {
    setJobId(id)
    const params = new URLSearchParams(window.location.search)
    params.set('job', id)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        {/* Skeleton header */}
        <div className="sticky top-0 z-10 bg-[var(--paper)]/95 border-b border-[var(--ink-100)] px-4 flex items-center gap-3 h-14">
          <div className="w-16 h-4 rounded bg-[var(--ink-100)] animate-pulse" />
          <div className="flex-1 h-4 rounded bg-[var(--ink-100)] animate-pulse max-w-50" />
        </div>
        {/* Skeleton tab bar */}
        <div className="h-12 bg-[var(--paper)] border-b border-[var(--ink-100)] flex items-center px-4 gap-4">
          {[...Array(3)].map((_, i) => (
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
          className="mt-2 inline-flex items-center gap-2 px-4 h-tap border border-[var(--ink-300)] rounded-lg text-sm font-medium text-[var(--ink-700)] hover:border-[var(--ink-900)] transition-colors"
        >
          ← SOPs
        </Link>
      </div>
    )
  }

  const jobs = procedureSections(sop)
  const job = jobs.find((s) => s.id === jobId) ?? jobs[0] ?? null
  // Walk it walks the chosen job only — "Step 1 of 6", not "Step 1 of 40".
  const walkSop = job && jobs.length > 1 ? scopeSopToJob(sop, job.id) : sop

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink-900)]">
      <header className="sticky top-0 z-10 bg-[var(--paper)]/95 backdrop-blur border-b border-[var(--ink-100)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/sops" className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)] flex-shrink-0">
              ← SOPs
            </Link>
            <p className="text-base font-semibold truncate">{sop.title ?? 'Untitled SOP'}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <Link
                href={`/admin/sops/builder/${sopId}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--ink-300)] text-sm font-medium text-[var(--ink-700)] hover:border-[var(--ink-900)] hover:text-[var(--ink-900)] transition-colors"
                title="Open this SOP in the admin builder"
              >
                Edit in builder
              </Link>
            )}
            {/* Admin preview tool — not worker chrome. */}
            {isAdmin && <WorkerPreviewToggle />}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4">
          <SopTabNav />
        </div>
      </header>

      <main>
        <WorkerPreviewClamp>
          {active === 'read' && <ReadTab sop={sop} jobId={job?.id ?? null} onJobChange={handleJobChange} />}
          {active === 'walk' && <WalkthroughSwitcher sop={walkSop} />}
        </WorkerPreviewClamp>
      </main>

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
