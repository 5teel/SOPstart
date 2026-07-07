'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, ClipboardCheck, AlertTriangle, Zap, Lightbulb, Wrench, Clock } from 'lucide-react'
import type { SopWithSections, SopSection } from '@/types/sop'
import { useWalkthroughStore } from '@/stores/walkthrough'
import { ReadAloudButton, stepSpeechText } from '@/components/sop/voice/ReadAloudButton'
import { useCompletionStore } from '@/stores/completionStore'
import { PageShell } from '@/components/layout/PageShell'
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

  // PERF: drive currentStep from local state, not the URL — see the same
  // comment in MobileWalkthrough.tsx for full rationale.
  const [localStepId, setLocalStepId] = useState<string | null>(
    () => search.get('step') ?? allSteps[0]?.id ?? null
  )
  useEffect(() => {
    const urlStep = search.get('step')
    if (urlStep && urlStep !== localStepId) {
      setLocalStepId(urlStep)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.toString()])

  const currentId = localStepId ?? allSteps[0]?.id
  const currentIdx = Math.max(0, allSteps.findIndex((s) => s.id === currentId))
  const currentStep = allSteps[currentIdx]
  const prevStep = allSteps[currentIdx - 1]
  const nextStep = allSteps[currentIdx + 1]
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
        setLocalStepId(targetId)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          params.set('step', targetId)
          const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`
          window.history.replaceState(window.history.state, '', newUrl)
        }
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
    (stepId: string) => {
      setLocalStepId(stepId)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        params.set('step', stepId)
        const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`
        window.history.replaceState(window.history.state, '', newUrl)
      }
      void upsertWalkthroughProgress({ sopId: sop.id, stepId })
    },
    [sop.id]
  )

  const handleAcknowledgeNext = useCallback(() => {
    if (!currentStep) return
    // PERF: sync in-memory updates + navigation first; Dexie writes
    // happen in the background via fire-and-forget. The completionStore
    // sets state synchronously so the order here is safe even on first
    // click (no need to await startCompletion).
    walkthroughStore.markStepAcknowledged(sopId, currentStep.id)
    walkthroughStore.markStepComplete(sopId, currentStep.id)
    const next = allSteps.slice(currentIdx + 1).find((s) => !completedSteps.has(s.id))
    if (next) void handleStepChange(next.id)
    if (!activeCompletion) {
      void completionStore.startCompletion(sopId, sop.version)
    }
    void completionStore.markStepCompleted(sopId, currentStep.id)
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
        // Phase 15 polish: preserve walkthrough state so the worker can
        // re-enter and re-read any step freely. resetWalkthrough is only
        // called from the explicit "Start another walkthrough" action.
        walkthroughStore.markWalkthroughSubmitted(sopId)
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
    const firstStepId = allSteps[0]?.id
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-8 text-center"
        data-walkthrough="desktop"
      >
        <CheckCircle2 size={96} className="text-green-500" />
        <div>
          <p className="text-4xl font-bold text-[var(--ink-900)] mb-3">Completion submitted</p>
          <p className="text-xl text-[var(--ink-500)]">Your supervisor has been notified.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-testid="reread-steps"
            onClick={() => {
              setSubmitted(false)
              if (firstStepId) {
                const params = new URLSearchParams(search.toString())
                params.set('step', firstStepId)
                router.push(`?${params.toString()}`, { scroll: false })
              }
            }}
            className="min-h-[60px] px-10 rounded-xl bg-[var(--ink-900)] text-[var(--paper)] text-xl font-bold hover:opacity-90 transition-opacity"
          >
            Re-read steps
          </button>
          <button
            type="button"
            onClick={() => { setSubmitted(false); walkthroughStore.resetWalkthrough(sopId) }}
            className="min-h-[60px] px-10 rounded-xl border border-[var(--ink-300)] text-lg font-medium text-[var(--ink-700)] hover:border-[var(--ink-900)] transition-colors"
          >
            Start another walkthrough
          </button>
        </div>
      </div>
    )
  }

  const isSubmittedSop = walkthroughStore.isSubmitted(sopId)

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
        <PageShell width="lg" paddingX="px-8" paddingY="py-12" animateKey={`wt-${sopId}`}>
          {/*
            Phase 15 polish: walkthrough laid out with a CSS grid of named
            regions (see globals.css `.walkthrough-step-grid`). Empty regions
            (no warning / no tools / no time estimate) collapse to zero, but
            the action bar's grid position is locked at the bottom — no more
            "jumpy" step-to-step layout shifts.

            The keyed wrapper around the swappable regions cross-fades each
            step in (~140ms). Action bar is OUTSIDE the keyed region so it
            doesn't restart its animation on every click.
          */}
          <div className="walkthrough-step-grid">
            <div key={currentStep.id} className="step-fade-in contents">
              <div data-region="meta" className="flex items-center gap-3">
                <span
                  className="mono text-base uppercase tracking-wider text-[var(--ink-500)]"
                  data-testid="step-counter"
                >
                  Step {currentIdx + 1} of {totalSteps}
                  {currentSection?.title ? ` · ${currentSection.title}` : ''}
                </span>
                <ReadAloudButton text={stepSpeechText(currentStep)} />
              </div>

              <div data-region="title">
                <h2
                  className="text-4xl font-semibold text-[var(--ink-900)] leading-tight"
                  data-testid="step-title"
                >
                  {currentStep.text}
                </h2>
              </div>

              <div data-region="callouts" className="flex flex-col gap-3">
                {currentStep.warning && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--accent-escalate)]/10 border border-[var(--accent-escalate)]/30">
                    <AlertTriangle
                      className="h-6 w-6 text-[var(--accent-escalate)] flex-shrink-0 mt-0.5"
                    />
                    <p className="text-lg text-[var(--accent-escalate)]" data-testid="step-warning">
                      {currentStep.warning}
                    </p>
                  </div>
                )}
                {currentStep.caution && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--accent-decision)]/10 border border-[var(--accent-decision)]/30">
                    <Zap className="h-6 w-6 text-[var(--accent-decision)] flex-shrink-0 mt-0.5" />
                    <p className="text-lg text-[var(--accent-decision)]">{currentStep.caution}</p>
                  </div>
                )}
                {currentStep.tip && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--ink-50)] border border-[var(--ink-100)]">
                    <Lightbulb className="h-6 w-6 text-[var(--ink-500)] flex-shrink-0 mt-0.5" />
                    <p className="text-lg text-[var(--ink-500)]">{currentStep.tip}</p>
                  </div>
                )}
              </div>

              <div data-region="context" className="flex flex-col gap-3">
                {currentStep.required_tools && currentStep.required_tools.length > 0 && (
                  <div>
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
                  <div className="flex items-center gap-2 text-lg text-[var(--ink-500)]">
                    <Clock className="h-5 w-5" />
                    Estimated: {currentStep.time_estimate_minutes} min
                  </div>
                )}
              </div>

              {/* Subtle hint pinned just above the action bar — only shown
                  when the step has no warnings, cautions or tips. Keeps
                  short steps from looking empty without dominating the
                  layout the way the old big-text "body" card did. */}
              {!currentStep.warning && !currentStep.caution && !currentStep.tip && (
                <p
                  data-region="hint"
                  className="text-sm text-[var(--ink-400)] italic text-center"
                >
                  Follow the step as written above.
                </p>
              )}
            </div>

            {/* Action bar — outside the keyed wrapper so it doesn't re-animate */}
            <div data-region="action" className="flex items-center justify-between gap-6 pt-2">
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

            {isSubmittedSop ? (
              <div className="flex items-center gap-4">
                <div
                  data-testid="walkthrough-already-submitted"
                  className="min-h-[60px] px-6 rounded-xl border border-[var(--ink-200)] bg-[var(--ink-50)] flex items-center gap-3 text-lg font-semibold text-[var(--ink-700)]"
                >
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  Already submitted — re-reading
                </div>
                <button
                  type="button"
                  disabled={!nextStep}
                  onClick={() => nextStep && void handleStepChange(nextStep.id)}
                  className="min-h-[60px] px-8 rounded-xl bg-[var(--ink-900)] text-[var(--paper)] text-xl font-bold flex items-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:pointer-events-none"
                  data-testid="review-next"
                >
                  Next
                  <span aria-hidden>→</span>
                </button>
              </div>
            ) : allDone ? (
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
                className="min-h-[60px] px-10 rounded-xl bg-[var(--ink-900)] text-[var(--paper)] text-xl font-bold flex items-center gap-3 hover:opacity-90 transition-transform duration-100 active:scale-[0.97]"
                data-testid="ack-next"
              >
                I&apos;ve done this — Next
                <span aria-hidden>→</span>
              </button>
            )}
            </div>
          </div>
        </PageShell>
      )}
    </div>
  )
}
