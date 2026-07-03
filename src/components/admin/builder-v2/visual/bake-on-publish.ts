'use client'

/**
 * Phase 26 Plan 26-13 (D-03, R8) — flatten an annotated diagram Stage to a
 * content-versioned baked PNG for the Konva-FREE worker read path.
 *
 * The CLIENT only rasterises (`stage.toDataURL`); the `bakeAnnotation` server
 * action owns versioning + the service-role storage upload + the
 * baked_storage_path write. Lives in builder-v2/visual/ so its `import type Konva`
 * stays inside the Konva allow-list dir (konva-worker-isolation gate) and is only
 * ever invoked from the admin annotate flow — never the worker bundle.
 *
 * Runs at annotation SAVE (the Stage is live in the editor) rather than a headless
 * publish pass: the baked PNG + baked_storage_path outcome is identical, without
 * mounting an offscreen Stage per diagram at publish time.
 */
import type Konva from 'konva'
import { bakeAnnotation } from '@/actions/annotations'

/** Rasterise the live Stage → PNG and hand it to the versioning/upload action. */
export async function bakeStageToVersionedPng(
  stage: Konva.Stage,
  sopImageId: string
): Promise<string | null> {
  // pixelRatio 2 keeps callouts/arrows crisp on the worker's retina phones.
  const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 2 })
  const res = await bakeAnnotation({ sopImageId, dataUrl })
  return res.success ? res.bakedStoragePath : null
}
