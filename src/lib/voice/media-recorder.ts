'use client'

export const PREFERENCE_CHAIN = [
  {
    mimeType: 'audio/webm;codecs=opus',
    deepgramEncoding: 'opus',
    sampleRate: 48000,
    ext: 'webm' as const,
  },
  {
    mimeType: 'audio/webm',
    deepgramEncoding: 'opus',
    sampleRate: 48000,
    ext: 'webm' as const,
  },
  {
    mimeType: 'audio/ogg;codecs=opus',
    deepgramEncoding: 'opus',
    sampleRate: 48000,
    ext: 'ogg' as const,
  },
  {
    mimeType: 'audio/mp4',
    deepgramEncoding: 'aac',
    sampleRate: 44100,
    ext: 'mp4' as const,
  },
] as const

export type RecorderFormat = (typeof PREFERENCE_CHAIN)[number]

export function pickRecorderFormat(): RecorderFormat | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return null
  for (const entry of PREFERENCE_CHAIN) {
    if (MediaRecorder.isTypeSupported(entry.mimeType)) return entry
  }
  return null
}

export function isVoiceCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined' &&
    pickRecorderFormat() !== null
  )
}
