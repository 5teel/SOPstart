import { z } from 'zod'
import type { SourceFileType } from '@/types/sop'
import {
  ACCEPTED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_VIDEO_FILE_SIZE,
  VIDEO_MIME_TYPES,
  INTAKE_HINT,
} from '@/lib/upload/file-intake'

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
  // Phase 20 interim — image positions extracted from DOCX as [IMAGE N] tokens
  // in the source text. GPT must list every [IMAGE N] index that appears in or
  // immediately around this step. Empty array if no image tokens were near the step.
  image_indexes: z.array(z.number().int()).nullable(),
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

// Upload validation — accept list, blocked lists and size limits derive from
// the single shared intake module (Phase 40 DUP-01 / WR-01): this schema is
// the authoritative server-side gate, but it must agree with the client's
// shared validateIntakeFile on every type it advertises as supported.
export const uploadFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().max(MAX_FILE_SIZE, 'File must be under 50MB'),
  type: z.string().refine(
    (t) => (ACCEPTED_MIME_TYPES as readonly string[]).includes(t) && !(BLOCKED_MIME_TYPES as readonly string[]).includes(t),
    `Accepted formats: ${INTAKE_HINT}. Macro-enabled files are blocked for security.`
  ),
})

export const uploadVideoFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().max(MAX_VIDEO_FILE_SIZE, 'Video must be under 2GB'),
  type: z.string().refine(
    (t) => (VIDEO_MIME_TYPES as readonly string[]).includes(t),
    'Accepted video formats: MP4 (.mp4) or MOV (.mov)'
  ),
})

export const youtubeUrlSchema = z.string().refine(
  (url) => {
    try {
      const u = new URL(url)
      return (
        u.hostname === 'www.youtube.com' ||
        u.hostname === 'youtube.com' ||
        u.hostname === 'youtu.be' ||
        u.hostname === 'm.youtube.com'
      )
    } catch {
      return false
    }
  },
  "That doesn't look like a YouTube URL. Check the link and try again."
)

export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1)
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2]
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

export const uploadSessionSchema = z.object({
  files: z.array(uploadFileSchema).min(1, 'Select at least one file').max(20, 'Maximum 20 files per batch'),
})

export type UploadFileInput = z.infer<typeof uploadFileSchema>

// Pipeline session validators (D-06)
export const pipelineVideoFormatSchema = z.enum(['narrated_slideshow', 'screen_recording'])

export const createVideoSopPipelineSessionSchema = z.object({
  file: z.object({
    name: z.string().min(1).max(255),
    size: z.number().int().positive(),
    type: z.string().min(1),
  }),
  format: pipelineVideoFormatSchema,
})

// Video generation validators
export const generateVideoSchema = z.object({
  sopId: z.string().uuid(),
  format: z.enum(['narrated_slideshow', 'screen_recording']),
})

export const recordVideoViewSchema = z.object({
  sopId: z.string().uuid(),
  sopVersion: z.number().int().positive(),
  videoJobId: z.string().uuid(),
})

export const updateVersionLabelSchema = z.object({
  jobId: z.string().uuid(),
  label: z.string().max(60).trim().nullable(),
})

/**
 * Phase 14: AI-prompt entry validator.
 * - D-06: min(20) blocks wasted-call prompts ("make me an SOP")
 * - Pitfall #6: max(2000) bounds LLM cost from pasted policy documents
 * - detailLevel mirrors the existing parseSop(detailLevel: 1-5) parameter
 * - Phase 40 DAT-01: categorySlug references the fixed SOP_CATEGORIES vocab
 *   (src/lib/sop-categories.ts), validated at the write site, not here (an
 *   unknown slug degrades to null rather than 400ing the whole request).
 * - Phase 40 CRE (shared metadata picker): optional title, submitted by
 *   plan 40-08's shared picker. Admin-supplied title wins over the
 *   AI-derived fallback (see ai-prompt/route.ts).
 */
export const aiPromptSchema = z.object({
  promptText: z
    .string()
    .min(20, 'Prompt must be at least 20 characters — describe the procedure, site, or worker role')
    .max(2000, 'Prompt cannot exceed 2000 characters — paste a shorter brief'),
  categorySlug: z.string().nullable().optional(),
  title: z.string().min(1).max(200).nullable().optional(),
  detailLevel: z.number().int().min(1).max(5).default(3),
})

export type AiPromptInput = z.infer<typeof aiPromptSchema>

/**
 * Phase 21 (Plan 21-01) / D-CV2-06 — block_provenance JSONB shape.
 *
 * The wrapping record `{ region, parser_run_id, parser_version }` is what
 * sits on each `sop_section_blocks.block_provenance` row. The inner `region`
 * is a discriminated union over the 5 source kinds:
 *   - pdf   : page + bbox + page dims (Spike 001 / 002)
 *   - docx  : paragraph_id + run offsets (commit 7b9151e structural anchor)
 *   - scan  : OCR image crop bbox
 *   - video : timestamp range (CONV-11 — frame-grab deferred)
 *   - ai_prompt : the prompt text itself (CONV-12 — Jobs D+E only)
 *
 * NULL is also a valid value at the DB column level (pre-Phase-21 rows survive
 * without provenance). The Zod schemas below only validate present payloads.
 */
export const SourceProvenanceRegionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pdf'),
    page: z.number().int().positive(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    pageWidth: z.number().positive(),
    pageHeight: z.number().positive(),
  }),
  z.object({
    kind: z.literal('docx'),
    paragraph_id: z.string().min(1),
    run_start: z.number().int().nonnegative(),
    run_end: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('scan'),
    image_crop: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
  z.object({
    kind: z.literal('video'),
    timestamp_start: z.number().nonnegative(),
    timestamp_end: z.number().nonnegative(),
  }),
  z.object({
    kind: z.literal('ai_prompt'),
    prompt_text: z.string().min(1),
  }),
])

export type SourceProvenanceRegion = z.infer<typeof SourceProvenanceRegionSchema>

/**
 * The full record stored on sop_section_blocks.block_provenance.
 * `parser_run_id` is a soft reference to `parse_jobs.id` (string, not FK).
 * `parser_version` is a semver-ish tag set by the parser at write time.
 */
export const BlockProvenanceRecordSchema = z.object({
  region: SourceProvenanceRegionSchema,
  parser_run_id: z.string().min(1),
  parser_version: z.string().min(1),
})

export type BlockProvenanceRecord = z.infer<typeof BlockProvenanceRecordSchema>

/**
 * Alias kept for plan-checker artifact contract ("BlockProvenanceSchema" was
 * the name requested in the plan). Identical to BlockProvenanceRecordSchema.
 */
export const BlockProvenanceSchema = BlockProvenanceRecordSchema
export type BlockProvenance = BlockProvenanceRecord

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
 * Throws on unknown MIME types to prevent silent wrong routing.
 */
export function getSourceFileType(mimeType: string): SourceFileType {
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/heic' || mimeType === 'image/heif') return 'image'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx'
  if (mimeType === 'text/plain') return 'txt'
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') return 'video'
  throw new Error('Unsupported file type: ' + mimeType)
}
