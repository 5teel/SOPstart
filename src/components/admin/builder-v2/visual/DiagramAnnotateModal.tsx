'use client'

/**
 * Phase 26 Plan 26-13 (D-03, R5) — the annotate launch surface.
 *
 * Opens the full Konva editor (26-11) over a diagram item via the sanctioned
 * `AnnotationEditorLoader` (dynamic ssr:false — Konva code-split, never the
 * worker bundle). On "Save & bake" it persists the scene (`saveAnnotation`) and
 * flattens the live Stage to a versioned baked PNG (`bakeStageToVersionedPng`),
 * handing the resulting annotationId + baked path back to MediaGrid.
 *
 * This is what makes the carried 26-11 device-UX residual (`p26-annotation-editor-feel`)
 * verifiable on sopstart.com — nothing mounted the editor from a route before now.
 *
 * Lives in builder-v2/visual/ so `import type Konva` + the loader stay inside the
 * Konva allow-list dir (konva-worker-isolation gate).
 */
import { useRef, useState } from 'react'
import type Konva from 'konva'
import { AnnotationEditorLoader } from './AnnotationEditorLoader'
import { bakeStageToVersionedPng } from './bake-on-publish'
import type { VisualItem } from './media-adapter'
import { saveAnnotation } from '@/actions/annotations'

interface DiagramAnnotateModalProps {
  item: VisualItem
  onClose: () => void
  /** Bubble the persisted annotationId + signed-later baked path up to the grid. */
  onSaved: (patch: { annotationId?: string; bakedSrc: string }) => void
}

export function DiagramAnnotateModal({ item, onClose, onSaved }: DiagramAnnotateModalProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const sceneJsonRef = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The sop_images FK is required to persist. Pipeline-extracted diagrams carry
  // it; a hand-added diagram slot can still be drawn on (UX feel check) but save
  // stays disabled until its image is linked.
  const canPersist = typeof item.sopImageId === 'string' && item.sopImageId.length > 0

  async function saveAndBake() {
    if (!canPersist || !item.sopImageId) return
    setSaving(true)
    setError(null)
    try {
      const json = sceneJsonRef.current
      const scene = (json
        ? JSON.parse(json)
        : { schemaVersion: 1, width: 0, height: 0, shapes: [] }) as {
        width?: number
        height?: number
      }
      const saved = await saveAnnotation({
        sopImageId: item.sopImageId,
        scene: scene as never,
        naturalWidth: scene.width ?? null,
        naturalHeight: scene.height ?? null,
      })
      if (!saved.success) {
        setError(saved.error)
        return
      }
      const stage = stageRef.current
      const bakedSrc = stage ? await bakeStageToVersionedPng(stage, item.sopImageId) : null
      if (!bakedSrc) {
        setError('Saved, but baking the image failed — retry.')
        return
      }
      onSaved({ annotationId: saved.annotationId, bakedSrc })
      onClose()
    } catch {
      setError('Could not save the annotation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Annotate diagram"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-steel-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-steel-700 px-4 py-2">
          <h2 className="text-sm font-semibold text-brand-yellow">Annotate diagram</h2>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              type="button"
              onClick={saveAndBake}
              disabled={!canPersist || saving}
              title={canPersist ? 'Save & bake' : 'Link an image to this diagram first'}
              className="rounded bg-brand-yellow px-3 py-1 text-xs font-semibold text-steel-900 disabled:opacity-40"
            >
              {saving ? 'Baking…' : 'Save & bake'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-xs text-white hover:bg-steel-700"
            >
              Close
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <AnnotationEditorLoader
            imageUrl={item.src ?? undefined}
            onChange={(json) => {
              sceneJsonRef.current = json
            }}
            onStageReady={(stage) => {
              stageRef.current = stage
            }}
          />
        </div>
      </div>
    </div>
  )
}
