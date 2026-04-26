// Phase 12.5 — new union types for blocks + voice + escalation
export type VoiceNoteBlockType = 'measurement' | 'note'
export type EscalationMode = 'alert' | 'lock' | 'form'
export type VoiceLanguage = 'en-NZ' | 'en-AU' | 'en-US'
export type EscalationStatus = 'open' | 'acknowledged' | 'resolved'

export type SopStatus = 'uploading' | 'parsing' | 'draft' | 'published'
export type ParseJobStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type SourceFileType = 'docx' | 'pdf' | 'image' | 'xlsx' | 'pptx' | 'txt' | 'video'
export type InputType = 'upload' | 'scan' | 'url' | 'video_file' | 'youtube_url'
export type CompletionStatus = 'pending_sign_off' | 'signed_off' | 'rejected'
export type SourceType = 'uploaded' | 'blank' | 'ai' | 'template'

export type VideoProcessingStage =
  | 'uploading'
  | 'extracting_audio'
  | 'transcribing'
  | 'structuring'
  | 'verifying'
  | 'completed'
  | 'failed'

export interface TranscriptSegment {
  start: number // seconds
  end: number // seconds
  text: string
}

export interface VerificationFlag {
  severity: 'critical' | 'warning'
  section_title: string
  step_number?: number
  original_text: string
  structured_text: string
  description: string
}

export interface Sop {
  id: string
  organisation_id: string
  title: string | null
  sop_number: string | null
  revision_date: string | null
  author: string | null
  category: string | null
  department: string | null
  related_sops: string[] | null
  applicable_equipment: string[] | null
  required_certifications: string[] | null
  status: SopStatus
  version: number
  source_file_path: string
  source_file_type: SourceFileType
  source_file_name: string
  overall_confidence: number | null
  parse_notes: string | null
  is_ocr: boolean
  uploaded_by: string
  published_at: string | null
  pipeline_run_id?: string | null
  source_type: SourceType
  created_at: string
  updated_at: string
}

export interface SopSection {
  id: string
  sop_id: string
  section_type: string                // legacy free-text, still populated
  section_kind_id: string | null      // v3.0 advisory FK (nullable)
  section_kind?: SectionKind | null   // optional join, populated by useSopDetail
  title: string
  content: string | null
  sort_order: number
  confidence: number | null
  approved: boolean
  layout_data: unknown | null
  layout_version: number | null
  created_at: string
  updated_at: string
}

export interface SopStep {
  id: string
  section_id: string
  step_number: number
  text: string
  warning: string | null
  caution: string | null
  tip: string | null
  required_tools: string[] | null
  time_estimate_minutes: number | null
  photo_required?: boolean
  created_at: string
  updated_at: string
}

export interface SopImage {
  id: string
  sop_id: string
  section_id: string | null
  step_id: string | null
  storage_path: string
  content_type: string
  alt_text: string | null
  sort_order: number
  created_at: string
}

export interface ParseJob {
  id: string
  organisation_id: string
  sop_id: string
  status: ParseJobStatus
  file_path: string
  file_type: SourceFileType
  input_type?: InputType
  error_message: string | null
  retry_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  current_stage?: VideoProcessingStage | null
  transcript_segments?: TranscriptSegment[] | null
  transcript_text?: string | null
  verification_flags?: VerificationFlag[] | null
  youtube_url?: string | null
  updated_at?: string
  pipeline_run_id?: string | null
}

// Pipeline run types (D-06)
export type PipelineVideoFormat = 'narrated_slideshow' | 'screen_recording'
export type PipelineRunStatus = 'active' | 'completed' | 'failed' | 'cancelled'

export interface SopPipelineRun {
  id: string
  organisation_id: string
  requested_video_format: PipelineVideoFormat
  status: PipelineRunStatus
  created_by: string
  created_at: string
  updated_at: string
}

// Video SOP generation types
export type VideoGenStatus = 'queued' | 'analyzing' | 'generating_audio' | 'rendering' | 'ready' | 'failed'
export type VideoFormat = 'narrated_slideshow' | 'screen_recording'
export type CompletionType = 'walkthrough' | 'video_view'

export interface ChapterMarker {
  sectionId: string
  title: string
  timestamp: number // seconds from video start
}

export interface VideoGenerationJob {
  id: string
  organisation_id: string
  sop_id: string
  sop_version: number
  format: VideoFormat
  status: VideoGenStatus
  current_stage: string | null
  shotstack_render_id: string | null
  video_url: string | null
  chapter_markers: ChapterMarker[] | null
  error_message: string | null
  published: boolean
  created_by: string
  completed_at: string | null
  created_at: string
  updated_at: string
  version_number: number
  label: string | null
  archived: boolean
}

// SOP with nested sections for review page
export interface SopWithSections extends Sop {
  sop_sections: (SopSection & {
    sop_steps: SopStep[]
    sop_images: SopImage[]
  })[]
}

// Upload session returned from server action
export interface UploadSession {
  sopId: string
  uploadUrl: string
  token: string
  path: string
}

// ---------------------------------------------------------------
// v3.0: Section Kinds catalog + Reusable Blocks
// Matches supabase/migrations/00019_section_kinds_and_blocks.sql
// ---------------------------------------------------------------

export type SectionRenderFamily =
  | 'hazard'
  | 'ppe'
  | 'steps'
  | 'content'
  | 'signoff'
  | 'emergency'
  | 'custom'

export interface SectionKind {
  id: string
  organisation_id: string | null   // null = global/canonical
  slug: string
  display_name: string
  render_family: SectionRenderFamily
  icon: string | null              // lucide icon name
  color_family: string | null      // brand palette key
  render_priority: number
  description: string | null
  created_at: string
  updated_at: string
}

// Discriminated-union payload for block_versions.content
export type BlockContent =
  | { kind: 'hazard';    text: string; severity: 'critical' | 'warning' | 'notice' }
  | { kind: 'ppe';       items: string[] }
  | { kind: 'step';      text: string; warning?: string; tip?: string }
  | { kind: 'emergency'; text: string; contacts?: string[] }
  | { kind: 'custom';    data: Record<string, unknown> }

export interface Block {
  id: string
  organisation_id: string | null
  kind_slug: string
  name: string
  category: string | null
  current_version_id: string | null
  archived_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BlockVersion {
  id: string
  block_id: string
  version_number: number
  content: BlockContent
  change_note: string | null
  created_by: string | null
  created_at: string
}

export type PinMode = 'pinned' | 'follow_latest'

export interface SopSectionBlock {
  id: string
  sop_section_id: string
  block_id: string
  pinned_version_id: string | null
  pin_mode: PinMode
  snapshot_content: BlockContent
  overridden_at: string | null
  update_available: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
