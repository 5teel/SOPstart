'use server'

/**
 * SOP schema introspection — canonical AI-facing description of the SOP
 * data model.
 *
 * An AI agent (or any external integration) can call this once and get
 * everything needed to author a valid SOP:
 *   - all block types + their prop schemas (JSON-Schema shape)
 *   - all string enums (SopStatus, SourceType, SectionRenderFamily, …)
 *   - supported layout_version values
 *   - per-block constraints (min/max length, required fields, etc.)
 *
 * Consumed by GET /api/schema. No auth required — the response is
 * schema metadata, not tenant data. No RLS concerns.
 *
 * When adding a new block type, enum value, or prop constraint, it MUST
 * be reflected here — this file is the single source of truth the AI
 * relies on. The introspection endpoint is the "API contract" layer; if
 * the runtime schema drifts from what this returns, AI writes will fail.
 */

import { z, toJSONSchema } from 'zod'
import {
  TextBlockPropsSchema,
  HeadingBlockPropsSchema,
  PhotoBlockPropsSchema,
  CalloutBlockPropsSchema,
  StepBlockPropsSchema,
  HazardCardBlockPropsSchema,
  PPECardBlockPropsSchema,
  MeasurementBlockPropsSchema,
  DecisionBlockPropsSchema,
  EscalateBlockPropsSchema,
  SignOffBlockPropsSchema,
  ZoneBlockPropsSchema,
  InspectBlockPropsSchema,
  VoiceNoteBlockPropsSchema,
  ModelBlockPropsSchema,
} from '@/components/sop/blocks'
import { BlockContentSchema } from '@/lib/validators/blocks'
import {
  StepDataSchema,
  SignOffDecisionSchema,
} from '@/lib/validators/completions'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'
import { SUPPORTED_LAYOUT_VERSIONS } from '@/lib/builder/supported-versions'

// Inline mirror of the SopStatus / SourceType / etc. unions in src/types/sop.ts.
// Duplication is deliberate: the TypeScript unions exist for compile-time
// inference; the arrays below are runtime-queryable by an AI.
const SOP_STATUSES = ['uploading', 'parsing', 'draft', 'published'] as const
const PARSE_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const
const SOURCE_FILE_TYPES = ['docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt', 'video'] as const
const INPUT_TYPES = ['upload', 'scan', 'url', 'video_file', 'youtube_url'] as const
const COMPLETION_STATUSES = ['pending_sign_off', 'signed_off', 'rejected'] as const
const SOURCE_TYPES = ['uploaded', 'blank', 'ai', 'template'] as const
const SECTION_RENDER_FAMILIES = [
  'hazard', 'ppe', 'steps', 'content', 'signoff', 'emergency', 'custom',
] as const
const VIDEO_PROCESSING_STAGES = [
  'uploading', 'extracting_audio', 'transcribing', 'structuring',
  'verifying', 'completed', 'failed',
] as const

