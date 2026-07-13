'use client'

/**
 * Phase 21.5 (Plan 21.5-04 Task 2) — Review Station: 3-zone synced review grid.
 *
 * Zone 1 (left,  280px/240px): Step navigator — NavRow list, one per block
 * Zone 2 (centre, flex-1):     Step in app — one step card + inline AI flags
 * Zone 3 (right,  flex-1):     Original document — SourceViewerPane as-is
 *
 * Reuses shipped data layer (no new fetch/mutations):
 *   - useVerifyChecklist    — blocks, activeIdx, setActiveIdx, approve, decline
 *   - useReviewerFlags      — byBlockId for the AI panel header count
 *   - useChecklistKeybinds  — j/k nav, a verify, d send-back, Enter focus-source
 *   - useSelectionSync      — setActiveProvenance syncs source pane on row select
 *   - ReviewerFlagsPanel    — inline per-step AI flags (self-hides when clean)
 *   - SourceViewerPane      — zone 3, rendered as-is
 *
 * Responsive:
 *   ≥1024px: grid-template-columns: 280px 1fr 1fr; all three zones visible
 *   768–1023px: grid-template-columns: 240px 1fr; zone 3 = drawer (CSS only)
 *
 * CLAUDE.md 2026-05-13: Active-step state driven from hook's activeIdx.
 * Never uses router.push for step navigation.
 *
 * D-21-07 / SCP-VERIFY-05: NO bulk-verify affordance. Single-block verify only.
 * D-21-09 isolation: admin-only; never imported by worker routes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVerifyChecklist } from '@/components/admin/verify-checklist/useVerifyChecklist'
import {
  useChecklistKeybinds,
  CHECKLIST_KEYBINDS,
} from '@/components/admin/verify-checklist/keyboard-bindings'
import { useReviewerFlags } from '@/components/admin/ai-reviewer/useReviewerFlags'
import { ReviewerFlagsPanel } from '@/components/admin/ai-reviewer/ReviewerFlagsPanel'
import { RerunReviewerButton } from '@/components/admin/ai-reviewer/RerunReviewerButton'
import { useSelectionSync } from '@/components/admin/source-viewer/useSelectionSync'
import type { SourcePaneKind } from '@/components/admin/source-viewer/types'
import type { TranscriptSegment } from '@/components/admin/source-viewer/VideoSourcePreview'
import { SourceViewerPane } from '@/components/admin/source-viewer/SourceViewerPane'
import { NavRow } from './NavRow'
import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import { BLOCK_COMPONENTS, type BlockType } from '@/lib/builder/block-registry'
import {
  blockContentToPuckProps,
  blockKindToPuckType,
} from '@/lib/builder/puck-to-block-content'
import type { ChecklistBlock } from '@/components/admin/verify-checklist/useVerifyChecklist'

/**
 * Render the step as the worker actually sees it — the zone's stated promise.
 *
 * Uses the SAME BLOCK_COMPONENTS registry the worker read path (LayoutRenderer)
 * and the edit host (BlockEditShell) use, so there is no forked renderer to
 * drift. Falls back to the preview line for blocks whose kind has no worker
 * component (text/heading/callout primitives) or whose snapshot didn't validate.
 */
function StepInApp({ block }: { block: ChecklistBlock }): React.JSX.Element {
  const puckType = block.content ? blockKindToPuckType(block.content.kind) : null
  const Block = puckType ? BLOCK_COMPONENTS[puckType as BlockType] : undefined

  if (!block.content || !Block) {
    return (
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          lineHeight: 1.55,
          color: 'var(--ink-700)',
          margin: 0,
        }}
      >
        {block.preview || 'No preview available for this block.'}
      </p>
    )
  }

  const props = blockContentToPuckProps(block.content)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BlockAny = Block as any
  return <BlockAny {...props} />
}

export type ReviewStationProps = {
  sopId: string
  sourceType: SourcePaneKind | null
  transcriptSegments?: TranscriptSegment[]
}

