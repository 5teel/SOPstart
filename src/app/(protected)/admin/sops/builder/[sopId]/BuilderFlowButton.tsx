'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Workflow, X } from 'lucide-react'
import { deriveFlowGraph } from '@/lib/sop/flow-graph'
import { FlowGraphSchema } from '@/lib/validators/flow-graph'
import { FlowGraphCanvas } from '@/components/sop/flow/FlowGraphCanvas'
import type { SopWithSections } from '@/types/sop'

/**
 * Builder-side entry point to the procedure flow graph (Phase 24 prototype),
 * so admins can see the spatial flow without leaving the builder. Resolves the
 * same graph the Flow tab does (explicit flow_graph if valid, else derived) and
 * shows it in a portaled modal.
 */
export function BuilderFlowButton({ sop }: { sop: SopWithSections }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const graph = (() => {
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
        title="View the procedure flow graph"
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
        <Workflow size={14} /> Flow
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
              className="bg-[var(--paper)] w-full sm:max-w-5xl h-[88vh] sm:h-[85vh] sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            >
              <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-100)] bg-white">
                <div>
                  <span className="pill">PREVIEW</span>
                  <h2 className="text-base font-semibold text-[var(--ink-900)] mt-1">Procedure flow</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="h-9 w-9 rounded-lg hover:bg-[var(--paper-2)] flex items-center justify-center text-[var(--ink-500)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
              <div className="flex-1 min-h-0">
                <FlowGraphCanvas graph={graph} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
