'use client'

/**
 * Phase 21.5 (Plan 21.5-05) — BuilderStageShell
 *
 * SUPERSEDES the legacy Phase-21 builder shell (deleted in Phase 30 Plan 01).
 * This shell replaces its role and adds the 3-stage Build → Review
 * → Publish sequence (SPEC R1, R7, R8, R10).
 *
 * Architecture:
 *   - Migrates handlePublish, showPane, showVerifyGate, transcriptSegments
 *     VERBATIM from the legacy Phase-21 shell.
 *   - Owns activeStage (useState — no router.push per CLAUDE.md 2026-05-13).
 *   - Calls useVerifyChecklist(sopId) once at shell level so BuilderStageStepper,
 *     ReviewStation, and PublishStage share one source of gate truth.
 *   - Wraps all content in SourceViewerSelectionProvider (same as original).
 *
 * Stage routing:
 *   'build'   → BuilderClient (full-width, no orientation strip)
 *   'review'  → OrientationStrip + ReviewStation (only when hasSourceDoc)
 *   'publish' → PublishStage (sole publish trigger — Req 7)
 *
 * Adaptive stepper (SPEC R8):
 *   hasSourceDoc === true  → 3-stage: Build → Review → Publish
 *   hasSourceDoc === false → 2-stage: Build → Publish (skip Review + source)
 *
 * Safety gates (SPEC R10):
 *   - onStageSelect guards: ignores 'review' when !hasSourceDoc, 'publish'
 *     when !isReady (gate satisfied for !showVerifyGate source-less SOPs).
 *   - PublishStage is the ONLY mount of the publish button.
 *   - No VerifyProgressIndicator or bulk-verify affordance mounted here.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { DeleteSopButton } from '@/components/admin/DeleteSopButton'
import { BuilderClient } from './BuilderClient'
import { BuilderStageStepper } from './BuilderStageStepper'
import { BuilderFlowButton } from './BuilderFlowButton'
import { BuilderFlowEditButton } from './BuilderFlowEditButton'
import type { BuilderStage } from './BuilderStageStepper'
import { OrientationStrip } from './OrientationStrip'
import { ReviewStation } from './ReviewStation'
import { PublishStage } from './PublishStage'
import {
  SourceViewerSelectionProvider,
} from '@/components/admin/source-viewer/useSelectionSync'
import { useVerifyChecklist } from '@/components/admin/verify-checklist/useVerifyChecklist'
import { approveStep, requestChanges } from '@/actions/approvals'
import type { ApprovalStatus } from '@/actions/approvals'
import type { SopWithSections, ParseJob } from '@/types/sop'
import type { SourcePaneKind, TranscriptSegment } from '@/components/admin/source-viewer'

// ---------------------------------------------------------------------------
// Helpers — migrated verbatim from the legacy Phase-21 shell (CONV-12 logic)
// ---------------------------------------------------------------------------

function deriveSourcePaneKind(rawType: string | null | undefined): SourcePaneKind | null {
  if (!rawType) return null
  const v = rawType.toLowerCase()
  if (v === 'pdf') return 'pdf'
  if (v === 'docx' || v === 'doc') return 'docx'
  if (v === 'image' || v === 'scan' || v === 'jpg' || v === 'jpeg' || v === 'png') return 'scan'
  if (v === 'video' || v === 'mp4' || v === 'mov' || v === 'youtube') return 'video'
  return null
}

// ---------------------------------------------------------------------------
// ONE self-describing tools menu — Phase 33 (33-04, SC-6 winner decision #2)
//
// Absorbs the old SopActionsMenu (Assign / Versions / Video / QR /
// Delete-draft — Phase 30 30-07 UX-06) PLUS BuilderFlowButton +
// BuilderFlowEditButton, which render as menu rows below. Every item is a
// plain-language verb phrase about THIS SOP with a one-line hint — labels
// traced from the shipped code (sketches/builder-header-orientation
// README § Decisions 2026-07-19).
// ---------------------------------------------------------------------------

function ToolsMenu({
  sopId,
  isDraft,
  sop,
}: {
  sopId: string
  isDraft: boolean
  sop: SopWithSections
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const items: { label: string; hint: string; href: string }[] = [
    { label: 'Assign this SOP to workers', hint: 'choose who must do it and by when', href: `/admin/sops/${sopId}/assign` },
    { label: 'See earlier versions', hint: 'what changed, and when', href: `/admin/sops/${sopId}/versions` },
    { label: 'Make a training video', hint: 'turn these steps into a narrated video', href: `/admin/sops/${sopId}/video` },
    { label: 'Print a QR code', hint: 'stick it on the machine — scanning opens this SOP', href: `/admin/sops/${sopId}/qr` },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="tools-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tools for this SOP"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xs border border-[var(--ink-300)] bg-white px-3 text-[11px] text-[var(--ink-700)] hover:border-[var(--ink-900)] transition-colors"
      >
        Tools for this SOP
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Backdrop closes the menu on outside click */}
          <button
            type="button"
            aria-label="Close tools menu"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="Tools for this SOP"
            data-testid="tools-menu"
            className="absolute left-0 top-full z-50 mt-1.5 min-w-[300px] rounded-md border border-[var(--ink-300)] bg-white py-1 shadow-lg"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                role="menuitem"
                href={item.href}
                className="flex flex-col gap-0.5 px-3 py-2 hover:bg-[var(--paper-2)] transition-colors"
              >
                <span className="text-[12.5px] text-[var(--ink-900)]">{item.label}</span>
                <span className="text-[10.5px] text-[var(--ink-500)]">{item.hint}</span>
              </Link>
            ))}
            <div className="my-1 h-px bg-[var(--ink-100)]" />
            <BuilderFlowButton sop={sop} />
            <BuilderFlowEditButton sop={sop} sopId={sopId} />
            {isDraft && (
              <>
                <div className="my-1 h-px bg-[var(--ink-100)]" />
                <div role="menuitem">
                  <DeleteSopButton sopId={sopId} redirectTo="/admin/sops" showLabel />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuilderStageShellProps = {
  sopId: string
  initialSop: SopWithSections
  parseJob: ParseJob | null
  /** Phase 29 (29-04) — pending approval chain for this SOP, if any */
  approvalStatus?: ApprovalStatus | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BuilderStageShell({
  sopId,
  initialSop,
  parseJob,
  approvalStatus,
}: BuilderStageShellProps): React.JSX.Element {
  const router = useRouter()

  // ------------------------------------------------------------------
  // Source-doc derivation — VERBATIM from the legacy Phase-21 shell
  // ------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawType = (initialSop as any).source_file_type as string | null | undefined
  const sourceType = deriveSourcePaneKind(rawType)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceFilePath = (initialSop as any).source_file_path as string | null | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAiPrompt = ((initialSop as any).source_type ?? rawType) === 'ai_prompt'

  // CONV-12 backward-compat — mirrors the legacy Phase-21 shell exactly
  const showPane = !!sourceFilePath && !isAiPrompt && sourceType !== null
  const showVerifyGate = !!sourceFilePath && !isAiPrompt

  // Adaptive stepper mode: hasSourceDoc drives 3-stage vs 2-stage
  const hasSourceDoc = showPane

  // ------------------------------------------------------------------
  // Publish state — VERBATIM from the legacy Phase-21 shell
  // ------------------------------------------------------------------
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  const handlePublish = useCallback(async () => {
    setPublishError(null)
    setPublishing(true)
    try {
      const res = await fetch(`/api/sops/${sopId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          count?: number
        }
        if (body.error === 'unverified_blocks') {
          setPublishError(
            `Cannot publish — ${body.count ?? 'some'} block(s) still need verification.`,
          )
        } else {
          setPublishError(body.error || `Publish failed (${res.status})`)
        }
        return
      }
      // Success branch covers both outcomes: a straight publish, or the
      // chained-category divert ({ pendingApproval: true }) — NOT an error
      // (Phase 29 D29-03). Either way, refresh so the re-fetched
      // approvalStatus prop brings in the pending-chain panel if needed.
      const body = (await res.json().catch(() => ({}))) as { pendingApproval?: boolean }
      const enteredPendingApproval = body.pendingApproval === true
      if (enteredPendingApproval) console.info('[handlePublish] entered pending approval')
      router.refresh()
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }, [sopId, router])

  // ------------------------------------------------------------------
  // Approval chain actions — Phase 29 (29-04)
  // ------------------------------------------------------------------
  const [approvalActionPending, setApprovalActionPending] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  const handleApproveStep = useCallback(
    async (comment?: string) => {
      setApprovalError(null)
      setApprovalActionPending(true)
      try {
        const result = await approveStep(sopId, comment)
        if ('error' in result) {
          setApprovalError(result.error)
          return
        }
        router.refresh()
      } finally {
        setApprovalActionPending(false)
      }
    },
    [sopId, router],
  )

  const handleRequestChanges = useCallback(
    async (comment: string) => {
      setApprovalError(null)
      setApprovalActionPending(true)
      try {
        const result = await requestChanges(sopId, comment)
        if ('error' in result) {
          setApprovalError(result.error)
          return
        }
        router.refresh()
      } finally {
        setApprovalActionPending(false)
      }
    },
    [sopId, router],
  )

  // ------------------------------------------------------------------
  // Transcript segments — VERBATIM from the legacy Phase-21 shell
  // ------------------------------------------------------------------
  const transcriptSegments: TranscriptSegment[] = []
  if (sourceType === 'video' && parseJob) {
    const raw = (parseJob as unknown as { transcript_segments?: unknown }).transcript_segments
    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        const r = raw[i] as { id?: string; start?: number; end?: number; text?: string }
        if (
          r &&
          typeof r.start === 'number' &&
          typeof r.end === 'number' &&
          typeof r.text === 'string'
        ) {
          transcriptSegments.push({
            id: r.id ?? `seg_${i}`,
            start: r.start,
            end: r.end,
            text: r.text,
          })
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Verify checklist — shared source of gate truth for stepper + stages
  // ------------------------------------------------------------------
  const checklist = useVerifyChecklist(sopId)

  // Source-less / AI-prompt SOPs bypass the verify gate — treat as ready.
  const effectiveIsReady = showVerifyGate ? checklist.isReady : true
  const effectiveVerifiedCount = showVerifyGate ? checklist.verifiedCount : 0
  const effectiveTotalCount = showVerifyGate ? checklist.totalCount : 0

  // ------------------------------------------------------------------
  // Stage state
  // ------------------------------------------------------------------
  const [activeStage, setActiveStage] = useState<BuilderStage>('build')

  // Demote off the Publish stage if verification is revoked while parked there
  // (e.g. a decline elsewhere / query invalidation flips isReady back to false).
  // Prevents a dead-end stage where the stepper shows Publish active but the
  // button is disabled with a "N steps left to verify" reason. (WR-01)
  useEffect(() => {
    if (activeStage === 'publish' && !effectiveIsReady) {
      setActiveStage(hasSourceDoc ? 'review' : 'build')
    }
  }, [activeStage, effectiveIsReady, hasSourceDoc])

  const handleStageSelect = useCallback(
    (stage: BuilderStage) => {
      // Guard: ignore review when no source doc
      if (stage === 'review' && !hasSourceDoc) return
      // Guard: ignore publish when gate not satisfied
      if (stage === 'publish' && !effectiveIsReady) return
      setActiveStage(stage)
    },
    [hasSourceDoc, effectiveIsReady],
  )

  // SOP display info for top bar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sopTitle = (initialSop as any).title as string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sopVersion = (initialSop as any).version as number | undefined

  // "You're editing / checking / sending" here-zone verb — Phase 33 (33-04)
  const HERE_VERB: Record<BuilderStage, string> = {
    build: 'editing',
    review: 'checking',
    publish: 'sending',
  }

  const approvalPending = approvalStatus?.state === 'pending'
  const nextApproverLabel = approvalPending
    ? approvalStatus?.steps?.[approvalStatus.nextStepIndex]?.label
    : undefined

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <SourceViewerSelectionProvider>
      <div
        data-testid="builder-stage-shell"
        data-publishing={publishing ? 'true' : 'false'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          minHeight: 0,
          background: '#fafafa',
        }}
      >
        {/* ── Wayfinder bar (Phase 33, 33-04, SC-6) ────────────────────
            Light paper/hairline schema — back / here / forward zones.
            The amber "YOU'RE EDITING" tick and the green ready-chip are
            the only colour. ─────────────────────────────────────────── */}
        <header
          data-testid="wayfinder-bar"
          className="flex items-stretch bg-white border-b border-[var(--ink-100)]"
          style={{ height: 58, minHeight: 58, flexShrink: 0 }}
        >
          {/* Back zone */}
          <Link
            href="/admin/sops"
            data-testid="wayfinder-back"
            className="flex flex-shrink-0 items-center gap-2 px-[18px] border-r border-[var(--ink-100)] text-[var(--ink-500)] hover:text-[var(--ink-900)] no-underline transition-colors"
          >
            <span className="text-[15px]" aria-hidden="true">←</span>
            <span className="flex flex-col leading-tight">
              <span className="text-[9px] uppercase tracking-wider text-[var(--ink-300)]">Back to</span>
              <span className="text-[12px]">SOP library</span>
            </span>
          </Link>

          {/* Here zone */}
          <div
            data-testid="wayfinder-here"
            className="flex min-w-0 flex-1 items-center gap-[11px] px-[18px] border-r border-[var(--ink-100)]"
          >
            <span
              className="flex-shrink-0 text-[9px] uppercase leading-tight tracking-wider text-amber-700"
              style={{ borderLeft: '3px solid var(--brand-yellow, #fbbf24)', paddingLeft: 9 }}
            >
              You&rsquo;re<br />{HERE_VERB[activeStage]}
            </span>
            {sopTitle && (
              <span
                className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[var(--ink-900)]"
                title={sopTitle}
              >
                {sopTitle}
              </span>
            )}
            {sopVersion !== undefined && (
              <span className="flex-shrink-0 rounded-xs border border-[var(--ink-300)] px-1.5 py-0.5 text-[9px] text-[var(--ink-500)]">
                v{sopVersion}
              </span>
            )}
          </div>

          {/* Forward zone — single next-stage chip, lock reason inline */}
          <div data-testid="wayfinder-forward" className="flex flex-shrink-0 items-center px-[14px]">
            <BuilderStageStepper
              activeStage={activeStage}
              hasSourceDoc={hasSourceDoc}
              isReady={effectiveIsReady}
              verifiedCount={effectiveVerifiedCount}
              totalCount={effectiveTotalCount}
              onStageSelect={handleStageSelect}
              approvalPending={approvalPending}
              approverLabel={nextApproverLabel}
            />
          </div>
        </header>

        {/* ── Tools row (--paper-2) ─────────────────────────────────── */}
        <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-[var(--ink-100)] bg-[var(--paper-2)] px-[18px]">
          <ToolsMenu sopId={sopId} isDraft={initialSop.status === 'draft'} sop={initialSop} />
          <span className="flex-1" />
          {showVerifyGate && (
            <span className="text-[10.5px] text-[var(--ink-500)]">
              <b className="text-[var(--ink-900)]">{effectiveVerifiedCount} of {effectiveTotalCount}</b> steps checked
            </span>
          )}
        </div>

        {/* ── Stage content area ───────────────────────────────────── */}
        <main style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeStage === 'build' && (
            <BuilderClient sopId={sopId} initialSop={initialSop} />
          )}

          {activeStage === 'review' && hasSourceDoc && (
            <>
              <OrientationStrip
                stageBadge="Step 2 of 3"
                verifiedCount={effectiveVerifiedCount}
                totalCount={effectiveTotalCount}
              />
              <ReviewStation
                sopId={sopId}
                sourceType={sourceType}
                transcriptSegments={transcriptSegments}
              />
            </>
          )}

          {activeStage === 'publish' && (
            <PublishStage
              verifiedCount={effectiveVerifiedCount}
              totalCount={effectiveTotalCount}
              isReady={effectiveIsReady}
              hasSourceDoc={hasSourceDoc}
              publishing={publishing}
              publishError={publishError}
              onPublish={handlePublish}
              onDismissError={() => setPublishError(null)}
              onBackToReview={() => setActiveStage('review')}
              approvalStatus={approvalStatus}
              onApproveStep={handleApproveStep}
              onRequestChanges={handleRequestChanges}
              approvalActionPending={approvalActionPending}
              approvalError={approvalError}
              wireUpHref={initialSop.status === 'published' ? `/admin/sops?view=access&sop=${sopId}` : undefined}
            />
          )}
        </main>
      </div>
    </SourceViewerSelectionProvider>
  )
}
