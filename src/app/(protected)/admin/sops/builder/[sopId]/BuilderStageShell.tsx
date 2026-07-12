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
// Per-SOP labelled action menu — Phase 30 (30-07, UX-06 orchestrator decision #2)
//
// The 5 per-SOP actions (Assign / Versions / Video / QR / Delete-draft) move
// OFF the admin list rows (30-08) into this labelled menu in the builder top
// bar, reachable from every stage. Fixes usability-lab F-09 (icon-only
// actions, WCAG) — every control here carries a visible text label.
// ---------------------------------------------------------------------------

function SopActionsMenu({
  sopId,
  isDraft,
}: {
  sopId: string
  isDraft: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const items: { label: string; href: string }[] = [
    { label: 'Assign to team', href: `/admin/sops/${sopId}/assign` },
    { label: 'Version history', href: `/admin/sops/${sopId}/versions` },
    { label: 'Generate video', href: `/admin/sops/${sopId}/video` },
    { label: 'Print QR code', href: `/admin/sops/${sopId}/qr` },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="sop-actions-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="SOP actions"
        className="mono inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xs border border-[var(--ink-500)] bg-transparent px-3 text-[12px] text-[var(--paper)] hover:border-[var(--ink-300)] transition-colors"
      >
        Actions
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Backdrop closes the menu on outside click */}
          <button
            type="button"
            aria-label="Close actions menu"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="SOP actions"
            data-testid="sop-actions-menu"
            className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-sm border border-[var(--ink-100)] bg-[var(--paper)] py-1 shadow-lg"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                role="menuitem"
                href={item.href}
                className="block px-3 py-2 text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)] transition-colors"
              >
                {item.label}
              </Link>
            ))}
            {isDraft && (
              <div role="menuitem" className="mt-1 border-t border-[var(--ink-100)] pt-1">
                <DeleteSopButton sopId={sopId} redirectTo="/admin/sops" showLabel />
              </div>
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
        {/* ── Top bar (48px, --steel-900) ──────────────────────────── */}
        <header
          style={{
            height: 48,
            minHeight: 48,
            background: '#0a0a0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
          }}
        >
          {/* Left: SOP title + version */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sopTitle && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fafafa',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 320,
                }}
              >
                {sopTitle}
              </span>
            )}
            {sopVersion !== undefined && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10,
                  fontWeight: 400,
                  color: '#71717a',
                  lineHeight: 1.3,
                }}
              >
                v{sopVersion}
              </span>
            )}
          </div>

          {/* Right-of-center: actions menu + flow-graph preview + edit + stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Phase 30 (30-07) — UX-06 labelled per-SOP action menu */}
            <SopActionsMenu sopId={sopId} isDraft={initialSop.status === 'draft'} />
            {/* Phase 24 Plan 03 — FLOW-05: "Edit flow" re-surfaces FlowGraphEditor
                outside the suppressed Puck right sidebar via a portaled modal.
                No Puck hook is called — avoids CLAUDE.md 2026-06-08 outside-Puck crash. */}
            <BuilderFlowEditButton sop={initialSop} sopId={sopId} />
            <BuilderFlowButton sop={initialSop} />
            <BuilderStageStepper
              activeStage={activeStage}
              hasSourceDoc={hasSourceDoc}
              isReady={effectiveIsReady}
              verifiedCount={effectiveVerifiedCount}
              totalCount={effectiveTotalCount}
              onStageSelect={handleStageSelect}
            />
          </div>
        </header>

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
            />
          )}
        </main>
      </div>
    </SourceViewerSelectionProvider>
  )
}
