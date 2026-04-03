import { z } from 'zod'
import type { SourceFileType } from '@/types/sop'

// GPT-4o structured output schemas (used with zodResponseFormat)
// OpenAI requires .nullable() not .optional() for structured outputs
export const SopStepSchema = z.object({
  order: z.number().int(),
  text: z.string(),
  warning: z.string().nullable(),
  caution: z.string().nullable(),
  tip: z.string().nullable(),
  required_tools: z.array(z.string()).nullable(),
  time_estimate_minutes: z.number().nullable(),
  has_image: z.boolean(),
})

export const SopSectionSchema = z.object({
  order: z.number().int(),
  type: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  steps: z.array(SopStepSchema).nullable(),
  confidence: z.number().min(0).max(1),
})

export const ParsedSopSchema = z.object({
  title: z.string(),
  sop_number: z.string().nullable(),
  revision_date: z.string().nullable(),
  author: z.string().nullable(),
  category: z.string().nullable(),
  related_sops: z.array(z.string()).nullable(),
  applicable_equipment: z.array(z.string()).nullable(),
  required_certifications: z.array(z.string()).nullable(),
  sections: z.array(SopSectionSchema),
  overall_confidence: z.number().min(0).max(1),
  parse_notes: z.string().nullable(),
})

export type ParsedSop = z.infer<typeof ParsedSopSchema>
export type ParsedSopSection = z.infer<typeof SopSectionSchema>
export type ParsedSopStep = z.infer<typeof SopStepSchema>

// Upload validation
const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic', // HEIC from iOS
  'image/heif', // HEIF variant
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/plain', // txt
] as const

// Macro-enabled Office formats — blocked for security (cannot be safely parsed)
const BLOCKED_MIME_TYPES = [
  'application/vnd.ms-excel.sheet.macroEnabled.12',       // xlsm
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12', // pptm
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12', // xlsb
] as const

const BLOCKED_EXTENSIONS = ['.xlsm', '.xlsb', '.xltm', '.pptm', '.potm', '.ppam'] as const

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export const uploadFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().max(MAX_FILE_SIZE, 'File must be under 50MB'),
  type: z.string().refine(
    (t) => (ACCEPTED_TYPES as readonly string[]).includes(t) && !(BLOCKED_MIME_TYPES as readonly string[]).includes(t),
    'Accepted formats: Word (.docx), PDF, Excel (.xlsx), PowerPoint (.pptx), plain text (.txt), or photos (jpg, png). Macro-enabled files are blocked for security.'
  ),
})

export const uploadSessionSchema = z.object({
  files: z.array(uploadFileSchema).min(1, 'Select at least one file').max(20, 'Maximum 20 files per batch'),
})

export type UploadFileInput = z.infer<typeof uploadFileSchema>

/**
 * Returns true if the filename has a macro-enabled Office extension.
 * Must be checked before any parsing library is invoked.
 */
export function isBlockedMacroFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return (BLOCKED_EXTENSIONS as readonly string[]).some((ext) => lower.endsWith(ext))
}

/**
 * Maps a MIME type to a SourceFileType.
 * Throws on unknown MIME types to prevent silent wrong routing (Research Pitfall 8).
 */
export function getSourceFileType(mimeType: string): SourceFileType {
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/heic' || mimeType === 'image/heif') return 'image'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx'
  if (mimeType === 'text/plain') return 'txt'
  throw new Error('Unsupported file type: ' + mimeType)
}
