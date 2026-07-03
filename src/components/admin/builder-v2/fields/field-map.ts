/**
 * Phase 26 Plan 26-06 (P14, D-01) — the per-block field→pattern registry.
 *
 * THE REACHABILITY SOURCE OF TRUTH. For every registered block type, this maps
 * each Puck-editable field (the exact key set from `puck-config.tsx` `fields:`)
 * to one of the five bespoke interaction patterns from the UI-SPEC:
 *
 *   A — inline contentEditable text/textarea   (InlineText)
 *   B — inline enum chip (cycle ≤3 / menu >3)   (EnumChip)
 *   C — anchored array / multi-field panel      (26-07)
 *   D — inline editable numeric/string token    (InlineToken)
 *   E — media grid + medium picker              (26-09)
 *
 * The hard SPEC rule: **no field editable under Puck may become unreachable.**
 * `field-map.spec.ts` reads the live `puck-config.tsx` and asserts, per block,
 * that the FIELD_MAP field set === the Puck `fields:` key set (0 dropped fields).
 * This wave IMPLEMENTS A/B/D; C/E are declared here so 26-07/26-09 build them
 * and the phase-level `unreachable === 0` parity gate has its checklist.
 *
 * PURE module (data + one pure helper) — no React/`@/` runtime imports, so the
 * parity spec can import it in-process (the phase26 project has no `@/` alias
 * and cannot load React barrels). Field VALIDATION lives in `field-commit.ts`
 * (which pulls the block `*PropsSchema` and is React-coupled).
 */

// Type-only import — erased at compile, pulls no React barrel at runtime.
import type { BlockType } from '@/lib/builder/block-registry'

export type FieldPattern = 'A' | 'B' | 'C' | 'D' | 'E'

/** A single Puck-editable field routed to its bespoke pattern. */
export interface FieldSpec {
  field: string
  pattern: FieldPattern
  /** Pattern B only — enum options (value + human label), transcribed from puck-config. */
  options?: readonly { value: unknown; label: string }[]
  /** Pattern D only — true when the token holds a number (else a string token, e.g. unit). */
  numeric?: boolean
}

/**
 * Per-block field→pattern map. The `field` keys MUST match the block's
 * `puck-config.tsx` `fields:` object exactly (parity-tested).
 */