export function ReviewStation({
  sopId,
  sourceType,
  transcriptSegments,
}: ReviewStationProps): React.JSX.Element {
  const checklist = useVerifyChecklist(sopId)
  const reviewer = useReviewerFlags(sopId)
  const selection = useSelectionSync()
  const navListRef = useRef<HTMLDivElement | null>(null)

  // Zone 3 drawer state for tablet (768–1023px). CSS hides zone 3 at tablet;
  // the drawer toggle overlays it as a side panel. No JS breakpoint detection
  // per D-04 SSR-safety pattern — the button only shows at tablet via CSS.
  const [drawerOpen, setDrawerOpen] = useState(false)

  const focusSourcePane = useCallback(
    (blockId: string) => {
      const block = checklist.blocks.find((b) => b.id === blockId)
      if (!block) return
      selection.setActiveProvenance(block.provenance ?? null, block.id)
    },
    [checklist.blocks, selection],
  )

  useChecklistKeybinds({
    blocks: checklist.blocks,
    activeIdx: checklist.activeIdx,
    setActiveIdx: checklist.setActiveIdx,
    approve: checklist.approve,
    decline: checklist.decline,
    focusSourcePane,
    enabled: true,
  })

  // Auto-scroll the active nav row into view when activeIdx changes.
  useEffect(() => {
    const container = navListRef.current
    if (!container) return
    const row = container.querySelector<HTMLElement>(
      `[data-testid="nav-row"][data-block-id="${checklist.activeBlockId}"]`,
    )
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [checklist.activeIdx, checklist.activeBlockId])

  const activeBlock = checklist.blocks[checklist.activeIdx] ?? null
  const activeBlockFlags = activeBlock
    ? (reviewer.byBlockId.get(activeBlock.id) ?? [])
    : []
  const hasAiFlags = activeBlockFlags.length > 0

  const handleSelectRow = useCallback(
    (idx: number) => {
      checklist.setActiveIdx(idx)
      const block = checklist.blocks[idx]
      if (block) {
        selection.setActiveProvenance(block.provenance ?? null, block.id)
      }
    },
    [checklist, selection],
  )

  const handleApprove = useCallback(async () => {
    if (!activeBlock) return
    await checklist.approve(activeBlock.id)
    // Advance to next unverified block after verifying
    const nextIdx = checklist.blocks.findIndex(
      (b, i) => i > checklist.activeIdx && b.verified_by_admin_id === null,
    )
    if (nextIdx !== -1) {
      checklist.setActiveIdx(nextIdx)
      const nextBlock = checklist.blocks[nextIdx]
      if (nextBlock) {
        selection.setActiveProvenance(nextBlock.provenance ?? null, nextBlock.id)
      }
    } else if (checklist.activeIdx < checklist.blocks.length - 1) {
      const next = checklist.activeIdx + 1
      checklist.setActiveIdx(next)
      const nextBlock = checklist.blocks[next]
      if (nextBlock) {
        selection.setActiveProvenance(nextBlock.provenance ?? null, nextBlock.id)
      }
    }
  }, [activeBlock, checklist, selection])

  const handleDecline = useCallback(async () => {
    if (!activeBlock) return
    await checklist.decline(activeBlock.id)
  }, [activeBlock, checklist])

  const handlePrev = useCallback(() => {
    const idx = Math.max(0, checklist.activeIdx - 1)
    checklist.setActiveIdx(idx)
    const b = checklist.blocks[idx]
    if (b) selection.setActiveProvenance(b.provenance ?? null, b.id)
  }, [checklist, selection])

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (checklist.isLoading) {
    return (
      <div
        data-testid="review-station"
        data-state="loading"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: 'var(--ink-500)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '12px',
        }}
      >
        Loading checklist…
      </div>
    )
  }

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (checklist.totalCount === 0) {
    return (
      <div
        data-testid="review-station"
        data-state="empty"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: '8px',
          padding: '48px 24px',
          color: 'var(--ink-500)',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '17px',
            fontWeight: 600,
            color: 'var(--ink-900)',
            margin: 0,
          }}
        >
          Nothing to verify yet
        </p>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: 'var(--ink-500)',
            margin: 0,
          }}
        >
          Add content in the Build stage, then come back to review it.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Responsive grid styles via <style> — CSS queries, NOT JS breakpoints (D-04) */}
      <style>{`
        .review-station-grid {
          display: grid;
          grid-template-columns: 280px 1fr 1fr;
          grid-template-rows: 1fr auto;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          background: var(--paper, #fafafa);
        }
        .review-station-grid .rs-zone1 {
          grid-column: 1;
          grid-row: 1;
        }
        .review-station-grid .rs-zone2 {
          grid-column: 2;
          grid-row: 1;
        }
        .review-station-grid .rs-zone3 {
          grid-column: 3;
          grid-row: 1;
        }
        .review-station-grid .rs-actionbar {
          grid-column: 2 / 4;
          grid-row: 2;
        }
        .rs-drawer-toggle { display: none; }
        .rs-zone3-drawer { display: contents; }

        @media (max-width: 1023px) {
          .review-station-grid {
            grid-template-columns: 240px 1fr;
          }
          .review-station-grid .rs-zone3 {
            display: none;
          }
          .review-station-grid .rs-zone3.drawer-open {
            display: block;
            grid-column: 1 / -1;
            grid-row: 1;
            z-index: 20;
            position: absolute;
            top: 0; right: 0; bottom: 0;
            width: 360px;
            box-shadow: -4px 0 16px rgba(0,0,0,0.12);
          }
          .review-station-grid .rs-actionbar {
            grid-column: 1 / -1;
          }
          .rs-drawer-toggle { display: inline-flex; }
        }
      `}</style>

      <div
        data-testid="review-station"
        className="review-station-grid"
        style={{ position: 'relative' }}
      >
        {/* ── Zone 1: Step Navigator ───────────────────────────────────────── */}
        <aside
          className="rs-zone1"
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--ink-300)',
            background: 'var(--paper, #fafafa)',
            overflow: 'hidden',
          }}
        >
          {/* Zone header */}
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--paper-2, #f4f4f5)',
              borderBottom: '1px solid var(--ink-300)',
              flexShrink: 0,
            }}
          >
            <p
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ink-900)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: 0,
              }}
            >
              Steps in this SOP
            </p>
            <p
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                fontWeight: 500,
                color: 'var(--ink-500)',
                margin: '2px 0 0',
              }}
            >
              Click any step to review it
            </p>
          </div>

          {/* Nav rows */}
          <div
            ref={navListRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {checklist.blocks.map((block, idx) => (
              <NavRow
                key={block.id}
                block={block}
                active={idx === checklist.activeIdx}
                onSelect={() => handleSelectRow(idx)}
              />
            ))}
          </div>
        </aside>

        {/* ── Zone 2: Step in App ──────────────────────────────────────────── */}
        <section
          className="rs-zone2"
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--ink-300)',
            background: 'var(--paper, #fafafa)',
            overflow: 'hidden',
          }}
        >
          {/* Zone header */}
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--paper-2, #f4f4f5)',
              borderBottom: '1px solid var(--ink-300)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ink-900)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  margin: 0,
                }}
              >
                The step, in the app
              </p>
              <p
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: 'var(--ink-500)',
                  margin: '2px 0 0',
                }}
              >
                This is what the worker will see on their phone
              </p>
            </div>

            {/* Drawer toggle — only visible at 768–1023px via CSS */}
            <button
              type="button"
              aria-label="Show original document"
              className="rs-drawer-toggle"
              onClick={() => setDrawerOpen((v) => !v)}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '4px 8px',
                border: '1px solid var(--ink-300)',
                borderRadius: '2px',
                background: drawerOpen ? '#eff4ff' : '#fff',
                color: drawerOpen ? 'var(--accent-step)' : 'var(--ink-700)',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                fontWeight: 500,
              }}
            >
              {drawerOpen ? '✕ Hide source' : '⊞ Show source'}
            </button>
          </div>

          {/* Step card + AI panel */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
            }}
          >
            {activeBlock ? (
              <>
                {/* Step card — primary visual anchor */}
                <div
                  key={activeBlock.id}
                  data-block-id={activeBlock.id}
                  style={{
                    border: '1.5px solid var(--accent-step)',
                    borderRadius: '4px',
                    background: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  {/* Card strip */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#eff4ff',
                      borderBottom: '1px solid var(--ink-200)',
                    }}
                  >
                    {/* Type pill (outline variant) */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '10px',
                        fontWeight: 600,
                        fontFamily: 'JetBrains Mono, monospace',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--accent-step)',
                        border: '1px solid var(--accent-step)',
                        borderRadius: '2px',
                        padding: '2px 8px',
                      }}
                    >
                      {humanizeBlockType(activeBlock.type)}
                    </span>

                    {/* Context label */}
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '10px',
                        fontWeight: 500,
                        color: 'var(--ink-500)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Step {checklist.activeIdx + 1} of {checklist.totalCount}
                    </span>
                  </div>

                  {/* The real worker block. Replaces the old h2-preview +
                      canned "parsed from the source document" sentence, which
                      restated the left-rail row and read identically on every
                      block — nothing to review against the source. */}
                  <div style={{ padding: '16px' }}>
                    <StepInApp block={activeBlock} />
                  </div>
                </div>

                {/* Inline AI Safety Check panel — only when this block HAS flags.
                    A clean block previously rendered an "all clear" box plus its
                    own re-run button, repeating identically on every block while
                    the same re-run action already sits in the page header. Silence
                    is the correct signal for clean; the header carries the count. */}
                {hasAiFlags && (
                  <div
                    style={{
                      marginTop: '16px',
                      border: '1px solid var(--ink-300)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* AI panel header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--paper-2, #f4f4f5)',
                        borderBottom: '1px solid var(--ink-200)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {/* Status dot */}
                        <span
                          aria-hidden
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: 'var(--accent-measure)',
                            flexShrink: 0,
                          }}
                        />
                        {/* Label */}
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--ink-900)',
                          }}
                        >
                          {`AI safety check · ${activeBlockFlags.length} thing${activeBlockFlags.length === 1 ? '' : 's'} to look at`}
                        </span>
                      </div>

                      {/* Re-run button (restyled) */}
                      <RerunReviewerButton
                        sopId={sopId}
                      />
                    </div>

                    {/* Flag rows rendered by ReviewerFlagsPanel */}
                    <ReviewerFlagsPanel
                      sopId={sopId}
                      blockId={activeBlock.id}
                      blockProvenance={activeBlock.provenance}
                    />
                  </div>
                )}
              </>
            ) : null}
          </div>
        </section>

        {/* ── Zone 3: Original Document ────────────────────────────────────── */}
        <aside
          className={`rs-zone3${drawerOpen ? ' drawer-open' : ''}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--paper, #fafafa)',
            overflow: 'hidden',
          }}
        >
          {/* Zone header */}
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--paper-2, #f4f4f5)',
              borderBottom: '1px solid var(--ink-300)',
              flexShrink: 0,
            }}
          >
            <p
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ink-900)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: 0,
              }}
            >
              Original document
            </p>
            <p
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                fontWeight: 500,
                color: 'var(--ink-500)',
                margin: '2px 0 0',
              }}
            >
              Auto-scrolled to the part this step came from
            </p>
          </div>

          {/* Source viewer fills remaining column */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <SourceViewerPane
              sopId={sopId}
              sourceType={sourceType}
              transcriptSegments={transcriptSegments}
            />
          </div>
        </aside>

        {/* ── Action Bar ───────────────────────────────────────────────────── */}
        <div
          className="rs-actionbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--paper-2, #f4f4f5)',
            borderTop: '1px solid var(--ink-300)',
            flexShrink: 0,
          }}
        >
          {/* Previous step */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={checklist.activeIdx === 0}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--ink-300)',
              borderRadius: '2px',
              background: 'transparent',
              color: checklist.activeIdx === 0 ? 'var(--ink-300)' : 'var(--ink-700)',
              cursor: checklist.activeIdx === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            ◀ Previous step
          </button>

          {/* Verify step — primary action */}
          <button
            type="button"
            onClick={() => { void handleApprove() }}
            disabled={!activeBlock}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '2px',
              background: activeBlock ? 'var(--accent-ok)' : 'var(--ink-300)',
              color: '#fff',
              cursor: activeBlock ? 'pointer' : 'not-allowed',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            ✓ Looks right — verify step
          </button>

          {/* Send back to edit */}
          <button
            type="button"
            onClick={() => { void handleDecline() }}
            disabled={!activeBlock}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--accent-measure)',
              borderRadius: '2px',
              background: 'transparent',
              color: '#c2410c',
              cursor: activeBlock ? 'pointer' : 'not-allowed',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            ✎ Send back to edit
          </button>

          {/* Keyboard hint — right-aligned */}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              fontWeight: 500,
              color: 'var(--ink-500)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>or press</span>
            <kbd
              style={{
                border: '1px solid var(--ink-300)',
                borderRadius: '2px',
                padding: '4px',
                background: '#fff',
                fontSize: '10px',
              }}
            >
              {CHECKLIST_KEYBINDS.approve}
            </kbd>
            <span>verify ·</span>
            <kbd
              style={{
                border: '1px solid var(--ink-300)',
                borderRadius: '2px',
                padding: '4px',
                background: '#fff',
                fontSize: '10px',
              }}
            >
              {CHECKLIST_KEYBINDS.decline}
            </kbd>
            <span>edit ·</span>
            <kbd
              style={{
                border: '1px solid var(--ink-300)',
                borderRadius: '2px',
                padding: '4px',
                background: '#fff',
                fontSize: '10px',
              }}
            >
              {CHECKLIST_KEYBINDS.next}
            </kbd>
            <span>/</span>
            <kbd
              style={{
                border: '1px solid var(--ink-300)',
                borderRadius: '2px',
                padding: '4px',
                background: '#fff',
                fontSize: '10px',
              }}
            >
              {CHECKLIST_KEYBINDS.prev}
            </kbd>
            <span>next/prev</span>
          </div>
        </div>
      </div>
    </>
  )
}
