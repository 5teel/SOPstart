'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Download, CheckCircle } from 'lucide-react'
import { useSopDetail } from '@/hooks/useSopDetail'
import { useVideoGeneration } from '@/hooks/useVideoGeneration'
import { useNetworkStore } from '@/stores/network'
import { SopSectionTabs } from '@/components/sop/SopSectionTabs'
import { SectionContent } from '@/components/sop/SectionContent'
import { VideoTabPanel } from '@/components/sop/VideoTabPanel'
import type { ChapterMarker } from '@/types/sop'

export default function SopDetailPage() {
  const params = useParams()
  const sopId = params.sopId as string

  const { data: sop, isLoading, isError } = useSopDetail(sopId)
  const { data: videoJob } = useVideoGeneration(sopId)
  const isOnline = useNetworkStore((s) => s.isOnline)

  // Default active tab: prefer 'steps', fall back to first section
  const [activeTab, setActiveTab] = useState<string>('')

  useEffect(() => {
    if (sop && sop.sop_sections.length > 0 && !activeTab) {
      const stepsSection = sop.sop_sections.find((s) => s.section_type === 'steps')
      setActiveTab(stepsSection?.section_type ?? sop.sop_sections[0].section_type)
    }
  }, [sop, activeTab])

  // Since SOP is loaded from Dexie, it's cached when data is present
  const isCached = !!sop

  const activeSection = sop?.sop_sections.find((s) => s.section_type === activeTab)
  const isStepsTab = activeTab === 'steps'
  const isVideoTab = activeTab === 'video'

  // Video tab visibility: only when online and published video exists (D-04, Pitfall 7)
  const hasVideo = isOnline && !!videoJob?.video_url && videoJob.published

  // Outdated check: compare SOP updated_at vs video completed_at (D-10, Pitfall 5 — use completed_at not created_at)
  const videoOutdated =
    hasVideo &&
    !!sop?.updated_at &&
    !!videoJob?.completed_at &&
    new Date(sop.updated_at) > new Date(videoJob.completed_at)

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-steel-900 overflow-hidden">
        {/* Skeleton header */}
        <div className="sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]">
          <div className="w-8 h-8 rounded-lg bg-steel-700 animate-pulse" />
          <div className="flex-1 h-4 rounded bg-steel-700 animate-pulse max-w-[200px]" />
        </div>
        {/* Skeleton tab bar */}
        <div className="h-[52px] bg-steel-900 border-b border-steel-700 flex items-center px-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-16 h-4 rounded bg-steel-700 animate-pulse" />
          ))}
        </div>
        {/* Skeleton content */}
        <div className="flex-1 px-4 py-6 flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-steel-800 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !sop) {
    return (
      <div className="flex flex-col h-screen bg-steel-900 overflow-hidden">
        <div className="sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]">
          <Link
            href="/sops"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-steel-800 transition-colors"
            aria-label="Back to SOPs"
          >
            <ArrowLeft size={20} className="text-steel-400 hover:text-steel-100" />
          </Link>
          <span className="text-base font-semibold text-steel-100 flex-1 truncate">SOP Not Found</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-4 px-8 text-center">
          <p className="text-lg font-semibold text-steel-100">SOP not available</p>
          <p className="text-sm text-steel-400 max-w-xs">
            This SOP isn&apos;t available offline. Connect to the internet and try again.
          </p>
          <Link
            href="/sops"
            className="mt-2 inline-flex items-center gap-2 px-4 h-[44px] bg-steel-800 rounded-xl text-sm font-medium text-steel-100 hover:bg-steel-700 border border-steel-700 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to SOPs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-steel-900 overflow-hidden">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]">
        <Link
          href="/sops"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-steel-800 transition-colors flex-shrink-0"
          aria-label="Back to SOPs"
        >
          <ArrowLeft size={20} className="text-steel-400 hover:text-steel-100" />
        </Link>
        <span className="text-base font-semibold text-steel-100 flex-1 truncate">
          {sop.title ?? 'Untitled SOP'}
        </span>
        <button
          type="button"
          aria-label={isCached ? 'Downloaded — available offline' : 'Download for offline use'}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-steel-800 transition-colors flex-shrink-0"
        >
          {isCached ? (
            <CheckCircle size={20} className="text-green-400" />
          ) : (
            <Download size={20} className="text-steel-400" />
          )}
        </button>
      </header>

      {/* Sticky tab bar */}
      {sop.sop_sections.length > 0 && (
        <div className="sticky top-[56px] z-10">
          <SopSectionTabs
            sections={sop.sop_sections}
            activeType={activeTab}
            onTabChange={setActiveTab}
            hasVideo={hasVideo}
            videoOutdated={!!videoOutdated}
          />
        </div>
      )}

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-[80px]">
        {isVideoTab && videoJob?.video_url && videoJob.chapter_markers ? (
          <VideoTabPanel
            videoUrl={`/api/videos/${videoJob.id}/stream`}
            chapters={videoJob.chapter_markers as ChapterMarker[]}
            videoJobId={videoJob.id}
            sopId={sopId}
            sopVersion={videoJob.sop_version}
            isOutdated={!!videoOutdated}
          />
        ) : activeSection ? (
          <SectionContent section={activeSection} />
        ) : (
          <p className="text-sm text-steel-400">No content for this section.</p>
        )}
      </div>

      {/* Bottom action bar — Steps tab only (hidden for video tab) */}
      {isStepsTab && (
        <div className="sticky bottom-[56px] bg-steel-900 border-t border-steel-700 px-4 py-3">
          <Link
            href={`/sops/${sopId}/walkthrough`}
            className="flex items-center justify-center w-full h-[72px] bg-brand-yellow text-steel-900 font-bold text-lg rounded-xl hover:bg-amber-400 active:bg-amber-500 transition-colors"
          >
            Start Walkthrough
          </Link>
        </div>
      )}
    </div>
  )
}
