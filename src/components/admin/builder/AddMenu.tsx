'use client'
// D-21-09 isolation: admin-only; never imported by worker routes.

import { useEffect } from 'react'
import { Library } from 'lucide-react'
import { humanizeBlockType, BLOCK_TYPE_LABELS } from '@/lib/builder/block-type-labels'

// ---------------------------------------------------------------------------
// Phase 21.6 Plan 04 — AddMenu
//
// A single grouped, humanised "＋ Add" menu. AddMenu renders OUTSIDE the <Puck>
// provider, so it CANNOT call useGetPuck() directly (that throws "usePuckGet
// must be used inside <Puck>"). Instead it requests an insert through the
// onInsert callback, which BuilderClient routes to a dispatch captured by the
// `puck` override that lives inside the Puck context (RESEARCH Pitfall 2 —
// root:default-zone). Preserves Phase 13 library picker via onOpenLibrary (D-03).
// All visible labels resolve through humanizeBlockType — no raw PascalCase.
// ---------------------------------------------------------------------------

interface AddMenuProps {
  /** Request insertion of a block type into the active section. */
  onInsert: (componentType: string) => void
  /** Called after a block is inserted or the user dismisses. */
  onClose: () => void
  /** Opens the Phase 13 block picker (addBlockToSection path). D-03 preservation. */
  onOpenLibrary: () => void
}

// ---------------------------------------------------------------------------
// Pill style helper — verbatim from NavRow.tsx / TreeStepRow.tsx
// ---------------------------------------------------------------------------
function getPillStyle(pillVariant: string): React.CSSProperties {
  switch (pillVariant) {
    case 'kind-haz':
      return { background: '#fef2f2', color: 'var(--accent-hazard)', border: '1px solid #fca5a5' }
    case 'kind-meas':
      return { background: '#fff5ed', color: 'var(--accent-measure)', border: '1px solid #fdba74' }
    case 'kind-ins':
      return { background: '#ecfdff', color: 'var(--accent-mcu)', border: '1px solid #67e8f9' }
    case 'kind-dec':
      return { background: '#fdf2f8', color: 'var(--accent-decision)', border: '1px solid #f9a8d4' }
    case 'kind-esc':
      return { background: '#fef2f2', color: 'var(--accent-hazard)', border: '1px solid #fca5a5' }
    case 'kind-sign':
      return { background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' }
    case 'kind-step':
    default:
      return { background: '#eff4ff', color: 'var(--accent-step)', border: '1px solid #93c5fd' }
  }
}

// ---------------------------------------------------------------------------
// Block groups — per UI-SPEC § Add Menu (STEPS / ANNOTATIONS / SAFETY / STRUCTURED).
// Block type keys are stored as object keys (exempt from E2 lint guard) and
// resolved through humanizeBlockType at render time — no raw PascalCase strings
// appear as user-visible JSX text nodes.
// ---------------------------------------------------------------------------

// Object-key form keeps each PascalCase identifier in a non-render context
// (isNonRenderContext passes "key:" form). The values carry no type strings —
// they're purely presentational metadata.
const STEP_GROUP_TYPES: Record<string, true> = {
  StepBlock: true,
  StepWithPhotosBlock: true,
}
const ANNOTATION_GROUP_TYPES: Record<string, true> = {
  HeadingBlock: true,
  TextBlock: true,
  CalloutBlock: true,
  VoiceNoteBlock: true,
}
const SAFETY_GROUP_TYPES: Record<string, true> = {
  HazardCardBlock: true,
  PPECardBlock: true,
  EscalateBlock: true,
}
const STRUCTURED_GROUP_TYPES: Record<string, true> = {
  MeasurementBlock: true,
  DecisionBlock: true,
  InspectBlock: true,
  SignOffBlock: true,
}

const BLOCK_GROUPS: { label: string; types: string[] }[] = [
  { label: 'STEPS', types: Object.keys(STEP_GROUP_TYPES) },
  { label: 'ANNOTATIONS', types: Object.keys(ANNOTATION_GROUP_TYPES) },
  { label: 'SAFETY', types: Object.keys(SAFETY_GROUP_TYPES) },
  { label: 'STRUCTURED', types: Object.keys(STRUCTURED_GROUP_TYPES) },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AddMenu({ onInsert, onClose, onOpenLibrary }: AddMenuProps) {
  // Insert a new block by asking BuilderClient (which holds the Puck dispatch
  // captured inside the `puck` override). AddMenu lives outside <Puck>.
  function insertBlock(componentType: string) {
    onInsert(componentType)
    onClose()
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="menu"
      data-testid="add-menu"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--ink-300)',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        maxHeight: '320px',
        overflowY: 'auto',
        zIndex: 50,
      }}
    >
      {BLOCK_GROUPS.map((group, gi) => (
        <div key={group.label}>
          {/* Divider between groups */}
          {gi > 0 && (
            <div
              style={{
                height: '1px',
                background: 'var(--ink-300)',
                margin: '2px 0',
              }}
            />
          )}

          {/* Group header */}
          <div
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--ink-400)',
              letterSpacing: '0.08em',
            }}
          >
            {group.label}
          </div>

          {/* Group items */}
          {group.types.map((componentType) => {
            const entry = BLOCK_TYPE_LABELS[componentType]
            const pillVariant = entry?.pillVariant ?? 'kind-step'
            return (
              <button
                key={componentType}
                type="button"
                role="menuitem"
                onClick={() => insertBlock(componentType)}
                className="hover:bg-[var(--paper-2)]"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '4px 8px',
                  height: '32px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Kind pill — 60px */}
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '60px',
                    minWidth: '60px',
                    fontSize: '10px',
                    fontWeight: 600,
                    fontFamily: 'JetBrains Mono, monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    borderRadius: '2px',
                    padding: '2px 4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    ...getPillStyle(pillVariant),
                  }}
                >
                  {humanizeBlockType(componentType)}
                </span>

                {/* Label — resolved through humanizeBlockType, never raw PascalCase */}
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 400,
                    color: 'var(--ink-700)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {humanizeBlockType(componentType)}
                </span>
              </button>
            )
          })}
        </div>
      ))}

      {/* Divider before "From library…" */}
      <div
        style={{
          height: '1px',
          background: 'var(--ink-300)',
          margin: '2px 0',
        }}
      />

      {/* "From library…" entry — delegates to Phase 13 block picker (D-03) */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onOpenLibrary()
          onClose()
        }}
        className="hover:bg-[var(--paper-2)]"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          width: '100%',
          height: '32px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Library size={14} style={{ color: 'var(--ink-500)', flexShrink: 0 }} />
        <span
          style={{
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'var(--ink-500)',
          }}
        >
          From library…
        </span>
      </button>
    </div>
  )
}
