'use client'
// D-21-09 isolation: admin-only; never imported by worker routes.

import { useEffect, useRef } from 'react'
import { humanizeBlockType } from '@/lib/builder/block-type-labels'

// ---------------------------------------------------------------------------
// Phase 21.6 Plan 04 — StructuredFieldPopover
//
// Anchored chrome wrapper for structured-field editing (D-04).
// Hosts the existing Puck field inputs for structured data (photo layout enum,
// decision branches, measurement units) via a children slot.
//
// Edits continue to flow through Puck's own onChange → useBuilderAutosave path.
// This component is chrome ONLY — it does NOT write to Supabase/Dexie directly.
// No autosave import, no server action import. E7 tripwire is preserved.
//
// Decision/Measurement complexity note: the Decision-branch arrays and
// Measurement configuration may benefit from the D-04 allowed slim 280px
// right-rail fallback if this popover proves too cramped in practice.
// That fallback would be a separate component injected at the right of the
// canvas — decision deferred; the popover form is built here first.
// ---------------------------------------------------------------------------

interface StructuredFieldPopoverProps {
  /** The Puck component ID of the selected block. */
  blockId: string
  /** PascalCase block type identifier (e.g. 'DecisionBlock'). */
  blockType: string
  /** Ref to the selected block's DOM element for anchor positioning. */
  anchorRef: React.RefObject<HTMLElement | null>
  /** Called to dismiss the popover. */
  onClose: () => void
  /**
   * The existing Puck field inputs for this block's structured fields.
   * Edits within these children flow through Puck's onChange → autosave path.
   * This popover is chrome only — no direct data mutation here.
   */
  children?: React.ReactNode
}

export function StructuredFieldPopover({
  blockId,
  blockType,
  anchorRef,
  onClose,
  children,
}: StructuredFieldPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // -------------------------------------------------------------------------
  // Close on Escape key
  // -------------------------------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // -------------------------------------------------------------------------
  // Close on click outside
  // -------------------------------------------------------------------------
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [onClose])

  // -------------------------------------------------------------------------
  // Close when the selected block changes (reselect another block)
  // -------------------------------------------------------------------------
  useEffect(() => {
    // blockId changing means a different block was selected — dismiss popover.
    // The effect fires whenever blockId updates; initial mount is intentionally
    // a no-op (we just opened for this blockId).
    return () => {
      // Cleanup only; actual close is triggered by the parent updating blockId.
    }
  }, [blockId, onClose])

  // -------------------------------------------------------------------------
  // Anchor positioning — bottom-left of the selected block element
  // -------------------------------------------------------------------------
  const rect = anchorRef.current?.getBoundingClientRect()
  const top = rect ? rect.bottom + 4 : 0
  const left = rect ? rect.left : 0

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${humanizeBlockType(blockType)} fields`}
      data-testid="structured-field-popover"
      style={{
        position: 'fixed',
        top,
        left,
        width: '280px',
        maxHeight: '360px',
        overflowY: 'auto',
        background: 'var(--paper)',
        border: '1.5px solid var(--ink-300)',
        borderRadius: '4px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        zIndex: 50,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid var(--ink-300)',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: 'var(--ink-500)',
            letterSpacing: '0.06em',
          }}
        >
          {humanizeBlockType(blockType)}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-500)',
            fontSize: '16px',
            lineHeight: 1,
            padding: '0 2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="hover:text-[var(--ink-900)]"
        >
          ×
        </button>
      </div>

      {/* Field content — existing Puck field renders injected via children slot.
          Edits here flow through Puck's onChange → useBuilderAutosave. */}
      <div style={{ padding: '8px 12px' }}>
        {children}
      </div>
    </div>
  )
}
