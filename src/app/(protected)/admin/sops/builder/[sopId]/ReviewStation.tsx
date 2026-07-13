'use client'

/**
 * Phase 21.5 (Plan 21.5-04 Task 2) — Review Station: 3-zone synced review grid.
 *
 * Zone 1 (left,  280px/240px): Step navigator — NavRow list, one per block
 * Zone 2 (centre, flex-1):     Step in app — the blocks, as the worker sees them
 * Zone 3 (right,  flex-1):     Original document — SourceViewerPane as-is
 *
 * Zone 2 is a CONTINUOUS SCROLL column: every block is rendered, each with its
 * own inline verify action. It replaced a one-block-at-a-time pager whose
 * bottom action bar forced 48 × (click → read → verify) round-trips through a
 * 48-step SOP. Scrolling the column moves the active block, which drives the
 * source pane (zone 3) — so the original document follows the reviewer's eye
 * instead of demanding a click per step.
 *
 * D-21-07 / SCP-VERIFY-05 is UNTOUCHED by that change: there is still exactly
 * ONE deliberate verify act per block, and no affordance that verifies more
 * than one. The lock bans a BULK action, not a scrolling layout — the
 * per-block friction (the actual safety feature, Spike 004) is preserved.
 *
 * Reuses shipped data layer (no new fetch/mutations):
 *   - useVerifyChecklist    — blocks, activeIdx, setActiveIdx, approve, decline
 *   - useReviewerFlags      — byBlockId for the per-block AI panel
 *   - useChecklistKeybinds  — j/k nav, a verify, d send-back, Enter focus-source
 *   - useSelectionSync      — setActiveProvenance syncs source pane on active change
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
import type { ReviewerFlag } from '@/lib/parsers/ai-reviewer'

export type ReviewStationProps = {
  sopId: string
  sourceType: SourcePaneKind | null
  transcriptSegments?: TranscriptSegment[]
}

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

/**
 * One block in the review column: what the worker sees, what the AI flagged,
 * and the single verify decision for THIS block (D-21-07 — one act, one block).
 */
