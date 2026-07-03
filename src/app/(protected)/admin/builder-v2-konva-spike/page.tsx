/**
 * Phase 26 / Plan 26-05 — THROWAWAY day-1 Konva-in-Next-16 de-risk spike.
 *
 * ponytail: this route exists only to force react-konva + the externalized
 * `canvas` module into the build graph so `next build --webpack` actually
 * proves Pitfall 5 (canvas module resolution) is resolved under Next 16 — a
 * component that no route imports is never bundled, so the spike would be a
 * no-op. Delete this route when Plan 26-13 wires the real VisualBlock →
 * AnnotationEditorLoader into the builder. Admin-only (under `(protected)`),
 * so Konva never reaches the worker `/sops/[sopId]` bundle.
 */
import { AnnotationEditorLoader } from '@/components/admin/builder-v2/visual/AnnotationEditorLoader'

export default function KonvaSpikePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-brand-yellow text-lg font-semibold">
        Konva-in-Next-16 spike (26-05)
      </h1>
      <p className="text-sm text-steel-400">
        A real react-konva &lt;Stage&gt; mounted via dynamic(ssr:false). If you
        see a bordered canvas below with no console error, the spike passed.
      </p>
      <AnnotationEditorLoader naturalWidth={400} naturalHeight={300} />
    </main>
  )
}
