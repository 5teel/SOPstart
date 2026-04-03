import * as tus from 'tus-js-client'

export interface TusUploadOptions {
  file: File
  storagePath: string        // e.g. '{org_id}/{sop_id}/original/{filename}'
  accessToken: string        // Supabase session access_token
  bucketName?: string        // defaults to 'sop-documents'
  onProgress?: (percentage: number) => void
  onSuccess?: () => void
  onError?: (error: Error) => void
}

// Supabase TUS requires exactly 6MB chunks
const CHUNK_SIZE = 6 * 1024 * 1024

export function tusUpload(options: TusUploadOptions): tus.Upload {
  const {
    file,
    storagePath,
    accessToken,
    bucketName = 'sop-documents',
    onProgress,
    onSuccess,
    onError,
  } = options

  const upload = new tus.Upload(file, {
    endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
    retryDelays: [0, 1000, 3000, 5000],
    chunkSize: CHUNK_SIZE, // Exactly 6MB — Supabase hard requirement
    headers: {
      authorization: `Bearer ${accessToken}`,
      'x-upsert': 'true',
    },
    metadata: {
      bucketName,
      objectName: storagePath,
      contentType: file.type,
    },
    onProgress: (bytesUploaded: number, bytesTotal: number) => {
      const pct = Math.round((bytesUploaded / bytesTotal) * 100)
      onProgress?.(pct)
    },
    onSuccess: () => {
      onSuccess?.()
    },
    onError: (error: Error) => {
      onError?.(error)
    },
  })

  return upload
}

// Threshold: use TUS for files > 10MB, presigned URL for smaller
export const TUS_THRESHOLD = 10 * 1024 * 1024