function ReviewCard({
  block,
  index,
  total,
  active,
  flags,
  sopId,
  onSelect,
  onApprove,
  onDecline,
  registerRef,
}: {
  block: ChecklistBlock
  index: number
  total: number
  active: boolean
  flags: ReviewerFlag[]
  sopId: string
  onSelect: () => void
  onApprove: () => void
  onDecline: () => void
  registerRef: (el: HTMLElement | null) => void
}): React.JSX.Element {
  const verified = block.verified_by_admin_id !== null
  const hasAiFlags = flags.length > 0

  return (
    <div
      ref={registerRef}
      data-testid="review-card"
      data-block-id={block.id}
      data-active={active ? 'true' : undefined}
      data-verified={verified ? 'true' : undefined}
      onClick={onSelect}
      style={{
        border: active
          ? '1.5px solid var(--accent-step)'
          : '1px solid var(--ink-300)',
        borderRadius: '4px',
        background: '#fff',
        overflow: 'hidden',
        marginBottom: '12px',
        // The active card is what zone 3 is showing the source for — make that
        // legible without shouting, since every card is on screen at once now.
        boxShadow: active ? '0 0 0 3px rgba(59,130,246,0.10)' : 'none',
        scrollMarginTop: '12px',
      }}
    >
      {/* Card strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: active ? '#eff4ff' : 'var(--paper-2, #f4f4f5)',
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
          {humanizeBlockType(block.type)}
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
          Step {index + 1} of {total}
        </span>
      </div>

      {/* The real worker block. */}
      <div style={{ padding: '16px' }}>
        <StepInApp block={block} />
      </div>

      {/* Inline AI Safety Check — only when THIS block has flags. A clean block
          used to render an "all clear" box plus its own re-run button; across a
          48-step SOP that was 48 repetitions of nothing. Silence signals clean. */}
      {hasAiFlags && (
        <div
          style={{
            margin: '0 16px 16px',
            border: '1px solid var(--ink-300)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ink-900)',
                }}
              >
                {`AI safety check · ${flags.length} thing${flags.length === 1 ? '' : 's'} to look at`}
              </span>
            </div>
          </div>

          <ReviewerFlagsPanel
            sopId={sopId}
            blockId={block.id}
            blockProvenance={block.provenance}
          />
        </div>
      )}

      {/* Per-block decision — the ONE deliberate act for this block (D-21-07). */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderTop: '1px solid var(--ink-200)',
          background: verified ? 'rgba(22,163,74,0.06)' : 'var(--paper-2, #f4f4f5)',
        }}
      >
        {verified ? (
          <>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent-ok)',
              }}
            >
              ✓ Verified
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDecline()
              }}
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                border: '1px solid var(--ink-300)',
                borderRadius: '2px',
                background: 'transparent',
                color: 'var(--ink-700)',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ✎ Send back to edit
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-testid="verify-step"
              onClick={(e) => {
                e.stopPropagation()
                onApprove()
              }}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '2px',
                background: 'var(--accent-ok)',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ✓ Looks right — verify step
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDecline()
              }}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--accent-measure)',
                borderRadius: '2px',
                background: 'transparent',
                color: '#c2410c',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ✎ Send back to edit
            </button>
          </>
        )}
      </div>
    </div>
  )
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

  // Zone 2 scroll container + one ref per rendered card, so nav/keyboard can
  // reveal a card and the scroll handler can work out which card is being read.
  const columnRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Scrolling the column drives activeIdx. A programmatic reveal (nav click,
  // j/k) also fires scroll events — suppress the handler briefly so it cannot
  // fight the reveal it just triggered.
  const suppressScrollSyncRef = useRef(false)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  // Zone 3 drawer state for tablet (768–1023px). CSS hides zone 3 at tablet;
  // the drawer toggle overlays it as a side panel. No JS breakpoint detection
  // per D-04 SSR-safety pattern — the button only shows at tablet via CSS.
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { setActiveProvenance } = selection
  const { blocks, activeIdx, activeBlockId, setActiveIdx } = checklist

  useEffect(() => {
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const revealCard = useCallback((blockId: string) => {
    const el = cardRefs.current.get(blockId)
    if (!el || typeof el.scrollIntoView !== 'function') return
    suppressScrollSyncRef.current = true
    el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = setTimeout(() => {
      suppressScrollSyncRef.current = false
    }, 700)
  }, [])

  /**
   * Explicit navigation (nav row click, j/k). Unlike a scroll-driven change,
   * this must bring the card to the reader. Passed to useChecklistKeybinds as
   * `setActiveIdx` so the keyboard contract keeps working in a scrolling column.
   */
  const selectAndReveal = useCallback(
    (idx: number) => {
      setActiveIdx(idx)
      const block = blocks[idx]
      if (block) revealCard(block.id)
    },
    [blocks, setActiveIdx, revealCard],
  )

  const focusSourcePane = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId)
      if (!block) return
      setActiveProvenance(block.provenance ?? null, block.id)
    },
    [blocks, setActiveProvenance],
  )

  useChecklistKeybinds({
    blocks,
    activeIdx,
    setActiveIdx: selectAndReveal,
    approve: checklist.approve,
    decline: checklist.decline,
    focusSourcePane,
    enabled: true,
  })

  /**
   * The source pane follows the active block — however it became active
   * (nav click, j/k, or simply scrolling the column). This is what removes the
   * click-per-step: read down zone 2, and zone 3 tracks you.
   */
  useEffect(() => {
    const block = blocks[activeIdx]
    if (!block) return
    setActiveProvenance(block.provenance ?? null, block.id)
  }, [activeIdx, blocks, setActiveProvenance])

  // Auto-scroll the active nav row into view when activeIdx changes.
  useEffect(() => {
    const container = navListRef.current
    if (!container) return
    const row = container.querySelector<HTMLElement>(
      `[data-testid="nav-row"][data-block-id="${activeBlockId}"]`,
    )
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIdx, activeBlockId])

  /**
   * Scroll → active. The card whose top edge sits nearest the top of the
   * column is the one being read. rAF-throttled; no-ops during a reveal.
   */
  const syncActiveToScroll = useCallback(() => {
    if (suppressScrollSyncRef.current) return
    const root = columnRef.current
    if (!root) return
    const rootTop = root.getBoundingClientRect().top

    let bestIdx = -1
    let bestDist = Number.POSITIVE_INFINITY
    blocks.forEach((block, idx) => {
      const el = cardRefs.current.get(block.id)
      if (!el) return
      const dist = Math.abs(el.getBoundingClientRect().top - rootTop)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = idx
      }
    })

    if (bestIdx !== -1 && bestIdx !== activeIdx) setActiveIdx(bestIdx)
  }, [blocks, activeIdx, setActiveIdx])

  const handleColumnScroll = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      syncActiveToScroll()
    })
  }, [syncActiveToScroll])

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

  const remaining = checklist.totalCount - checklist.verifiedCount

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
              Jump to any step — or just scroll
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
            {blocks.map((block, idx) => (
              <NavRow
                key={block.id}
                block={block}
                active={idx === activeIdx}
                onSelect={() => selectAndReveal(idx)}
              />
            ))}
          </div>
        </aside>

        {/* ── Zone 2: The blocks, as the worker sees them ───────────────────── */}
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
                The steps, in the app
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
                This is what the worker will see on their phone — scroll to read, verify as you go
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

          {/* The review column — every block, each with its own verify act. */}
          <div
            ref={columnRef}
            onScroll={handleColumnScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
            }}
          >
            {blocks.map((block, idx) => (
              <ReviewCard
                key={block.id}
                block={block}
                index={idx}
                total={checklist.totalCount}
                active={idx === activeIdx}
                flags={reviewer.byBlockId.get(block.id) ?? []}
                sopId={sopId}
                onSelect={() => setActiveIdx(idx)}
                onApprove={() => {
                  void checklist.approve(block.id)
                }}
                onDecline={() => {
                  void checklist.decline(block.id)
                }}
                registerRef={(el) => {
                  if (el) cardRefs.current.set(block.id, el)
                  else cardRefs.current.delete(block.id)
                }}
              />
            ))}
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
              Follows the step you&rsquo;re reading
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

        {/* ── Status bar ───────────────────────────────────────────────────────
            Progress + the AI re-run (once for the SOP, not once per block) +
            the keyboard contract. The old per-step Previous/Verify/Send-back
            pager lived here; those decisions now sit on the block they concern. */}
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
          <span
            data-testid="verify-progress"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              fontWeight: 600,
              color: remaining === 0 ? 'var(--accent-ok)' : 'var(--ink-900)',
              whiteSpace: 'nowrap',
            }}
          >
            {remaining === 0
              ? `✓ All ${checklist.totalCount} steps verified`
              : `${checklist.verifiedCount} of ${checklist.totalCount} steps verified · ${remaining} to go`}
          </span>

          <RerunReviewerButton sopId={sopId} />

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
