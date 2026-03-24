import { createAdminClient } from '@/lib/supabase/admin'
import type { ExtractedImage } from './extract-docx'

export interface UploadedImage {
  storagePath: string
  contentType: string
  index: number
}

/**
 * Uploads extracted images (base64) to the sop-images Storage bucket.
 * Returns storage paths for linking to sop_images table records.
 */
export async function uploadExtractedImages(
  organisationId: string,
  sopId: string,
  images: ExtractedImage[]
): Promise<UploadedImage[]> {
  if (images.length === 0) return []

  const admin = createAdminClient()
  const uploaded: UploadedImage[] = []

  for (const image of images) {
    const ext = image.contentType === 'image/png' ? 'png' : 'jpg'
    const path = `${organisationId}/${sopId}/images/img_${image.index}.${ext}`

    // Convert base64 to Uint8Array
    const binaryString = atob(image.base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const { error } = await admin.storage
      .from('sop-images')
      .upload(path, bytes, {
        contentType: image.contentType,
        upsert: true,
      })

    if (error) {
      console.error(`Failed to upload image ${image.index}:`, error)
      continue // skip failed images, don't abort entire parse
    }

    uploaded.push({
      storagePath: path,
      contentType: image.contentType,
      index: image.index,
    })
  }

  return uploaded
}
