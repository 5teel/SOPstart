export type SopStatus = 'uploading' | 'parsing' | 'draft' | 'published'
export type ParseJobStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type SourceFileType = 'docx' | 'pdf' | 'image'

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
  created_at: string
  updated_at: string
}

export interface SopSection {
  id: string
  sop_id: string
  section_type: string
  title: string
  content: string | null
  sort_order: number
  confidence: number | null
  approved: boolean
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
  error_message: string | null
  retry_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
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
