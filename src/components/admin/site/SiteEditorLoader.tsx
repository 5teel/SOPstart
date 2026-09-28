'use client'

/**
 * Phase 51 / Plan 51-04 (D-08, T-51-02) — admin-only dynamic loader for the
 * Konva site editor.
 *
 * This is the ONLY sanctioned reference site for `SiteEditor`. It uses
 * `next/dynamic` with SSR disabled so react-konva + the `canvas` module land in a
 * separate client chunk that is code-split away from any Server-Side render and,
 * critically, from the worker `/sops/[sopId]` First Load JS. Every caller
 * (SiteWorkspace, 51-05) must import THIS wrapper, never `SiteEditor` directly —
 * the `konva-worker-isolation` lint enforces it.
 */
import dynamic from 'next/dynamic'

export const SiteEditorLoader = dynamic(() => import('./SiteEditor'), {
  ssr: false,
  loading: () => <div>Loading the site map…</div>,
})

export default SiteEditorLoader
