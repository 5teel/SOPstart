'use server'

/**
 * SOP schema introspection — canonical AI-facing description of the SOP
 * data model.
 *
 * Phase 58 repointed this from the block registry onto the step model: a SOP
 * is sections, each holding focus steps of four kinds (hazard, ppe, step,
 * check). An AI agent (or any external integration) can call this once and get
 * what it needs to author a valid SOP.
 *
 * Consumed by GET /api/schema. No auth required — the response is
 * schema metadata, not tenant data. No RLS concerns.
 *
 * When adding a step kind, enum value or field, reflect it here: this file is
 * the single source of truth the AI relies on.
 */

import { toJSONSchema } from 'zod'
import {
  StepDataSchema,
  SignOffDecisionSchema,
} from '@/lib/validators/completions'

// Inline mirror of the SopStatus / SourceType / etc. unions in src/types/sop.ts.
// Duplication is deliberate: the TypeScript unions exist for compile-time
// inference; the arrays below are runtime-queryable by an AI.
const SOP_STATUSES = ['uploading', 'parsing', 'draft', 'published'] as const
const PARSE_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const
const SOURCE_FILE_TYPES = ['docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt', 'video'] as const
const INPUT_TYPES = ['upload', 'scan', 'url', 'video_file', 'youtube_url'] as const
const COMPLETION_STATUSES = ['pending_sign_off', 'signed_off', 'rejected'] as const
const SOURCE_TYPES = ['uploaded', 'blank', 'ai', 'template'] as const
const VIDEO_PROCESSING_STAGES = [
  'uploading', 'extracting_audio', 'transcribing', 'structuring',
  'verifying', 'completed', 'failed',
] as const

type StepKindDescriptor = {
  id: 'hazard' | 'ppe' | 'step' | 'check'
  description: string
  example: { text: string; tip?: string }
}

const STEP_KINDS: StepKindDescriptor[] = [
  {
    id: 'hazard',
    description: 'Something that can hurt someone. Walked first, before the job starts.',
    example: { text: 'Crush hazard: keep hands clear of the ram.' },
  },
  {
    id: 'ppe',
    description: 'Protective equipment to put on. Walked first, before the job starts.',
    example: { text: 'Cut-resistant gloves and safety glasses.' },
  },
  {
    id: 'step',
    description: 'One thing to do. Steps are numbered within their section.',
    example: { text: 'Lower the guard until it clicks.', tip: 'It should click twice.' },
  },
  {
    id: 'check',
    description: 'Something to confirm before moving on.',
    example: { text: 'Guard is seated and the ready light is green.' },
  },
]

export type SopSchemaDescription = {
  version: 2
  model: {
    summary: string
    section_fields: Record<string, string>
    step_fields: Record<string, string>
    kinds: StepKindDescriptor[]
  }
  completion: {
    step_data_schema: unknown
    signoff_decisions: readonly string[]
  }
  enums: {
    sop_status: readonly string[]
    parse_job_status: readonly string[]
    source_file_type: readonly string[]
    input_type: readonly string[]
    completion_status: readonly string[]
    source_type: readonly string[]
    video_processing_stage: readonly string[]
  }
  notes: {
    storage_path_convention: string
    completion_immutability: string
    rls: string
    versions: string
  }
}

export async function describeSopSchema(): Promise<SopSchemaDescription> {
  return {
    version: 2,
    model: {
      summary:
        'A SOP has sections; each section holds focus steps. Workers walk every hazard and PPE step first, then each section\'s steps in order. Steps carry text, an optional tip, an optional photo requirement and optional images.',
      section_fields: {
        title: 'string',
        section_type: 'string (free text, AI-detected on upload)',
        content: 'string | null (introductory text)',
        sort_order: 'integer, order within the SOP',
      },
      step_fields: {
        kind: "'hazard' | 'ppe' | 'step' | 'check'",
        text: 'string, required',
        tip: 'string | null',
        photo_required: 'boolean, the worker must attach a photo to continue',
        image_paths: 'string[] of storage paths the step shows',
        required_tools: 'string[] | null',
        time_estimate_minutes: 'number | null',
        sort_order: 'integer, order within the section',
      },
      kinds: STEP_KINDS,
    },
    completion: {
      step_data_schema: toJSONSchema(StepDataSchema),
      signoff_decisions: [...SignOffDecisionSchema.options] as string[],
    },
    enums: {
      sop_status: SOP_STATUSES,
      parse_job_status: PARSE_JOB_STATUSES,
      source_file_type: SOURCE_FILE_TYPES,
      input_type: INPUT_TYPES,
      completion_status: COMPLETION_STATUSES,
      source_type: SOURCE_TYPES,
      video_processing_stage: VIDEO_PROCESSING_STAGES,
    },
    notes: {
      storage_path_convention:
        "{organisation_id}/{sop_id}/{section_id?}/{step_id?}/{image_id} - org prefix enables RLS via `auth.jwt()->>'organisation_id'`.",
      completion_immutability:
        'sop_completions is append-only: no UPDATE/DELETE policies exist for authenticated role. Use client UUID as PK for idempotent retry (23505 conflict = success).',
      rls:
        'All SOP reads/writes are org-scoped via RLS (migration 00002). Use the user-scoped Supabase client (src/lib/supabase/server.ts); the admin client bypasses RLS and is reserved for idempotent / cross-org operations.',
      versions:
        'Editing a published SOP creates a draft of the next version; publishing it makes it the one workers see and keeps the earlier version on record.',
    },
  }
}
