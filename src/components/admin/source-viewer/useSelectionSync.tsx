'use client'

/**
 * Phase 21 (Plan 21-02, Task 1) — Bidirectional selection-sync context for
 * the source-viewer pane.
 *
 * Two directions of binding:
 *   1. **Builder → Source**: `setActiveProvenance(region)` is called from
 *      the Puck canvas (BuilderClient) when a block is selected. The active
 *      `<PdfCanvasPage>` / `<DocxPreview>` / `<VideoSourcePreview>` re-renders,
 *      scrolls the matching region into view, and pulses a yellow bbox
 *      overlay (SCP-VIEWER-02).
 *   2. **Source → Builder**: `onSourceClick(blockId)` is called from inside
 *      the pane (BboxOverlay click, paragraph click, transcript-line click).
 *      It fans out to any handler the builder registered via
 *      `registerBlockClickHandler(fn)` (SCP-VIEWER-03 reverse channel).
 *
 * Handler-registration uses a ref-stable Set so registering / unregistering
 * never causes a re-render. The registration API is mirror-image of React 19
 * cleanup-on-effect pattern: `register(fn)` returns an `unregister` fn.
 *
 * D-21-09 — this file is admin-only and `'use client'`. It must NOT be
 * statically imported from any worker-side route — the source-viewer module
 * is dynamic-imported from BuilderWithSourceViewer (Task 3).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { SourceProvenanceRegion } from '@/lib/parsers/source-viewer'

export type BlockClickHandler = (blockId: string) => void

export type SourceViewerSelectionContextValue = {
  activeProvenance: SourceProvenanceRegion | null
  activeBlockId: string | null
  /** Builder-canvas → source pane: highlight a region (SCP-VIEWER-02). */
  setActiveProvenance: (region: SourceProvenanceRegion | null, blockId?: string | null) => void
  /** Source pane → builder: forward a click on a bbox / paragraph / transcript line. */
  onSourceClick: (blockId: string) => void
  /**
   * Builder registers a single handler that runs every time the source pane
   * forwards a click. Returns an unregister function (React 19 cleanup
   * pattern). Multiple registrants are supported but the common case is one.
   */
  registerBlockClickHandler: (handler: BlockClickHandler) => () => void
}

const noopUnregister = () => {}

const defaultValue: SourceViewerSelectionContextValue = {
  activeProvenance: null,
  activeBlockId: null,
  setActiveProvenance: () => {},
  onSourceClick: () => {},
  registerBlockClickHandler: () => noopUnregister,
}

export const SourceViewerSelectionContext = createContext<SourceViewerSelectionContextValue>(defaultValue)

/**
 * Hook returning the selection-sync API. Components inside the
 * `<SourceViewerSelectionProvider>` subtree can drive or observe the
 * active provenance.
 */
export function useSelectionSync(): SourceViewerSelectionContextValue {
  return useContext(SourceViewerSelectionContext)
}

/**
 * Provider component. Wraps the builder layout (Task 3) so both halves
 * (Puck canvas on the left, source pane on the right) share one
 * selection-sync instance.
 */
export function SourceViewerSelectionProvider({ children }: { children: ReactNode }) {
  const [activeProvenance, setActiveProvenanceState] = useState<SourceProvenanceRegion | null>(null)
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)

  // Stable ref-backed Set of click handlers; registering doesn't re-render.
  const handlersRef = useRef<Set<BlockClickHandler>>(new Set())

  const setActiveProvenance = useCallback(
    (region: SourceProvenanceRegion | null, blockId: string | null = null) => {
      setActiveProvenanceState(region)
      setActiveBlockId(blockId)
    },
    []
  )

  const onSourceClick = useCallback((blockId: string) => {
    handlersRef.current.forEach((fn) => {
      try {
        fn(blockId)
      } catch (err) {
        // Defensive: a misbehaving registered handler should not break the
        // fan-out for other handlers. Surface to console for dev diagnosis.
        console.warn('[useSelectionSync] block-click handler threw', err)
      }
    })
  }, [])

  const registerBlockClickHandler = useCallback((handler: BlockClickHandler) => {
    handlersRef.current.add(handler)
    return () => {
      handlersRef.current.delete(handler)
    }
  }, [])

  const value = useMemo<SourceViewerSelectionContextValue>(
    () => ({
      activeProvenance,
      activeBlockId,
      setActiveProvenance,
      onSourceClick,
      registerBlockClickHandler,
    }),
    [activeProvenance, activeBlockId, setActiveProvenance, onSourceClick, registerBlockClickHandler]
  )

  return (
    <SourceViewerSelectionContext.Provider value={value}>
      {children}
    </SourceViewerSelectionContext.Provider>
  )
}
