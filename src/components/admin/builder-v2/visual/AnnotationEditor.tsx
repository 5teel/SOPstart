'use client'

/**
 * Phase 26 / Plan 26-05 (D-03, R5) — Konva-in-Next-16 spike shell.
 *
 * Minimal react-konva <Stage> proving Konva mounts under Next 16 with
 * `serverExternalPackages: ['canvas']` + `dynamic({ ssr:false })`. The real
 * annotation editor (draw primitives, transformer, undo, bake-on-publish) is
 * built in Plan 26-13 on top of this foundation.
 *
 * HARD CONSTRAINT: this module statically imports `react-konva` and MUST only
 * ever be reached through `AnnotationEditorLoader` (dynamic ssr:false) from
 * admin builder-v2 code — never the worker `/sops/[sopId]` bundle. The
 * `konva-worker-isolation` lint + `check-bundle-size` gate enforce this.
 *
 * Pitfall 5 (26-RESEARCH): Stage instances leak on React StrictMode remount —
 * `stage.destroy()` in effect cleanup releases the underlying canvas.
 */
import { useEffect, useRef } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'

type AnnotationEditorProps = {
  naturalWidth?: number
  naturalHeight?: number
}

export default function AnnotationEditor({
  naturalWidth = 400,
  naturalHeight = 300,
}: AnnotationEditorProps) {
  const stageRef = useRef<Konva.Stage | null>(null)

  // Pitfall 5: explicit teardown so a StrictMode double-mount doesn't leak the
  // first Stage's canvas element / event listeners.
  useEffect(() => {
    const stage = stageRef.current
    return () => {
      stage?.destroy()
    }
  }, [])

  return (
    <Stage ref={stageRef} width={naturalWidth} height={naturalHeight}>
      <Layer>
        <Rect
          x={20}
          y={20}
          width={Math.max(0, naturalWidth - 40)}
          height={Math.max(0, naturalHeight - 40)}
          stroke="#f5c518"
          strokeWidth={2}
        />
      </Layer>
    </Stage>
  )
}
