'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, RotateCcw, Trash2, Send, MoreVertical } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import ParseJobStatus from '@/components/admin/ParseJobStatus'
import OriginalDocViewer from '@/components/admin/OriginalDocViewer'
import SectionEditor from '@/components/admin/SectionEditor'
import { AddSectionButton } from '@/components/admin/AddSectionButton'
import AdversarialFlagBanner from '@/components/admin/AdversarialFlagBanner'
import MissingSectionWarningBanner from '@/components/admin/MissingSectionWarningBanner'
import { reparseSop, restructureSop } from '@/actions/sops'
import type { SopWithSections, SopStatus, ParseJob, TranscriptSegment, VerificationFlag } from '@/types/sop'

interface ReviewClientProps {
  sop: SopWithSections
  parseJob: ParseJob | null
  presignedUrl: string | null
  // New video-specific props
  transcriptSegments?: TranscriptSegment[]
  verificationFlags?: VerificationFlag[]
  youtubeVideoId?: string | null
}

export default function ReviewClient({
  sop,
  parseJob,
  presignedUrl,
  transcriptSegments,
  verificationFlags,
  youtubeVideoId,
}: ReviewClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPipeline = searchParams?.get('from') === 'pipeline'
  const pipelineId = searchParams?.get('pipelineId') ?? null

  const initialApprovedCount = sop.sop_sections.filter((s) => s.approved).length
  const [approvedCount, setApprovedCount] = useState(initialApprovedCount)

  useEffect(() => {
    setApprovedCount(sop.sop_sections.filter((s) => s.approved).length)
  }, [sop.sop_sections])

  const totalCount = sop.sop_sections.length
  const allApproved = totalCount > 0 && approvedCount >= totalCount

  const isVideoSop = sop.source_file_type === 'video'

  // Confirmation state
  const [confirmAction, setConfirmAction] = useState<'reparse' | 'restructure' | 'delete' | 'publish' | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [detailLevel, setDetailLevel] = useState(3)
  const [publishSuccess, setPublishSuccess] = useState(false)

  // Missing section acknowledgement state
  const [missingSectionAcknowledged, setMissingSectionAcknowledged] = useState(false)

  // Unresolved critical adversarial flags count
  const [unresolvedCriticalFlags, setUnresolvedCriticalFlags] = useState(() => {
    return (verificationFlags ?? []).filter(
      (f) =>
        f.severity === 'critical' &&
        !(
          (f.section_title === 'Hazards' || f.section_title === 'PPE') &&
          f.original_text === '(not found in transcript)'
        )
    ).length
  })

  // Derive publish gate conditions
  const hasMissingSectionFlags = (verificationFlags ?? []).some(
    (f) =>
      (f.section_title === 'Hazards' || f.section_title === 'PPE') &&
      f.original_text === '(not found in transcript)'
  )

  const handleApprovalChange = useCallback(() => {
    router.refresh()
  }, [router])

  const executeReparse = async () => {
    setActionPending(true)
    setConfirmAction(null)
    const result = await reparseSop(sop.id)
    if ('sopId' in result) {
      // Route to correct pipeline based on source file type
      const endpoint = sop.source_file_type === 'video'
        ? '/api/sops/transcribe'
        : '/api/sops/parse'
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopId: result.sopId }),
      }).catch(console.error)
    } else if ('error' in result) {
      alert(result.error)
    }
    router.refresh()
    setActionPending(false)
  }

  const executeRestructure = async () => {
    setActionPending(true)
    setConfirmAction(null)
    const result = await restructureSop(sop.id)
    if ('sopId' in result) {
      fetch('/api/sops/restructure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopId: result.sopId, detailLevel }),
      }).catch(console.error)
    } else if ('error' in result) {
      alert(result.error)
    }
    router.refresh()
    setActionPending(false)
  }

  const executeDelete = async () => {
    setActionPending(true)
    setConfirmAction(null)
    await fetch(`/api/sops/${sop.id}`, { method: 'DELETE' })
    router.push('/admin/sops')
  }

  const executePublish = async () => {
    setActionPending(true)
    setConfirmAction(null)
    const res = await fetch(`/api/sops/${sop.id}/publish`, { method: 'POST' })
    if (res.ok) {
      setPublishSuccess(true)
      router.refresh()
    }
    setActionPending(false)
  }

  const isOcr = sop.is_ocr

  // Publish button disabled conditions
  const publishDisabled =
    !allApproved ||
    actionPending ||
    sop.status === 'published' ||
    (hasMissingSectionFlags && !missingSectionAcknowledged) ||
    unresolvedCriticalFlags > 0

  const publishTitle = !allApproved
    ? 'Approve all sections before publishing'
    : unresolvedCriticalFlags > 0
    ? 'Resolve all critical AI verification flags before publishing (per D-04)'
    : hasMissingSectionFlags && !missingSectionAcknowledged
    ? 'Acknowledge missing safety sections before publishing'
    : undefined

  const [menuOpen, setMenuOpen] = useState(false)
  const DETAIL_LABELS = ['Min', 'Brief', 'Std', 'Detail', 'Max'] as const

  return (
    <div className="flex flex-col flex-1">
      {/* Back to pipeline breadcrumb — only when arriving from pipeline flow */}
      {fromPipeline && pipelineId && (
        <Link
          href={`/admin/sops/pipeline/${pipelineId}`}
          className="inline-block text-brand-yellow text-sm font-medium hover:text-amber-400 px-4 py-2"
        >
          ← Back to pipeline
        </Link>
      )}

      {/* Sticky header bar — compact */}
      <header className="sticky top-0 z-10 bg-steel-900 border-b border-steel-700 px-4 flex items-center h-[56px] gap-3">
        {/* Back + title */}
        <Link
          href="/admin/sops"
          className="text-steel-400 hover:text-steel-100 flex-shrink-0"
          aria-label="Back to SOP library"
        >
          <ArrowLeft size={20} />
        </Link>
        <span className="text-sm font-semibold text-steel-100 truncate flex-1 min-w-0">
          {sop.title ?? sop.source_file_name}
        </span>
        <StatusBadge status={sop.status as SopStatus} />

        {/* Confirmation inline bar */}
        {confirmAction ? (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-steel-400 hidden sm:inline">
              {confirmAction === 'reparse' && (isVideoSop ? 'Re-transcribe?' : 'Re-parse?')}
              {confirmAction === 'restructure' && 'Re-structure?'}
              {confirmAction === 'delete' && 'Delete?'}
              {confirmAction === 'publish' && 'Publish?'}
            </span>
            <button
              onClick={() => {
                if (confirmAction === 'reparse') executeReparse()
                else if (confirmAction === 'restructure') executeRestructure()
                else if (confirmAction === 'delete') executeDelete()
                else if (confirmAction === 'publish') executePublish()
              }}
              disabled={actionPending}
              className={[
                'h-9 px-3 font-semibold text-xs rounded-lg',
                confirmAction === 'delete' ? 'bg-red-600 text-white' : 'bg-brand-yellow text-steel-900',
              ].join(' ')}
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              className="h-9 px-3 bg-steel-700 text-steel-100 text-xs rounded-lg hover:bg-steel-600"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 ml-2">
            {/* Detail level slider (video only) */}
            {isVideoSop && (
              <div className="hidden sm:flex items-center gap-1 bg-steel-800 border border-steel-700 rounded-lg px-2 h-9">
                <span className="text-[10px] text-steel-400">−</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={detailLevel}
                  onChange={(e) => setDetailLevel(parseInt(e.target.value))}
                  className="w-12 h-1 rounded-full appearance-none bg-steel-600 accent-brand-yellow cursor-pointer"
                  aria-label="Detail level"
                  title={`Detail: ${DETAIL_LABELS[detailLevel - 1]} (${detailLevel}/5)`}
                />
                <span className="text-[10px] text-steel-400">+</span>
              </div>
            )}

            {/* Re-structure (video only) */}
            {isVideoSop && (
              <button
                onClick={() => setConfirmAction('restructure')}
                disabled={actionPending}
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-steel-800 border border-steel-700 text-brand-yellow hover:bg-steel-700 disabled:opacity-50"
                title="Re-structure (keep transcript)"
                aria-label="Re-structure"
              >
                <RefreshCw size={16} />
              </button>
            )}

            {/* Re-parse / Re-transcribe */}
            <button
              onClick={() => setConfirmAction('reparse')}
              disabled={actionPending}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-steel-800 border border-steel-700 text-brand-orange hover:bg-steel-700 disabled:opacity-50"
              title={isVideoSop ? 'Re-transcribe (full redo)' : 'Re-parse'}
              aria-label={isVideoSop ? 'Re-transcribe' : 'Re-parse'}
            >
              <RotateCcw size={16} />
            </button>

            {/* Delete */}
            <button
              onClick={() => setConfirmAction('delete')}
              disabled={actionPending || sop.status === 'published'}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-steel-800 border border-steel-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50"
              title="Delete draft"
              aria-label="Delete draft"
            >
              <Trash2 size={16} />
            </button>

            {/* Publish */}
            <button
              onClick={() => setConfirmAction('publish')}
              disabled={publishDisabled}
              title={publishTitle ?? 'Publish SOP'}
              className="h-9 px-3 bg-brand-yellow text-steel-900 font-semibold text-xs rounded-lg hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Send size={14} />
              <span className="hidden sm:inline">Publish</span>
            </button>
          </div>
        )}
      </header>

      {/* Publish success banner with next-step actions */}
      {publishSuccess && (
        <div className="bg-green-500/20 border border-green-500/40 rounded-lg px-4 py-4 mx-6 mt-4">
          <p className="text-green-400 text-sm font-semibold mb-3">
            SOP published successfully. It&apos;s now in the library. What&apos;s next?
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/sops/${sop.id}/assign`}
              className="min-h-[44px] px-4 flex items-center bg-brand-yellow text-steel-900 font-semibold rounded-lg hover:bg-amber-400 active:bg-amber-500 transition-colors"
            >
              Assign to team
            </Link>
            <Link
              href={`/admin/sops/${sop.id}/video`}
              className="min-h-[44px] px-4 flex items-center bg-steel-700 text-steel-100 font-semibold rounded-lg hover:bg-steel-600 active:bg-steel-500 transition-colors"
            >
              Generate video
            </Link>
            <Link
              href="/admin/sops"
              className="min-h-[44px] px-4 flex items-center bg-steel-800 text-steel-300 font-semibold rounded-lg hover:bg-steel-700 transition-colors"
            >
              Back to library
            </Link>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="px-6 py-6">
        {/* Still parsing */}
        {(sop.status === 'parsing' || sop.status === 'uploading') && parseJob ? (
          <div className="max-w-lg mx-auto mt-8">
            <ParseJobStatus
              sopId={sop.id}
              initialStatus={parseJob.status}
              initialErrorMessage={parseJob.error_message}
              isOcr={isOcr}
            />
          </div>
        ) : (
          /* Side-by-side layout */
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left pane — Original document */}
            <div className="w-full lg:w-1/2 overflow-y-visible">
              <OriginalDocViewer
                sourceFileType={sop.source_file_type}
                presignedUrl={presignedUrl}
                sourceFileName={sop.source_file_name}
                transcriptSegments={transcriptSegments}
                youtubeVideoId={youtubeVideoId}
              />
            </div>

            {/* Right pane — Parsed output */}
            <div className="w-full lg:w-1/2 overflow-y-visible">
              {/* Adversarial verification flags (D-04/D-05) */}
              {verificationFlags && verificationFlags.length > 0 && (
                <AdversarialFlagBanner
                  flags={verificationFlags}
                  onUnresolvedCountChange={setUnresolvedCriticalFlags}
                />
              )}

              {/* Missing section warning (VID-07 / D-13) */}
              {verificationFlags && (
                <MissingSectionWarningBanner
                  flags={verificationFlags}
                  acknowledged={missingSectionAcknowledged}
                  onAcknowledgeChange={setMissingSectionAcknowledged}
                />
              )}

              <p className="text-xs font-semibold text-steel-400 uppercase tracking-wide mb-2">
                PARSED OUTPUT
              </p>

              {/* Progress counter */}
              <p className="text-sm text-steel-400 mb-4">
                {approvedCount} of {totalCount} sections approved
              </p>

              {/* OCR warning banner */}
              {isOcr && (
                <div className="bg-brand-orange/20 border border-brand-orange/50 text-brand-orange rounded-lg px-4 py-3 text-sm flex gap-2 items-start mb-4">
                  <span className="flex-shrink-0">&#9888;</span>
                  <span>
                    Heads up — this document was scanned or photographed, so some text might be off. Check it carefully before publishing.
                  </span>
                </div>
              )}

              {/* Section editors */}
              {sop.sop_sections.length === 0 ? (
                <p className="text-sm text-steel-400 italic">
                  No sections found. Try re-parsing the document.
                </p>
              ) : (
                sop.sop_sections.map((section) => (
                  <SectionEditor
                    key={section.id}
                    section={section}
                    sopId={sop.id}
                    onApprovalChange={handleApprovalChange}
                  />
                ))
              )}

              {/* Add section (draft SOPs only) — lets admin insert a new
                  canonical or custom section via the 11-01 section_kinds
                  catalog. Multiple sections of the same kind are allowed. */}
              {sop.status === 'draft' && (
                <AddSectionButton
                  sopId={sop.id}
                  onCreated={handleApprovalChange}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
