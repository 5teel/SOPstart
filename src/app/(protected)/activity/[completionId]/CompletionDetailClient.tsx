'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, Check, X } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { CompletionStepRow } from '@/components/activity/CompletionStepRow'
import { RejectReasonSheet } from '@/components/activity/RejectReasonSheet'
import { signOffCompletion } from '@/actions/completions'
import type { CompletionStatus } from '@/types/sop'

interface Photo {
  id: string
  step_id: string
  storage_path: string
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
  completionId: string
  sopTitle: string | null
  sopVersion: number
  status: CompletionStatus
  submittedAt: string
  stepData: Record<string, number>
  workerName: string
  workerId: string
  steps: Step[]
  photos: Photo[]
  signOff: SignOff | null
  isSupervisor: boolean
  alreadySigned: boolean
}

function formatNZDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', ' ·')
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function CompletionDetailClient({
  completionId,
  sopTitle,
  sopVersion,
  status: initialStatus,
  submittedAt,
  stepData,
  workerName,
  steps,
  photos,
  signOff: initialSignOff,
  isSupervisor,
  alreadySigned: initialAlreadySigned,
}: CompletionDetailClientProps) {
  const [status, setStatus] = useState<CompletionStatus>(initialStatus)
  const [signOff, setSignOff] = useState<SignOff | null>(initialSignOff)
  const [alreadySigned, setAlreadySigned] = useState(initialAlreadySigned)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const totalPhotoCount = photos.length

  async function handleApprove() {
    if (isApproving) return
    setIsApproving(true)
    setActionError(null)
    try {
      const result = await signOffCompletion({ completionId, decision: 'approved' })
      if (result.success) {
        setStatus('signed_off')
        setAlreadySigned(true)
        setSignOff({
          id: '',
          supervisor_id: '',
          decision: 'approved',
          reason: null,
          created_at: new Date().toISOString(),
        })
      } else {
        setActionError(result.error)
      }
    } catch {
      setActionError('An unexpected error occurred.')
    } finally {
      setIsApproving(false)
    }
  }

  async function handleRejectConfirm(reason: string) {
    setIsRejecting(true)
    setActionError(null)
    try {
      const result = await signOffCompletion({ completionId, decision: 'rejected', reason })
      if (result.success) {
        setStatus('rejected')
        setAlreadySigned(true)
        setSignOff({
          id: '',
          supervisor_id: '',
          decision: 'rejected',
          reason,
          created_at: new Date().toISOString(),
        })
        setRejectSheetOpen(false)
      } else {
        setActionError(result.error)
      }
    } catch {
      setActionError('An unexpected error occurred.')
    } finally {
      setIsRejecting(false)
    }
  }

  // Organize photos by step_id
  const photosByStep = new Map<string, Photo[]>()
  for (const photo of photos) {
    const existing = photosByStep.get(photo.step_id) ?? []
    existing.push(photo)
    photosByStep.set(photo.step_id, existing)
  }

  // Content bottom padding: if sign-off bar visible, needs extra space
  const showSignOffBar = isSupervisor && !alreadySigned
  const contentPaddingClass = showSignOffBar ? 'pb-[100px]' : ''

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]">
        <Link
          href="/activity"
          className="flex items-center gap-1.5 text-steel-400 hover:text-steel-100 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Activity</span>
        </Link>
        <span className="text-steel-600 mx-1">|</span>
        <h1 className="text-sm font-semibold text-steel-100 truncate">Completion Detail</h1>
      </div>

      {/* Page content */}
      <div className={`px-4 py-6 max-w-2xl mx-auto ${contentPaddingClass}`}>

        {/* Completion Summary Banner */}
        <div className="bg-steel-800 rounded-xl p-5 mb-6 border border-steel-700">
          {/* SOP title + version + status */}
          <div className="flex items-start gap-2 flex-wrap mb-3">
            <h2 className="text-base font-semibold text-steel-100 flex-1 min-w-0">
              {sopTitle ?? 'Untitled SOP'}
            </h2>
            <span className="text-xs bg-steel-700 text-steel-400 px-2 py-0.5 rounded font-medium flex-shrink-0">
              v{sopVersion}
            </span>
            <StatusBadge status={status} />
          </div>

          {/* Worker info + date */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-steel-700 flex items-center justify-center text-xs font-bold text-steel-100 flex-shrink-0">
              {getInitials(workerName)}
            </div>
            <div>
              <p className="text-sm font-medium text-steel-200">{workerName}</p>
              <p className="text-xs text-steel-400">{formatNZDateTime(submittedAt)}</p>
            </div>
          </div>

          {/* Photo count */}
          {totalPhotoCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-steel-400 mb-3">
              <Camera size={13} />
              <span className="font-bold tabular-nums">{totalPhotoCount}</span>
              <span>photo{totalPhotoCount !== 1 ? 's' : ''} submitted</span>
            </div>
          )}

          {/* Rejection callout */}
          {status === 'rejected' && signOff?.reason && (
            <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-xs font-semibold text-red-400 mb-1">Rejection reason</p>
              <p className="text-sm text-red-300">{signOff.reason}</p>
            </div>
          )}

          {/* Approved strip */}
          {status === 'signed_off' && (
            <div className="mt-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2">
              <Check size={14} className="text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-400 font-medium">
                Approved{signOff?.created_at ? ` · ${formatNZDateTime(signOff.created_at)}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Action error */}
        {actionError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{actionError}</p>
          </div>
        )}

        {/* Step-by-step detail */}
        <div className="bg-steel-800 rounded-xl px-4 border border-steel-700">
          {steps.length === 0 ? (
            <p className="py-8 text-center text-sm text-steel-500">
              Step details not available (SOP may have been updated).
            </p>
          ) : (
            steps.map((step) => {
              const stepPhotos = photosByStep.get(step.id) ?? []
              const completedAt = stepData[step.id] ?? null

              return (
                <CompletionStepRow
                  key={step.id}
                  stepNumber={step.step_number}
                  stepText={step.text}
                  completedAt={completedAt}
                  photos={stepPhotos.map((p) => ({
                    id: p.id,
                    storagePath: p.storage_path,
                    signedUrl: p.signed_url,
                    contentType: p.content_type,
                  }))}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Sign-off action bar (supervisor only, not yet signed) */}
      {showSignOffBar && (
        <div className="sticky bottom-0 z-30 bg-steel-900 border-t border-steel-700 px-4 pt-3 pb-3">
          <div className="flex gap-3 max-w-2xl mx-auto">
            {/* Approve button */}
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className={`flex-1 h-[72px] rounded-xl font-bold text-base bg-green-500 text-white flex items-center justify-center gap-2 transition-opacity ${
                isApproving || isRejecting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'
              }`}
            >
              <Check size={20} />
              {isApproving ? 'Approving…' : 'Approve'}
            </button>

            {/* Reject button */}
            <button
              type="button"
              onClick={() => setRejectSheetOpen(true)}
              disabled={isApproving || isRejecting}
              className={`flex-1 h-[72px] rounded-xl font-bold text-base bg-steel-800 border-2 border-red-500 text-red-400 flex items-center justify-center gap-2 transition-opacity ${
                isApproving || isRejecting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500/10'
              }`}
            >
              <X size={20} />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Reject reason sheet */}
      <RejectReasonSheet
        isOpen={rejectSheetOpen}
        onClose={() => setRejectSheetOpen(false)}
        onConfirm={handleRejectConfirm}
        isSubmitting={isRejecting}
      />
    </>
  )
}
