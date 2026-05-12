'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, ClipboardCheck, AlertTriangle, Zap, Lightbulb, Wrench, Clock } from 'lucide-react'
import type { SopWithSections, SopSection } from '@/types/sop'
import { useWalkthroughStore } from '@/stores/walkthrough'
import { useCompletionStore } from '@/stores/completionStore'
import { SafetyAcknowledgement } from '@/components/sop/SafetyAcknowledgement'
import { submitCompletion } from '@/actions/completions'
import { upsertWalkthroughProgress } from '@/actions/walkthrough-progress'
import { db } from '@/lib/offline/db'

/**
 * Phase 15 — DesktopWalkthrough (D-01..D-04).
 *
 * Big-text single-step-per-viewport variant designed for a Visy operator
 * seated at a control-room desk (22"+ HD monitor at ~600mm). Body text is
 * 24px+ so it's far-readable; the primary "I've done this — Next" button
 * is 60px+ tall so it's gloves-friendly when the operator stands to
 * acknowledge (D-19).
 *
 * Bundle isolation contract: this file is dynamic-imported via
 * `next/dynamic({ ssr: false })` from WalkthroughSwitcher ONLY. The
 * Wave 0 lint guard (tests/lint/no-static-desktop-import.spec.ts)
 * enforces no other static import. See SB-LINE-06.
 */
