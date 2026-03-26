'use client'
/**
 * StepPhotoZone — Camera capture UI with thumbnail grid per step.
 *
 * Per UI-SPEC C-01. Four states:
 *   A — photo_required, no photos: Orange container with [Take photo] button
 *   B — photo_required, has photos: Label + thumbnail grid + [+ Add] button
 *   C — optional, no photos: Ghost button "Add photo (optional)"
 *   D — optional, has photos: Label + thumbnail grid + [+ Add] button
 *
 * Uses hidden <input capture="environment"> for iOS-safe camera access.
 */
import { useRef } from 'react'
import { Camera, Plus } from 'lucide-react'
import type { SopStep } from '@/types/sop'
import type { QueuedPhoto } from '@/lib/offline/db'
import { PhotoThumbnail } from './PhotoThumbnail'

interface StepPhotoZoneProps {
  step: SopStep
  completionLocalId: string | null
  photos: QueuedPhoto[]
  onAddPhoto: (file: File) => Promise<void>
  onRemovePhoto: (localId: string) => void
}

export function StepPhotoZone({
  step,
  completionLocalId,
  photos,
  onAddPhoto,
  onRemovePhoto,
}: StepPhotoZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleCameraClick(e: React.MouseEvent) {
    e.stopPropagation()
    inputRef.current?.click()
  }

  async function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      await onAddPhoto(file)
    }
    // Reset so same file can be captured again
    if (inputRef.current) inputRef.current.value = ''
  }

  const hasPhotos = photos.length > 0
  const isRequired = !!step.photo_required

  // Hidden camera input — iOS-safe, uses rear camera by default
  const cameraInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="sr-only"
      onChange={handleCapture}
      aria-hidden
    />
  )

  // Shared thumbnail grid + add button (States B & D)
  const thumbnailGrid = (
    <div className="flex flex-wrap gap-2 mt-2">
      {photos.map((photo) => (
        <PhotoThumbnail
          key={photo.localId}
          photo={photo}
          onRemove={() => onRemovePhoto(photo.localId)}
        />
      ))}
      {/* [+ Add photo] button matching thumbnail size */}
      <button
        type="button"
        onClick={handleCameraClick}
        className="w-[72px] h-[72px] rounded-lg border-2 border-dashed border-steel-600 flex items-center justify-center hover:border-steel-400 transition-colors"
        aria-label="Add another photo"
      >
        <Plus size={22} className="text-steel-400" />
      </button>
    </div>
  )

  // State A: photo_required, no photos
  if (isRequired && !hasPhotos) {
    return (
      <div
        className="mt-3 rounded-xl bg-brand-orange/10 border border-brand-orange/40 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {cameraInput}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-brand-orange flex-shrink-0" />
            <span className="text-sm font-semibold text-brand-orange">Photo required</span>
          </div>
          <button
            type="button"
            onClick={handleCameraClick}
            className="flex items-center gap-1.5 h-[72px] px-4 bg-brand-orange text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition-colors flex-shrink-0"
          >
            <Camera size={16} />
            Take photo
          </button>
        </div>
      </div>
    )
  }

  // State B: photo_required, has photos
  if (isRequired && hasPhotos) {
    return (
      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        {cameraInput}
        <div className="flex items-center gap-1.5">
          <Camera size={14} className="text-brand-orange" />
          <span className="text-[13px] font-bold tabular-nums text-brand-orange">
            Photo required · {photos.length} attached
          </span>
        </div>
        {thumbnailGrid}
      </div>
    )
  }

  // State C: optional, no photos
  if (!isRequired && !hasPhotos) {
    return (
      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        {cameraInput}
        <button
          type="button"
          onClick={handleCameraClick}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-steel-600 text-steel-400 text-sm hover:border-steel-400 hover:text-steel-300 transition-colors"
        >
          <Camera size={14} />
          Add photo (optional)
        </button>
      </div>
    )
  }

  // State D: optional, has photos
  return (
    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
      {cameraInput}
      <div className="flex items-center gap-1.5">
        <Camera size={14} className="text-steel-400" />
        <span className="text-[13px] font-bold tabular-nums text-steel-300">
          Photos · {photos.length} attached
        </span>
      </div>
      {thumbnailGrid}
    </div>
  )
}
