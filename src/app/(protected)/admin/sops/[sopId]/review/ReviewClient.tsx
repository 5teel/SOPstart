'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import ParseJobStatus from '@/components/admin/ParseJobStatus'
import OriginalDocViewer from '@/components/admin/OriginalDocViewer'
import SectionEditor from '@/components/admin/SectionEditor'
import AdversarialFlagBanner from '@/components/admin/AdversarialFlagBanner'
import MissingSectionWarningBanner from '@/components/admin/MissingSectionWarningBanner'
import { reparseSop } from '@/actions/sops'
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

  const initialApprovedCount = sop.sop_sections.filter((s) => s.approved).length
  const [approvedCount, setApprovedCount] = useState(initialApprovedCount)

  useEffect(() => {
    setApprovedCount(sop.sop_sections.filter((s) => s.approved).length)
  }, [sop.sop_sections])

  const totalCount = sop.sop_sections.length
  const allApproved = totalCount > 0 && approvedCount >= totalCount

  // Confirmation state: 'reparse' | 'delete' | 'publish' | null
  const [confirmAction, setConfirmAction] = useState<'reparse' | 'delete' | 'publish' | null>(null)
  const [actionPending, setActionPending] = useState(false)
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

  return (
    <div className="min-h-dvh bg-steel-900">
      {/* Sticky header bar */}
      <header className="sticky top-0 z-10 bg-steel-900 border-b border-steel-700 px-6 py-4 flex items-center gap-4 flex-wrap">
        {/* Left cluster */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/sops"
            className="text-sm text-steel-400 hover:text-steel-100 flex items-center gap-1 flex-shrink-0"
          >
            <ArrowLeft size={16} />
            All SOPs
          </Link>
          <div className="w-px h-5 bg-steel-700 flex-shrink-0" />
          <span className="text-base font-semibold text-steel-100 truncate max-w-[200px] lg:max-w-xs">
            {sop.title ?? sop.source_file_name}
          </span>
          <StatusBadge status={sop.status as SopStatus} />
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {confirmAction === 'reparse' ? (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="text-steel-400 text-xs">
                This will discard your edits and run the AI again. Sure?
              </span>
              <button
                onClick={executeReparse}
                disabled={actionPending}
                className="h-[40px] px-3 bg-brand-orange text-white font-semibold text-xs rounded-lg hover:opacity-90"
              >
                Yes, re-parse
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="h-[40px] px-3 bg-steel-700 text-steel-100 font-semibold text-xs rounded-lg hover:bg-steel-600"
              >
                Cancel
              </button>
            </div>
          ) : confirmAction === 'delete' ? (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="text-steel-400 text-xs">
                This will permanently delete this draft. Can&apos;t be undone.
              </span>
              <button
                onClick={executeDelete}
                disabled={actionPending}
                className="h-[40px] px-3 bg-red-600 text-white font-semibold text-xs rounded-lg hover:opacity-90"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="h-[40px] px-3 bg-steel-700 text-steel-100 font-semibold text-xs rounded-lg hover:bg-steel-600"
              >
                Cancel
              </button>
            </div>
          ) : confirmAction === 'publish' ? (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="text-steel-400 text-xs">
                Publish this SOP? It will be visible to all workers.
              </span>
              <button
                onClick={executePublish}
                disabled={actionPending}
                className="h-[40px] px-3 bg-brand-yellow text-steel-900 font-bold text-xs rounded-lg hover:bg-amber-400"
              >
                Yes, publish
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="h-[40px] px-3 bg-steel-700 text-steel-100 font-semibold text-xs rounded-lg hover:bg-steel-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirmAction('reparse')}
                disabled={actionPending}
                className="h-[48px] px-4 bg-steel-700 text-brand-orange border border-brand-orange/40 font-semibold text-sm rounded-lg hover:bg-steel-600 disabled:opacity-50"
              >
                Re-parse
              </button>
              <button
                onClick={() => setConfirmAction('delete')}
                disabled={actionPending || sop.status === 'published'}
                className="h-[48px] px-4 text-red-400 border border-red-500/40 font-semibold text-sm rounded-lg hover:bg-red-500/10 disabled:opacity-50"
              >
                Delete draft
              </button>
              <button
                onClick={() => setConfirmAction('publish')}
                disabled={publishDisabled}
                title={publishTitle}
                className="h-[56px] px-6 bg-brand-yellow text-steel-900 font-bold text-sm rounded-lg hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Publish SOP
              </button>
            </>
          )}
        </div>
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
            <div className="w-full lg:w-1/2 overflow-y-auto max-h-[calc(100vh-theme(spacing.32))]">
              <OriginalDocViewer
                sourceFileType={sop.source_file_type}
                presignedUrl={presignedUrl}
                sourceFileName={sop.source_file_name}
                transcriptSegments={transcriptSegments}
                youtubeVideoId={youtubeVideoId}
              />
            </div>

            {/* Right pane — Parsed output */}
            <div className="w-full lg:w-1/2 overflow-y-auto max-h-[calc(100vh-theme(spacing.32))]">
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