export function DesktopWalkthrough({ sop }: { sop: SopWithSections }) {
  const router = useRouter()
  const search = useSearchParams()
  const walkthroughStore = useWalkthroughStore()
  const completionStore = useCompletionStore()

  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    void completionStore.restoreFromDexie(sop.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sop.id])

  const sopId = sop.id
  const acknowledged = walkthroughStore.isAcknowledged(sopId)
  const completedSteps = walkthroughStore.getCompletedSteps(sopId)
  const activeCompletion = completionStore.getActiveCompletion(sopId)

  const allSteps = sop.sop_sections.flatMap((s) => s.sop_steps ?? [])
  const totalSteps = allSteps.length
  const completedCount = completedSteps.size
  const allDone = totalSteps > 0 && completedCount >= totalSteps

  const currentId = search.get('step') ?? allSteps[0]?.id
  const currentIdx = Math.max(0, allSteps.findIndex((s) => s.id === currentId))
  const currentStep = allSteps[currentIdx]
  const prevStep = allSteps[currentIdx - 1]
  const currentSection =
    sop.sop_sections.find((s) => (s.sop_steps ?? []).some((st) => st.id === currentStep?.id)) ?? null

  // ── Phase 15 D-19 / D-20: sequential ack-trace forward-jump guard ────
  const allStepIds = allSteps.map((s) => s.id)
  const highestAckIdx = useWalkthroughStore((s) =>
    s.getHighestAckIndex(sopId, allStepIds)
  )
  useEffect(() => {
    if (!currentStep) return
    const requestedIdx = allSteps.findIndex((s) => s.id === currentStep.id)
    if (requestedIdx > highestAckIdx + 1) {
      const targetId = allSteps[highestAckIdx + 1]?.id ?? allSteps[0]?.id
      if (targetId && targetId !== currentStep.id) {
        const params = new URLSearchParams(search.toString())
        params.set('step', targetId)
        router.replace(`?${params.toString()}`, { scroll: false })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id, highestAckIdx])

  const sections = sop.sop_sections
  const hazardsSection = sections.find((s) => s.section_type.includes('hazard')) as SopSection | undefined
  const ppeSection = sections.find((s) =>
    s.section_type.includes('ppe') || s.section_type.includes('protective')
  ) as SopSection | undefined
  const emergencySection = sections.find((s) => s.section_type.includes('emergency')) as SopSection | undefined

  const handleStepChange = useCallback(
    async (stepId: string) => {
      const params = new URLSearchParams(search.toString())
      params.set('step', stepId)
      router.push(`?${params.toString()}`, { scroll: false })
      void upsertWalkthroughProgress({ sopId: sop.id, stepId })
    },
    [router, search, sop.id]
  )

  const handleAcknowledgeNext = useCallback(async () => {
    if (!currentStep) return
    if (!activeCompletion) {
      await completionStore.startCompletion(sopId, sop.version)
    }
    // D-19: explicit sequential ack — record before advancing.
    walkthroughStore.markStepAcknowledged(sopId, currentStep.id)
    walkthroughStore.markStepComplete(sopId, currentStep.id)
    await completionStore.markStepCompleted(sopId, currentStep.id)
    const next = allSteps.slice(currentIdx + 1).find((s) => !completedSteps.has(s.id))
    if (next) void handleStepChange(next.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, activeCompletion, allSteps, currentIdx, completedSteps])

  async function handleSubmit() {
    if (!activeCompletion) return
    setSubmitLoading(true)
    setSubmitError(null)
    try {
      const canonical = [...allSteps]
        .sort((a, b) => a.step_number - b.step_number)
        .map((s) => `${s.step_number}:${s.text}`)
        .join('|')
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
      const contentHash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      await db.completions.update(activeCompletion.localId, { contentHash, status: 'submitted' })

      const stepAckTrace = walkthroughStore.getAckTrace(sopId)
      const result = await submitCompletion({
        localId: activeCompletion.localId,
        sopId,
        sopVersion: sop.version,
        contentHash,
        stepData: activeCompletion.stepCompletions,
        photoStoragePaths: [],
        stepAckTrace,
      })

      if (result.success) {
        await completionStore.clearCompletion(sopId)
        walkthroughStore.resetWalkthrough(sopId)
        setSubmitted(true)
      } else {
        await db.completions.update(activeCompletion.localId, { status: 'in_progress' })
        setSubmitError(result.error)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitLoading(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-6 text-center"
        data-walkthrough="desktop"
      >
        <CheckCircle2 size={96} className="text-green-500" />
        <div>
          <p className="text-4xl font-bold text-[var(--ink-900)] mb-3">Completion submitted</p>
          <p className="text-xl text-[var(--ink-500)]">Your supervisor has been notified.</p>
        </div>
      </div>
    )
  }

  if (!currentStep) {
    return (
      <div
        className="flex items-center justify-center min-h-[60vh]"
        data-walkthrough="desktop"
      >
        <p className="text-2xl text-[var(--ink-500)]">No steps available.</p>
      </div>
    )
  }

  return (
    <div className="responsive-walkthrough-root" data-walkthrough="desktop">
      {/* Safety acknowledgement gate */}
      {!acknowledged && (
        <SafetyAcknowledgement
          sopId={sopId}
          hazardsSection={hazardsSection}
          ppeSection={ppeSection}
          emergencySection={emergencySection}
          onAcknowledge={() => walkthroughStore.acknowledgeSafety(sopId)}
        />
      )}

      {acknowledged && (
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Step counter — blueprint mono */}
          <div className="mb-6">
            <span
              className="mono text-base uppercase tracking-wider text-[var(--ink-500)]"
              data-testid="step-counter"
            >
              Step {currentIdx + 1} of {totalSteps}
              {currentSection?.title ? ` · ${currentSection.title}` : ''}
            </span>
          </div>

          {/* Step body — big-text variant per D-01 */}
          <article className="blueprint-frame bg-[var(--paper)] border border-[var(--ink-100)] rounded-xl p-10">
            <h2
              className="text-4xl font-semibold text-[var(--ink-900)] leading-tight mb-6"
              data-testid="step-title"
            >
              {currentStep.text}
            </h2>

            <div
              className="text-2xl text-[var(--ink-700)] leading-relaxed"
              data-testid="step-body"
              style={{ fontSize: '1.5rem' /* 24px — D-01 floor */ }}
            >
              {/* Reserved slot for sub-text / instructions; the SopStep
                  model doesn't currently carry a long-form body, so we
                  surface tools/warnings/cautions/tips below at ≥18px. */}
              {currentStep.warning || currentStep.caution || currentStep.tip ? null : (
                <span className="text-[var(--ink-500)]">Follow the step as written above.</span>
              )}
            </div>

            {/* Secondary text — warnings/cautions/tips at ≥18px (text-lg = 18px) */}
            {currentStep.warning && (
              <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-[var(--accent-escalate)]/10 border border-[var(--accent-escalate)]/30">
                <AlertTriangle
                  className="h-6 w-6 text-[var(--accent-escalate)] flex-shrink-0 mt-0.5"
                />
                <p className="text-lg text-[var(--accent-escalate)]" data-testid="step-warning">
                  {currentStep.warning}
                </p>
              </div>
            )}
            {currentStep.caution && (
              <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-[var(--accent-decision)]/10 border border-[var(--accent-decision)]/30">
                <Zap className="h-6 w-6 text-[var(--accent-decision)] flex-shrink-0 mt-0.5" />
                <p className="text-lg text-[var(--accent-decision)]">{currentStep.caution}</p>
              </div>
            )}
            {currentStep.tip && (
              <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-[var(--ink-50)] border border-[var(--ink-100)]">
                <Lightbulb className="h-6 w-6 text-[var(--ink-500)] flex-shrink-0 mt-0.5" />
                <p className="text-lg text-[var(--ink-500)]">{currentStep.tip}</p>
              </div>
            )}

            {currentStep.required_tools && currentStep.required_tools.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-5 w-5 text-[var(--ink-500)]" />
                  <span className="mono text-sm uppercase tracking-wider text-[var(--ink-500)]">
                    Tools required
                  </span>
                </div>
                <ul className="space-y-1 ml-7">
                  {currentStep.required_tools.map((tool, i) => (
                    <li key={i} className="text-lg text-[var(--ink-700)]">
                      • {tool}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {currentStep.time_estimate_minutes != null && (
              <div className="mt-6 flex items-center gap-2 text-lg text-[var(--ink-500)]">
                <Clock className="h-5 w-5" />
                Estimated: {currentStep.time_estimate_minutes} min
              </div>
            )}
          </article>

          {/* Action bar */}
          <div className="mt-8 flex items-center justify-between gap-6">
            <button
              type="button"
              disabled={!prevStep}
              onClick={() => prevStep && void handleStepChange(prevStep.id)}
              className="text-base font-medium text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors disabled:opacity-30 disabled:pointer-events-none px-4 py-2"
            >
              ← Back
            </button>

            {submitError && (
              <p className="text-base text-[var(--accent-escalate)]">{submitError}</p>
            )}

            {allDone ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitLoading}
                className="min-h-[60px] px-10 rounded-xl bg-[var(--accent-decision)] text-white text-xl font-bold flex items-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50"
                data-testid="ack-next"
              >
                <ClipboardCheck className="h-6 w-6" />
                {submitLoading ? 'Submitting…' : 'Sign off & submit'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAcknowledgeNext}
                className="min-h-[60px] px-10 rounded-xl bg-[var(--ink-900)] text-[var(--paper)] text-xl font-bold flex items-center gap-3 hover:opacity-90 transition-opacity"
                data-testid="ack-next"
              >
                I&apos;ve done this — Next
                <span aria-hidden>→</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
