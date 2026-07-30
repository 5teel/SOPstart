'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, Check, X } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { CompletionStepRow } from '@/components/activity/CompletionStepRow'
import { RejectReasonSheet } from '@/components/activity/RejectReasonSheet'
import { signOffCompletion, recordSignature } from '@/actions/completions'
import { requestAssessorReview } from '@/actions/observations'
import type { CompletionStatus } from '@/types/sop'

// sessionStorage key for roster identity (set by RosterSelector on shared devices — D-11)
const ROSTER_STORAGE_KEY = 'safestart_roster_worker_id'

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
  sopId: string
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
  currentUserId: string
  isAssessor: boolean
  canOverride: boolean
}

// Phase 37 ASR-01/D-08: plain-language copy for a supervisor blocked from
// approving because they are not themselves signed off on this SOP.
const NOT_ASSESSOR_COPY = 'You need to be signed off on this SOP yourself before you can assess others on it'
// D-05: honesty copy shown before an admin/safety_manager override commits.
const OVERRIDE_DISCLOSURE_COPY = 'This will be recorded as an assessor override with your reason, visible in the audit trail.'

function mapSignOffError(error: string): string {
  if (error === 'NOT_SIGNED_OFF_ASSESSOR') return NOT_ASSESSOR_COPY + '.'
  if (error === 'ASSESSOR_OVERRIDE_REQUIRED') return 'An override reason (10+ characters) is required to approve without assessor status.'
  return error
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
  sopId,
  sopTitle,
  sopVersion,
  status: initialStatus,
  submittedAt,
  stepData,
  workerName,
  workerId,
  steps,
  photos,
  signOff: initialSignOff,
  isSupervisor,
  currentUserId,
  alreadySigned: initialAlreadySigned,
  isAssessor,
  canOverride,
}: CompletionDetailClientProps) {
  const [status, setStatus] = useState<CompletionStatus>(initialStatus)
  const [signOff, setSignOff] = useState<SignOff | null>(initialSignOff)
  const [alreadySigned, setAlreadySigned] = useState(initialAlreadySigned)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false)
  const [overrideSheetOpen, setOverrideSheetOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [requestingAssessment, setRequestingAssessment] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  const totalPhotoCount = photos.length
  // Phase 37 ASR-01: the client's blocked/disabled state is UX only —
  // signOffCompletion recomputes isSignedOffAssessor server-side and is the
  // real authority (T-37-04-01).
  const blockedFromApproving = !isAssessor

  async function handleApprove(withOverrideReason?: string) {
    if (isApproving) return
    setIsApproving(true)
    setActionError(null)
    try {
      const result = await signOffCompletion({
        completionId,
        decision: 'approved',
        overrideReason: withOverrideReason,
      })
      if (result.success) {
        setStatus('signed_off')
        setAlreadySigned(true)
        setSignOff({ id: '', supervisor_id: '', decision: 'approved', reason: null, created_at: new Date().toISOString() })
        setOverrideSheetOpen(false)
        setOverrideReason('')

        // D-10 / AFL-VER-05: Record supervisor counter-signature bound to roster identity.
        // On shared devices, the supervisor's roster id is stored in sessionStorage by RosterSelector.
        // On personal-login devices, fall back to the supervisor's own user id (currentUserId).
        // Using workerId here would record the WORKER's uid as the supervisor roster id,
        // corrupting the sign-off chain (WR-05 fix).
        // recordSignature is best-effort — sign-off is already committed above; signature
        // failure is non-fatal (logged only). The completion is legally recorded via signOffCompletion.
        const supervisorRosterId = sessionStorage.getItem(ROSTER_STORAGE_KEY) ?? currentUserId
        if (supervisorRosterId) {
          recordSignature({
            completionId,
            role: 'supervisor',
            rosterUserId: supervisorRosterId,
          }).catch((err) => {
            console.warn('recordSignature (supervisor) failed — non-fatal:', err)
          })
        }
      } else {
        // T-37-04-01: the server is the authority and can differ from the
        // client's blocked state (e.g. a needs_support reset landing between
        // render and click) — map both gate error codes to human copy.
        // WR-04: if the server demanded an override that the stale-true
        // client-side isAssessor never routed through handleApproveClick's
        // sheet-opening branch, open the sheet now so the demand is
        // actionable instead of a dead end — the error copy below still
        // explains why. Safe to call when the sheet is already open (the
        // override-confirm re-entry path with a too-short reason): setting
        // an already-true state is a no-op.
        if (result.error === 'ASSESSOR_OVERRIDE_REQUIRED' && canOverride) {
          setOverrideSheetOpen(true)
        }
        setActionError(mapSignOffError(result.error))
      }
    } catch {
      setActionError('An unexpected error occurred.')
    } finally {
      setIsApproving(false)
    }
  }

  function handleApproveClick() {
    if (blockedFromApproving && canOverride) {
      setOverrideSheetOpen(true)
      return
    }
    void handleApprove()
  }

  async function handleRequestAssessment() {
    if (requestingAssessment) return
    setRequestingAssessment(true)
    try {
      const result = await requestAssessorReview(sopId)
      if (result.success) setRequestSent(true)
    } finally {
      setRequestingAssessment(false)
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
      <div className={`px-4 py-6 max-w-5xl mx-auto ${showSignOffBar ? 'pb-[100px]' : ''}`}>

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
          <div className="flex flex-col gap-3 max-w-5xl mx-auto">
            {/* Phase 37 D-08: blocked-supervisor teaching state — the reject
                control below is UNAFFECTED by this and stays fully enabled. */}
            {blockedFromApproving && !canOverride && (
              <div className="p-3 rounded-xl bg-[var(--paper-2)] border border-[var(--ink-100)]">
                <p className="text-sm text-[var(--ink-900)] mb-2">{NOT_ASSESSOR_COPY}</p>
                {requestSent ? (
                  <p className="text-sm text-[var(--accent-signoff)] font-medium">
                    Request sent — an admin or safety manager will be notified
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestAssessment}
                    disabled={requestingAssessment}
                    className="text-sm font-semibold text-[var(--accent-measure)] hover:underline disabled:opacity-50"
                  >
                    {requestingAssessment ? 'Sending…' : 'Request assessment'}
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleApproveClick}
                disabled={isApproving || isRejecting || (blockedFromApproving && !canOverride)}
                className={`flex-1 h-[72px] rounded-xl font-bold text-base bg-[var(--accent-signoff)] text-white flex items-center justify-center gap-2 transition-opacity ${
                  isApproving || isRejecting || (blockedFromApproving && !canOverride) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
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
        </div>
      )}

      <RejectReasonSheet
        isOpen={rejectSheetOpen}
        onClose={() => setRejectSheetOpen(false)}
        onConfirm={handleRejectConfirm}
        isSubmitting={isRejecting}
      />

      {/* Phase 37 D-05: progressive-disclosure override reason sheet for
          admin/safety_manager approving without assessor status. Added
          inline (not a fork of RejectReasonSheet) since that sheet hardcodes
          its own title/copy. */}
      {overrideSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[var(--ink-900)]/40 backdrop-blur-sm"
            onClick={() => setOverrideSheetOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] px-4 flex flex-col gap-4 border-t border-[var(--ink-100)]"
            role="dialog"
            aria-modal="true"
            aria-label="Assessor override"
          >
            <div className="w-10 h-1 bg-[var(--ink-300)] rounded-full mx-auto mb-2" />
            <h2 className="text-lg font-semibold text-[var(--ink-900)]">Approve as assessor override</h2>
            <p className="text-sm text-[var(--ink-500)] -mt-2">{OVERRIDE_DISCLOSURE_COPY}</p>
            <div className="border-t border-[var(--ink-100)]" />
            <div className="flex flex-col gap-1">
              <label htmlFor="override-reason" className="text-sm font-semibold text-[var(--ink-900)]">
                Reason for override
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <textarea
                id="override-reason"
                className="w-full bg-[var(--paper-2)] border border-[var(--ink-100)] rounded-xl text-base text-[var(--ink-900)] p-3 resize-none min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[var(--accent-signoff)]/30 placeholder:text-[var(--ink-300)]"
                placeholder="e.g. I've directly verified this worker's competence on this task."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value.slice(0, 500))}
                disabled={isApproving}
              />
              <span className="mono text-xs text-[var(--ink-500)] text-right tabular-nums">{overrideReason.length}/500</span>
            </div>
            <button
              type="button"
              onClick={() => void handleApprove(overrideReason.trim())}
              disabled={overrideReason.trim().length < 10 || isApproving}
              className={`w-full h-[72px] rounded-xl font-bold text-lg bg-[var(--accent-signoff)] text-white flex items-center justify-center gap-2 transition-opacity ${
                overrideReason.trim().length < 10 || isApproving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
              }`}
            >
              <Check size={20} />
              {isApproving ? 'Approving…' : 'Confirm override'}
            </button>
            <button
              type="button"
              onClick={() => setOverrideSheetOpen(false)}
              disabled={isApproving}
              className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)] text-center mt-1 py-2 cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </>
  )
}