// Registry of the 7 canonical block types. Each entry pairs the Puck-facing
// props schema with a plain-English description and a minimal valid example
// — enough for an AI to author a block without reading source.
const BLOCK_REGISTRY: Record<string, {
  schema: z.ZodTypeAny
  description: string
  example: Record<string, unknown>
}> = {
  TextBlock: {
    schema: TextBlockPropsSchema,
    description: 'Paragraph / markdown-table text (1-10,000 chars).',
    example: { content: 'Inspect guard for damage before each shift.' },
  },
  HeadingBlock: {
    schema: HeadingBlockPropsSchema,
    description: 'Section heading - h2 or h3 in steel-100 palette.',
    example: { level: 'h2', text: 'Pre-start checklist' },
  },
  PhotoBlock: {
    schema: PhotoBlockPropsSchema,
    description: 'Inline SOP image by storage path with optional alt text.',
    example: { src: 'org_id/sop_id/.../image.jpg', alt: 'Guard in place' },
  },
  CalloutBlock: {
    schema: CalloutBlockPropsSchema,
    description: 'Amber callout for non-critical reminders.',
    example: { text: 'Remember to wear cut-resistant gloves.' },
  },
  StepBlock: {
    schema: StepBlockPropsSchema,
    description: 'Single numbered procedural step.',
    example: { number: 1, text: 'Lower the guard until it clicks.' },
  },
  HazardCardBlock: {
    schema: HazardCardBlockPropsSchema,
    description: 'Red hazard card - severity + bullet list.',
    example: { title: 'Crush hazard', severity: 'high', bullets: ['Keep hands clear of the ram'] },
  },
  PPECardBlock: {
    schema: PPECardBlockPropsSchema,
    description: 'Blue PPE card - required equipment chips.',
    example: { title: 'Required PPE', items: ['Cut-resistant gloves', 'Safety glasses'] },
  },
  MeasurementBlock: {
    schema: MeasurementBlockPropsSchema,
    description: 'Numeric measurement capture with unit, tolerance, and optional voice affordance.',
    example: { label: 'Blade gap', unit: 'mm', tolerance: { min: 0.5, max: 1.5, target: 1.0 }, voiceEnabled: true },
  },
  DecisionBlock: {
    schema: DecisionBlockPropsSchema,
    description: 'Branching decision with 2-6 options; each option may jump to a step or trigger escalation.',
    example: { question: 'Is the guard in place?', options: [{ label: 'Yes — continue' }, { label: 'No — escalate', isEscalation: true }] },
  },
  EscalateBlock: {
    schema: EscalateBlockPropsSchema,
    description: 'Hybrid escalation. Mode "alert" notifies supervisor, "lock" blocks NEXT until sign-off, "form" (default) opens a structured report.',
    example: { title: 'Lockout required', escalationMode: 'form', recipients: ['supervisor'] },
  },
  SignOffBlock: {
    schema: SignOffBlockPropsSchema,
    description: 'Supervisor sign-off capable block. Can unlock a previously locked EscalateBlock.',
    example: { title: 'Supervisor sign-off', requiredRole: 'supervisor' },
  },
  ZoneBlock: {
    schema: ZoneBlockPropsSchema,
    description: 'Color-coded zone label (danger/warning/safe/pedestrian).',
    example: { label: 'Forklift corridor', zoneType: 'danger' },
  },
  InspectBlock: {
    schema: InspectBlockPropsSchema,
    description: 'Inspection checklist. Each item may require a photo.',
    example: { title: 'Pre-start inspection', items: [{ label: 'Guards in place', requirePhoto: true }] },
  },
  VoiceNoteBlock: {
    schema: VoiceNoteBlockPropsSchema,
    description: 'Voice-note capture (Deepgram Nova-3). Transcript persisted to sop_voice_notes.',
    example: { prompt: 'Describe any unusual noise.', language: 'en-NZ', maxDurationSec: 60 },
  },
  ModelBlock: {
    schema: ModelBlockPropsSchema,
    description: '3D model viewer (feature-flagged via NEXT_PUBLIC_MODEL_BLOCK_ENABLED). Renders placeholder when disabled.',
    example: { assetUrl: 'https://storage.example.com/models/pump.glb', hotspots: [], defaultLayers: [] },
  },
}

type BlockDescriptor = {
  id: string
  description: string
  props_schema: unknown
  example_props: Record<string, unknown>
}

export type SopSchemaDescription = {
  version: 1
  layout: {
    supported_versions: readonly number[]
    data_schema: unknown
  }
  blocks: BlockDescriptor[]
  block_content_schema: unknown
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
    section_render_family: readonly string[]
    video_processing_stage: readonly string[]
  }
  notes: {
    storage_path_convention: string
    completion_immutability: string
    rls: string
  }
}

export async function describeSopSchema(): Promise<SopSchemaDescription> {
  const blocks: BlockDescriptor[] = Object.entries(BLOCK_REGISTRY).map(
    ([id, entry]) => ({
      id,
      description: entry.description,
      props_schema: toJSONSchema(entry.schema),
      example_props: entry.example,
    })
  )

  return {
    version: 1,
    layout: {
      supported_versions: SUPPORTED_LAYOUT_VERSIONS,
      data_schema: toJSONSchema(LayoutDataSchema),
    },
    blocks,
    block_content_schema: toJSONSchema(BlockContentSchema),
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
      section_render_family: SECTION_RENDER_FAMILIES,
      video_processing_stage: VIDEO_PROCESSING_STAGES,
    },
    notes: {
      storage_path_convention:
        "{organisation_id}/{sop_id}/{section_id?}/{step_id?}/{image_id} - org prefix enables RLS via `auth.jwt()->>'organisation_id'`.",
      completion_immutability:
        'sop_completions is append-only: no UPDATE/DELETE policies exist for authenticated role. Use client UUID as PK for idempotent retry (23505 conflict = success).',
      rls:
        'All SOP reads/writes are org-scoped via RLS (migration 00002). Use the user-scoped Supabase client (src/lib/supabase/server.ts); the admin client bypasses RLS and is reserved for idempotent / cross-org operations.',
    },
  }
}
