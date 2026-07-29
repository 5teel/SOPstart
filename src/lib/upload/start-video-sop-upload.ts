import { tusUpload } from '@/lib/upload/tus-upload'

export interface StartVideoSopUploadSession {
  sopId: string
  path: string
  token: string
}

export interface StartVideoSopUploadArgs {
  file: File
  session: StartVideoSopUploadSession
  onProgress: (percent: number) => void
  onError?: (message: string) => void
}

export interface StartVideoSopUploadResult {
  ok: boolean
  error?: string
}

/**
 * The one client routine that extracts audio from a video SOP source,
 * TUS-uploads it, and triggers transcription. Extracted from
 * UploadDropzone.handleUpload's inline video branch so the new-version page
 * (plan 40-07) and the video-generate modal can reuse it instead of growing
 * a third copy.
 *
 * Progress: audio extraction is the first half of the bar (0-50%), the TUS
 * upload is the second half (50-100%) -- preserves current behaviour exactly.
 */
export async function startVideoSopUpload({
  file,
  session,
  onProgress,
  onError,
}: StartVideoSopUploadArgs): Promise<StartVideoSopUploadResult> {
  try {
    const { extractAudioFromVideo } = await import('@/lib/parsers/extract-video-audio')

    const audioFile = await extractAudioFromVideo(file, (pct) => {
      onProgress(Math.round(pct / 2))
    })

    return await new Promise<StartVideoSopUploadResult>((resolve) => {
      const upload = tusUpload({
        file: audioFile,
        storagePath: session.path,
        accessToken: session.token,
        bucketName: 'sop-videos',
        onProgress: (pct) => {
          onProgress(50 + Math.round(pct / 2))
        },
        onSuccess: () => {
          fetch('/api/sops/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sopId: session.sopId }),
          }).catch(console.error)
          resolve({ ok: true })
        },
        onError: (err) => {
          const message = err.message || 'Upload failed'
          onError?.(message)
          resolve({ ok: false, error: message })
        },
      })
      upload.start()
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video processing failed'
    onError?.(message)
    return { ok: false, error: message }
  }
}
