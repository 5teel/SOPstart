'use client'

/**
 * Phase 26 / Plan 26-05 (D-03, R5, R8) — admin-only dynamic loader for the
 * Konva annotation editor.
 *
 * This is the ONLY sanctioned reference site for `AnnotationEditor`. It uses
 * `next/dynamic({ ssr: false })` so react-konva + the `canvas` module land in a
 * separate client chunk that is code-split away from any Server-Side render and,
 * critically, from the worker `/sops/[sopId]` First Load JS. Every admin caller
 * (Plan 26-13 VisualBlock, the day-1 spike route) imports THIS wrapper, never
 * `AnnotationEditor` directly — the `konva-worker-isolation` lint enforces it.
 */
import dynamic from 'next/dynamic'

export const AnnotationEditorLoader = dynamic(
  () => import('./AnnotationEditor'),
  {
    ssr: false,
    loading: () => <div>Loading annotator…</div>,
  }
)

export default AnnotationEditorLoader
