'use client'
/**
 * usePhotoQueue — Dexie photo queue state hook.
 *
 * Reads from db.photoQueue with 2-second polling to pick up upload status
 * changes from the sync engine (which runs independently).
 *
 * dexie-react-hooks is not installed — uses useEffect + useState pattern.
 */
import { useState, useEffect, useCallback } from 'react'
import { db, type QueuedPhoto } from '@/lib/offline/db'
import { compressPhoto } from '@/lib/offline/photo-compress'

interface UsePhotoQueueResult {
  photos: QueuedPhoto[]
  photosForStep: (stepId: string) => QueuedPhoto[]
  queueCount: number
  uploadedCount: number
}

export function usePhotoQueue(completionLocalId: string | null): UsePhotoQueueResult {
  const [photos, setPhotos] = useState<QueuedPhoto[]>([])

  const fetchPhotos = useCallback(async () => {
    if (!completionLocalId) {
      setPhotos([])
      return
    }
    try {
      const results = await db.photoQueue
        .where('completionLocalId')
        .equals(completionLocalId)
        .toArray()
      setPhotos(results)
    } catch {
      // Dexie not available (SSR) — ignore
    }
  }, [completionLocalId])

  useEffect(() => {
    fetchPhotos()
    const interval = setInterval(fetchPhotos, 2000)
    return () => clearInterval(interval)
  }, [fetchPhotos])

  const photosForStep = useCallback(
    (stepId: string) => photos.filter((p) => p.stepId === stepId),
    [photos]
  )

  const queueCount = photos.filter((p) => !p.uploaded).length
  const uploadedCount = photos.filter((p) => p.uploaded).length

  return { photos, photosForStep, queueCount, uploadedCount }
}

/**
 * Add a photo to the Dexie photo queue.
 * Compresses the file to ~200KB before writing.
 */
export async function addPhotoToQueue(params: {
  completionLocalId: string
  stepId: string
  file: File
}): Promise<void> {
  const { completionLocalId, stepId, file } = params
  const compressed = await compressPhoto(file)
  const localId = crypto.randomUUID()
  await db.photoQueue.put({
    localId,
    completionLocalId,
    stepId,
    blob: compressed,
    contentType: 'image/jpeg',
    capturedAt: Date.now(),
    uploaded: false,
    storagePath: null,
  })
}

/**
 * Remove a photo from the queue.
 * Only works for photos that have NOT been uploaded yet.
 * Already-uploaded photos are immutable.
 */
export async function removePhoto(localId: string): Promise<void> {
  const photo = await db.photoQueue.get(localId)
  if (photo && !photo.uploaded) {
    await db.photoQueue.delete(localId)
  }
}
