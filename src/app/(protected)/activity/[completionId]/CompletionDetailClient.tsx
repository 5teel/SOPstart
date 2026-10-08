'use client'

import Link from 'next/link'
import { ArrowLeft, Camera, Check } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { CompletionStepRow } from '@/components/activity/CompletionStepRow'
import type { CompletionStatus } from '@/types/sop'

interface Photo {
  id: string
  step_id: string
  content_type: string
  signed_url: string
}

interface Step {
  id: string
  step_number: number
  text: string
}

interface SignOff {
  id: string
  supervisor_id: string
  decision: string
  reason: string | null
  created_at: string
}

interface CompletionDetailClientProps {
  sopTitle: string | null
  sopVersion: number
  status: CompletionStatus
  submittedAt: string
  stepData: Record<string, number>
  steps: Step[]
  photos: Photo[]
  signOff: SignOff | null
}

function formatNZDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-NZ', {
    // Fixed zone: the server (UTC) and the browser (NZ) must render the SAME text or React throws #418 on hydration.
    timeZone: 'Pacific/Auckland',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', ' ·')
}

// The walker's own record of one walk: steps, photos, status, and the decision with its reason.
export function CompletionDetailClient({
  sopTitle,
  sopVersion,
  status,
  submittedAt,
  stepData,
  steps,
  photos,
  signOff,
}: CompletionDetailClientProps) {
  const photosByStep = new Map<string, Photo[]>()
  for (const photo of photos) {
    const existing = photosByStep.get(photo.step_id) ?? []
    existing.push(photo)
    photosByStep.set(photo.step_id, existing)
  }

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[var(--paper)] border-b border-[var(--ink-100)] px-4 flex items-center gap-3 h-14">
        <Link
          href="/?s=record"
          className="flex items-center gap-1.5 text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">My record</span>
        </Link>
        <span className="text-[var(--ink-300)] mx-1">|</span>
        <h1 className="text-sm font-semibold text-[var(--ink-900)] truncate">Completion Detail</h1>
      </div>

      <div className="px-4 py-6 max-w-5xl mx-auto">
        {/* Summary banner */}
        <div className="blueprint-frame p-5 mb-6">
          <div className="flex items-start gap-2 flex-wrap mb-3">
            <h2 className="text-base font-semibold text-[var(--ink-900)] flex-1 min-w-0">
              {sopTitle ?? 'Untitled SOP'}
            </h2>
            <span className="mono text-xs bg-[var(--paper-2)] border border-[var(--ink-100)] text-[var(--ink-500)] px-2 py-0.5 rounded font-medium flex-shrink-0">
              v{sopVersion}
            </span>
            <StatusBadge status={status} />
          </div>

          <p className="mono text-xs text-[var(--ink-500)] mb-3">{formatNZDateTime(submittedAt)}</p>

          {photos.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-500)] mb-3">
              <Camera size={13} />
              <span className="font-bold tabular-nums">{photos.length}</span>
              <span>photo{photos.length !== 1 ? 's' : ''} submitted</span>
            </div>
          )}

          {status === 'rejected' && signOff?.reason && (
            <div className="mt-2 p-3 rounded-lg bg-[var(--accent-escalate)]/8 border border-[var(--accent-escalate)]/20">
              <p className="mono text-xs font-semibold text-[var(--accent-escalate)] mb-1 uppercase tracking-wider">Rejection reason</p>
              <p className="text-sm text-[var(--accent-escalate)]">{signOff.reason}</p>
            </div>
          )}

          {status === 'signed_off' && (
            <div className="mt-2 p-3 rounded-lg bg-[var(--accent-signoff)]/8 border border-[var(--accent-signoff)]/20 flex items-center gap-2">
              <Check size={14} className="text-[var(--accent-signoff)] flex-shrink-0" />
              <p className="text-sm text-[var(--accent-signoff)] font-medium">
                Approved{signOff?.created_at ? ` · ${formatNZDateTime(signOff.created_at)}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Step-by-step detail */}
        <div className="bg-white border border-[var(--ink-100)] rounded-lg px-4">
          {steps.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--ink-500)]">
              Step details not available (SOP may have been updated).
            </p>
          ) : (
            steps.map((step) => (
              <CompletionStepRow
                key={step.id}
                stepNumber={step.step_number}
                stepText={step.text}
                completedAt={stepData[step.id] ?? null}
                photos={(photosByStep.get(step.id) ?? []).map((p) => ({
                  id: p.id,
                  signedUrl: p.signed_url,
                  contentType: p.content_type,
                }))}
              />
            ))
          )}
        </div>
      </div>
    </>
  )
}
