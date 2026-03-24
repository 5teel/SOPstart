import { z } from 'zod'

// GPT-4o structured output schemas (used with zodResponseFormat)
export const SopStepSchema = z.object({
  order: z.number().int(),
  text: z.string(),
  warning: z.string().optional(),
  caution: z.string().optional(),
  tip: z.string().optional(),
  required_tools: z.array(z.string()).optional(),
  time_estimate_minutes: z.number().optional(),
  has_image: z.boolean(),
})

export const SopSectionSchema = z.object({
  order: z.number().int(),
  type: z.string(),
  title: z.string(),
  content: z.string().optional(),
  steps: z.array(SopStepSchema).optional(),
  confidence: z.number().min(0).max(1),
})

export const ParsedSopSchema = z.object({
  title: z.string(),
  sop_number: z.string().optional(),
  revision_date: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  related_sops: z.array(z.string()).optional(),
  applicable_equipment: z.array(z.string()).optional(),
  required_certifications: z.array(z.string()).optional(),
  sections: z.array(SopSectionSchema),
  overall_confidence: z.number().min(0).max(1),
  parse_notes: z.string().optional(),
})

export type ParsedSop = z.infer<typeof ParsedSopSchema>
export type ParsedSopSection = z.infer<typeof SopSectionSchema>
export type ParsedSopStep = z.infer<typeof SopStepSchema>

// Upload validation
const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export const uploadFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().max(MAX_FILE_SIZE, 'File must be under 50MB'),
  type: z.string().refine(
    (t) => (ACCEPTED_TYPES as readonly string[]).includes(t),
    'Accepted formats: Word (.docx), PDF, or photos (jpg, png)'
  ),
})

export const uploadSessionSchema = z.object({
  files: z.array(uploadFileSchema).min(1, 'Select at least one file').max(20, 'Maximum 20 files per batch'),
})

export type UploadFileInput = z.infer<typeof uploadFileSchema>

export function getSourceFileType(mimeType: string): 'docx' | 'pdf' | 'image' {
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'image'
}