export const FIELD_MAP: Record<BlockType, readonly FieldSpec[]> = {
  TextBlock: [{ field: 'content', pattern: 'A' }],
  HeadingBlock: [
    { field: 'text', pattern: 'A' },
    {
      field: 'level',
      pattern: 'B',
      options: [
        { value: 'h2', label: 'H2' },
        { value: 'h3', label: 'H3' },
      ],
    },
  ],
  PhotoBlock: [
    { field: 'src', pattern: 'E' },
    { field: 'alt', pattern: 'C' },
    { field: 'caption', pattern: 'A' },
  ],
  CalloutBlock: [
    { field: 'title', pattern: 'A' },
    { field: 'body', pattern: 'A' },
  ],
  StepBlock: [
    { field: 'number', pattern: 'D', numeric: true },
    { field: 'text', pattern: 'A' },
  ],
  HazardCardBlock: [
    { field: 'title', pattern: 'A' },
    { field: 'body', pattern: 'A' },
    {
      field: 'severity',
      pattern: 'B',
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'warning', label: 'Warning' },
        { value: 'notice', label: 'Notice' },
      ],
    },
  ],
  PPECardBlock: [
    { field: 'title', pattern: 'A' },
    { field: 'items', pattern: 'C' },
  ],
  MeasurementBlock: [
    { field: 'label', pattern: 'A' },
    { field: 'unit', pattern: 'D', numeric: false },
    {
      field: 'voiceEnabled',
      pattern: 'B',
      options: [
        { value: true, label: 'On' },
        { value: false, label: 'Off' },
      ],
    },
    { field: 'hint', pattern: 'A' },
  ],
  DecisionBlock: [
    { field: 'question', pattern: 'A' },
    { field: 'options', pattern: 'C' },
  ],
  EscalateBlock: [
    { field: 'title', pattern: 'A' },
    { field: 'reason', pattern: 'A' },
    {
      field: 'escalationMode',
      pattern: 'B',
      options: [
        { value: 'form', label: 'Form (default)' },
        { value: 'alert', label: 'Alert' },
        { value: 'lock', label: 'Lock' },
      ],
    },
  ],
  SignOffBlock: [
    { field: 'title', pattern: 'A' },
    {
      field: 'requiredRole',
      pattern: 'B',
      options: [
        { value: 'supervisor', label: 'Supervisor' },
        { value: 'safety_manager', label: 'Safety manager' },
        { value: 'admin', label: 'Admin' },
      ],
    },
    { field: 'acknowledgementText', pattern: 'A' },
  ],
  ZoneBlock: [
    { field: 'label', pattern: 'A' },
    {
      field: 'zoneType',
      pattern: 'B',
      options: [
        { value: 'danger', label: 'Danger' },
        { value: 'warning', label: 'Warning' },
        { value: 'safe', label: 'Safe' },
        { value: 'pedestrian', label: 'Pedestrian' },
      ],
    },
    { field: 'notes', pattern: 'A' },
  ],
  InspectBlock: [
    { field: 'title', pattern: 'A' },
    { field: 'items', pattern: 'C' },
  ],
  VoiceNoteBlock: [
    { field: 'prompt', pattern: 'A' },
    {
      field: 'language',
      pattern: 'B',
      options: [
        { value: 'en-NZ', label: 'English (NZ)' },
        { value: 'en-AU', label: 'English (AU)' },
        { value: 'en-US', label: 'English (US)' },
      ],
    },
    { field: 'maxDurationSec', pattern: 'D', numeric: true },
  ],
  ModelBlock: [{ field: 'assetUrl', pattern: 'C' }],
  StepWithPhotosBlock: [
    { field: 'number', pattern: 'D', numeric: true },
    { field: 'text', pattern: 'A' },
    { field: 'photos', pattern: 'E' },
    {
      field: 'layout',
      pattern: 'B',
      options: [
        { value: 'right', label: 'Photo right of step' },
        { value: 'grid-2', label: '2-col grid below' },
        { value: 'grid-3', label: '3-col grid below' },
        { value: 'grid-4', label: '4-col grid below' },
      ],
    },
  ],
  PhotoGridBlock: [
    { field: 'items', pattern: 'E' },
    {
      field: 'columns',
      pattern: 'B',
      options: [
        { value: '2', label: '2 columns' },
        { value: '3', label: '3 columns' },
        { value: '4', label: '4 columns' },
      ],
    },
  ],
}

/**
 * Semantic accent (CSS var) per block, driving the EnumChip pill colour
 * (UI-SPEC §Color reserved-for). Edit chrome defaults to the interactive
 * step-blue; blocks with a strong safety semantic use their reserved hue.
 */
export const ACCENT_BY_TYPE: Partial<Record<BlockType, string>> = {
  HazardCardBlock: 'var(--accent-hazard, #ef4444)',
  EscalateBlock: 'var(--accent-hazard, #ef4444)',
  MeasurementBlock: 'var(--accent-measure, #f97316)',
  DecisionBlock: 'var(--accent-decision, #ec4899)',
  SignOffBlock: 'var(--accent-signoff, #fbbf24)',
  StepBlock: 'var(--accent-step, #3b82f6)',
  StepWithPhotosBlock: 'var(--accent-step, #3b82f6)',
}

/** Default edit-chrome accent (interactive step-blue) — UI-SPEC blue-does-double-duty. */
export const DEFAULT_ACCENT = 'var(--accent-step, #3b82f6)'

/**
 * Pattern B cycle logic (pure): given the current value, return the next enum
 * option value, wrapping around. Used by EnumChip's ≤3-option cycle-on-click
 * AND asserted directly by the field-inline-patterns harness.
 */
export function nextEnumValue(
  current: unknown,
  options: readonly { value: unknown; label: string }[]
): unknown {
  if (options.length === 0) return current
  const idx = options.findIndex((o) => o.value === current)
  return options[(idx + 1) % options.length].value
}
