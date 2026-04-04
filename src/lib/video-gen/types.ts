/**
 * Shared types for the video SOP generation pipeline.
 * Used by tts.ts, shotstack-client.ts, and the generation API route.
 */

export interface SectionWithAudio {
  sectionId: string
  title: string
  contentHtml: string     // HTML for slide rendering
  contentText: string     // Plain text for TTS input
  sectionType: string     // e.g. 'hazards', 'ppe', 'steps', 'emergency'
  audioStorageUrl: string // Supabase Storage public/presigned URL for the audio file
  audioDuration: number   // Duration in seconds
}

export interface ShotstackClip {
  asset:
    | { type: 'html'; html: string; width?: number; height?: number }
    | { type: 'audio'; src: string }
    | { type: 'image'; src: string }
  start: number
  length: number
}

export interface ShotstackTrack {
  clips: ShotstackClip[]
}

export interface ShotstackEdit {
  timeline: {
    tracks: ShotstackTrack[]
    soundtrack?: { src: string; effect?: 'fadeIn' | 'fadeOut'; volume?: number }
  }
  output: { format: 'mp4'; resolution: 'hd' }
  callback?: string
}

export interface ShotstackRenderResponse {
  status: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed'
  url?: string
  error?: string
}
