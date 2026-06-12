'use client'

/**
 * Phase 24 Plan 03 — FLOW-05 re-surface: "Edit flow" entry point in the builder.
 *
 * Background: FlowGraphField is registered as a Puck root.fields.flowGraph custom
 * field but is UNREACHABLE because BuilderClient passes
 * `ui={{ rightSideBarVisible: false }}` (the 21.6 invariant). This component
 * opens the FlowGraphEditor in a portaled modal so admins can author explicit node
 * positions without the suppressed Puck right sidebar.
 *
 * Safety constraints:
 * - This component calls NO Puck hook (no useGetPuck / usePuck) — per CLAUDE.md
 *   2026-06-08 learning: those hooks crash if mounted outside <Puck>, and this
 *   component renders in BuilderStageShell's header, which is outside the Puck
 *   editor subtree entirely.
 * - Write path unchanged: FlowGraphEditor calls updateSopFlowGraph directly
 *   (existing admin/safety_manager role gate + FlowGraphSchema validation + 256 KB
 *   cap). No new trust boundary — T-24-05 mitigated.
 * - modalRoot guard prevents SSR hydration errors (document.body is client-only).
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { GitBranch, X } from 'lucide-react'
import { FlowGraphSchema } from '@/lib/validators/flow-graph'
import type { FlowGraph } from '@/lib/validators/flow-graph'
import { deriveFlowGraph } from '@/lib/sop/flow-graph'
import { FlowGraphEditor } from '@/lib/builder/flow-graph-field'
import type { SopWithSections } from '@/types/sop'

interface BuilderFlowEditButtonProps {
  sop: SopWithSections
  sopId: string
}

export function BuilderFlowEditButton({ sop, sopId }: BuilderFlowEditButtonProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  // CR-02 fix: the server-fetched `sop` prop is never refreshed after a save,
  // so reopening would re-seed from the pre-save graph and a second save would
  // clobber the first. Hold the last-saved graph and prefer it when seeding.
  const [savedGraph, setSavedGraph] = useState<FlowGraph | null>(null)

  // Portal guard: document.body only available on client
  useEffect(() => setMounted(true), [])

  // Escape-to-close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Seed initialGraph: last-saved graph from this session wins, then the
  // explicit graph if valid, else derive from SOP content so admin starts
  // from the current derived layout rather than a blank canvas.
  const initialGraph: FlowGraph = (() => {
    if (savedGraph) return savedGraph
    if (sop.flow_graph != null) {
      const parsed = FlowGraphSchema.safeParse(sop.flow_graph)
      if (parsed.success) return parsed.data
    }
    return deriveFlowGraph(sop)
  })()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit the procedure flow graph (author node positions)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 10px',
          borderRadius: 7,
          border: '1px solid #3f3f46',
          background: 'transparent',
          color: '#fafafa',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <GitBranch size={14} /> Edit flow
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--paper)] w-full sm:max-w-5xl h-[90vh] sm:h-[88vh] sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            >
              <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-100)] bg-white flex-shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-[var(--ink-900)]">Edit procedure flow</h2>
                  <p className="text-xs text-[var(--ink-500)] mt-0.5">
                    Drag nodes to author explicit positions. &ldquo;Save to SOP&rdquo; persists the layout.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="h-9 w-9 rounded-lg hover:bg-[var(--paper-2)] flex items-center justify-center text-[var(--ink-500)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
              <div className="flex-1 min-h-0 overflow-hidden p-4">
                <FlowGraphEditor initialGraph={initialGraph} sopId={sopId} onSaved={setSavedGraph} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
