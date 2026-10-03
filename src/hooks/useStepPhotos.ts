'use client'
/**
 * useStepPhotos -- photos taken during one walk, uploaded straight away.
 *
 * compress -> getPhotoUploadUrl (server action) -> signed PUT. State lives in
 * memory only; the storage path goes to submitCompletion once the walk ends.
 * Each photo is tagged with the completion it was taken under and every view
 * is filtered to the active completion, so a second walk never sees (or
 * submits) the first walk's photos.
 */
import { useCallback, useMemo, useState } from 'react'
import { compressPhoto } from '@/lib/photo/compress'
import { getPhotoUploadUrl } from '@/actions/completions'

export type StepPhoto = {
  localId: string
  completionId: string
  stepId: string
  storagePath: string | null
  status: 'uploading' | 'uploaded' | 'error'
}

export function useStepPhotos(activeCompletionId: string | undefined) {
  const [allPhotos, setPhotos] = useState<StepPhoto[]>([])
  const photos = useMemo(
    () => allPhotos.filter((p) => p.completionId === activeCompletionId),
    [allPhotos, activeCompletionId]
  )

  const patch = useCallback((localId: string, change: Partial<StepPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.localId === localId ? { ...p, ...change } : p)))
  }, [])

  const addPhoto = useCallback(
    async (completionId: string, stepId: string, file: File) => {
      const localId = crypto.randomUUID()
      setPhotos((prev) => [...prev, { localId, completionId, stepId, storagePath: null, status: 'uploading' }])
      try {
        const blob = await compressPhoto(file)
        const result = await getPhotoUploadUrl({
          localId,
          contentType: 'image/jpeg',
          completionLocalId: completionId,
        })
        if ('error' in result) return patch(localId, { status: 'error' })
        const res = await fetch(result.url, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        })
        if (!res.ok) return patch(localId, { status: 'error' })
        patch(localId, { status: 'uploaded', storagePath: result.path })
      } catch {
        patch(localId, { status: 'error' })
      }
    },
    [patch]
  )

  const removePhoto = useCallback((localId: string) => {
    setPhotos((prev) => prev.filter((p) => p.localId !== localId))
  }, [])

  const photosForStep = useCallback(
    (stepId: string) => photos.filter((p) => p.stepId === stepId),
    [photos]
  )

  const uploadingCount = photos.filter((p) => p.status === 'uploading').length
  const uploadedPhotos = photos
    .filter((p) => p.status === 'uploaded' && p.storagePath !== null)
    .map((p) => ({
      localId: p.localId,
      stepId: p.stepId,
      storagePath: p.storagePath as string,
      contentType: 'image/jpeg',
    }))

  return { photosForStep, uploadingCount, uploadedPhotos, addPhoto, removePhoto }
}
