/**
 * Phase 26 Plan 26-06 (P14, T-26-06-01) — the validated, lossless field-commit
 * path shared by the bespoke A/B/D field controls.
 *
 * Every EnumChip / InlineToken / InlineText commit routes through here:
 *   1. coerce the raw control value per the field's pattern (D-numeric → number),
 *   2. build the candidate component props (meta stripped),
 *   3. validate the WHOLE candidate against the block's `*PropsSchema` Zod,
 *   4. on success → spread-merge via the lossless reducer (junctionId /
 *      block_provenance / unknown agent keys survive — R7); on failure → return
 *      the content UNCHANGED (invalid input keeps the prior value).
 *
 * React-coupled (pulls the block `*PropsSchema` from the components barrel), so
 * behavioural tests exercise it through the tsx subprocess harness (the phase26
 * project has no `@/` alias + can't load React/CSS in-process).
 */
import type { ZodType } from 'zod'
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
  StepWithPhotosBlockPropsSchema,
  PhotoGridBlockPropsSchema,
} from '@/components/sop/blocks'
import { VisualBlockPropsSchema } from '@/components/admin/builder-v2/visual/media-adapter'
import { stripMeta, type BlockType } from '@/lib/builder/block-registry'
import { updateBlockProps, type LayoutItem } from '@/lib/builder/content-ops'
import { FIELD_MAP } from './field-map'

/** Per-block props validators (the write-boundary Zod, reused as the field gate). */
export const SCHEMA_BY_TYPE: Record<BlockType, ZodType> = {
  TextBlock: TextBlockPropsSchema,
  HeadingBlock: HeadingBlockPropsSchema,
  PhotoBlock: PhotoBlockPropsSchema,
  CalloutBlock: CalloutBlockPropsSchema,
  StepBlock: StepBlockPropsSchema,
  HazardCardBlock: HazardCardBlockPropsSchema,
  PPECardBlock: PPECardBlockPropsSchema,
  MeasurementBlock: MeasurementBlockPropsSchema,
  DecisionBlock: DecisionBlockPropsSchema,
  EscalateBlock: EscalateBlockPropsSchema,
  SignOffBlock: SignOffBlockPropsSchema,
  ZoneBlock: ZoneBlockPropsSchema,
  InspectBlock: InspectBlockPropsSchema,
  VoiceNoteBlock: VoiceNoteBlockPropsSchema,
  ModelBlock: ModelBlockPropsSchema,
  StepWithPhotosBlock: StepWithPhotosBlockPropsSchema,
  PhotoGridBlock: PhotoGridBlockPropsSchema,
  VisualBlock: VisualBlockPropsSchema,
}

/** A sentinel returned when coercion itself rejects the raw value (before Zod). */
const INVALID = Symbol('invalid-field-value')

/**
 * Coerce a raw control value to the field's stored type. Text/enum pass through
 * (the control already yields the correct type); a numeric D-token parses the
 * string — empty or non-finite → INVALID so the prior value is kept.
 */
function coerce(numeric: boolean | undefined, raw: unknown): unknown | typeof INVALID {
  if (!numeric) return raw
  const s = String(raw).trim()
  if (s === '') return INVALID
  const n = Number(s)
  return Number.isFinite(n) ? n : INVALID
}

/**
 * Validate + merge a single field edit into `content`. Returns a NEW content
 * array on success, or the SAME array (unchanged) when the value is invalid.
 */
export function commitFieldToContent(
  content: LayoutItem[],
  id: string,
  type: BlockType,
  field: string,
  rawValue: unknown
): LayoutItem[] {
  const spec = FIELD_MAP[type]?.find((f) => f.field === field)
  if (!spec) return content // unknown field — no-op

  const value = coerce(spec.numeric, rawValue)
  if (value === INVALID) return content

  const item = content.find((it) => it.props.id === id)
  if (!item) return content

  const schema = SCHEMA_BY_TYPE[type]
  const candidate = { ...stripMeta(item.props), [field]: value }
  if (schema && !schema.safeParse(candidate).success) return content // Zod-guarded

  return updateBlockProps(content, id, { [field]: value })
}

/**
 * Would committing `value` to `field` pass the block's `*PropsSchema`? Used by
 * the Pattern-C FieldPanel to surface an inline validity message (e.g. Decision
 * `options` below the Zod min of 2) WITHOUT mutating content — the actual write
 * still routes through `commitFieldToContent` (single validated path).
 */
export function isFieldValueValid(
  props: Record<string, unknown>,
  type: BlockType,
  field: string,
  value: unknown
): boolean {
  const schema = SCHEMA_BY_TYPE[type]
  if (!schema) return true
  const candidate = { ...stripMeta(props), [field]: value }
  return schema.safeParse(candidate).success
}
