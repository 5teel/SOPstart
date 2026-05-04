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
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', ' ·')
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
        setSignOff({ id: '', supervisor_id: '', decision: 'approved', reason: null, created_at: new Date().toISOString() })
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
        setSignOff({ id: '', supervisor_id: '', decision: 'rejected', reason, created_at: new Date().toISOString() })
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

  const photosByStep = new Map<string, Photo[]>()
  for (const photo of photos) {
    const existing = photosByStep.get(photo.step_id) ?? []
    existing.push(photo)
    photosByStep.set(photo.step_id, existing)
  }

  const showSignOffBar = isSupervisor && !alreadySigned

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[var(--paper)] border-b border-[var(--ink-100)] px-4 flex items-center gap-3 h-[56px]">
        <Link
          href="/activity"
          className="flex items-center gap-1.5 text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Activity</span>
        </Link>
        <span className="text-[var(--ink-300)] mx-1">|</span>
        <h1 className="text-sm font-semibold text-[var(--ink-900)] truncate">Completion Detail</h1>
      </div>

      {/* Page content */}
      <div className={`px-4 py-6 max-w-2xl mx-auto ${showSignOffBar ? 'pb-[100px]' : ''}`}>

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

          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[var(--paper-2)] border border-[var(--ink-100)] flex items-center justify-center text-xs font-bold text-[var(--ink-700)] flex-shrink-0">
              {getInitials(workerName)}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--ink-900)]">{workerName}</p>
              <p className="mono text-xs text-[var(--ink-500)]">{formatNZDateTime(submittedAt)}</p>
            </div>
          </div>

          {totalPhotoCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-500)] mb-3">
              <Camera size={13} />
              <span className="font-bold tabular-nums">{totalPhotoCount}</span>
              <span>photo{totalPhotoCount !== 1 ? 's' : ''} submitted</span>
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

        {actionError && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--accent-escalate)]/8 border border-[var(--accent-escalate)]/20">
            <p className="text-sm text-[var(--accent-escalate)]">{actionError}</p>
          </div>
        )}

        {/* Step-by-step detail */}
        <div className="bg-white border border-[var(--ink-100)] rounded-xl px-4">
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
                  storagePath: p.storage_path,
                  signedUrl: p.signed_url,
                  contentType: p.content_type,
                }))}
              />
            ))
          )}
        </div>
      </div>

      {/* Sign-off bar (supervisor only) */}
      {showSignOffBar && (
        <div className="sticky bottom-0 z-30 bg-[var(--paper)] border-t border-[var(--ink-100)] px-4 pt-3 pb-3">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className={`flex-1 h-[72px] rounded-xl font-bold text-base bg-[var(--accent-signoff)] text-white flex items-center justify-center gap-2 transition-opacity ${
                isApproving || isRejecting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
              }`}
            >
              <Check size={20} />
              {isApproving ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => setRejectSheetOpen(true)}
              disabled={isApproving || isRejecting}
              className={`flex-1 h-[72px] rounded-xl font-bold text-base bg-white border-2 border-[var(--accent-escalate)] text-[var(--accent-escalate)] flex items-center justify-center gap-2 transition-opacity ${
                isApproving || isRejecting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--accent-escalate)]/5'
              }`}
            >
              <X size={20} />
              Reject
            </button>
          </div>
        </div>
      )}

      <RejectReasonSheet
        isOpen={rejectSheetOpen}
        onClose={() => setRejectSheetOpen(false)}
        onConfirm={handleRejectConfirm}
        isSubmitting={isRejecting}
      />
    </>
  )
}
